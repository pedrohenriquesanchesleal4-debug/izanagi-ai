/**
 * Commander (LEVEL 0): o cérebro executivo do runtime.
 *
 * Recebe um objetivo, classifica complexidade e domínios, escolhe o MODO de
 * execução (direct/assisted/orchestrated/autonomous), gera um Task Contract
 * por tarefa com critérios de aceite verificáveis, monta o Task Graph e
 * estima custo antes de qualquer execução.
 *
 * O Commander NÃO executa tarefa: ele decide e delega. E é determinístico por
 * padrão (regra "Deterministic Core"): classificação, modo, contratos,
 * critérios e estimativa saem de heurísticas e dos schemas de artefato já
 * existentes, sem nenhuma chamada de modelo. Uma decomposição assistida por
 * LLM pode ser injetada via `decompose`, mas o resultado passa por validação
 * determinística e cai no template quando não conforma.
 *
 * Ganho central: antes, TODA tarefa (inclusive "converta 10 dólares para
 * reais") virava um grafo de 3 a 9 nós com avaliação e crítica. Agora o modo
 * é proporcional ao problema.
 */

import crypto from 'crypto';
import type { ExecutionGraph, GraphNode } from '../types.js';
import { ExecutionGraphBuilder } from './graph.js';
import { Planner, templateForCategory } from './planner.js';
import { ARTIFACT_SCHEMAS } from '../contracts/artifacts.js';
import {
  AGENT_ROLES,
  attachContract,
  contractFromNode,
  contractOf,
  defaultRoleForNode,
  validateContract,
  type AcceptanceCriterion,
  type AgentRole,
  type DeterministicCheck,
  type ExecutionMode,
  type TaskContract,
} from '../contracts/task-contract.js';
import type { AgentCapabilityRegistry } from '../registry/capabilities.js';
import { ModelRouter } from '../model/router.js';
import { detectDomains, type Domain } from './domains.js';
import { DELIVER_NODE_ID, deliverNode } from './delivery.js';
import { SURVEY_NODE_ID, surveyNode, withSurveyAtHead } from './grounding.js';

export type { Domain } from './domains.js';

/* ============================ CLASSIFICAÇÃO ============================ */

export interface Classification {
  /** 1 (trivial) a 5 (projeto inteiro). */
  complexity: 1 | 2 | 3 | 4 | 5;
  domains: Domain[];
  /** Categoria legada usada pelos templates do Planner. */
  category: string;
  reasoning: 'low' | 'medium' | 'high';
  /** Risco em [0,1]: alto quando o objetivo toca segurança/dados sensíveis. */
  risk: number;
  reasons: string[];
}

/** Verbos que indicam pergunta/consulta em vez de construção. */
const QUESTION_SIGNALS = /^\s*(qual|quais|quanto|quando|onde|quem|como|por que|porque|o que|what|which|how much|how many|when|where|who)\b/i;
const TRIVIAL_SIGNALS = /convert|calcul|traduz|translate|format|renomeia|liste|list|resum|summar|explique|explain/i;
const BIG_SIGNALS = /saas|sistema completo|app completo|fullstack|full-stack|monorepo|plataforma|do zero|end.?to.?end/i;

/**
 * Classifica o objetivo. Determinístico e barato: nenhuma chamada de modelo,
 * então classificar não custa token nenhum.
 */
export function classify(objective: string): Classification {
  const text = objective.trim();
  const reasons: string[] = [];
  const domains: Domain[] = detectDomains(text);

  const words = text.split(/\s+/).filter(Boolean).length;
  let score = 1;
  if (domains.length >= 2) {
    score += domains.length - 1;
    reasons.push(`${domains.length} domínios detectados: ${domains.join(', ')}`);
  }
  if (words > 40) {
    score += 1;
    reasons.push(`enunciado longo (${words} palavras)`);
  }
  if (BIG_SIGNALS.test(text)) {
    score += 2;
    reasons.push('sinal de projeto inteiro (saas/fullstack/do zero)');
  }
  if (QUESTION_SIGNALS.test(text) && words <= 25) {
    score -= 1;
    reasons.push('formato de pergunta curta');
  }
  if (TRIVIAL_SIGNALS.test(text) && words <= 20 && domains.length <= 1) {
    score -= 1;
    reasons.push('verbo de transformação simples');
  }

  const complexity = Math.min(5, Math.max(1, Math.round(score))) as Classification['complexity'];
  const risk = domains.includes('security') ? 0.8 : domains.includes('database') || domains.includes('devops') ? 0.4 : 0.2;
  const reasoning: Classification['reasoning'] = complexity >= 4 ? 'high' : complexity >= 3 ? 'medium' : 'low';

  return { complexity, domains, category: categoryFor(domains, text), reasoning, risk, reasons };
}

/**
 * Ordem de INTENÇÃO, não de detecção. "Auditar a segurança da API" cita API e
 * segurança; o trabalho é auditoria de segurança, não construção de backend.
 * Sem esta ordem, o primeiro domínio da tabela de sinais venceria por acidente
 * de ordenação e escolheria o template errado.
 */
const INTENT_PRIORITY: Domain[] = [
  'debugging', 'security', 'architecture', 'automation', 'database',
  'devops', 'testing', 'frontend', 'backend', 'research', 'docs',
];

