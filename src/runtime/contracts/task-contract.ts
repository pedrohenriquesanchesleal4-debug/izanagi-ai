/**
 * Task Contract: contrato formal de UMA tarefa executável.
 *
 * Antes deste módulo, um nó do grafo (`GraphNode`) carregava só a mecânica de
 * execução (dependências, retry, timeout, tokenBudget). O que a tarefa PRECISA
 * entregar (objetivo, saída esperada, critérios de aceite verificáveis, teto de
 * custo) vivia implícito no template do planner ou no prompt.
 *
 * O contrato torna isso explícito e verificável: o Commander gera um contrato
 * por nó, o Context Resolver monta o contexto mínimo a partir dele, e a
 * Verification Engine decide VERIFIED/FAILED comparando o artefato produzido
 * contra `acceptance` + `verification`. Nada aqui depende de LLM: é o núcleo
 * determinístico exigido pela arquitetura (regra "Deterministic Core").
 *
 * Compatibilidade: `GraphNode` continua sendo a unidade do scheduler. O
 * contrato é anexado em `node.metadata.contract` e lido por quem souber dele;
 * grafos antigos (sem contrato) seguem executando pelo caminho pré-contrato.
 */

import type { ArtifactKind, GraphNode } from '../types.js';

/* ============================ MODOS E PAPÉIS ============================ */

/**
 * Modo de execução adaptativo. Determina QUANTO runtime a tarefa merece:
 *   direct       : 1 chamada de modelo, sem grafo, sem avaliação pesada.
 *   assisted     : commander decide + 1 especialista executa.
 *   orchestrated : grafo completo com verificação.
 *   autonomous   : grafo + healing + replan + verificação final.
 */
export type ExecutionMode = 'direct' | 'assisted' | 'orchestrated' | 'autonomous';

export const EXECUTION_MODES: ExecutionMode[] = ['direct', 'assisted', 'orchestrated', 'autonomous'];

export function isExecutionMode(value: string): value is ExecutionMode {
  return (EXECUTION_MODES as string[]).includes(value);
}

/** Nível hierárquico de quem executa a tarefa (LEVEL 0/1/2 da arquitetura). */
export type AgentRole = 'commander' | 'specialist' | 'worker';

export const AGENT_ROLES: AgentRole[] = ['commander', 'specialist', 'worker'];

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/* ============================ CHECKS DETERMINÍSTICOS ============================ */

/**
 * Verificação que roda SEM modelo nenhum. É o que separa "o agente disse que
 * terminou" de "existe evidência de que terminou".
 *
 * `command` fica de fora de propósito: executar comando arbitrário vindo de um
 * plano gerado é superfície de ataque. Comandos passam pela ToolRegistry, que
 * já aplica permissão/sandbox/Policy Engine.
 */
export type DeterministicCheck =
  | { kind: 'artifact-valid'; message?: string }
  | { kind: 'min-size'; bytes: number; message?: string }
  | { kind: 'contains'; text: string; caseSensitive?: boolean; message?: string }
  | { kind: 'not-contains'; text: string; caseSensitive?: boolean; message?: string }
  | { kind: 'matches'; pattern: string; flags?: string; message?: string }
  | { kind: 'json-field'; field: string; message?: string }
  | { kind: 'file-exists'; path: string; message?: string };

export interface AcceptanceCriterion {
  id: string;
  description: string;
  /**
   * deterministic: decidido por `check` sem modelo.
   * semantic: exige um juiz (modelo ou humano); sem juiz configurado o critério
   *   fica UNKNOWN e nunca é contado como aprovado.
   * evidence: exige que um artefato específico exista e seja válido.
   */
  kind: 'deterministic' | 'semantic' | 'evidence';
  check?: DeterministicCheck;
  /** Para `evidence`: id do nó cujo artefato precisa existir e ser válido. */
  evidenceOf?: string;
  /** Critério opcional não bloqueia o veredito quando falha. */
  optional?: boolean;
}

export interface VerificationPolicy {
  /** Checks aplicados diretamente ao artefato deste nó. */
  deterministic: DeterministicCheck[];
  /** Score semântico mínimo quando existe juiz. Sem juiz, ignorado. */
  semanticMinScore?: number;
  /** false: critérios opcionais podem falhar sem derrubar o veredito. */
  requireAllCriteria?: boolean;
}

/* ============================ ORÇAMENTO ============================ */

export interface TaskBudget {
  maxTokens: number;
  maxTimeMs?: number;
  maxToolCalls?: number;
  /** Teto de custo em USD para esta tarefa. */
  maxCostUsd?: number;
}

/* ============================ CONTRATO ============================ */

export interface OutputSchema {
  kind: ArtifactKind | string;
  /** Campos/termos que a saída deve conter (o validador de artefatos já cobre o schema do kind). */
  required?: string[];
  minSize?: number;
}

