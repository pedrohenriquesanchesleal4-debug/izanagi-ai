/**
 * Policy Engine — permissão CONTEXTUAL, distinta do Security Scanner.
 *
 * SkillScanner responde: "isso parece perigoso?" (varredura estática de
 * conteúdo). PolicyEngine responde: "isso é permitido NESTE CONTEXTO?" —
 * mesma ação pode ser permitida em desenvolvimento e bloqueada em produção,
 * ou permitida para uma skill curada (builtin) e negada para uma skill de
 * baixa confiança (community).
 *
 * Regras são avaliadas em ordem; a primeira que casar decide. Sem match,
 * o default é permitir (o gate de permissão bruta já é feito por quem
 * concede `ToolContext.permissions` — o Policy Engine restringe em cima
 * disso, não substitui o least-privilege da ToolRegistry).
 *
 * Esse default só é defensável para tool cujo código o runtime conhece. Uma
 * tool que entrou por `ToolRegistry.register` não tem regra escrita para ela,
 * e para essa o "não previsto" passa a exigir aprovação humana
 * (`EXTERNAL-TOOL-001`) em vez de virar "permitido".
 */

import type { ToolPermission } from '../tools/registry.js';

export type PolicyEnvironment = 'development' | 'ci' | 'production';

/**
 * Nível de confiança de quem está solicitando a ação — mesma escala usada
 * pelo SkillScanner/SkillFactory: skills embutidas no framework (builtin),
 * geradas pela Skill/Agent Factory (generated, já passaram por scan) ou
 * de fonte externa/comunidade (community, o padrão mais restrito).
 */
export type TrustTier = 'builtin' | 'generated' | 'community';

export type PolicyRequestKind =
  | 'tool'
  | 'filesystem-delete'
  | 'network'
  | 'dependency-install'
  | 'production-deploy'
  | 'skill-permission';

export interface PolicyRequest {
  kind: PolicyRequestKind;
  environment: PolicyEnvironment;
  /** Permissão de tool sendo exercida (kind === 'tool' | 'skill-permission'). */
  permission?: ToolPermission;
  trustTier?: TrustTier;
  /** Alvo da ação (path/URL/pacote) — usado só para contexto no motivo. */
  target?: string;
  description?: string;
  /**
   * Origem da TOOL, distinta do trust tier de quem a pede.
   *
   * `builtin`: a tool está no `ToolRegistry` do framework, o código dela foi
   * revisado junto com o runtime e cada uma tem regra de política acima.
   * `registered`: entrou por `ToolRegistry.register` em tempo de execução
   * (plugin, MCP, integração de quem embute o SDK) e o runtime nunca viu o
   * código dela.
   *
   * O default de política é PERMITIR quando nenhuma regra casa, e isso é uma
   * decisão defensável para as builtin (cobertas por regra e por permissão de
   * contrato) e indefensável para uma tool que chegou de fora sem nenhuma
   * regra escrita para ela. Este campo é o que permite separar os dois casos
   * sem virar o default do mundo inteiro e quebrar todo caminho existente.
   */
  toolOrigin?: 'builtin' | 'registered';
}

export interface PolicyDecision {
  allowed: boolean;
  /** Ação bloqueada mas pode prosseguir mediante aprovação humana (Fase 5: izanagi approve). */
  requiresApproval: boolean;
  reason: string;
  ruleId: string;
}

export interface PolicyRule {
  id: string;
  applies: (req: PolicyRequest) => boolean;
  decide: (req: PolicyRequest) => Omit<PolicyDecision, 'ruleId'>;
}

const DESTRUCTIVE_PERMISSIONS: ToolPermission[] = ['fs:write', 'shell'];