/** Mapeia domínios detectados para a categoria de template já existente no Planner. */
function categoryFor(domains: Domain[], text: string): string {
  if (BIG_SIGNALS.test(text)) return 'fullstack';
  const first = INTENT_PRIORITY.find((d) => domains.includes(d)) ?? domains[0];
  switch (first) {
    case 'debugging': return 'debugging';
    case 'security': return 'security_audit';
    case 'architecture': return 'architecture';
    case 'automation': return 'automacao';
    case 'frontend': return 'frontend';
    case 'database': return 'database_design';
    case 'devops': return 'devops_infra';
    case 'testing': return 'testing';
    default: return 'implementation';
  }
}

/**
 * Escolhe o modo proporcional ao problema. Override explícito sempre vence.
 *
 * `hints.knownFailures` é o sinal da memória: quando o runtime já falhou antes
 * em algo parecido, o problema se mostrou mais difícil do que a classificação
 * léxica sugere, e o modo sobe UM degrau. Um degrau só — memória é evidência
 * de dificuldade, não licença para gastar o modo mais caro.
 */
export function decideMode(
  classification: Classification,
  override?: ExecutionMode,
  hints: { knownFailures?: number } = {},
): { mode: ExecutionMode; reason: string } {
  if (override) return { mode: override, reason: `modo forçado pelo chamador (--mode ${override})` };
  const { complexity, domains } = classification;
  const base: { mode: ExecutionMode; reason: string } =
    complexity <= 1 && domains.length <= 1
      ? { mode: 'direct', reason: 'tarefa trivial: uma chamada de modelo resolve, sem grafo' }
      : complexity === 2
        ? { mode: 'assisted', reason: 'tarefa simples: um especialista + verificação determinística' }
        : complexity >= 5 || domains.length >= 3
          ? { mode: 'autonomous', reason: `problema amplo (complexidade ${complexity}, ${domains.length} domínios): grafo + healing + replan` }
          : { mode: 'orchestrated', reason: `problema composto (complexidade ${complexity}): grafo com verificação` };

  const known = hints.knownFailures ?? 0;
  const next = MODE_LADDER[MODE_LADDER.indexOf(base.mode) + 1];
  if (known > 0 && next) {
    return {
      mode: next,
      reason: `${base.reason}; ${known} padrão(ões) de falha conhecido(s) na memória para este objetivo: sobe de ${base.mode} para ${next}`,
    };
  }
  return base;
}

/* ============================ CRITÉRIOS DE ACEITE ============================ */

/**
 * Deriva critérios de aceite do SCHEMA REAL do artefato esperado
 * (`contracts/artifacts.ts`), não de texto inventado: campos obrigatórios
 * viram checks `contains`, `minSize` vira `min-size`, proibições viram
 * `not-contains`. Se o schema muda, os critérios acompanham.
 */
export function acceptanceForKind(nodeId: string, kind: string): AcceptanceCriterion[] {
  const schema = ARTIFACT_SCHEMAS[kind as keyof typeof ARTIFACT_SCHEMAS];
  const criteria: AcceptanceCriterion[] = [
    { id: `${nodeId}:valid`, description: `artefato "${kind}" válido contra o schema do framework`, kind: 'deterministic', check: { kind: 'artifact-valid' } },
  ];
  if (!schema) return criteria;
  if (schema.minSize && schema.minSize > 0) {
    criteria.push({
      id: `${nodeId}:size`,
      description: `conteúdo com pelo menos ${schema.minSize} bytes (sem resposta vazia ou de uma linha)`,
      kind: 'deterministic',
      check: { kind: 'min-size', bytes: schema.minSize },
    });
  }
  for (const field of schema.required ?? []) {
    criteria.push({
      id: `${nodeId}:field:${field}`,
      description: `saída cobre "${field}"`,
      kind: 'deterministic',
      check: { kind: 'contains', text: field, message: `campo obrigatório "${field}" ausente na saída` },
    });
  }
  for (const forbidden of schema.forbidden ?? []) {
    criteria.push({
      id: `${nodeId}:forbidden:${slug(forbidden)}`,
      description: `saída sem "${forbidden}" (zero stub/checklist)`,
      kind: 'deterministic',
      check: { kind: 'not-contains', text: forbidden, message: `conteúdo proibido "${forbidden}" presente` },
    });
  }
  return criteria;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'x';
}

function checksFromAcceptance(criteria: AcceptanceCriterion[]): DeterministicCheck[] {
  return criteria.filter((c) => c.kind === 'deterministic' && c.check).map((c) => c.check as DeterministicCheck);
}

/* ============================ PLANO ============================ */

export interface CommanderInput {
  objective: string;
  /** Override de modo (CLI `--mode`). */
  mode?: ExecutionMode;
  /** Agente pedido explicitamente pelo usuário (`izanagi run architect ...`). */
  agent?: string;
  /** Chain de skills já resolvida pelo chamador (compatibilidade com a CLI atual). */
  skillChain?: string[];
  /** Teto global de tokens do run. */
  maxTokens?: number;
  /** Teto global de custo em USD: quando a estimativa estoura, o modo degrada. */
  maxCostUsd?: number;
  /** Registro de capacidades para escolher agentes por capacidade, não por nome fixo. */
  capabilities?: AgentCapabilityRegistry;
  /** Estimador de custo por (papel, tokens). Injetado pelo ModelRouter. */
  estimateCostUsd?: (role: AgentRole, tokens: number) => number;
  /** Decomposição assistida por modelo (opcional). Valida antes de aceitar. */
  decompose?: (objective: string, classification: Classification) => DecomposedTask[] | null;
  /**
   * Memória do runtime, consultada de forma SELETIVA: padrões de falha
   * relevantes ao objetivo e taxa de sucesso por agente. Nunca a memória
   * inteira injetada no contexto.
   */
  memory?: PlanningMemory;
  /**
   * Ranking de skills por objetivo (`SkillResolver.rankSkills`). Quando
   * presente, CADA tarefa carrega as skills do próprio objetivo em vez da
   * chain do agente para o run inteiro.
   */
  resolveSkills?: (objective: string, limit: number) => string[];
  /**
   * Diretório de entrega, RELATIVO à raiz do projeto (`--output`). Quando
   * presente, o plano ganha um nó `kind: 'tool'` que grava o que o run
   * produziu e cuja verificação confere o arquivo escrito. Ausente: nenhum nó
   * do grafo recebe permissão de escrita, e o comportamento é o de antes.
   */
  output?: string;
  /**
   * Lê o projeto antes de decidir (`--survey`). Acrescenta um nó de tool na
   * CABEÇA do grafo que levanta stack, manifestos e árvore de forma
   * determinística, e o resultado entra no contexto mínimo das tarefas raiz.
   * Ignorado em modo `direct`: uma resposta de uma chamada não justifica
   * dobrar o grafo para levantar o terreno.
   */
  survey?: boolean;
}

