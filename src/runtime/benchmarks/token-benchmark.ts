/**
 * Token Benchmark: runtime antigo vs runtime novo, na dimensão CUSTO.
 *
 * O que ele mede, exatamente: o PLANO. Para cada objetivo representativo,
 * compara o que o caminho legado (Planner por categoria, um modelo para o run
 * inteiro) reservaria contra o que o Commander reserva (modo proporcional +
 * roteamento por papel). As grandezas comparadas são tetos declarados e preços
 * de catálogo, então o resultado é 100% determinístico e reproduzível.
 *
 * O que ele NÃO mede: qualidade da saída do modelo nem tokens realmente
 * consumidos numa execução real (isso depende do provider e aparece na
 * telemetria de cada run, via `izanagi budget <run-id>`). Confundir as duas
 * coisas seria exatamente o tipo de número inflado que este framework proíbe.
 */

import { Commander } from '../orchestration/commander.js';
import { Planner, templateForCategory } from '../orchestration/planner.js';
import { DEFAULT_PROVIDERS, ModelRouter } from '../model/router.js';
import { contractOf, type AgentRole } from '../contracts/task-contract.js';
import type { ExecutionGraph, ModelProvider } from '../types.js';

export interface TokenBenchmarkCase {
  id: string;
  objective: string;
  /** O que este caso existe para provar. */
  hypothesis: string;
}

export const TOKEN_BENCHMARK_CASES: TokenBenchmarkCase[] = [
  {
    id: 'trivial-conversion',
    objective: 'Converta 10 dólares para reais',
    hypothesis: 'tarefa trivial não deve montar grafo nem pagar preço de modelo premium',
  },
  {
    id: 'single-file-test',
    objective: 'Escreva um teste unitário para a função de soma',
    hypothesis: 'tarefa de um domínio deve rodar com um especialista, não com a suíte inteira',
  },
  {
    id: 'bugfix',
    objective: 'Corrigir o erro 500 intermitente no endpoint de login',
    hypothesis: 'bug de um domínio não precisa de crítica adversarial nem discovery',
  },
  {
    id: 'security-audit',
    objective: 'Auditar a segurança OWASP da API de pagamentos e propor remediação',
    hypothesis: 'auditoria é trabalho composto: grafo com verificação, sem cauda opcional',
  },
  {
    id: 'saas-fullstack',
    objective:
      'Construa um SaaS completo de cobrança com frontend Next.js, API backend, banco Postgres com migrations, auditoria de segurança OWASP e pipeline de deploy',
    hypothesis: 'projeto amplo justifica o modo autônomo completo, e é aqui que o legado ganha menos',
  },
];

export interface PlanMetrics {
  mode: string;
  /** Tarefas do grafo. */
  nodes: number;
  /** Tarefas que de fato chamam um modelo (gate/validator não chamam). */
  modelCalls: number;
  /** Soma dos tetos de token declarados. */
  maxTokens: number;
  /** Custo do teto em USD, com o roteamento daquele caminho. */
  maxCostUsd: number;
  byRole?: Record<AgentRole, number>;
}

export interface TokenBenchmarkRow {
  id: string;
  objective: string;
  hypothesis: string;
  legacy: PlanMetrics;
  commander: PlanMetrics;
  /** Redução de custo em [0,1]. Negativo = o novo caminho custa mais. */
  costReduction: number;
  /** Redução de chamadas de modelo em [0,1]. */
  callReduction: number;
  /** Redução do teto de tokens em [0,1]. */
  tokenReduction: number;
}

export interface TokenBenchmarkReport {
  createdAt: string;
  catalog: string[];
  rows: TokenBenchmarkRow[];
  totals: {
    legacyTokens: number;
    commanderTokens: number;
    legacyCostUsd: number;
    commanderCostUsd: number;
    legacyModelCalls: number;
    commanderModelCalls: number;
    costReduction: number;
    callReduction: number;
    tokenReduction: number;
  };
}

