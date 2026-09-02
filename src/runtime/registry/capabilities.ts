/**
 * Agent Capability Registry: responde "quem sabe fazer isso?" sem que o
 * Commander precise conhecer agente por agente num prompt gigante.
 *
 * Antes deste módulo a lista de agentes era um array literal dentro do
 * orchestrator (`agentIds()`), que ficava desatualizado a cada agente novo e
 * ignorava agentes do projeto do usuário. Aqui a lista vem do disco: cada
 * `agents/<slug>-agent.json` declara capacidades, skills, custo e modelo.
 *
 * Determinístico por construção: descoberta = leitura de diretório, seleção =
 * scoring do CandidateScorer já existente. Nenhuma chamada de modelo.
 */

import fs from 'fs';
import path from 'path';
import type { AgentRole } from '../contracts/task-contract.js';
import type { TrustTier } from '../security/policy.js';
import { semanticRelevance } from '../routing/scorer.js';
import { detectDomains, domainOverlap, type Domain } from '../orchestration/domains.js';

export interface AgentCapability {
  id: string;
  name: string;
  purpose: string;
  capabilities: string[];
  skills: string[];
  chains: Record<string, string[]>;
  /** Teto declarado de tokens do agente (proxy de custo). */
  tokenBudget: number;
  /** Classe de custo derivada do tokenBudget: agentes caros só entram quando o papel justifica. */
  costClass: 'low' | 'medium' | 'high';
  /** Papel natural do agente na hierarquia. */
  role: AgentRole;
  /** Kinds de artefato que o agente costuma produzir (derivado das chains/capacidades). */
  outputs: string[];
  /**
   * Domínios técnicos cobertos pelo agente, detectados sobre a mesma tabela
   * bilíngue usada pelo Commander para classificar o objetivo. É o que faz um
   * agente descrito em inglês ("Clean Architecture") casar com um objetivo
   * escrito em português ("arquitetura limpa").
   */
  domains: Domain[];
  /**
   * Confiança de origem, derivada do diretório de onde o agente foi lido.
   * É o que a `PolicyEngine` usa para negar permissão destrutiva a agente que
   * não veio do framework. Derivar do caminho é deliberado: um agente não pode
   * declarar o próprio trust tier no JSON dele.
   */
  trustTier: TrustTier;
  file: string;
}

export interface CapabilityMatch {
  agent: AgentCapability;
  score: number;
  reasons: string[];
}

/** Agentes que raciocinam sobre o problema inteiro em vez de executar uma fatia. */
const COMMANDER_AGENTS = new Set(['discovery', 'architect', 'product-reasoner', 'pm', 'techlead', 'agent-architect']);
/** Agentes de tarefa curta e barata (extração, formatação, avaliação objetiva). */
const WORKER_AGENTS = new Set(['evaluator', 'docs', 'professor']);

function roleFor(id: string): AgentRole {
  if (COMMANDER_AGENTS.has(id)) return 'commander';
  if (WORKER_AGENTS.has(id)) return 'worker';
  return 'specialist';
}

/**
 * Trust tier pela ORIGEM do arquivo, nunca pelo que o arquivo declara:
 *   - `agents/generated/` : produzido pela Agent Factory desta instalação;
 *   - `.agents/`          : trazido pelo projeto do usuário (terceiro);
 *   - resto               : o catálogo do próprio framework.
 */
