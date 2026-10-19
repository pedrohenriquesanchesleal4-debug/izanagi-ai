/**
 * Agent Factory — gera agentes especializados a partir de requisitos.
 *
 * Pipeline: Requirements → Capability Analysis → Skill Discovery → Skill
 * Composition → Agent Prompt Generation → Guardrails → Evaluation → Genome
 * → Registration.
 *
 * O agente gerado passa por validação (genome completo) antes de ser
 * registrado em agents/generated/.
 */

import fs from 'fs';
import path from 'path';
import type { AgentGenome, Stack } from '../types.js';
import type { SkillResolver } from '../routing/resolver.js';
import { semanticRelevance } from '../routing/scorer.js';
import { AgentCapabilityRegistry, profileForAgent, type CoreProfileId } from '../registry/capabilities.js';
import { STACK_META, isValidStack, stackCapabilities, stackGuardrails, stackValidation } from './stacks.js';

export interface AgentFactoryInput {
  /** Descrição do agente desejado, ex.: "migração PHP legado para Laravel". */
  requirement: string;
  /** Nome do agente (slug). Default: derivado da requirement. */
  name?: string;
  /** Ids de skills obrigatórias adicionais. */
  requiredSkills?: string[];
  /**
   * Stack de destino (`ts | go | rust | python | all`). Diferente de `all`,
   * o genome nasce com capabilities, guardrails de validação e identity da
   * stack — ex.: `rust` exige `cargo clippy + cargo test` na entrega.
   */
  stack?: Stack;
  targetDir?: string;
  memory?: string[];
  /** Permissões explícitas solicitadas (passam por sanitização least-privilege). */
  permissions?: string[];
  /** Se false, gera o genome em memória sem gravar em disco (default: true). */
  persist?: boolean;
  /** Se true, verifica antes se perfil/agente + skills existentes já cobrem a necessidade. */
  checkCoverage?: boolean;
  /** Força a geração mesmo quando já coberto por agente/skills existentes. */
  force?: boolean;
}

export interface AgentNeedAssessment {
  needed: boolean;
  isTrivial: boolean;
  reason: string;
  coveredByAgent?: string;
  coveredByProfile?: CoreProfileId;
  recommendedSkills: string[];
  coverageScore: number;
}

export interface GeneratedAgent {
  genome: AgentGenome;
  file: string;
  chain: string[];
  validation: { valid: boolean; issues: string[] };
  assessment?: AgentNeedAssessment;
}

const FORBIDDEN_AGENT_PERMISSIONS = [
  /^sudo\b/i,
  /\brm\s+-rf\b/i,
  /^shell:\*$/i,
  /^fs:delete$/i,
  /^\*$/,
  /\bchmod\s+777\b/i,
];

export function sanitizePermissions(perms: string[] = []): string[] {
  return perms
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !FORBIDDEN_AGENT_PERMISSIONS.some((re) => re.test(p)));
}

export class AgentFactory {
  private readonly capabilitiesRegistry: AgentCapabilityRegistry;

  constructor(
    private readonly resolver: SkillResolver,
    capabilitiesRegistry?: AgentCapabilityRegistry,
  ) {
    this.capabilitiesRegistry =
      capabilitiesRegistry ?? new AgentCapabilityRegistry({ baseDir: process.cwd(), includeGenerated: false });
  }