/** Nós que consomem modelo. Gate/validator são determinísticos e custam zero. */
function modelCallsOf(graph: ExecutionGraph): number {
  return graph.nodes.filter((n) => n.kind === 'agent' || n.kind === 'skill' || n.kind === 'evaluator').length;
}

/**
 * Métricas do caminho legado: template por categoria e UM modelo escolhido
 * para o run inteiro (era exatamente assim que o Orchestrator roteava antes).
 */
export function legacyMetrics(objective: string, router: ModelRouter): PlanMetrics {
  const complexity = ModelRouter.estimateComplexity(objective);
  const category = legacyCategoryOf(objective);
  const graph = new Planner().plan({
    task: objective,
    category,
    primaryAgent: 'senior-engineer',
    skillChain: [],
    workflow: templateForCategory(category),
  });
  const routed = router.route({
    task: objective,
    taskComplexity: complexity,
    reasoningRequirement: complexity >= 4 ? 'high' : complexity >= 3 ? 'medium' : 'low',
    risk: 0.2,
    tokenBudget: 16000,
    requiresTools: false,
  });
  const maxTokens = graph.nodes.reduce((acc, n) => acc + (n.tokenBudget ?? 0), 0);
  return {
    mode: 'legacy',
    nodes: graph.nodes.length,
    modelCalls: modelCallsOf(graph),
    maxTokens,
    maxCostUsd: ModelRouter.costUsd(routed.model, maxTokens * 0.7, maxTokens * 0.3),
  };
}

/**
 * Categoria pela heurística legada de `templateForCategory`: reproduz o
 * comportamento anterior (primeiro sinal encontrado vence), sem a ordem de
 * intenção que o Commander introduziu.
 */
function legacyCategoryOf(objective: string): string {
  const t = objective.toLowerCase();
  if (/saas|fullstack|sistema completo|app completo/.test(t)) return 'fullstack';
  if (/bug|erro|error|crash|debug/.test(t)) return 'debugging';
  if (/secur|seguran|owasp|vulnerab|audit/.test(t)) return 'security_audit';
  if (/arquitet|architect/.test(t)) return 'architecture';
  if (/automa|scrap|etl/.test(t)) return 'automacao';
  if (/frontend|react|component|css/.test(t)) return 'frontend';
  if (/database|banco de dados|sql|postgres/.test(t)) return 'database_design';
  if (/docker|deploy|pipeline|k8s/.test(t)) return 'devops_infra';
  if (/test|teste|qa/.test(t)) return 'testing';
  return 'implementation';
}

/** Métricas do caminho novo: modo proporcional + custo por papel. */
export function commanderMetrics(objective: string, router: ModelRouter): PlanMetrics {
  const plan = new Commander().plan({
    objective,
    estimateCostUsd: (role, tokens) => router.estimateCostForRole(role, tokens),
  });
  const byRole: Record<AgentRole, number> = { commander: 0, specialist: 0, worker: 0 };
  for (const c of plan.contracts) byRole[c.role] += c.budget.maxTokens;
  return {
    mode: plan.mode,
    nodes: plan.graph.nodes.length,
    modelCalls: modelCallsOf(plan.graph),
    maxTokens: plan.estimate.maxTokens,
    maxCostUsd: plan.estimate.maxCostUsd ?? 0,
    byRole,
  };
}

/**
 * Roda o benchmark contra o catálogo informado. Sem catálogo, usa o default
 * do ModelRouter (providers pagos + locais).
 */
export const PAID_CATALOG: ModelProvider[] = DEFAULT_PROVIDERS.filter((p) => ['openai', 'anthropic', 'google'].includes(p.id));