function trustTierFor(file: string): TrustTier {
  const normalized = file.replace(/\\/g, '/');
  if (/\/agents\/generated\//.test(normalized)) return 'generated';
  if (/\/\.agents\//.test(normalized)) return 'community';
  return 'builtin';
}

function costClassFor(tokenBudget: number): AgentCapability['costClass'] {
  if (tokenBudget >= 8000) return 'high';
  if (tokenBudget >= 4000) return 'medium';
  return 'low';
}

export class AgentCapabilityRegistry {
  private cache: AgentCapability[] | null = null;

  constructor(private readonly opts: { baseDir: string; extraDirs?: string[] }) {}

  /** Diretórios varridos, em ordem de precedência (projeto do usuário primeiro). */
  private dirs(): string[] {
    return [
      ...(this.opts.extraDirs ?? []),
      path.join(this.opts.baseDir, '.agents', 'agents'),
      path.join(this.opts.baseDir, 'agents'),
      path.join(this.opts.baseDir, 'agents', 'generated'),
    ];
  }

  /** Todos os agentes descobertos. Primeira declaração de um id vence. */
  list(): AgentCapability[] {
    if (this.cache) return this.cache;
    const byId = new Map<string, AgentCapability>();
    for (const dir of this.dirs()) {
      if (!fs.existsSync(dir)) continue;
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const id = entry.replace(/-agent\.json$/, '').replace(/\.json$/, '');
        if (byId.has(id)) continue;
        const parsed = this.parse(path.join(dir, entry), id);
        if (parsed) byId.set(id, parsed);
      }
    }
    this.cache = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    return this.cache;
  }

  private parse(file: string, id: string): AgentCapability | null {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
    const skills = Array.isArray(raw.skills) ? (raw.skills as string[]) : [];
    const chains = (raw.chains && typeof raw.chains === 'object' ? raw.chains : {}) as Record<string, string[]>;
    const tokenBudget = Number(raw.token_budget ?? raw.tokenBudget ?? 4096);
    const capabilities = Array.isArray(raw.capabilities) ? (raw.capabilities as string[]) : skills;
    return {
      id,
      name: (raw.name as string) ?? id,
      purpose: (raw.role as string) ?? (raw.description as string) ?? '',
      capabilities,
      skills,
      chains,
      tokenBudget,
      costClass: costClassFor(tokenBudget),
      role: roleFor(id),
      outputs: Array.isArray(raw.outputs) ? (raw.outputs as string[]) : [],
      domains: detectDomains([raw.role, raw.description, raw.name, ...capabilities, ...skills, ...Object.keys(chains)].filter(Boolean).join(' ')),
      trustTier: trustTierFor(file),
      file,
    };
  }

  get(id: string): AgentCapability | undefined {
    return this.list().find((a) => a.id === id);
  }

  ids(): string[] {
    return this.list().map((a) => a.id);
  }

  /**
   * Capability matching: ranqueia agentes capazes de atender a um objetivo.
   * `role` restringe ao nível hierárquico (não gasta um commander numa
   * extração); `exclude` remove agentes já descartados por falha.
   */
  findCapable(objective: string, opts: { role?: AgentRole; limit?: number; exclude?: string[] } = {}): CapabilityMatch[] {
    const exclude = new Set(opts.exclude ?? []);
    const objectiveDomains = detectDomains(objective);
    const matches: CapabilityMatch[] = [];
    for (const agent of this.list()) {
      if (exclude.has(agent.id)) continue;
      if (opts.role && agent.role !== opts.role) continue;
      const haystack = [agent.purpose, agent.name, agent.id, ...agent.capabilities, ...agent.skills, ...Object.keys(agent.chains)].join(' ');
      const lexical = semanticRelevance(objective, haystack);
      const domainFit = domainOverlap(objectiveDomains, agent.domains);
      if (lexical <= 0 && domainFit <= 0) continue;
      const reasons: string[] = [];
      if (lexical > 0) reasons.push(`relevância léxica ${lexical.toFixed(2)}`);
      if (domainFit > 0) {
        const shared = objectiveDomains.filter((d) => agent.domains.includes(d));
        reasons.push(`domínios em comum: ${shared.join(', ')}`);
      }
      // Custo entra como desempate: entre dois agentes igualmente relevantes,
      // o mais barato vence (princípio "mínima inteligência necessária").
      const costPenalty = agent.costClass === 'high' ? 0.08 : agent.costClass === 'medium' ? 0.03 : 0;
      if (costPenalty > 0) reasons.push(`custo ${agent.costClass}`);
      const score = Math.max(0, lexical * 0.6 + domainFit * 0.4 - costPenalty);
      matches.push({ agent, score, reasons });
    }
    matches.sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id));
    return matches.slice(0, opts.limit ?? 3);
  }

  /** Melhor agente para um objetivo, ou null quando nada casa. */
  bestFor(objective: string, opts: { role?: AgentRole; exclude?: string[] } = {}): AgentCapability | null {
    const found = this.findCapable(objective, { ...opts, limit: 1 });
    return found[0]?.agent ?? null;
  }

  /** Chain de skills declarada pelo agente para uma categoria, com fallback estável. */
  chainFor(agentId: string, category: string): string[] {
    const agent = this.get(agentId);
    if (!agent) return [];
    if (Array.isArray(agent.chains[category])) return agent.chains[category];
    const first = Object.values(agent.chains)[0];
    if (Array.isArray(first)) return first;
    return agent.skills.slice(0, 5);
  }

  /** Invalida o cache (útil depois que a Agent Factory gera um agente novo). */
  refresh(): void {
    this.cache = null;
  }
}