/**
 * Fatia da memória que o planejamento consulta. Interface estreita de
 * propósito: o Commander não precisa conhecer o `MemoryStore` inteiro, e um
 * teste pode passar um objeto literal.
 */
export interface PlanningMemory {
  findRelevantFailures(query: string): Array<{ pattern: string; occurrences: number; confidence: number }>;
  /**
   * Com `domain`, o recorte daquele domínio; sem ele, o agregado do agente.
   * `undefined` significa ausência de histórico, não histórico ruim.
   */
  agentStats(agent: string, domain?: string): { runs: number; successes: number; failures: number } | undefined;
}

/** Runs mínimos antes de confiar na taxa de sucesso de um agente. */
const MIN_RUNS_FOR_TRUST = 3;
/** Abaixo desta taxa, o agente sai da disputa (havendo alternativa). */
const MIN_SUCCESS_RATE = 0.4;
/** Skills carregadas por tarefa. O prompt já corta em 4; 3 dá folga. */
const MAX_SKILLS_PER_TASK = 3;

/** Tarefa proposta por uma decomposição externa (LLM ou plugin). */
export interface DecomposedTask {
  id: string;
  objective: string;
  agent?: string;
  outputKind?: string;
  dependencies?: string[];
  role?: AgentRole;
  optional?: boolean;
}

export interface PlanEstimate {
  nodes: number;
  parallelStages: number;
  /** Soma dos tetos de token dos contratos: limite superior, não previsão. */
  maxTokens: number;
  /** Custo em USD no pior caso (todos os tetos gastos). Ausente sem estimador. */
  maxCostUsd?: number;
  byRole: Record<AgentRole, { tasks: number; tokens: number }>;
}

export interface CommanderPlan {
  runObjective: string;
  mode: ExecutionMode;
  modeReason: string;
  classification: Classification;
  graph: ExecutionGraph;
  contracts: TaskContract[];
  estimate: PlanEstimate;
  /** Decisões tomadas na fase de planejamento (entram no Decision Journal). */
  decisions: string[];
  /** Problemas nos contratos gerados. Vazio em plano saudável. */
  issues: string[];
}

const MODE_LADDER: ExecutionMode[] = ['direct', 'assisted', 'orchestrated', 'autonomous'];

/* ============================ REPLANEJAMENTO ============================ */

/** O que o Commander precisa saber sobre a falha — e nada além disso. */
export interface ReplanFailure {
  nodeId: string;
  error: string;
  /** Tentativa em que a falha aconteceu (1 = primeira). */
  attempt: number;
  /** Critérios de aceite não comprovados pela Verification Engine. */
  unmet?: string[];
  /** Referência do artefato reprovado (`runId:nodeId`), não o conteúdo dele. */
  artifactRef?: string;
  /** Agente que produziu a falha: sai da disputa na nova escolha. */
  agent?: string;
}

export interface ReplanResult {
  graph: ExecutionGraph;
  contracts: TaskContract[];
  decisions: string[];
  /**
   * O que mudou entre o Plano A e o Plano B. Vazio significa que o
   * replanejamento não encontrou nada para mudar — e isso precisa aparecer,
   * senão "replanejou" vira sinônimo de "tentou de novo".
   */
  changes: string[];
}

/** Teto de caracteres da causa da falha levada ao replanejamento. */
const MAX_FAILURE_CHARS = 300;

export class Commander {
  constructor(
    private readonly planner = new Planner(),
    private readonly builder = new ExecutionGraphBuilder(),
  ) {}

