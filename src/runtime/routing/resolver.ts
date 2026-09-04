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

/** Remove um par de aspas simples ou duplas ao redor do valor. */
function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

/**
 * Faz parse do frontmatter YAML simples (scalars + listas inline e de bloco).
 * Sem dependências.
 *
 * A lista de BLOCO (`triggers:` seguido de linhas `  - valor`) foi acrescentada
 * porque produtor e consumidor deste mesmo repositório estavam em formatos
 * incompatíveis: a `SkillFactory` escreve exclusivamente lista de bloco
 * (`factories/skill-factory.ts`), e o parser só entendia escalar ou `[a, b]`
 * inline. O efeito não era erro: `triggers:` casava com o regex de chave e
 * gravava string vazia, as linhas `  - valor` não casavam com nada e eram
 * puladas, e `readSkill` derivava `[]`. Toda skill gerada pela Factory (e toda
 * skill sintetizada por trajetória, que usa o mesmo escritor) perdia em
 * silêncio justamente o metadado pelo qual `rankSkills` a encontraria.
 *
 * Chave aninhada (`tools:` → `  mcp:` → `    - x`) continua fora de escopo, e
 * de propósito: o único consumidor é `SkillManifest`, que é plano. Um parser
 * YAML de verdade aqui seria dependência nova para ler seis campos.
 */
export function parseFrontmatter(content: string): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return fm;
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = unquote(m[2].trim());

    if (/^\[.*\]$/.test(value)) {
      fm[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
      continue;
    }

    // Chave sem valor na própria linha: pode ser lista de bloco. Olha adiante
    // sem consumir, para que uma chave vazia de verdade siga sendo string
    // vazia em vez de virar `[]` (ausência de valor não é lista vazia).
    if (value === '') {
      const items: string[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const item = lines[j].match(/^\s+-\s+(.*)$/);
        if (!item) break;
        const parsed = unquote(item[1].trim());
        if (parsed) items.push(parsed);
      }
      if (items.length > 0) {
        fm[key] = items;
        i = j - 1;
        continue;
      }
    }

    fm[key] = value;
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
  /**
   * Manifesto por alias, memoizado. `rankSkills` varre a biblioteca inteira a
   * cada chamada; sem cache, ranquear skills por TAREFA (e não por run) faria
   * a mesma centena de arquivos ser lida do disco uma vez por nó do grafo.
   * `null` também é cacheado: alias que não resolve não precisa ser tentado de
   * novo dentro do mesmo processo.
   */
  private readonly manifestCache = new Map<string, { manifest: SkillManifest; file: string } | null>();

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
    const cached = this.manifestCache.get(alias);
    if (cached !== undefined) return cached;
    const loaded = this.readSkill(alias);
    this.manifestCache.set(alias, loaded);
    return loaded;
  }

  /** Invalida o cache de manifestos (ex.: depois da Skill Factory gerar uma skill). */
  clearCache(): void {
    this.manifestCache.clear();
  }

  private readSkill(alias: string): { manifest: SkillManifest; file: string } | null {
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
      lifecycle: ((fm.lifecycle as string) ?? 'active') as SkillManifest['lifecycle'],
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
      path.join(this.opts.baseDir, 'agents', 'generated'),
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

  /** Ranking otimizado com lazy-load e pruning por relevância e custo (Token Economy). */
  rankAgents(query: string, agentIds: string[], limit = 3): CandidateScore[] {
    const scored: CandidateScore[] = [];
    const q = query.toLowerCase();
    for (const id of agentIds) {
      const loaded = this.loadAgent(id);
      if (!loaded) continue;
      // Pruning por incapacidade óbvia (otimização de token e latência)
      const haystack = [loaded.genome.purpose, loaded.genome.role ?? '', loaded.genome.name, ...loaded.genome.capabilities, ...(loaded.genome.skills ?? [])].join(' ').toLowerCase();
      const relevance = semanticRelevance(q, haystack);
      if (relevance < 0.15 && agentIds.length > 5) continue; // descarta candidatos irrelevantes em seleções amplas

      const stats = this.opts.memory?.agentStats(id);
      const historicalSuccess = stats && stats.runs > 0 ? stats.successes / stats.runs : 0.5;
      const costPenalty = costNumber(loaded.genome.tokenBudget);

      scored.push(
        this.scorer.score({
          candidate: id,
          relevance,
          historicalSuccess,
          compatibility: 1,
          risk: 0.1,
          cost: costPenalty,
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
