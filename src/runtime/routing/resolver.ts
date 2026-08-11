/**
 * Skill Resolver com Scoring — resolve skills + agentes com pontuação.
 *
 * Estende o resolver legacy (aliases → paths) com:
 *  - parsing de frontmatter das skills (Skill Manifest)
 *  - scoring por relevância semântica + histórico (MemoryStore)
 *  - composições do skill-resolver.json (chains por domínio)
 */

import fs from 'fs';
import path from 'path';
import type { CandidateScore, SkillManifest } from '../types.js';
import { CandidateScorer, semanticRelevance } from './scorer.js';
import type { MemoryStore } from '../memory/store.js';

export interface ResolvedSkill {
  alias: string;
  path: string;
  manifest: SkillManifest;
  score: CandidateScore;
}

export interface ResolverOptions {
  baseDir: string;
  memory?: MemoryStore;
  scorer?: CandidateScorer;
}

/** Faz parse do frontmatter YAML simples (scalars + listas). Sem dependências. */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return fm;
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value: string = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (/^\[.*\]$/.test(value)) {
      fm[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      fm[key] = value;
    }
  }
  return fm;
}

/** Extrai o corpo da skill (remove frontmatter). */
export function stripFrontmatter(content: string): string {
  const m = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? content.slice(m[0].length) : content;
}

export class SkillResolver {
  private aliases: Map<string, string> = new Map();
  private readonly scorer: CandidateScorer;

  constructor(private readonly opts: ResolverOptions) {
    this.scorer = opts.scorer ?? new CandidateScorer();
    this.loadAliases();
  }

