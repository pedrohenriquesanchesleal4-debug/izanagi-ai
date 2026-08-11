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
import type { AgentGenome } from '../types.js';
import type { SkillResolver } from '../routing/resolver.js';
import { semanticRelevance } from '../routing/scorer.js';

export interface AgentFactoryInput {
  /** Descrição do agente desejado, ex.: "migração PHP legado para Laravel". */
  requirement: string;
  /** Nome do agente (slug). Default: derivado da requirement. */
  name?: string;
  /** Ids de skills obrigatórias adicionais. */
  requiredSkills?: string[];
  targetDir?: string;
  memory?: string[];
}

export interface GeneratedAgent {
  genome: AgentGenome;
  file: string;
  chain: string[];
  validation: { valid: boolean; issues: string[] };
}

export class AgentFactory {
  constructor(private readonly resolver: SkillResolver) {}

  /** Pipeline completo de geração. */
  generate(input: AgentFactoryInput): GeneratedAgent {
    const name = input.name ?? deriveName(input.requirement);
    const purpose = input.requirement.trim().replace(/\s+/g, ' ');

    // 1. Capability Analysis + Skill Discovery (ranking semântico)
    const ranked = this.resolver.rankSkills(input.requirement, 10);

    // 2. Skill Composition: requeridas + top ranked (completam capabilities)
    const required = [...new Set([...(input.requiredSkills ?? []), ...ranked.slice(0, 4).map((r) => r.alias)])];
    const optional = ranked.slice(4, 8).map((r) => r.alias);

    const capabilities = deriveCapabilities(input.requirement);
    const guardrails = deriveGuardrails(input.requirement);

    // 3. Agent Prompt Generation (identity sintética em PT-BR)
    const identity = buildIdentity(name, purpose, capabilities);

    // 4. Genome completo
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
      permissions: [],
      handoffs: [{ to: 'senior-engineer', reason: 'implementacao' }, { to: 'qa', reason: 'verificacao' }],
      memory: input.memory ?? ['memoria-projeto', 'handoff-sessao'],
      evaluation: { metrics: ['correctness', 'requirementCoverage', 'maintainability'], minScore: 0.75 },
      tokenBudget: 6000,
      compatibility: '>=2.0.0',
      role: purpose,
      identity,
      skills: required,
      always: guardrails.always,
      never: guardrails.never,
    };

    // 5. Validação do genome
    const validation = validateGenome(genome);

    // 6. Registration
    const targetDir = input.targetDir ?? path.join(process.cwd(), 'agents', 'generated');
    fs.mkdirSync(targetDir, { recursive: true });
    const file = path.join(targetDir, `${name}-agent.json`);
    fs.writeFileSync(file, JSON.stringify(genome, null, 2), 'utf-8');

    return { genome, file, chain: required, validation };
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

function deriveGuardrails(requirement: string): { always: string[]; never: string[] } {
  const r = requirement.toLowerCase();
  const never: string[] = [
    'Gerar stubs, TODOs ou arquivos vazios',
    'Entregar checklist/resumo no lugar de código real completo',
  ];
  if (/php|laravel|legado|legacy/.test(r)) {
    never.push('Reescrever o sistema inteiro sem estratégia de migração incremental');
  }
  const always = ['Documentar decisões relevantes', 'Validar a entrega com testes'];
  return { always, never };
}

function buildIdentity(name: string, purpose: string, capabilities: string[]): string {
  return `Você é o agente especializado ${prettify(name)} do Izanagi AI. Propósito: ${purpose}. Capacidades: ${capabilities.join(', ')}. Trabalhe orientado a artefatos estruturados, aplique qualidade de produção (tipagem estrita, tratamento de erros, testes) e registre aprendizados na memória.`;
}
