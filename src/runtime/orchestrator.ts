/**
 * Orchestrator — runtime de execução adaptativa.
 *
 * Fluxo:
 *   Task → Classify → Plan (graph) → Route (score agents/skills/model)
 *   → Execute nodes (serial/paralelo por batches) → Validate artifacts
 *   → Evaluate → Heal (se falhar) → Reflect/Learn → Trace persistido.
 *
 * Este módulo é headless: a CLI (`izanagi run`) fornece o producer real
 * (prompt compilado) e o consumer dos artefatos; o runtime cuida do estado.
 */

import path from 'path';
import type {
  EvaluationReport,
  ExecutionGraph,
  GraphNode,
  HealingAction,
  RunTrace,
} from './types.js';
import { TraceStore, Tracer } from './observability/tracer.js';
import { MemoryStore } from './memory/store.js';
import { EvaluationEngine } from './evaluation/engine.js';
import { Planner } from './orchestration/planner.js';
import { ExecutionGraphBuilder } from './orchestration/graph.js';
import { SkillResolver } from './routing/resolver.js';
import { CandidateScorer } from './routing/scorer.js';
import { Healer, isRecoverable } from './recovery/healing.js';
import { LearningEngine } from './evolution/learning.js';
import { ModelRouter } from './model/router.js';
import { validateArtifact } from './contracts/artifacts.js';

export interface OrchestratorOptions {
  baseDir: string;
  command: string;
  task: string;
  category: string;
  primaryAgent: string;
  skillChain: string[];
  /** Producer de artefato de um nó: recebe o nó e devolve conteúdo/resultado. */
  produce: (node: GraphNode, ctx: ExecuteCtx) => Promise<{ content: unknown; kind: string; tokens?: number; model?: string }> | { content: unknown; kind: string; tokens?: number; model?: string };
  /** Consumer de artefato validado (ex.: salvar em disco). */
  consume?: (node: GraphNode, artifact: { kind: string; content: unknown; valid: boolean }) => void;
  verbose?: boolean;
}

export interface ExecuteCtx {
  runId: string;
  task: string;
  category: string;
  primaryAgent: string;
  skillChain: string[];
  model: string;
  trace: Tracer;
  memory: MemoryStore;
  artifacts: Map<string, { kind: string; content: unknown; valid: boolean }>;
}

export interface OrchestrationResult {
  trace: RunTrace;
  traceFile: string;
  graph: ExecutionGraph;
  evaluation?: EvaluationReport;
  healing: HealingAction[];
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN';
  score: number;
}

export class Orchestrator {
  constructor(private readonly opts: OrchestratorOptions) {}

  /** Pontos de extensão (compatibilidade: permite injetar implementações). */
  private store?: TraceStore;
  private memory?: MemoryStore;

  setStore(store: TraceStore): void {
    this.store = store;
  }

  setMemory(memory: MemoryStore): void {
    this.memory = memory;
  }

