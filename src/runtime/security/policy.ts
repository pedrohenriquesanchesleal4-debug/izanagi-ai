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
    return {
      allowed: true,
      requiresApproval: false,
      reason: 'nenhuma política restritiva aplicável neste contexto',
      ruleId: 'DEFAULT-ALLOW',
    };
  }
}