  /**
   * Avalia se um novo agente é realmente necessário ou se um perfil/agente existente
   * combinado com skills do catálogo já cobre o requisito.
   */
  assessNeed(requirement: string): AgentNeedAssessment {
    const clean = requirement.trim().replace(/\s+/g, ' ');
    const words = clean.split(' ').filter((w) => w.length >= 2);
    const rankedSkills = this.resolver.rankSkills(clean, 6);
    const recommendedSkills = rankedSkills.slice(0, 4).map((r) => r.alias);

    if (clean.length < 18 || words.length < 3) {
      return {
        needed: false,
        isTrivial: true,
        reason: `Requisito trivial ou curto demais ("${clean}") — usar perfil builder/senior-engineer com skills existentes.`,
        coveredByAgent: 'senior-engineer',
        coveredByProfile: 'builder',
        recommendedSkills,
        coverageScore: 1,
      };
    }

    const matches = this.capabilitiesRegistry.findCapable(clean, { limit: 1 });
    const best = matches[0];
    const topSkillScore = rankedSkills[0]?.score?.finalScore ?? 0;
    if (best && (best.score >= 0.12 || (best.score >= 0.08 && topSkillScore >= 0.2))) {
      return {
        needed: false,
        isTrivial: false,
        reason: `Capacidade já coberta pelo agente "${best.agent.id}" (perfil "${best.agent.profile}", score ${best.score.toFixed(2)}) + skills [${recommendedSkills.join(', ')}].`,
        coveredByAgent: best.agent.id,
        coveredByProfile: best.agent.profile,
        recommendedSkills: recommendedSkills.length > 0 ? recommendedSkills : best.agent.skills.slice(0, 4),
        coverageScore: best.score,
      };
    }

    return {
      needed: true,
      isTrivial: false,
      reason: `Lacuna real de especialização: nenhum agente core atingiu cobertura suficiente (melhor score: ${(best?.score ?? 0).toFixed(2)}).`,
      recommendedSkills,
      coverageScore: best?.score ?? 0,
    };
  }

  /** Pipeline completo de geração. */
  generate(input: AgentFactoryInput): GeneratedAgent {
    const assessment = this.assessNeed(input.requirement);
    if (input.checkCoverage && !input.force && !assessment.needed) {
      throw new Error(`Criação de agente recusada: ${assessment.reason}`);
    }

    const name = input.name ?? deriveName(input.requirement);
    const purpose = input.requirement.trim().replace(/\s+/g, ' ');
    const stack: Stack = input.stack ?? 'all';

    // 1. Capability Analysis + Skill Discovery (ranking semântico)
    const ranked = this.resolver.rankSkills(input.requirement, 10);

    // 2. Skill Composition: requeridas + top ranked (completam capabilities)
    const required = [...new Set([...(input.requiredSkills ?? []), ...ranked.slice(0, 4).map((r) => r.alias)])];
    const optional = ranked.slice(4, 8).map((r) => r.alias);

    const capabilities = [...deriveCapabilities(input.requirement), ...stackCapabilities(stack)];
    const guardrails = deriveGuardrails(input.requirement, stack);

    // 3. Agent Prompt Generation (identity sintética em PT-BR)
    const identity = buildIdentity(name, purpose, capabilities, stack);

    // 4. Genome completo com least-privilege por padrão
    const genome: AgentGenome = {
      name: prettify(name),
      version: '1.0.0',
      purpose,
      capabilities,
      requiredSkills: required,
      optionalSkills: optional,
      inputs: ['task', 'context'],
      outputs: ['implementation', 'report'],
      constraints: guardrails.never,
      permissions: sanitizePermissions(input.permissions),
      handoffs: [{ to: 'senior-engineer', reason: 'implementacao' }, { to: 'qa', reason: 'verificacao' }],
      memory: input.memory ?? ['memoria-projeto', 'handoff-sessao'],
      evaluation: { metrics: ['correctness', 'requirementCoverage', 'maintainability'], minScore: 0.75 },
      tokenBudget: 6000,
      compatibility: '>=2.0.0',
      stacks: [stack],
      role: purpose,
      identity,
      skills: required,
      always: guardrails.always,
      never: guardrails.never,
    };

    // 5. Validação do genome
    const validation = validateGenome(genome);

    // 6. Registration — só grava em disco se o genome passou na validação e persist !== false
    if (!validation.valid || input.persist === false) {
      return { genome, file: '', chain: required, validation, assessment };
    }
    const targetDir = input.targetDir ?? path.join(process.cwd(), 'agents', 'generated');
    fs.mkdirSync(targetDir, { recursive: true });
    const file = path.join(targetDir, `${name}-agent.json`);
    fs.writeFileSync(file, JSON.stringify(genome, null, 2), 'utf-8');

    return { genome, file, chain: required, validation, assessment };
  }
}

