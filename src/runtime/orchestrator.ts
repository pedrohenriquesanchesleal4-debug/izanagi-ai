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
import { Healer } from './recovery/healing.js';
import { LearningEngine } from './evolution/learning.js';
import { AgentFactory } from './factories/agent-factory.js';
import { SkillFactory } from './factories/skill-factory.js';
import { ModelRouter } from './model/router.js';
import { validateArtifact } from './contracts/artifacts.js';
import { PhaseTokenBudget, defaultWeights } from './token/budget.js';

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
  artifacts: Map<string, { kind: string; content: unknown; valid: boolean; score: number }>;
  /** Token Budget 2.0 — orçamento por fase (planning/execution/evaluation/recovery). */
  budget: PhaseTokenBudget;
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
  private tokensUsed = 0;

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
    const startedAt = Date.now();
    this.tokensUsed = 0;
    const tokensUsed = () => this.tokensUsed;

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
    if (relevant.length > 0 && this.opts.verbose) {
      console.log(`  \x1b[33m⚠\x1b[0m ${relevant.length} padrão(ões) de falha conhecido(s) na memória (${relevant.map((p) => p.pattern).join(', ')})`);
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
    const agentFactory = new AgentFactory(resolver);
    const agentScore = resolver.rankAgents(this.opts.task, agentIds(), 3);
    if (agentScore.length === 0 || agentScore[0].finalScore < 0.25) {
      try {
        const drafted = agentFactory.generate({ requirement: this.opts.task });
        if (drafted.validation.valid && this.opts.verbose) {
          console.log(`  \x1b[35m⚡\x1b[0m Agent Factory gerou e validou agente especializado: ${drafted.genome.name}`);
        }
      } catch {
        // Ignora se não for possível gerar automaticamente
      }
    }
    if (agentScore.length > 0) {
      const best = agentScore[0];
      trace.markAgent(best.candidate);
      if (this.opts.verbose) {
        console.log(`  \x1b[32m✔\x1b[0m Adaptive routing: melhor agente ${best.candidate} (score ${best.finalScore}) — ${best.reasons.join(', ')}`);
      }
    }

    // Execution com self-healing
    const phaseBudget = new PhaseTokenBudget(graph.budget.maxTokens, defaultWeights(complexity));
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
      budget: phaseBudget,
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

      // Token Budget 2.0: fase de recovery esgotada → aborta (impede loop)
      if (phaseBudget.exhausted('recovery')) {
        const node = workingGraph.nodes.find((n) => n.id === failure.nodeId);
        if (node) {
          node.status = 'failed';
          node.error = 'orçamento de tokens da fase recovery esgotado';
        }
        const abortHeal: HealingAction = {
          id: `heal-${Date.now().toString(36)}-${failure.nodeId}`,
          kind: 'abort',
          failureKind: 'non-recoverable',
          message: 'orçamento de tokens da fase recovery esgotado — abortando',
          nodeId: failure.nodeId,
          createdAt: new Date().toISOString(),
        };
        healing.push(abortHeal);
        trace.span(`healing:${abortHeal.kind}`, 'healing', { failureKind: abortHeal.failureKind, message: abortHeal.message })(false, abortHeal.message);
        break;
      }

      // Self-healing
      const healer = new Healer();
      const elapsed = Date.now() - startedAt;
      const decision = healer.heal({
        nodeId: failure.nodeId,
        agent: failure.agent,
        skill: failure.skill,
        error: failure.error,
        attempt: attempts,
        maxAttempts,
        elapsedMs: elapsed,
        maxTimeMs: workingGraph.budget.maxTimeMs,
        tokensUsed: tokensUsed(),
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

      // skill_replacement / handoff: aplica a substituição ao nó antes de reprocessar
      if ((decision.action.kind === 'skill_replacement' || decision.action.kind === 'handoff') && decision.replacement) {
        const node = workingGraph.nodes.find((n) => n.id === failure.nodeId);
        if (node) {
          if (decision.replacement.agent) node.agent = decision.replacement.agent;
          if (decision.replacement.skill) node.skills = [decision.replacement.skill];
          node.error = undefined;
        }
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
    const testResults = Array.from(ctx.artifacts.values()).find((a) => a.kind === 'test-results');
    const testsFailed = testResults ? (testResults.content as { failed?: number }).failed ?? 0 : 0;
    const scoredArtifacts = Array.from(ctx.artifacts.values()).filter((a) => a.valid);

    finalEvaluation = evaluator.buildReport({
      taskId: trace.runId,
      task: this.opts.task,
      agentId: this.opts.primaryAgent,
      metrics: {
        // correctness derivada do melhor artefato validado (score do validador),
        // não de métrica inventada
        correctness: scoredArtifacts.length > 0
          ? Math.max(...scoredArtifacts.map((a) => a.score))
          : ctx.artifacts.has('implementation') ? 0.5 : 0.3,
        artifactValidity: artifacts.length > 0 ? artifacts.filter((a) => a.valid).length / artifacts.length : 0.3,
        security: this.opts.category === 'security_audit' ? 0.9 : undefined,
      },
      tests: { passed: testsFailed > 0 ? 0 : 1, failed: testsFailed },
      regressions: testsFailed > 0 ? [`${testsFailed} teste(s) falhando (test-results)`] : [],
      recommendations: ctx.artifacts.has('critique') ? ['crítica adversarial consumida; revisar achados no artefato critique'] : [],
    });
    closeEval();

    // Learning
    const closeLearn = trace.span('learning', 'memory');
    const learning = new LearningEngine(memory);
    learning.process(finalEvaluation, {
      agentId: this.opts.primaryAgent,
      skillIds: this.opts.skillChain,
      tokens: tokensUsed(),
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
      budget: phaseBudget.summary(),
    });

    if (this.opts.verbose) {
      console.log(`\n  \x1b[90mTrace salvo:\x1b[0m ${path.relative(this.opts.baseDir, file)}`);
      const usage = phaseBudget.usage();
      console.log(`  \x1b[90mToken budget por fase:\x1b[0m ${usage.map((u: { phase: string; spent: number; allocated: number; exhausted: boolean }) => `${u.phase}=${u.spent}/${u.allocated}${u.exhausted ? ' (max)' : ''}`).join('  ')}`);
      if (finalEvaluation) {
        console.log(`  \x1b[90mAvaliação:\x1b[0m ${finalEvaluation.verdict} (score ${finalEvaluation.score.toFixed(2)})`);
      }
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
      if (result.tokens) {
        ctx.trace.addTokens(result.tokens, Math.round(result.tokens * 0.6));
        this.tokensUsed += result.tokens;
        // Retry consome a fase recovery, não execution
        const phase = node.attempts && node.attempts > 1 ? 'recovery' : 'execution';
        if (!ctx.budget.spend(phase, result.tokens)) {
          node.status = 'failed';
          node.error = `orçamento de tokens da fase ${phase} excedido`;
          closeSpan(false, node.error);
          return { status: 'error', nodeId: node.id, agent: node.agent, skill: node.skills?.[0], error: node.error };
        }
      }
      if (result.model) ctx.trace.markTool(`model:${result.model}`);

      // Validação de artefato
      const validation = validateArtifact(result.kind as never, result.content);
      ctx.artifacts.set(node.id, { kind: result.kind, content: result.content, valid: validation.valid, score: validation.score });
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
    'discovery', 'product-reasoner', 'architect', 'security', 'database', 'pm', 'senior-engineer',
    'qa', 'adversarial-critic', 'bug-hunter', 'automation-engineer', 'animation',
    'researcher', 'devops', 'techlead', 'docs', 'professor', 'agent-architect', 'skill-architect',
  ];
}