export const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    // Tool registrada em tempo de execução: nenhuma regra foi escrita para
    // ela, e cair no default-allow significaria que "não previsto" vira
    // "permitido". Exige aprovação humana explícita em vez de negar de vez:
    // negar tornaria o `ToolRegistry.register` inútil, e permitir em silêncio
    // é o buraco.
    //
    // A regra só age sobre tier DECLARADO e não-builtin. Tier ausente é o
    // chamador direto da `ToolRegistry` que não declarou nada, e esse é
    // necessariamente o dono do processo: dentro de um run o Orchestrator
    // sempre declara (`builtin` para nó de tool do próprio plano, `community`
    // para agente desconhecido). Exigir aprovação de quem chama o registry em
    // processo seria pedir a decisão a quem já a tomou, num caminho onde não
    // existe ninguém para aprovar.
    id: 'EXTERNAL-TOOL-001',
    applies: (r) =>
      r.kind === 'tool' &&
      r.toolOrigin === 'registered' &&
      r.trustTier !== undefined &&
      r.trustTier !== 'builtin',
    decide: (r) => ({
      allowed: false,
      requiresApproval: true,
      reason:
        `tool "${r.target ?? 'desconhecida'}" foi registrada em tempo de execução e não tem regra de política própria: ` +
        'exige aprovação humana (izanagi approve) antes de executar',
    }),
  },
  {
    id: 'PROD-DEPLOY-001',
    applies: (r) => r.kind === 'production-deploy',
    decide: () => ({
      allowed: false,
      requiresApproval: true,
      reason: 'deploy de produção sempre requer aprovação humana explícita (izanagi approve)',
    }),
  },
  {
    id: 'PROD-FS-DELETE-001',
    applies: (r) => r.kind === 'filesystem-delete' && r.environment === 'production',
    decide: () => ({
      allowed: false,
      requiresApproval: true,
      reason: 'operação destrutiva de filesystem em produção requer aprovação humana',
    }),
  },
  {
    id: 'PROD-DEP-INSTALL-001',
    applies: (r) => r.kind === 'dependency-install' && r.environment === 'production',
    decide: () => ({
      allowed: false,
      requiresApproval: true,
      reason: 'instalação de dependências em produção requer aprovação humana',
    }),
  },
  {
    id: 'COMMUNITY-DESTRUCTIVE-001',
    applies: (r) => r.kind === 'tool' && r.trustTier === 'community' && !!r.permission && DESTRUCTIVE_PERMISSIONS.includes(r.permission),
    decide: (r) => ({
      allowed: false,
      requiresApproval: false,
      reason: `skill de trust tier "community" não recebe "${r.permission}" por default — eleve o trust tier ou aprove explicitamente`,
    }),
  },
  {
    id: 'GENERATED-SHELL-001',
    applies: (r) => r.kind === 'tool' && r.trustTier === 'generated' && r.permission === 'shell',
    decide: () => ({
      allowed: false,
      requiresApproval: false,
      reason: 'skills/agents gerados pela Factory não recebem "shell" por default (defesa em profundidade pós-scan)',
    }),
  },
];

export class PolicyEngine {
  constructor(private readonly rules: PolicyRule[] = DEFAULT_POLICY_RULES) {}

  evaluate(req: PolicyRequest): PolicyDecision {
    for (const rule of this.rules) {
      if (rule.applies(req)) {
        return { ruleId: rule.id, ...rule.decide(req) };
      }
    }
    // Default-allow, e a escolha é deliberada: a `ToolRegistry` já negou o que
    // o contrato da tarefa não concedeu (menor privilégio por construção), e a
    // allowlist do run já negou o que não estava declarado. A política
    // RESTRINGE em cima disso; se ela também fosse o portão de concessão,
    // haveria três lugares decidindo a mesma coisa e nenhum deles seria o
    // lugar. O caso em que "não previsto" seria perigoso — tool de fora sem
    // regra — é coberto por `EXTERNAL-TOOL-001` acima.
    return {
      allowed: true,
      requiresApproval: false,
      reason: 'nenhuma política restritiva aplicável neste contexto',
      ruleId: 'DEFAULT-ALLOW',
    };
  }
}
