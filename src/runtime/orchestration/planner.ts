/**
 * Planner — constrói o Execution Graph dinamicamente a partir da tarefa.
 *
 * Estratégia:
 *  1. Classifica a tarefa (reutiliza a classificação do Decision Engine).
 *  2. Seleciona o template de workflow do skill-resolver (compositions).
 *  3. Expande em nós: discovery → architect → (security ∥ database ∥ product)
 *     → senior-engineer → qa+critic → evaluator.
 *  4. Nodes paralelos detectados pelo grafo (parallelBatches).
 *
 * Templates estáticos existem para composições comuns; tarefas fora do padrão
 * geram grafo linear default. Nunca um grafo gigante para todos os casos.
 */

import type { ExecutionGraph, GraphNode } from '../types.js';
import { ExecutionGraphBuilder } from './graph.js';

export interface PlannerContext {
  task: string;
  /** Categoria classificada (ex.: 'frontend', 'debugging'). */
  category: string;
  /** Agente principal selecionado. */
  primaryAgent: string;
  /** Chain de skills resolvida para a categoria. */
  skillChain: string[];
  /** Composição de workflow encontrada no resolver (id) ou null. */
  workflow?: string | null;
}

export const WORKFLOW_TEMPLATES: Record<string, (ctx: PlannerContext) => GraphNode[]> = {
  /** Produto/SaaS completo: arquitetura paralela + implementação + QA + crítico + avaliação. */
  fullstack: (ctx) => [
    node('discovery', 'agent', { agent: 'discovery', outputs: ['requirements'], dependencies: [] }),
    node('architecture', 'agent', { agent: 'architect', outputs: ['architecture'], dependencies: ['discovery'] }),
    node('security-review', 'agent', { agent: 'security', outputs: ['security-report'], dependencies: ['architecture'] }),
    node('database-design', 'agent', { agent: 'database', outputs: ['database-schema'], dependencies: ['architecture'] }),
    node('product-spec', 'agent', { agent: 'pm', outputs: ['implementation-plan'], dependencies: ['architecture'] }),
    node('implementation', 'agent', { agent: 'senior-engineer', outputs: ['implementation'], dependencies: ['security-review', 'database-design', 'product-spec'] }),
    node('qa-gate', 'gate', { validator: 'artifact.valid', outputs: ['qa-report'], dependencies: ['implementation'] }),
    node('critic', 'agent', { agent: 'adversarial-critic', outputs: ['critique'], dependencies: ['implementation'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['qa-gate', 'critic'] }),
  ],

  /** Debug: reproduzir → causa raiz → corrigir → regressão → avaliar. */
  debugging: (ctx) => [
    node('reproduce', 'agent', { agent: 'bug-hunter', outputs: ['repro'], dependencies: [] }),
    node('root-cause', 'agent', { agent: 'bug-hunter', outputs: ['root-cause'], dependencies: ['reproduce'] }),
    node('fix', 'agent', { agent: 'senior-engineer', outputs: ['fix'], dependencies: ['root-cause'] }),
    node('regression-test', 'agent', { agent: 'qa', outputs: ['test-plan'], dependencies: ['fix'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['regression-test'] }),
  ],

  /** Auditoria de segurança: varredura → análise → relatório → avaliação. */
  security_audit: (ctx) => [
    node('scan', 'agent', { agent: 'security', outputs: ['security-report'], dependencies: [] }),
    node('deep-analysis', 'agent', { agent: 'security', outputs: ['security-report-2'], dependencies: ['scan'] }),
    node('remediation', 'agent', { agent: 'senior-engineer', outputs: ['fixes'], dependencies: ['deep-analysis'] }),
    node('critic', 'agent', { agent: 'adversarial-critic', outputs: ['critique'], dependencies: ['remediation'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['critic'] }),
  ],

  /** Análise/arquitetura: pesquisa → ADRs → plano → avaliação. */
  architecture: (ctx) => [
    node('research', 'agent', { agent: 'researcher', outputs: ['research'], dependencies: [] }),
    node('design', 'agent', { agent: 'architect', outputs: ['architecture'], dependencies: ['research'] }),
    node('adr', 'agent', { agent: 'architect', outputs: ['adrs'], dependencies: ['design'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['adr'] }),
  ],

  /** Automação: planejar → escolher stack → implementar → testar → avaliar. */
  automacao: (ctx) => [
    node('plan', 'agent', { agent: 'automation-engineer', outputs: ['implementation-plan'], dependencies: [] }),
    node('build', 'agent', { agent: 'automation-engineer', outputs: ['implementation'], dependencies: ['plan'] }),
    node('test', 'agent', { agent: 'qa', outputs: ['test-plan'], dependencies: ['build'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['test'] }),
  ],

  /** Frontend/UI: direção de design → design system → componente → perf → avaliação. */
  frontend: (ctx) => [
    node('design-direction', 'agent', { agent: 'animation', skills: ['design-directions'], outputs: ['direction'], dependencies: [] }),
    node('design-system', 'skill', { skills: ['ui-ux-pro-max', 'frontend'], outputs: ['design-system'], dependencies: ['design-direction'] }),
    node('implementation', 'agent', { agent: 'senior-engineer', outputs: ['implementation'], dependencies: ['design-system'] }),
    node('perf-check', 'gate', { validator: 'artifact.valid', outputs: ['perf-report'], dependencies: ['implementation'] }),
    node('critic', 'agent', { agent: 'adversarial-critic', outputs: ['critique'], dependencies: ['implementation'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['perf-check', 'critic'] }),
  ],

  /** Implementação simples: execução → QA → avaliação. */
  implementation: (ctx) => [
    node('execute', 'agent', { agent: ctx.primaryAgent, skills: ctx.skillChain, outputs: ['implementation'], dependencies: [] }),
    node('verify', 'agent', { agent: 'qa', outputs: ['qa-report'], dependencies: ['execute'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['verify'] }),
  ],

  /** Modelagem de dados: requisitos → schema → otimização → QA → avaliação. */
  database_design: (ctx) => [
    node('requirements', 'agent', { agent: 'database', outputs: ['requirements'], dependencies: [] }),
    node('schema', 'agent', { agent: 'database', outputs: ['database-schema'], dependencies: ['requirements'] }),
    node('optimize', 'agent', { agent: 'database', outputs: ['architecture'], dependencies: ['schema'] }),
    node('review', 'agent', { agent: 'qa', outputs: ['qa-report'], dependencies: ['optimize'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['review'] }),
  ],

  /** Infra/DevOps: análise → IaC → pipeline → observabilidade → avaliação. */
  devops_infra: (ctx) => [
    node('analysis', 'agent', { agent: 'devops', outputs: ['architecture'], dependencies: [] }),
    node('iac', 'agent', { agent: 'devops', outputs: ['implementation'], dependencies: ['analysis'] }),
    node('pipeline', 'agent', { agent: 'devops', outputs: ['implementation-plan'], dependencies: ['iac'] }),
    node('observability', 'agent', { agent: 'devops', outputs: ['qa-report'], dependencies: ['pipeline'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['observability'] }),
  ],

  /** QA/Testes: plano → execução → cobertura → avaliação. */
  testing: (ctx) => [
    node('test-plan', 'agent', { agent: 'qa', outputs: ['test-plan'], dependencies: [] }),
    node('execution', 'agent', { agent: 'qa', outputs: ['test-results'], dependencies: ['test-plan'] }),
    node('critic', 'agent', { agent: 'adversarial-critic', outputs: ['critique'], dependencies: ['execution'] }),
    node('evaluation', 'evaluator', { outputs: ['evaluation'], dependencies: ['critic'] }),
  ],
};

export const TEMPLATE_ORDER: string[] = [
  'fullstack',
  'debugging',
  'security_audit',
  'architecture',
  'automacao',
  'frontend',
  'database_design',
  'devops_infra',
  'testing',
  'implementation',
];

/** Mapeia categoria do classifier → template de workflow. */
export function templateForCategory(category: string): string {
  switch (category) {
    case 'fullstack':
    case 'saas':
      return 'fullstack';
    case 'debugging':
      return 'debugging';
    case 'security_audit':
      return 'security_audit';
    case 'architecture':
      return 'architecture';
    case 'automacao':
      return 'automacao';
    case 'frontend':
      return 'frontend';
    case 'database_design':
    case 'database':
      return 'database_design';
    case 'devops_infra':
    case 'devops':
      return 'devops_infra';
    case 'testing':
      return 'testing';
    case 'backend':
      return 'implementation';
    default:
      return 'implementation';
  }
}

export class Planner {
  constructor(private readonly builder = new ExecutionGraphBuilder()) {}

  /**
   * Planeja o grafo para a tarefa. `template` explícito vence; senão deriva
   * da categoria. Tarefas simples (1 agente) usam o template implementation.
   */
  plan(ctx: PlannerContext): ExecutionGraph {
    const templateId = ctx.workflow ?? templateForCategory(ctx.category);
    const template = WORKFLOW_TEMPLATES[templateId] ?? WORKFLOW_TEMPLATES.implementation;
    const nodes = template(ctx);

    return this.builder.build({
      task: ctx.task,
      nodes,
      budget: { maxAttempts: 3, maxTokens: 32000, maxTimeMs: 900_000 },
    });
  }

  /**
   * Replan — reconstrói o grafo após uma falha não-recuperável, marcando
   * nós já concluídos como skipped e substituindo o agente/skill falho.
   */
  replan(prev: ExecutionGraph, failedNodeId: string, replacement?: { agent?: string; skills?: string[] }): ExecutionGraph {
    const failed = prev.nodes.find((n) => n.id === failedNodeId);
    const nodes = prev.nodes.map((n) => {
      if (n.status === 'succeeded') return { ...n, status: 'skipped' as const };
      if (n.id === failedNodeId && failed) {
        return {
          ...n,
          status: 'pending' as const,
          attempts: 0,
          error: undefined,
          agent: replacement?.agent ?? n.agent,
          skills: replacement?.skills ?? n.skills,
          metadata: { ...n.metadata, replanned: true },
        };
      }
      return { ...n, status: (n.status === 'failed' ? 'pending' : n.status) as GraphNode['status'] };
    });

    return this.builder.build({
      id: `${prev.id}-replan-${Date.now() % 10000}`,
      task: prev.task,
      nodes,
      budget: prev.budget,
    });
  }
}

function node(id: string, kind: GraphNode['kind'], opts: Partial<GraphNode> & { dependencies: string[] }): GraphNode {
  return {
    id,
    kind,
    status: 'pending',
    retryPolicy: { maxAttempts: 2, backoffMs: 500, retryOnValidation: true },
    timeoutMs: 300_000,
    tokenBudget: 4000,
    ...opts,
  };
}