  /** Carrega aliases de core/skill-resolver.json (procura em baseDir e .agents). */
  private loadAliases(): void {
    const candidates = [
      path.join(this.opts.baseDir, 'core', 'skill-resolver.json'),
      path.join(this.opts.baseDir, '.agents', 'core', 'skill-resolver.json'),
    ];
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        for (const [k, v] of Object.entries(data.aliases ?? {})) {
          this.aliases.set(k, String(v));
        }
        return;
      } catch {
        // tenta o próximo
      }
    }
  }

  get aliasCount(): number {
    return this.aliases.size;
  }

  /** Resolve o caminho real do arquivo SKILL.md de um alias. */
  resolvePath(alias: string): string | null {
    const rel = this.aliases.get(alias);
    if (!rel) return null;
    const roots = [this.opts.baseDir, path.join(this.opts.baseDir, '.agents')];
    for (const root of roots) {
      const candidate = path.join(root, rel);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      if (fs.existsSync(candidate + '.md') && fs.statSync(candidate + '.md').isFile()) return candidate + '.md';
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        const skillFile = path.join(candidate, 'SKILL.md');
        if (fs.existsSync(skillFile)) return skillFile;
      }
    }
    return null;
  }

  /** Lê e parseia uma skill em SkillManifest. */
  loadSkill(alias: string): { manifest: SkillManifest; file: string } | null {
    const file = this.resolvePath(alias);
    if (!file) return null;
    const content = fs.readFileSync(file, 'utf-8');
    const fm = parseFrontmatter(content);
    const triggers = Array.isArray(fm.triggers)
      ? (fm.triggers as string[])
      : typeof fm.triggers === 'string' && fm.triggers
        ? [fm.triggers as string]
        : [];
    const deps = Array.isArray(fm.dependencies) ? (fm.dependencies as string[]) : [];
    const manifest: SkillManifest = {
      name: (fm.name as string) ?? alias,
      version: (fm.version as string) ?? '1.0.0',
      description: (fm.description as string) ?? '',
      capabilities: (fm.capabilities as string[]) ?? [],
      triggers,
      dependencies: deps,
      inputs: (fm.inputs as string[]) ?? [],
      outputs: (fm.outputs as string[]) ?? [],
      permissions: (fm.permissions as string[]) ?? [],
      compatibility: (fm.compatibility as string) ?? '>=1.0.0',
      risk: ((fm.risk as string) ?? 'low') as SkillManifest['risk'],
      tokenBudget: Number(fm.token_budget ?? fm.tokenBudget ?? 800),
      body: stripFrontmatter(content),
      path: file,
    };
    return { manifest, file };
  }

  /**
   * Ranking de skills para uma tarefa: relevância semântica (triggers +
   * description) + histórico de sucesso da memória.
   */
  rankSkills(query: string, limit = 8): ResolvedSkill[] {
    const results: ResolvedSkill[] = [];
    for (const alias of this.aliases.keys()) {
      const loaded = this.loadSkill(alias);
      if (!loaded) continue;
      const { manifest, file } = loaded;
      const haystack = [manifest.description, manifest.name, ...manifest.triggers, ...manifest.capabilities].join(' ');
      const relevance = semanticRelevance(query, haystack);
      if (relevance === 0) continue;

      const stats = this.opts.memory?.skillStats(alias);
      const historicalSuccess = stats && stats.uses > 0 ? stats.successes / stats.uses : 0.5;
      const score = this.scorer.score({
        candidate: alias,
        relevance,
        historicalSuccess,
        compatibility: 1,
        risk: riskNumber(manifest.risk),
        cost: costNumber(manifest.tokenBudget),
        latency: 0.5,
      });
      results.push({ alias, path: file, manifest, score });
    }
    return results.sort((a, b) => b.score.finalScore - a.score.finalScore).slice(0, limit);
  }

  /** Busca skills por termo (para `izanagi skill search`). */
  search(query: string, limit = 20): SkillManifest[] {
    const results: Array<{ manifest: SkillManifest; score: number }> = [];
    for (const alias of this.aliases.keys()) {
      const loaded = this.loadSkill(alias);
      if (!loaded) continue;
      const haystack = [loaded.manifest.name, loaded.manifest.description, ...loaded.manifest.triggers, ...loaded.manifest.capabilities].join(' ').toLowerCase();
      let score = 0;
      for (const term of query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)) {
        if (haystack.includes(term)) score += 1;
      }
      if (score > 0 || alias.includes(query.toLowerCase())) {
        results.push({ manifest: loaded.manifest, score: score + (alias.includes(query.toLowerCase()) ? 2 : 0) });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.manifest);
  }

  /** Lista todas as skills registradas com seus manifests. */
  list(): SkillManifest[] {
    const out: SkillManifest[] = [];
    for (const alias of this.aliases.keys()) {
      const loaded = this.loadSkill(alias);
      if (loaded) out.push(loaded.manifest);
    }
    return out;
  }

  /** Carrega o genome de um agente (JSON) com enriquecimento default. */
  loadAgent(agentId: string): { genome: import('../types.js').AgentGenome; file: string } | null {
    const candidates = [
      path.join(this.opts.baseDir, 'agents'),
      path.join(this.opts.baseDir, '.agents', 'agents'),
    ];
    const names = [`${agentId}-agent.json`, `${agentId}.json`];
    for (const dir of candidates) {
      for (const name of names) {
        const file = path.join(dir, name);
        if (fs.existsSync(file)) {
          try {
            const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
            return { genome: normalizeGenome(raw, agentId), file };
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  /** Ranking de agentes para uma tarefa (relevância + histórico). */
  rankAgents(query: string, agentIds: string[], limit = 5): CandidateScore[] {
    const scored: CandidateScore[] = [];
    for (const id of agentIds) {
      const loaded = this.loadAgent(id);
      const haystack = loaded
        ? [loaded.genome.purpose, loaded.genome.role ?? '', loaded.genome.name, ...loaded.genome.capabilities, ...(loaded.genome.skills ?? [])].join(' ')
        : id;
      const relevance = semanticRelevance(query, haystack);
      if (relevance === 0) continue;
      const stats = this.opts.memory?.agentStats(id);
      const historicalSuccess = stats && stats.runs > 0 ? stats.successes / stats.runs : 0.5;
      scored.push(
        this.scorer.score({
          candidate: id,
          relevance,
          historicalSuccess,
          compatibility: loaded ? 1 : 0.2,
          risk: 0.1,
          cost: loaded ? costNumber(loaded.genome.tokenBudget) : 0.5,
          latency: 0.5,
        }),
      );
    }
    return scored.sort((a, b) => b.finalScore - a.finalScore).slice(0, limit);
  }
}

/** Normaliza um JSON de agente legacy no formato AgentGenome (compatibilidade total). */
export function normalizeGenome(raw: Record<string, unknown>, id: string): import('../types.js').AgentGenome {
  const skills = Array.isArray(raw.skills) ? (raw.skills as string[]) : [];
  return {
    name: (raw.name as string) ?? id,
    version: (raw.version as string) ?? '1.0.0',
    purpose: (raw.role as string) ?? (raw.description as string) ?? '',
    capabilities: (raw.capabilities as string[]) ?? skills,
    requiredSkills: (raw.requiredSkills as string[]) ?? skills,
    optionalSkills: (raw.optionalSkills as string[]) ?? [],
    inputs: (raw.inputs as string[]) ?? ['task', 'context'],
    outputs: (raw.outputs as string[]) ?? ['texto'],
    constraints: (raw.constraints as string[]) ?? (Array.isArray(raw.never) ? (raw.never as string[]) : []),
    permissions: (raw.permissions as string[]) ?? [],
    handoffs: (raw.handoffs as Array<{ to: string; reason: string }>) ?? [],
    memory: (raw.memory as string[]) ?? ['memoria-projeto'],
    evaluation: (raw.evaluation as { metrics: import('../types.js').MetricName[]; minScore: number } | undefined) ?? { metrics: ['correctness'] as import('../types.js').MetricName[], minScore: 0.7 },
    tokenBudget: Number(raw.token_budget ?? raw.tokenBudget ?? 4096),
    compatibility: (raw.compatibility as string) ?? '>=2.0.0',
    model: raw.model as string | undefined,
    role: raw.role as string | undefined,
    identity: raw.identity as string | undefined,
    skills,
    chains: (raw.chains as Record<string, string[]>) ?? {},
    always: (raw.always as string[]) ?? [],
    never: (raw.never as string[]) ?? [],
  };
}

function riskNumber(risk: SkillManifest['risk']): number {
  switch (risk) {
    case 'high':
      return 0.8;
    case 'medium':
      return 0.5;
    default:
      return 0.15;
  }
}

function costNumber(tokenBudget: number): number {
  return Math.min(1, tokenBudget / 8000);
}