export function validateGenome(genome: AgentGenome): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!genome.name) issues.push('nome ausente');
  if (!genome.version) issues.push('versão ausente');
  if (!genome.purpose || genome.purpose.length < 10) issues.push('purpose curto demais (< 10 chars)');
  if (genome.requiredSkills.length === 0) issues.push('nenhuma skill requerida');
  if (genome.inputs.length === 0) issues.push('inputs vazios');
  if (genome.outputs.length === 0) issues.push('outputs vazios');
  if (genome.tokenBudget <= 0) issues.push('tokenBudget inválido');
  if (Array.isArray(genome.permissions)) {
    for (const p of genome.permissions) {
      if (FORBIDDEN_AGENT_PERMISSIONS.some((re) => re.test(p))) {
        issues.push(`permissão excessiva ou insegura rejeitada (least-privilege): ${p}`);
      }
    }
  }
  if (genome.stacks) {
    for (const s of genome.stacks) {
      if (!isValidStack(s)) issues.push(`stack inválido: ${s}`);
    }
  }
  return { valid: issues.length === 0, issues };
}

function deriveName(requirement: string): string {
  const clean = requirement
    .toLowerCase()
    .split('')
    .map((c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ç: 'c', ' ': '-' })[c] ?? (/[a-z0-9-]/.test(c) ? c : ''))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const words = clean.split('-').filter((w) => w.length > 0);
  const key = words[words.length - 1] ?? 'specialist';
  return `${key}-specialist`;
}

function prettify(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function deriveCapabilities(requirement: string): string[] {
  const caps: string[] = [];
  const r = requirement.toLowerCase();
  if (/php|laravel|legado|legacy/.test(r)) caps.push('php', 'laravel', 'migração de código legado');
  if (/frontend|react|next|ui|interface/.test(r)) caps.push('frontend', 'ui/ux', 'componentes React/Next.js');
  if (/api|rest|graphql|endpoint/.test(r)) caps.push('api design', 'REST/GraphQL');
  if (/banco|database|sql|postgres|mysql/.test(r)) caps.push('modelagem de dados', 'SQL');
  if (/segurança|seguranca|auth|owasp/.test(r)) caps.push('segurança', 'autenticação');
  if (/automac|planilha|scrap|etl/.test(r)) caps.push('automação', 'ETL', 'planilhas');
  if (/debug|bug|corrig/.test(r)) caps.push('debugging', 'análise de causa raiz');
  caps.push('análise de requisitos', 'qualidade de código');
  return Array.from(new Set(caps));
}

function deriveGuardrails(requirement: string, stack?: Stack): { always: string[]; never: string[] } {
  const r = requirement.toLowerCase();
  const never: string[] = [
    'Gerar stubs, TODOs ou arquivos vazios',
    'Entregar checklist/resumo no lugar de código real completo',
    ...stackGuardrails(stack),
  ];
  if (/php|laravel|legado|legacy/.test(r)) {
    never.push('Reescrever o sistema inteiro sem estratégia de migração incremental');
  }
  const always = ['Documentar decisões relevantes', 'Validar a entrega com testes'];
  if (stack && stack !== 'all') {
    always.push(`Validar na stack antes de entregar: ${stackValidation(stack)}`);
  }
  return { always, never };
}

function buildIdentity(name: string, purpose: string, capabilities: string[], stack?: Stack): string {
  const stackHint = stack && stack !== 'all' ? ` Stack de destino: ${STACK_META[stack].label} (validação obrigatória: ${stackValidation(stack)}).` : '';
  return `Você é o agente especializado ${prettify(name)} do Izanagi AI. Propósito: ${purpose}. Capacidades: ${capabilities.join(', ')}.${stackHint} Trabalhe orientado a artefatos estruturados, aplique qualidade de produção (tipagem estrita, tratamento de erros, testes) e registre aprendizados na memória.`;
}