  /**
   * Planeja o run inteiro. Cost-aware: se a estimativa estoura `maxCostUsd`, o
   * modo degrada um degrau e o plano é refeito, registrando o motivo (nunca
   * ultrapassa o orçamento em silêncio).
   */
  plan(input: CommanderInput): CommanderPlan {
    const classification = classify(input.objective);
    // Recuperação SELETIVA: só os padrões de falha que casam com este objetivo.
    // Injetar a memória inteira no planejamento é o que a arquitetura proíbe.
    const knownFailures = input.memory?.findRelevantFailures(input.objective) ?? [];
    const unreliable = this.unreliableAgents(input, classification.domains[0]);
    const decided = decideMode(classification, input.mode, { knownFailures: knownFailures.length });
    const decisions: string[] = [
      `classificação: complexidade ${classification.complexity}/5, domínios [${classification.domains.join(', ') || 'nenhum'}], risco ${classification.risk}`,
      `modo ${decided.mode}: ${decided.reason}`,
      ...classification.reasons.map((r) => `sinal: ${r}`),
    ];
    if (input.memory) {
      decisions.push(
        `memória consultada: ${knownFailures.length} padrão(ões) de falha relevante(s)` +
          (knownFailures.length > 0 ? ` (${knownFailures.slice(0, 3).map((f) => f.pattern).join(', ')})` : '') +
          (unreliable.length > 0 ? `; ${unreliable.length} agente(s) despriorizado(s) por histórico: ${unreliable.join(', ')}` : ''),
      );
    }

    let mode = decided.mode;
    let plan = this.buildForMode(mode, input, classification);
    let estimate = this.estimate(plan.contracts, input.estimateCostUsd);

    // Cost-aware planning: degrada o modo enquanto a estimativa estourar o teto
    // e ainda houver degrau abaixo. Modo forçado pelo usuário não degrada.
    const ceiling = input.maxCostUsd;
    if (ceiling !== undefined && estimate.maxCostUsd !== undefined && !input.mode) {
      let guard = 0;
      let cost = estimate.maxCostUsd;
      while (cost > ceiling && MODE_LADDER.indexOf(mode) > 0 && guard++ < MODE_LADDER.length) {
        const cheaper = MODE_LADDER[MODE_LADDER.indexOf(mode) - 1];
        decisions.push(
          `custo estimado $${cost.toFixed(4)} acima do teto $${ceiling.toFixed(4)}: degradando ${mode} para ${cheaper}`,
        );
        mode = cheaper;
        plan = this.buildForMode(mode, input, classification);
        estimate = this.estimate(plan.contracts, input.estimateCostUsd);
        cost = estimate.maxCostUsd ?? 0;
      }
      if (cost > ceiling) {
        decisions.push(`custo estimado $${cost.toFixed(4)} ainda acima do teto no modo mínimo: execução seguirá sob controle do Budget Controller`);
      }
    }

    const issues = plan.contracts.flatMap((c) => validateContract(c));
    return {
      runObjective: input.objective,
      mode,
      modeReason: mode === decided.mode ? decided.reason : `degradado por teto de custo (origem: ${decided.mode})`,
      classification,
      graph: plan.graph,
      contracts: plan.contracts,
      estimate,
      decisions,
      issues,
    };
  }