export function runTokenBenchmark(opts: { providers?: ModelProvider[]; cases?: TokenBenchmarkCase[] } = {}): TokenBenchmarkReport {
  // Catálogo pago por default: incluir Ollama/LM Studio (custo 0 declarado)
  // faria qualquer comparação de preço convergir para zero e esconder o que o
  // benchmark existe para medir.
  const providers = opts.providers ?? PAID_CATALOG;
  const router = new ModelRouter(providers);
  const cases = opts.cases ?? TOKEN_BENCHMARK_CASES;

  const rows: TokenBenchmarkRow[] = cases.map((c) => {
    const legacy = legacyMetrics(c.objective, router);
    const commander = commanderMetrics(c.objective, router);
    return {
      id: c.id,
      objective: c.objective,
      hypothesis: c.hypothesis,
      legacy,
      commander,
      costReduction: legacy.maxCostUsd > 0 ? 1 - commander.maxCostUsd / legacy.maxCostUsd : 0,
      callReduction: legacy.modelCalls > 0 ? 1 - commander.modelCalls / legacy.modelCalls : 0,
      tokenReduction: legacy.maxTokens > 0 ? 1 - commander.maxTokens / legacy.maxTokens : 0,
    };
  });

  const legacyTokens = rows.reduce((a, r) => a + r.legacy.maxTokens, 0);
  const commanderTokens = rows.reduce((a, r) => a + r.commander.maxTokens, 0);
  const legacyCostUsd = rows.reduce((a, r) => a + r.legacy.maxCostUsd, 0);
  const commanderCostUsd = rows.reduce((a, r) => a + r.commander.maxCostUsd, 0);
  const legacyModelCalls = rows.reduce((a, r) => a + r.legacy.modelCalls, 0);
  const commanderModelCalls = rows.reduce((a, r) => a + r.commander.modelCalls, 0);

  return {
    createdAt: new Date().toISOString(),
    catalog: providers.map((p) => p.id),
    rows,
    totals: {
      legacyTokens,
      commanderTokens,
      legacyCostUsd,
      commanderCostUsd,
      legacyModelCalls,
      commanderModelCalls,
      costReduction: legacyCostUsd > 0 ? 1 - commanderCostUsd / legacyCostUsd : 0,
      callReduction: legacyModelCalls > 0 ? 1 - commanderModelCalls / legacyModelCalls : 0,
      tokenReduction: legacyTokens > 0 ? 1 - commanderTokens / legacyTokens : 0,
    },
  };
}

/** Tabela legível para a CLI. */
export function formatTokenBenchmark(report: TokenBenchmarkReport): string {
  const lines: string[] = [];
  const pct = (v: number) => `${v >= 0 ? '' : '+'}${Math.abs(v * 100).toFixed(0)}%`;
  lines.push('caso                      modo         chamadas       tokens (teto)        custo do teto');
  lines.push('------------------------- ------------ -------------- -------------------- ---------------------');
  for (const r of report.rows) {
    const calls = `${r.legacy.modelCalls} -> ${r.commander.modelCalls}`;
    const tokens = `${r.legacy.maxTokens} -> ${r.commander.maxTokens}`;
    const cost = `$${r.legacy.maxCostUsd.toFixed(4)} -> $${r.commander.maxCostUsd.toFixed(4)}`;
    lines.push(
      `${r.id.padEnd(25)} ${r.commander.mode.padEnd(12)} ${calls.padEnd(14)} ${`${tokens} (${pct(r.tokenReduction)})`.padEnd(20)} ${cost} (${pct(r.costReduction)})`,
    );
  }
  lines.push('');
  lines.push(
    `TOTAL  chamadas ${report.totals.legacyModelCalls} -> ${report.totals.commanderModelCalls} (${pct(report.totals.callReduction)})  ·  ` +
    `tokens ${report.totals.legacyTokens} -> ${report.totals.commanderTokens} (${pct(report.totals.tokenReduction)})  ·  ` +
    `custo $${report.totals.legacyCostUsd.toFixed(4)} -> $${report.totals.commanderCostUsd.toFixed(4)} (${pct(report.totals.costReduction)})`,
  );
  lines.push('');
  lines.push('Leitura honesta: chamadas e tokens caem porque o modo é proporcional ao problema.');
  lines.push('O custo pode subir num caso isolado quando o papel exige um modelo melhor que o');
  lines.push('modelo único e barato que o caminho legado usava para tudo: isso é uma troca');
  lines.push('deliberada de qualidade por preço, não um bug.');
  return lines.join('\n');
}