  /** Executa o ciclo completo e retorna trace + avaliação. */
  async run(): Promise<OrchestrationResult> {
    const store = this.store ?? new TraceStore({ baseDir: this.opts.baseDir });
    const memory = this.memory ?? new MemoryStore({ baseDir: this.opts.baseDir });
    const trace = new Tracer(store, { task: this.opts.task, command: this.opts.command });
    const healing: HealingAction[] = [];

    // Model Routing
    const router = new ModelRouter();
    const complexity = ModelRouter.estimateComplexity(this.opts.task);
    const routed = router.route({
      task: this.opts.task,
      taskComplexity: complexity,
      reasoningRequirement: complexity >= 4 ? 'high' : complexity >= 3 ? 'medium' : 'low',
      risk: this.opts.category === 'security_audit' ? 0.8 : 0.2,
      tokenBudget: 16000,
      requiresTools: false,
    });
    trace.markTool(`model:${routed.provider}`);
    const closeModel = trace.span(`model-router:${routed.model.id}`, 'decision', { reasons: routed.reasons });
    closeModel();

    // Failure Memory check — padrões conhecidos antes de executar
    const closeMem = trace.span('memory:pattern-search', 'memory', { task: this.opts.task });
    const relevant = memory.findRelevantFailures(this.opts.task);
    closeMem(true);
    if (relevant.length > 0) {
      trace.addTokens(0, 0);
      if (this.opts.verbose) {
        console.log(`  \x1b[33m⚠\x1b[0m ${relevant.length} padrão(ões) de falha conhecido(s) na memória (${relevant.map((p) => p.pattern).join(', ')})`);
      }
    }

    // Planning
    const planner = new Planner();
    const closePlan = trace.span('planner', 'decision', { category: this.opts.category, complexity });
    let graph: ExecutionGraph;
    try {
      graph = planner.plan({
        task: this.opts.task,
        category: this.opts.category,
        primaryAgent: this.opts.primaryAgent,
        skillChain: this.opts.skillChain,
      });
      closePlan();
    } catch (err) {
      closePlan(false, err instanceof Error ? err.message : String(err));
      throw err;
    }

    // Adaptive routing: score agentes e skills
    const resolver = new SkillResolver({ baseDir: this.opts.baseDir, memory });
    const scorer = new CandidateScorer();
    const agentScore = resolver.rankAgents(this.opts.task, agentIds(), 3);
    if (agentScore.length > 0) {
      const best = agentScore[0];
      trace.markAgent(best.candidate);
      trace.addTokens(0, 0);
      if (this.opts.verbose) {
        console.log(`  \x1b[32m✔\x1b[0m Adaptive routing: melhor agente ${best.candidate} (score ${best.finalScore}) — ${best.reasons.join(', ')}`);
      }
    }

    // Execution com self-healing
    const ctx: ExecuteCtx = {
      runId: trace.runId,
      task: this.opts.task,
      category: this.opts.category,
      primaryAgent: this.opts.primaryAgent,
      skillChain: this.opts.skillChain,
      model: routed.model.id,
      trace,
      memory,
      artifacts: new Map(),
    };

    let finalEvaluation: EvaluationReport | undefined;
    const builder = new ExecutionGraphBuilder();
    let attempts = 0;
    const maxAttempts = graph.budget.maxAttempts;
    let workingGraph = graph;

    while (attempts < maxAttempts) {
      attempts++;
      const failure = await this.executeBatches(workingGraph, ctx);
      if (!failure) break;

      // Self-healing
      const healer = new Healer();
      const elapsed = Date.now() - Date.parse(trace.finish({}).startedAt);
      const decision = healer.heal({
        nodeId: failure.nodeId,
        agent: failure.agent,
        skill: failure.skill,
        error: failure.error,
        attempt: attempts,
        maxAttempts,
        elapsedMs: elapsed,
        maxTimeMs: workingGraph.budget.maxTimeMs,
        tokensUsed: trace.finish({}).tokens?.total ?? 0,
        maxTokens: workingGraph.budget.maxTokens,
        memory,
      });
      healing.push(decision.action);
      const closeHeal = trace.span(`healing:${decision.action.kind}`, 'healing', {
        failureKind: decision.action.failureKind,
        message: decision.action.message,
      });

      if (decision.action.kind === 'abort' || !decision.retryNow && !decision.replacement && decision.action.kind !== 'replan') {
        closeHeal(false, decision.abortReason ?? 'abort');
        // marca nó como falho e segue para avaliação
        const node = workingGraph.nodes.find((n) => n.id === failure.nodeId);
        if (node) node.status = 'failed';
        break;
      }

      // replan: reconstrói grafo
      if (decision.action.kind === 'replan') {
        workingGraph = planner.replan(workingGraph, failure.nodeId);
        closeHeal();
        continue;
      }
      closeHeal();
    }

    // Evaluation final
    const closeEval = trace.span('evaluation', 'evaluation');
    const evaluator = new EvaluationEngine();
    const artifacts = Array.from(ctx.artifacts.entries()).map(([id, a]) => ({
      name: id,
      kind: a.kind as never,
      valid: a.valid,
    }));
    const testsFailed = ctx.artifacts.has('test-results')
      ? (ctx.artifacts.get('test-results')!.content as { failed?: number }).failed ?? 0
      : 0;

    finalEvaluation = evaluator.buildReport({
      taskId: trace.runId,
      task: this.opts.task,
      agentId: this.opts.primaryAgent,
      metrics: {
        correctness: ctx.artifacts.has('implementation') ? 0.9 : 0.5,
        artifactValidity: artifacts.length > 0 ? artifacts.filter((a) => a.valid).length / artifacts.length : 0.3,
        security: this.opts.category === 'security_audit' ? 0.9 : undefined,
      },
      tests: { passed: testsFailed > 0 ? 0 : 1, failed: testsFailed },
      regressions: ctx.artifacts.has('critique') ? [] : [],
      recommendations: ctx.artifacts.has('critique') ? ['critique consumida pelo runtime'] : [],
    });
    closeEval();

    // Learning
    const closeLearn = trace.span('learning', 'memory');
    const learning = new LearningEngine(memory);
    learning.process(finalEvaluation, {
      agentId: this.opts.primaryAgent,
      skillIds: this.opts.skillChain,
      tokens: trace.finish({}).tokens?.total ?? 0,
    });
    closeLearn();
    memory.save();

    // Trace persistido
    const { trace: finalTrace, file } = trace.finishAndSave({
      graph: workingGraph,
      evaluation: finalEvaluation,
      healing,
      artifacts: artifacts.map((a) => ({ ...a, name: a.name })),
      model: routed.model.id,
    });

    if (this.opts.verbose) {
      console.log(`\n  \x1b[90mTrace salvo:\x1b[0m ${path.relative(this.opts.baseDir, file)}`);
    }

    return {
      trace: finalTrace,
      traceFile: file,
      graph: workingGraph,
      evaluation: finalEvaluation,
      healing,
      status: finalEvaluation.verdict,
      score: finalEvaluation.score,
    };
  }