  /**
   * Replanejamento: produz um Plano B, não o Plano A com um nó reaberto.
   *
   * O `Planner.replan` legado marcava concluídos como `skipped`, reabria o nó
   * falho e devolvia o MESMO grafo: mesmo agente, mesmo papel, mesma
   * decomposição. Repetir a tentativa que já falhou é a definição de gastar
   * orçamento sem aprender nada.
   *
   * Escada determinística, nesta ordem: trocar o agente (o que falhou sai da
   * disputa) -> subir o papel (mais capacidade para a mesma tarefa) -> quebrar
   * a tarefa em duas (rascunho + fechamento dirigido aos critérios não
   * comprovados). Da segunda tentativa em diante, trocar agente E subir papel
   * ao mesmo tempo. Nada mudou = `changes` vazio, e quem chamou decide o que
   * fazer com isso: "replanejou" não pode virar sinônimo de "tentou de novo".
   *
   * O Commander recebe só o DELTA da falha (nó, causa, critérios não
   * comprovados, referência do artefato, tentativa). Nunca a execução inteira.
   */
  replan(
    previous: { graph: ExecutionGraph; contracts?: TaskContract[] },
    failure: ReplanFailure,
    input: CommanderInput,
  ): ReplanResult {
    const changes: string[] = [];
    const decisions: string[] = [
      `replanejamento do nó "${failure.nodeId}" após a tentativa ${failure.attempt}: ${clip(failure.error, MAX_FAILURE_CHARS)}`,
    ];
    if (failure.unmet && failure.unmet.length > 0) {
      decisions.push(`critérios não comprovados: ${failure.unmet.slice(0, 3).join('; ')}`);
    }
    if (failure.artifactRef) decisions.push(`artefato reprovado: ${failure.artifactRef}`);

    const failed = previous.graph.nodes.find((n) => n.id === failure.nodeId);
    if (!failed) {
      decisions.push('nó da falha não existe no grafo: replanejamento sem alvo');
      return { graph: previous.graph, contracts: previous.contracts ?? [], decisions, changes };
    }

    const contract = previous.contracts?.find((c) => c.id === failure.nodeId) ?? contractOf(failed);
    const objective = contract?.objective ?? objectiveForNode(failed, input.objective);
    const aggressive = failure.attempt >= 2;

    // Nó de tool não tem plano B estrutural: não há agente para trocar, papel
    // para subir nem tarefa para quebrar — a tool ou executou ou foi recusada,
    // e a causa está no ambiente (permissão, política, caminho), não na
    // escolha de quem executa. Repetir a escada aqui produziria um contrato de
    // agente por cima de um contrato de tool, ou seja: o nó perderia a tool e
    // a permissão, e a "correção" seria uma regressão silenciosa.
    if (isToolContract(failed, contract)) {
      decisions.push(
        `nó "${failure.nodeId}" é de tool: sem alternativa estrutural (agente/papel/decomposição não se aplicam). O nó volta para a fila com o mesmo contrato.`,
      );
      const reopenedOnly = previous.graph.nodes.map((node) =>
        node.id === failure.nodeId
          ? ({ ...node, status: 'pending' as const, attempts: 0, error: undefined })
          : ({ ...node, status: (node.status === 'succeeded' ? 'skipped' : node.status) as GraphNode['status'] }),
      );
      const toolGraph = this.builder.build({
        id: `${previous.graph.id}-replan-${failure.attempt}`,
        task: previous.graph.task,
        nodes: reopenedOnly,
        budget: previous.graph.budget,
      });
      return {
        graph: toolGraph,
        contracts: toolGraph.nodes.map((n) => contractOf(n)).filter((c): c is TaskContract => Boolean(c)),
        decisions,
        changes,
      };
    }

    // Agentes já queimados NESTE nó: o que falhou agora e os das tentativas
    // anteriores. O histórico viaja no metadata do nó, não num estado global.
    const previouslyTried = Array.isArray(failed.metadata?.triedAgents) ? (failed.metadata!.triedAgents as string[]) : [];
    const tried = Array.from(new Set([...previouslyTried, failure.agent, failed.agent].filter((a): a is string => Boolean(a))));

    // 1. Trocar o agente por outro capaz do mesmo objetivo.
    let nextAgent: string | undefined;
    if (input.capabilities) {
      const candidate =
        input.capabilities.bestFor(objective, { ...(contract?.role ? { role: contract.role } : {}), exclude: tried }) ??
        input.capabilities.bestFor(objective, { exclude: tried });
      if (candidate && !tried.includes(candidate.id)) {
        nextAgent = candidate.id;
        changes.push(`agente de "${failure.nodeId}": ${failed.agent ?? 'nenhum'} -> ${nextAgent} (o anterior falhou neste objetivo)`);
      }
    }

    // 2. Subir o papel: sozinho quando não houve troca de agente, junto com a
    //    troca quando o nó já falhou mais de uma vez.
    let nextRole = contract?.role;
    if (contract && (!nextAgent || aggressive)) {
      const up = ModelRouter.escalateRole(contract.role);
      if (up && up !== contract.role) {
        nextRole = up;
        changes.push(`papel de "${failure.nodeId}": ${contract.role} -> ${up} (mais capacidade para a mesma tarefa)`);
      }
    }

    // 3. Quebrar em duas: último recurso. Só quando não há agente novo nem
    //    papel acima, existe critério não comprovado, e o nó ainda não foi
    //    quebrado antes (quebrar o quebrado produziria uma cascata).
    const alreadySplit =
      failed.metadata?.splitFrom !== undefined || previous.graph.nodes.some((n) => n.metadata?.splitFrom === failure.nodeId);
    const shouldSplit = changes.length === 0 && (failure.unmet?.length ?? 0) > 0 && !alreadySplit;
    const draftId = `${failure.nodeId}-draft`;

    const nodes: GraphNode[] = [];
    for (const node of previous.graph.nodes) {
      if (node.id !== failure.nodeId) {
        // Concluído vira `skipped` (não se paga duas vezes pelo mesmo artefato);
        // nó falho de outro ramo volta para a fila junto com o replanejamento.
        nodes.push({
          ...node,
          status: (node.status === 'succeeded' ? 'skipped' : node.status === 'failed' ? 'pending' : node.status) as GraphNode['status'],
        });
        continue;
      }
      const reopened: GraphNode = {
        ...node,
        status: 'pending',
        attempts: 0,
        error: undefined,
        ...(nextAgent ? { agent: nextAgent } : {}),
        metadata: {
          ...node.metadata,
          triedAgents: tried,
          replanned: true,
          ...(nextRole ? { role: nextRole } : {}),
        },
      };
      if (!shouldSplit) {
        nodes.push(reopened);
        continue;
      }
      // O rascunho assume as dependências originais. O nó original MANTÉM o id
      // (as dependências a jusante continuam válidas) e passa a consumir o
      // rascunho, com objetivo restrito ao que não foi comprovado.
      nodes.push({
        ...reopened,
        id: draftId,
        dependencies: node.dependencies ?? [],
        metadata: { ...reopened.metadata, splitFrom: failure.nodeId, splitRole: 'draft' },
      });
      nodes.push({
        ...reopened,
        dependencies: [draftId],
        metadata: { ...reopened.metadata, splitFrom: failure.nodeId, splitRole: 'finish' },
      });
      changes.push(
        `tarefa "${failure.nodeId}" quebrada em "${draftId}" (rascunho) + "${failure.nodeId}" (fechamento dirigido aos critérios não comprovados)`,
      );
    }

    // Contratos refeitos só para os nós tocados: replanejar não é motivo para
    // regerar contrato de tarefa que passou.
    const touched = new Set([failure.nodeId, ...(shouldSplit ? [draftId] : [])]);
    const classification = classify(input.objective);
    const rebuilt = nodes.map((node) => {
      if (!touched.has(node.id)) return node;
      // Contrato de tool jamais é regerado por `contractFor`: perderia `tool` e
      // `permissions` e o nó viraria uma chamada de modelo com o mesmo id.
      if (isToolContract(node, contractOf(node))) return node;
      const fresh = this.contractFor(node, input, classification, 'orchestrated');
      const withFailure: TaskContract = {
        ...fresh,
        ...(nextRole ? { role: nextRole } : {}),
        ...(node.agent ? { agent: node.agent } : {}),
        objective:
          node.metadata?.splitRole === 'draft'
            ? `${objective} (rascunho: produzir a primeira versão completa)`
            : node.metadata?.splitRole === 'finish'
              ? `${objective} (fechamento: partir do rascunho e cobrir o que não foi comprovado)`
              : objective,
        constraints: [
          ...fresh.constraints,
          // O delta da falha vira RESTRIÇÃO da nova tentativa: é a forma de a
          // causa chegar ao executor sem reenviar a execução inteira.
          `a tentativa anterior falhou por: ${clip(failure.error, MAX_FAILURE_CHARS)}`,
          ...(failure.unmet && failure.unmet.length > 0
            ? [`a nova entrega precisa cobrir explicitamente: ${failure.unmet.slice(0, 5).join('; ')}`]
            : []),
        ],
      };
      return attachContract(node, withFailure);
    });

    const graph = this.builder.build({
      id: `${previous.graph.id}-replan-${failure.attempt}`,
      task: previous.graph.task,
      nodes: rebuilt,
      budget: previous.graph.budget,
    });

    if (changes.length === 0) {
      decisions.push('nenhuma alternativa estrutural disponível: o grafo volta com o nó reaberto, sem mudança de agente, papel ou decomposição');
    }
    decisions.push(...changes);

    const contracts = graph.nodes.map((n) => contractOf(n)).filter((c): c is TaskContract => Boolean(c));
    return { graph, contracts, decisions, changes };
  }