export interface TaskContract {
  id: string;
  objective: string;
  role: AgentRole;
  /** Agente sugerido (o Capability Registry pode substituir por um mais apto). */
  agent?: string;
  skills?: string[];
  /** Ids de nós cujos artefatos entram como insumo (referência, não cópia de texto). */
  inputs: string[];
  constraints: string[];
  expectedOutput: OutputSchema;
  dependencies: string[];
  priority: TaskPriority;
  budget: TaskBudget;
  verification: VerificationPolicy;
  acceptance: AcceptanceCriterion[];
  /**
   * Tarefa dispensável quando o objetivo já está verificado (early stopping).
   * Crítico adversarial e revisões extras nascem opcionais.
   */
  optional?: boolean;
}

/** Erros estruturais de um contrato. Vazio = contrato utilizável. */
export function validateContract(contract: TaskContract): string[] {
  const issues: string[] = [];
  if (!contract.id) issues.push('contrato sem id');
  if (!contract.objective || contract.objective.trim().length < 4) {
    issues.push(`contrato "${contract.id}" sem objetivo utilizável`);
  }
  if (!AGENT_ROLES.includes(contract.role)) {
    issues.push(`contrato "${contract.id}" com papel inválido: "${contract.role}"`);
  }
  if (!contract.expectedOutput || !contract.expectedOutput.kind) {
    issues.push(`contrato "${contract.id}" sem saída esperada (expectedOutput.kind)`);
  }
  // maxTokens 0 é legítimo: nós determinísticos (gate, validator) não gastam
  // token nenhum. O que nunca é aceitável é orçamento ausente ou negativo.
  if (!contract.budget || !Number.isFinite(contract.budget.maxTokens) || contract.budget.maxTokens < 0) {
    issues.push(`contrato "${contract.id}" sem orçamento de tokens utilizável`);
  }
  if (contract.budget?.maxCostUsd !== undefined && contract.budget.maxCostUsd < 0) {
    issues.push(`contrato "${contract.id}" com maxCostUsd negativo`);
  }
  for (const dep of contract.dependencies ?? []) {
    if (dep === contract.id) issues.push(`contrato "${contract.id}" depende de si mesmo`);
  }
  for (const criterion of contract.acceptance ?? []) {
    if (criterion.kind === 'deterministic' && !criterion.check) {
      issues.push(`critério "${criterion.id}" é determinístico mas não declara check`);
    }
    if (criterion.kind === 'evidence' && !criterion.evidenceOf) {
      issues.push(`critério "${criterion.id}" é de evidência mas não declara evidenceOf`);
    }
  }
  return issues;
}

/**
 * Deriva um contrato mínimo de um nó de grafo já existente. Serve de ponte de
 * compatibilidade: grafos construídos pelos templates antigos ganham contrato
 * sem que o template precise ser reescrito.
 */
export function contractFromNode(node: GraphNode, opts: { objective: string; role?: AgentRole; constraints?: string[] }): TaskContract {
  const kind = node.outputs?.[0] ?? 'raw';
  return {
    id: node.id,
    objective: opts.objective,
    role: opts.role ?? defaultRoleForNode(node),
    ...(node.agent ? { agent: node.agent } : {}),
    ...(node.skills ? { skills: node.skills } : {}),
    inputs: node.dependencies ?? [],
    constraints: opts.constraints ?? [],
    expectedOutput: { kind },
    dependencies: node.dependencies ?? [],
    priority: 'normal',
    budget: {
      maxTokens: node.tokenBudget ?? 4000,
      ...(node.timeoutMs ? { maxTimeMs: node.timeoutMs } : {}),
    },
    verification: { deterministic: [{ kind: 'artifact-valid' }], requireAllCriteria: false },
    acceptance: [
      { id: `${node.id}:valid`, description: `artefato "${kind}" do nó "${node.id}" válido contra o schema`, kind: 'deterministic', check: { kind: 'artifact-valid' } },
    ],
  };
}

/** Papel default por tipo de nó: crítica/avaliação são baratas, agentes são especialistas. */
export function defaultRoleForNode(node: GraphNode): AgentRole {
  if (node.kind === 'evaluator' || node.kind === 'validator' || node.kind === 'gate') return 'worker';
  if (node.agent === 'discovery' || node.agent === 'architect' || node.agent === 'product-reasoner') return 'commander';
  return 'specialist';
}

/** Anexa o contrato ao nó preservando o resto do metadata. */
export function attachContract(node: GraphNode, contract: TaskContract): GraphNode {
  return { ...node, metadata: { ...node.metadata, contract } };
}

/** Lê o contrato anexado a um nó (undefined em grafos pré-contrato). */
export function contractOf(node: GraphNode): TaskContract | undefined {
  const c = node.metadata?.contract;
  return c && typeof c === 'object' ? (c as TaskContract) : undefined;
}