  /**
   * Executa os batches em ordem, respeitando paralelismo e retries.
   * Retorna a primeira falha não resolvida (ou null).
   */
  private async executeBatches(
    graph: ExecutionGraph,
    ctx: ExecuteCtx,
  ): Promise<{ nodeId: string; agent?: string; skill?: string; error: string } | null> {
    for (const batch of graph.parallelBatches) {
      const results = await Promise.all(
        batch.map((nodeId) => this.executeNode(graph, nodeId, ctx)),
      );
      const firstFailure = results.find((r) => r && r.status === 'error') as
        | { nodeId: string; agent?: string; skill?: string; error: string; status: string }
        | undefined;
      if (firstFailure) {
        return { nodeId: firstFailure.nodeId, agent: firstFailure.agent, skill: firstFailure.skill, error: firstFailure.error };
      }
    }
    return null;
  }

  private async executeNode(
    graph: ExecutionGraph,
    nodeId: string,
    ctx: ExecuteCtx,
  ): Promise<{ status: 'ok' | 'error'; nodeId: string; agent?: string; skill?: string; error?: string } | undefined> {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return undefined;
    if (node.status === 'succeeded' || node.status === 'skipped') return undefined;

    node.status = 'running';
    node.startedAt = new Date().toISOString();
    node.attempts = (node.attempts ?? 0) + 1;

    const label = node.agent ?? node.skills?.join('+') ?? node.kind;
    if (node.agent) ctx.trace.markAgent(node.agent);
    if (node.skills) node.skills.forEach((s) => ctx.trace.markSkill(s));
    const closeSpan = ctx.trace.span(`node:${node.id}`, node.kind === 'evaluator' ? 'evaluation' : node.kind === 'agent' ? 'agent' : 'tool', {
      label,
      attempt: node.attempts,
    });

    try {
      if (node.kind === 'gate') {
        // Gate: valida artefato de dependências
        const depId = (node.dependencies ?? [])[0];
        const artifact = depId ? ctx.artifacts.get(depId) : undefined;
        const valid = artifact?.valid ?? false;
        if (valid) {
          node.status = 'succeeded';
          closeSpan(true);
          return { status: 'ok', nodeId: node.id };
        }
        node.status = 'failed';
        node.error = `gate "${node.id}" falhou: artefato de "${depId}" inválido`;
        closeSpan(false, node.error);
        return { status: 'error', nodeId: node.id, error: node.error, skill: node.validator };
      }

      const result = await this.opts.produce(node, ctx);
      if (result.tokens) ctx.trace.addTokens(result.tokens, Math.round(result.tokens * 0.6));
      if (result.model) ctx.trace.markTool(`model:${result.model}`);

      // Validação de artefato
      const validation = validateArtifact(result.kind as never, result.content);
      ctx.artifacts.set(node.id, { kind: result.kind, content: result.content, valid: validation.valid });
      this.opts.consume?.(node, { kind: result.kind, content: result.content, valid: validation.valid });

      if (!validation.valid) {
        node.status = 'failed';
        node.error = `validação falhou: ${validation.issues.slice(0, 3).join('; ')}`;
        closeSpan(false, node.error);
        return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
      }

      node.status = 'succeeded';
      node.endedAt = new Date().toISOString();
      node.durationMs = Date.now() - Date.parse(node.startedAt!);
      closeSpan(true);
      return { status: 'ok', nodeId: node.id };
    } catch (err) {
      node.status = 'failed';
      node.error = err instanceof Error ? err.message : String(err);
      closeSpan(false, node.error);
      return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
    }
  }
}

function agentIds(): string[] {
  return [
    'discovery', 'architect', 'security', 'database', 'pm', 'senior-engineer',
    'qa', 'adversarial-critic', 'bug-hunter', 'automation-engineer', 'animation',
    'researcher', 'devops', 'techlead', 'docs', 'professor',
  ];
}