  /** Constrói grafo + contratos para um modo específico. */
  private buildForMode(
    mode: ExecutionMode,
    input: CommanderInput,
    classification: Classification,
  ): { graph: ExecutionGraph; contracts: TaskContract[] } {
    const planned = mode === 'direct'
      ? this.directNodes(input, classification)
      : mode === 'assisted'
        ? this.assistedNodes(input, classification)
        : this.graphNodes(mode, input, classification);

    // Grounding ANTES dos contratos: a dependência do survey precisa existir no
    // nó quando `contractFor` deriva `inputs` dele, senão o Context Resolver
    // nunca entrega o levantamento a quem deveria consumi-lo — o grafo teria a
    // aresta e não a transferência de informação.
    const grounded = input.survey && mode !== 'direct' ? withSurveyAtHead(planned) : planned;

    // Skills POR TAREFA: cada nó carrega o que o próprio objetivo pede, não a
    // chain do agente para o run inteiro. Sem o resolver injetado, o
    // comportamento anterior (chain do run) permanece intacto.
    const nodes = grounded.map((node) => this.withTaskSkills(node, input));
    const contracts = nodes.map((node) => this.contractFor(node, input, classification, mode));
    const withContracts = nodes.map((node, i) => attachContract(node, contracts[i]));

    if (grounded !== planned) {
      const { node, contract } = surveyNode();
      withContracts.unshift(attachContract(node, contract));
      contracts.unshift(contract);
    }

    // Entrega: depende de TODO nó anterior, então roda no último batch e vê o
    // run inteiro. Nó pulado por early stopping não bloqueia — os batches são
    // topológicos e calculados antes, não uma fila que espera cada predecessor.
    if (input.output) {
      const { node, contract } = deliverNode({
        outputDir: input.output,
        objective: input.objective,
        dependencies: withContracts.map((n) => n.id),
      });
      withContracts.push(attachContract(node, contract));
      contracts.push(contract);
    }

    const graph = this.builder.build({
      id: `graph-${crypto.randomBytes(3).toString('hex')}`,
      task: input.objective,
      nodes: withContracts,
      budget: {
        maxAttempts: mode === 'autonomous' ? 3 : mode === 'orchestrated' ? 2 : 1,
        maxTokens: input.maxTokens ?? budgetForMode(mode, classification.complexity),
        maxTimeMs: mode === 'autonomous' ? 900_000 : mode === 'orchestrated' ? 600_000 : 180_000,
      },
    });
    return { graph, contracts };
  }

  /** DIRECT: um nó. Sem crítico, sem avaliador, sem gate. */
  private directNodes(input: CommanderInput, classification: Classification): GraphNode[] {
    const agent = this.pickAgent(input, classification, 'worker') ?? input.agent ?? 'senior-engineer';
    return [
      {
        id: 'answer',
        kind: 'agent',
        agent,
        skills: (input.skillChain ?? []).slice(0, 2),
        outputs: ['raw'],
        dependencies: [],
        status: 'pending',
        tokenBudget: 1200,
        timeoutMs: 120_000,
        retryPolicy: { maxAttempts: 2, backoffMs: 500 },
        // Modo direct É uma tarefa de worker por definição: uma resposta curta
        // não vira trabalho de commander só porque o agente escolhido é caro.
        metadata: { role: 'worker' as AgentRole },
      },
    ];
  }

  /** ASSISTED: especialista executa, verificação determinística fecha. */
  private assistedNodes(input: CommanderInput, classification: Classification): GraphNode[] {
    const agent = input.agent ?? this.pickAgent(input, classification, 'specialist') ?? 'senior-engineer';
    return [
      {
        id: 'execute',
        kind: 'agent',
        agent,
        skills: (input.skillChain ?? []).slice(0, 4),
        outputs: [outputKindFor(classification.category)],
        dependencies: [],
        status: 'pending',
        tokenBudget: 3000,
        timeoutMs: 240_000,
        retryPolicy: { maxAttempts: 2, backoffMs: 500, retryOnValidation: true },
        metadata: { role: 'specialist' as AgentRole },
      },
      {
        id: 'verify',
        kind: 'gate',
        validator: 'artifact.valid',
        outputs: ['evaluation'],
        dependencies: ['execute'],
        status: 'pending',
        tokenBudget: 0,
        timeoutMs: 30_000,
        metadata: { role: 'worker' as AgentRole },
      },
    ];
  }

  /**
   * ORCHESTRATED/AUTONOMOUS: reaproveita os templates do Planner (já validados
   * e testados) e aplica duas correções do Commander: decomposição externa
   * quando fornecida, e marcação de nós opcionais para early stopping.
   */
  private graphNodes(mode: ExecutionMode, input: CommanderInput, classification: Classification): GraphNode[] {
    const decomposed = input.decompose ? input.decompose(input.objective, classification) : null;
    const valid = decomposed ? validateDecomposition(decomposed) : [];
    if (decomposed && valid.length === 0 && decomposed.length > 0) {
      return decomposed.map((t) => ({
        id: t.id,
        kind: 'agent' as const,
        agent: t.agent ?? input.agent ?? 'senior-engineer',
        outputs: [t.outputKind ?? 'raw'],
        dependencies: t.dependencies ?? [],
        status: 'pending' as const,
        tokenBudget: 4000,
        timeoutMs: 300_000,
        retryPolicy: { maxAttempts: 2, backoffMs: 500, retryOnValidation: true },
        metadata: { optional: t.optional === true, decomposed: true },
      }));
    }

    const graph = this.planner.plan({
      task: input.objective,
      category: classification.category,
      primaryAgent: input.agent ?? this.pickAgent(input, classification, 'specialist') ?? 'senior-engineer',
      skillChain: input.skillChain ?? [],
      workflow: templateForCategory(classification.category),
    });

    // Modo orchestrated corta o que é reforço e não evidência: crítica
    // adversarial fica só no autonomous. O nó de avaliação permanece nos dois.
    const nodes = graph.nodes.filter((n) => (mode === 'autonomous' ? true : n.id !== 'critic'));
    const critics = new Set(['critic']);
    return nodes.map((n) => ({
      ...n,
      dependencies: (n.dependencies ?? []).filter((d) => nodes.some((x) => x.id === d)),
      metadata: { ...n.metadata, optional: critics.has(n.id) },
    }));
  }

  /**
   * Seleciona agente por capacidade quando há registro; senão devolve null.
   *
   * Agentes com histórico ruim saem da disputa — mas só quando sobra
   * alternativa: excluir todo mundo transformaria memória em paralisia.
   */
  private pickAgent(input: CommanderInput, classification: Classification, role: AgentRole): string | null {
    if (!input.capabilities) return null;
    const exclude = this.unreliableAgents(input);
    const pick = (opts: { role?: AgentRole; exclude?: string[] }) => input.capabilities!.bestFor(input.objective, opts)?.id ?? null;
    const chosen =
      pick({ role, ...(exclude.length > 0 ? { exclude } : {}) }) ??
      pick(exclude.length > 0 ? { exclude } : {}) ??
      // Nenhum agente confiável casou: melhor um agente com histórico ruim do
      // que nenhum agente. O motivo já foi registrado nas decisões do plano.
      pick({ role }) ??
      pick({});
    return chosen;
  }

  /**
   * Agentes reprovados pelo histórico: taxa de sucesso abaixo do piso, com
   * amostra suficiente para a taxa significar alguma coisa.
   *
   * O recorte por DOMÍNIO vem primeiro: um agente que vai mal em frontend e bem
   * em backend não pode ser descartado de um trabalho de backend. Só quando não
   * há amostra suficiente naquele domínio o agregado global entra como sinal —
   * é menos preciso, mas é o único disponível enquanto o histórico é curto.
   */
  private unreliableAgents(input: CommanderInput, domain?: string): string[] {
    if (!input.memory || !input.capabilities) return [];
    return input.capabilities.ids().filter((id) => {
      const scoped = domain ? input.memory!.agentStats(id, domain) : undefined;
      const stats = scoped && scoped.runs >= MIN_RUNS_FOR_TRUST ? scoped : input.memory!.agentStats(id);
      return Boolean(stats && stats.runs >= MIN_RUNS_FOR_TRUST && stats.successes / stats.runs < MIN_SUCCESS_RATE);
    });
  }

  /**
   * Substitui a chain do run pelas skills relevantes ao objetivo DESTE nó.
   * Nós determinísticos (gate, evaluator, validator) não carregam skill: não
   * há prompt para elas ocuparem.
   */
  private withTaskSkills(node: GraphNode, input: CommanderInput): GraphNode {
    if (!input.resolveSkills) return node;
    if (node.kind === 'gate' || node.kind === 'evaluator' || node.kind === 'validator') return node;
    const query = [node.id, node.agent ?? '', node.outputs?.[0] ?? '', input.objective].filter(Boolean).join(' ');
    let ranked: string[] = [];
    try {
      ranked = input.resolveSkills(query, MAX_SKILLS_PER_TASK);
    } catch {
      // Resolver quebrado não derruba o planejamento: cai na chain do run.
      return node;
    }
    if (ranked.length === 0) return node;
    return { ...node, skills: ranked.slice(0, MAX_SKILLS_PER_TASK) };
  }

  /** Contrato completo de um nó, com critérios derivados do schema do artefato. */
  private contractFor(node: GraphNode, input: CommanderInput, classification: Classification, mode: ExecutionMode): TaskContract {
    const kind = node.outputs?.[0] ?? 'raw';
    const base = contractFromNode(node, { objective: objectiveForNode(node, input.objective) });
    const acceptance = acceptanceForKind(node.id, kind);
    const role = roleForNode(node, input.capabilities);
    const optional = node.metadata?.optional === true;
    return {
      ...base,
      role,
      objective: objectiveForNode(node, input.objective),
      constraints: constraintsFor(classification, mode),
      priority: classification.risk > 0.6 ? 'high' : 'normal',
      budget: {
        maxTokens: node.tokenBudget ?? 4000,
        ...(node.timeoutMs ? { maxTimeMs: node.timeoutMs } : {}),
        ...(input.maxCostUsd !== undefined ? { maxCostUsd: input.maxCostUsd } : {}),
      },
      verification: {
        deterministic: checksFromAcceptance(acceptance),
        requireAllCriteria: mode === 'autonomous',
      },
      acceptance,
      ...(optional ? { optional: true } : {}),
      // Decomposição em execução é privilégio de tarefa de raciocínio amplo em
      // modo autônomo: é onde o planejamento tem mais chance de subestimar o
      // escopo, e onde o orçamento comporta a divisão. Nos outros modos, o
      // Commander já decidiu o tamanho da tarefa e essa decisão vale.
      ...(mode === 'autonomous' && role === 'commander' ? { decomposable: true } : {}),
    };
  }

  /** Estimativa de teto: soma dos budgets por papel, convertida em USD quando há estimador. */
  estimate(contracts: TaskContract[], estimateCostUsd?: (role: AgentRole, tokens: number) => number): PlanEstimate {
    const byRole: PlanEstimate['byRole'] = {
      commander: { tasks: 0, tokens: 0 },
      specialist: { tasks: 0, tokens: 0 },
      worker: { tasks: 0, tokens: 0 },
    };
    let maxTokens = 0;
    let maxCostUsd = estimateCostUsd ? 0 : undefined;
    for (const c of contracts) {
      const tokens = c.budget.maxTokens;
      byRole[c.role].tasks++;
      byRole[c.role].tokens += tokens;
      maxTokens += tokens;
      if (estimateCostUsd && maxCostUsd !== undefined) maxCostUsd += estimateCostUsd(c.role, tokens);
    }
    const stages = new Set(contracts.map((c) => c.dependencies.length)).size;
    return {
      nodes: contracts.length,
      parallelStages: Math.max(1, stages),
      maxTokens,
      ...(maxCostUsd !== undefined ? { maxCostUsd } : {}),
      byRole,
    };
  }
}

/* ============================ HELPERS ============================ */

function budgetForMode(mode: ExecutionMode, complexity: number): number {
  switch (mode) {
    case 'direct': return 2000;
    case 'assisted': return 6000;
    case 'orchestrated': return complexity >= 4 ? 32_000 : 20_000;
    default: return 48_000;
  }
}

/** Kind de artefato natural da categoria: evita cair sempre em 'raw'. */
function outputKindFor(category: string): string {
  switch (category) {
    case 'architecture': return 'architecture';
    case 'security_audit': return 'security-report';
    case 'database_design': return 'database-schema';
    case 'testing': return 'test-plan';
    case 'automacao': return 'implementation-plan';
    default: return 'raw';
  }
}

function objectiveForNode(node: GraphNode, runObjective: string): string {
  const label = node.agent ?? node.skills?.join('+') ?? node.kind;
  return `${node.id} (${label}): produzir "${node.outputs?.[0] ?? 'raw'}" para o objetivo do run: ${runObjective}`;
}

function constraintsFor(classification: Classification, mode: ExecutionMode): string[] {
  const constraints = [
    'zero stubs, TODO, placeholder ou checklist: conteúdo real e completo',
    'responder apenas o artefato pedido, sem repetir contexto já fornecido',
  ];
  if (classification.risk > 0.6) constraints.push('nenhum segredo, credencial ou dado sensível em texto claro');
  if (mode === 'direct') constraints.push('resposta direta e curta: a tarefa não justifica elaboração longa');
  return constraints;
}

function roleForNode(node: GraphNode, registry?: AgentCapabilityRegistry): AgentRole {
  // Papel declarado pelo modo vence: é uma decisão do Commander sobre QUANTA
  // inteligência a tarefa merece, não sobre quem é o agente.
  const declared = node.metadata?.role;
  if (typeof declared === 'string' && AGENT_ROLES.includes(declared as AgentRole)) return declared as AgentRole;
  if (node.agent && registry) {
    const cap = registry.get(node.agent);
    if (cap) return cap.role;
  }
  return defaultRoleForNode(node);
}

/**
 * Valida uma decomposição externa antes de confiar nela: ids únicos,
 * dependências existentes, sem ciclo trivial. Erros derrubam a decomposição
 * inteira de volta para o template (nunca executa plano malformado).
 */
export function validateDecomposition(tasks: DecomposedTask[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const t of tasks) {
    if (!t.id || !/^[a-z0-9][a-z0-9._-]*$/i.test(t.id)) {
      issues.push(`tarefa com id inválido: "${t.id}"`);
      continue;
    }
    if (ids.has(t.id)) issues.push(`id duplicado na decomposição: "${t.id}"`);
    ids.add(t.id);
    if (!t.objective || t.objective.trim().length < 4) issues.push(`tarefa "${t.id}" sem objetivo`);
  }
  for (const t of tasks) {
    for (const dep of t.dependencies ?? []) {
      if (!ids.has(dep)) issues.push(`tarefa "${t.id}" depende de "${dep}" que não existe na decomposição`);
      if (dep === t.id) issues.push(`tarefa "${t.id}" depende de si mesma`);
    }
  }
  return issues;
}

/**
 * Nó de tool: o contrato declara a tool, ou o metadata do nó declara. As duas
 * fontes existem porque o `Orchestrator` aceita as duas (`isToolNode`), e
 * reconhecer só uma deixaria a outra escapar da proteção.
 */
function isToolContract(node: GraphNode, contract?: TaskContract): boolean {
  const fromMetadata = node.metadata?.tool as { id?: unknown } | undefined;
  return Boolean(contract?.tool?.id || (fromMetadata && typeof fromMetadata.id === 'string' && fromMetadata.id.length > 0));
}

/** Corta a causa da falha para caber no contrato sem virar um segundo prompt. */
function clip(text: string, max: number): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}...`;
}
