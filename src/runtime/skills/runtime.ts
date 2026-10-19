/**
 * Skill Runtime — Resolução centralizada, progressive disclosure em 3 níveis,
 * cache com hash SHA-256 e rastreabilidade completa (proveniência) de skills.
 *
 * Estágios rastreados por execução de nó:
 *   candidate -> selected -> resolved -> loaded -> injected -> validated (+ dropped)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveSkillPath } from '../../cli/framework.js';
import {
  parseFrontmatter,
  isV2Skill,
  layeredSkillSummary,
  findV2Counterpart,
  splitTopLevelSections,
} from '../text/frontmatter.js';

export type SkillDisclosureLevel = 'metadata' | 'instructions' | 'references';

export type SkillSelectionReason =
  | 'node-contract'
  | 'domain-policy'
  | 'task-relevance'
  | 'primary-fallback';

export type SkillDropReason =
  | 'budget-cap'
  | 'low-relevance'
  | 'not-found'
  | 'duplicate'
  | 'invalid-path';

export interface LoadedSkillEntry {
  alias: string;
  canonicalName: string;
  version: string;
  category: string;
  description: string;
  path: string;
  sourceCatalog: 'v2' | 'v1' | 'generated' | 'agent-skill';
  sha256: string;
  level: SkillDisclosureLevel;
  selectionReason: SkillSelectionReason;
  injectedText: string;
  tokens: number;
  lines: number;
  truncated: boolean;
  omittedSections: string[];
  referencesLoaded: string[];
}

export interface DroppedSkillEntry {
  alias: string;
  reason: SkillDropReason;
  detail?: string;
}

export interface SkillProvenanceReport {
  candidates: string[];
  selected: Array<{ alias: string; reason: SkillSelectionReason; score: number }>;
  resolved: Array<{ alias: string; canonicalName: string; path: string; sourceCatalog: LoadedSkillEntry['sourceCatalog'] }>;
  loaded: Array<{ alias: string; canonicalName: string; version: string; sha256: string; level: SkillDisclosureLevel }>;
  injected: Array<{
    alias: string;
    canonicalName: string;
    tokens: number;
    lines: number;
    truncated: boolean;
    omittedSections: string[];
  }>;
  validated: Array<{ alias: string; passed: boolean; note?: string }>;
  dropped: DroppedSkillEntry[];
  totalTokensInjected: number;
}

interface CacheRecord {
  mtimeMs: number;
  sha256: string;
  rawContent: string;
  canonicalName: string;
  version: string;
  category: string;
  description: string;
}

const FILE_CACHE = new Map<string, CacheRecord>();

/**
 * Mapa de vocabulário de domínio para ativação semântica de skills mesmo quando
 * o prompt do usuário não cita o slug literal da skill (ex.: "landing page para
 * cafeteria" precisa ativar `anti-ai-slop`, `design-directions`, `frontend`,
 * `editorial-layout`, `ui-ux-pro-max`, `design-taste`).
 */
const DOMAIN_SKILL_SYNONYMS: Record<string, string[]> = {
  'anti-ai-slop': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'dashboard', 'app', 'design', 'visual', 'component', 'componente', 'estilo', 'layout', 'saas', 'portfolio', 'home', 'checkout', 'slop'],
  'design-directions': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'dashboard', 'app', 'design', 'visual', 'estilo', 'layout', 'saas', 'portfolio', 'direcao', 'paleta', 'tipografia', 'brand', 'marca'],
  'design-taste': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'dashboard', 'app', 'design', 'visual', 'estilo', 'layout', 'saas', 'taste', 'estetica', 'tipografia'],
  'editorial-layout': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'design', 'layout', 'editorial', 'grid', 'hero', 'portfolio', 'revista', 'tipografia'],
  'ui-ux-pro-max': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'dashboard', 'app', 'design', 'component', 'componente', 'layout', 'saas', 'usabilidade'],
  frontend: ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'dashboard', 'react', 'next', 'nextjs', 'tailwind', 'css', 'html', 'component', 'componente', 'layout', 'saas'],
  'web-design-guidelines': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'design', 'acessibilidade', 'wcag', 'layout', 'playwright', 'navegacao', 'e2e'],
  'refero-styles': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'dashboard', 'design', 'saas', 'referencia'],
  'accessibility-reviewer': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'form', 'formulario', 'acessibilidade', 'wcag', 'a11y', 'aria', 'contraste', 'teclado'],
  'ux-reviewer': ['ui', 'ux', 'frontend', 'landing', 'page', 'site', 'web', 'interface', 'tela', 'fluxo', 'conversao', 'checkout', 'onboarding', 'usabilidade', 'nielsen'],
  'motion-design': ['ui', 'frontend', 'landing', 'page', 'site', 'animacao', 'animation', 'scroll', 'gsap', 'motion', 'transicao', 'interacao', 'cinematic'],
  'animation-web': ['ui', 'frontend', 'landing', 'page', 'site', 'animacao', 'animation', 'scroll', 'scrollytelling', 'parallax', 'canvas', 'cinematic'],
  'webgl-3d': ['3d', 'webgl', 'three', 'threejs', 'r3f', 'shader', 'glsl', 'particulas', 'canvas'],
  'web-forms': ['form', 'formulario', 'input', 'checkout', 'cadastro', 'login', 'wizard', 'validacao', 'zod'],
  'conversion-copywriting': ['landing', 'page', 'site', 'copy', 'copywriting', 'headline', 'cta', 'conversao', 'vendas', 'pricing', 'onboarding'],
  'react-next-practices': ['react', 'next', 'nextjs', 'frontend', 'ssr', 'rsc', 'suspense', 'app', 'saas', 'web'],
  'browser-playwright': ['playwright', 'e2e', 'browser', 'navegador', 'navegacao', 'teste', 'testes', 'ui', 'scraping', 'automacao'],
  'browser-automation': ['playwright', 'e2e', 'browser', 'navegador', 'navegacao', 'automacao', 'scraping', 'extracao', 'web'],
  'webapp-testing': ['playwright', 'e2e', 'browser', 'navegador', 'teste', 'testes', 'ui', 'web', 'qa', 'verificar'],
  'systematic-debugging': ['bug', 'erro', 'error', 'crash', 'debug', 'falha', 'corrigir', 'fix', '500', 'exception', 'stack', 'trace', 'intermitente', 'regressao'],
  'bug-hunter': ['bug', 'erro', 'error', 'crash', 'debug', 'falha', 'corrigir', 'fix', '500', 'exception', 'intermitente', 'regressao'],
  'root-cause-analyzer': ['bug', 'erro', 'error', 'crash', 'debug', 'falha', 'causa', 'raiz', 'rca', '500', 'incidente'],
  'error-recovery': ['bug', 'erro', 'error', 'falha', 'retry', 'timeout', 'resiliencia', 'checkpoint', 'recuperacao'],
  tdd: ['teste', 'testes', 'test', 'unit', 'unitario', 'tdd', 'implementar', 'funcao', 'feature', 'bug', 'corrigir', 'codigo', 'api', 'backend', 'regressao'],
  qa: ['teste', 'testes', 'test', 'qa', 'qualidade', 'auditar', 'validar', 'verificacao', 'e2e', 'integracao', 'unitario'],
  'security-privacy': ['seguranca', 'security', 'auth', 'autenticacao', 'login', 'jwt', 'oauth', 'owasp', 'vulnerabilidade', 'senha', 'token', 'lgpd', 'gdpr', 'api', 'pagamento', 'billing', 'auditoria'],
  'code-auditor': ['seguranca', 'security', 'auditar', 'auditoria', 'review', 'revisar', 'owasp', 'vulnerabilidade', 'pr', 'qualidade', 'critica'],
  'defense-in-depth': ['seguranca', 'security', 'auth', 'autenticacao', 'api', 'rate', 'limit', 'camadas', 'protecao'],
  'data-engineering': ['banco', 'database', 'db', 'sql', 'postgres', 'postgresql', 'mysql', 'redis', 'mongo', 'schema', 'migration', 'migracao', 'tabela', 'query', 'etl', 'dados', 'prisma', 'drizzle'],
  'data-validation': ['dados', 'validacao', 'validar', 'schema', 'zod', 'pydantic', 'form', 'formulario', 'planilha', 'api', 'importacao'],
  'architecture-patterns': ['arquitetura', 'architecture', 'clean', 'ddd', 'cqrs', 'hexagonal', 'sistema', 'saas', 'backend', 'api', 'microsservico', 'modular', 'adr', 'refatorar'],
  'software-architect': ['arquitetura', 'architecture', 'design', 'sistema', 'saas', 'escalabilidade', 'adr', 'componentes', 'backend'],
  'requirement-analyzer': ['requisito', 'requisitos', 'bdd', 'escopo', 'produto', 'historia', 'criterio', 'aceite', 'saas', 'sistema'],
  'deep-research': ['pesquisa', 'pesquisar', 'research', 'comparar', 'mercado', 'concorrente', 'preco', 'stack', 'referencia', 'documentacao', 'evidencia'],
  'reference-retrieval': ['referencia', 'documentacao', 'api', 'sdk', 'integracao', 'exemplo', 'contrato'],
  'agentic-coding': ['implementar', 'criar', 'construir', 'desenvolver', 'codigo', 'feature', 'funcao', 'api', 'backend', 'fullstack', 'saas', 'refatorar'],
  graphql: ['graphql', 'apollo', 'schema', 'resolver', 'resolvers', 'query', 'mutation'],
  wasm: ['wasm', 'webassembly', 'rust', 'browser', 'nativo'],
  'mobile-dev': ['mobile', 'ios', 'android', 'react-native', 'expo', 'flutter', 'pwa', 'celular'],
  database: ['banco', 'database', 'db', 'sql', 'postgres', 'postgresql', 'mysql', 'redis', 'schema', 'migration', 'migracao', 'tabela', 'query'],
};

const STOPWORDS = new Set([
  'para', 'com', 'sem', 'uma', 'uns', 'umas', 'dos', 'das', 'nos', 'nas',
  'por', 'pelo', 'pela', 'que', 'como', 'mais', 'menos', 'muito', 'sobre',
  'entre', 'apos', 'antes', 'depois', 'the', 'and', 'for', 'with', 'from',
  'into', 'this', 'that', 'skill', 'izanagi', 'tarefa', 'sistema',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenizeTask(task: string): Set<string> {
  return new Set(
    normalizeText(task)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w)),
  );
}

/**
 * Pontua a relevância de uma skill candidata contra uma tarefa usando:
 * 1) match direto nos tokens do slug da skill;
 * 2) vocabulário de domínio (`DOMAIN_SKILL_SYNONYMS`);
 * 3) prefix matching (ex.: "migracao" <-> "migration", "autenticacao" <-> "auth").
 */
export function scoreSkillRelevance(skillAlias: string, taskTokens: Set<string>, normalizedTask: string): number {
  const cleanAlias = normalizeText(skillAlias);
  const slugParts = cleanAlias.split(/[-_/]+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  let score = 0;

  for (const part of slugParts) {
    if (taskTokens.has(part)) {
      score += 3;
    } else if (part.length >= 4 && normalizedTask.includes(part)) {
      score += 2;
    } else if (part.length >= 4) {
      for (const t of taskTokens) {
        if (t.length >= 4 && (t.startsWith(part.slice(0, 4)) || part.startsWith(t.slice(0, 4)))) {
          score += 1.5;
          break;
        }
      }
    }
  }

  const synonyms = DOMAIN_SKILL_SYNONYMS[skillAlias] ?? DOMAIN_SKILL_SYNONYMS[cleanAlias] ?? [];
  for (const syn of synonyms) {
    const normSyn = normalizeText(syn);
    if (taskTokens.has(normSyn)) {
      score += 2;
    } else if (normSyn.length >= 4 && normalizedTask.includes(normSyn)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Seleciona cirurgicamente até `maxSkills` (default 8) a partir de uma lista
 * de candidatas.
 *
 * Quando `explicitSkills` é informado (ex.: skills declaradas diretamente no
 * nó do grafo pelo Planner/Commander), elas têm prioridade máxima (`node-contract`)
 * e NUNCA são descartadas por falta de match literal no prompt do usuário.
 */
export function selectRelevantSkillsWithProvenance(
  candidates: string[],
  task: string,
  maxSkills = 8,
  explicitSkills: string[] = [],
): {
  selected: Array<{ alias: string; reason: SkillSelectionReason; score: number }>;
  dropped: DroppedSkillEntry[];
} {
  const seen = new Set<string>();
  const uniqueCandidates: string[] = [];
  const dropped: DroppedSkillEntry[] = [];

  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const trimmed = c.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) {
      dropped.push({ alias: trimmed, reason: 'duplicate', detail: 'skill duplicada na lista de candidatas' });
      continue;
    }
    seen.add(trimmed);
    uniqueCandidates.push(trimmed);
  }

  if (uniqueCandidates.length === 0) {
    return { selected: [], dropped };
  }

  const explicitSet = new Set(explicitSkills.map((s) => s.trim()).filter(Boolean));
  const normalizedTask = normalizeText(task);
  const taskTokens = tokenizeTask(task);

  const selected: Array<{ alias: string; reason: SkillSelectionReason; score: number }> = [];

  // 1. Skills explícitas do contrato do nó entram primeiro (nunca descartadas em silêncio)
  for (const skill of uniqueCandidates) {
    if (!explicitSet.has(skill)) continue;
    const score = scoreSkillRelevance(skill, taskTokens, normalizedTask);
    if (selected.length < maxSkills) {
      selected.push({ alias: skill, reason: 'node-contract', score: Math.max(score, 1) });
    } else {
      dropped.push({ alias: skill, reason: 'budget-cap', detail: `limite de ${maxSkills} skills por nó atingido` });
    }
  }

  // 2. Candidatas restantes (ex.: catálogo geral do agente) passam por relevância
  const remaining = uniqueCandidates.filter((s) => !explicitSet.has(s));
  if (remaining.length > 0) {
    const scored = remaining.map((skill, index) => ({
      skill,
      index,
      score: scoreSkillRelevance(skill, taskTokens, normalizedTask),
    }));

    const positive = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);

    if (positive.length > 0) {
      for (const item of positive) {
        if (selected.length < maxSkills) {
          selected.push({ alias: item.skill, reason: 'task-relevance', score: item.score });
        } else {
          dropped.push({ alias: item.skill, reason: 'budget-cap', detail: `limite de ${maxSkills} skills atingido` });
        }
      }
      for (const item of scored.filter((s) => s.score <= 0)) {
        dropped.push({ alias: item.skill, reason: 'low-relevance', detail: 'score 0 contra o objetivo da tarefa' });
      }
    } else if (selected.length === 0) {
      // Nenhuma explícita e nenhuma com score > 0: mantém apenas a 1ª skill primária
      selected.push({ alias: remaining[0], reason: 'primary-fallback', score: 0 });
      for (const item of remaining.slice(1)) {
        dropped.push({ alias: item, reason: 'low-relevance', detail: 'fallback de tarefa genérica (apenas 1 skill primária)' });
      }
    } else {
      for (const item of remaining) {
        dropped.push({ alias: item, reason: 'low-relevance', detail: 'score 0 e nó já possui skills explícitas' });
      }
    }
  }

  return { selected, dropped };
}

function readCachedSkillFile(filePath: string): CacheRecord | null {
  try {
    const stat = fs.statSync(filePath);
    const cached = FILE_CACHE.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached;
    }
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const sha256 = crypto.createHash('sha256').update(rawContent).digest('hex');
    const fm = parseFrontmatter(rawContent);
    const canonicalName =
      typeof fm?.data.name === 'string' && fm.data.name
        ? fm.data.name
        : path.basename(path.dirname(filePath));
    const version =
      typeof fm?.data.version === 'string' && fm.data.version ? fm.data.version : '1.0.0';
    const category =
      typeof fm?.data.category === 'string' && fm.data.category ? fm.data.category : 'general';
    const description =
      typeof fm?.data.description === 'string' && fm.data.description
        ? fm.data.description
        : rawContent.split(/\r?\n/).find((l) => l.trim().length > 0 && !l.startsWith('#'))?.trim() ?? '';

    const rec: CacheRecord = {
      mtimeMs: stat.mtimeMs,
      sha256,
      rawContent,
      canonicalName,
      version,
      category,
      description,
    };
    FILE_CACHE.set(filePath, rec);
    return rec;
  } catch {
    return null;
  }
}

function classifyCatalog(filePath: string): LoadedSkillEntry['sourceCatalog'] {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('/.skills/')) return 'v2';
  if (norm.includes('/skills/generated/')) return 'generated';
  if (norm.includes('/.agents/skills/')) return 'agent-skill';
  return 'v1';
}

function extractOmittedAndTruncated(summaryText: string): { truncated: boolean; omittedSections: string[] } {
  const omittedMatch = summaryText.match(/seções omitidas:\s*([^;)\n]+)/i);
  const truncatedMatch = summaryText.match(/seções truncadas:\s*([^;)\n]+)/i) ?? summaryText.match(/skill truncada em/i);
  const omittedSections = omittedMatch
    ? omittedMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const truncated = Boolean(truncatedMatch);
  return { truncated, omittedSections };
}

export class SkillRuntime {
  constructor(
    private readonly opts: {
      cwd: string;
      baseDir: string;
      maxSkills?: number;
      maxLinesPerSkill?: number;
      defaultLevel?: SkillDisclosureLevel;
    },
  ) {}

  /**
   * Carrega uma única skill no nível de progressive disclosure solicitado
   * (`metadata` | `instructions` | `references`).
   */
  loadSkill(
    alias: string,
    level: SkillDisclosureLevel = 'instructions',
    opts?: { maxLines?: number; loadReferences?: boolean },
  ): LoadedSkillEntry | undefined {
    const res = this.compileSkills({
      candidates: [alias],
      explicitSkills: [alias],
      task: alias,
      level,
      maxSkills: 1,
      maxLinesPerSkill: opts?.maxLines,
      loadReferences: opts?.loadReferences,
    });
    return res.loadedSkills[0];
  }

  /**
   * Executa o pipeline completo de seleção, resolução, carregamento progressivo
   * e compilação de skills com relatório estruturado de proveniência.
   */
  compileSkills(params: {
    candidates: string[];
    explicitSkills?: string[];
    task: string;
    level?: SkillDisclosureLevel;
    maxSkills?: number;
    maxLinesPerSkill?: number;
    loadReferences?: boolean;
  }): {
    loadedSkills: LoadedSkillEntry[];
    provenance: SkillProvenanceReport;
    renderedPromptBlock: string;
  } {
    const maxSkills = params.maxSkills ?? this.opts.maxSkills ?? 8;
    const maxLines = params.maxLinesPerSkill ?? this.opts.maxLinesPerSkill ?? 60;
    const level: SkillDisclosureLevel =
      params.loadReferences ? 'references' : (params.level ?? this.opts.defaultLevel ?? 'instructions');

    const { selected, dropped } = selectRelevantSkillsWithProvenance(
      params.candidates,
      params.task,
      maxSkills,
      params.explicitSkills ?? [],
    );

    const resolvedList: SkillProvenanceReport['resolved'] = [];
    const loadedList: SkillProvenanceReport['loaded'] = [];
    const injectedList: SkillProvenanceReport['injected'] = [];
    const validatedList: SkillProvenanceReport['validated'] = [];
    const loadedEntries: LoadedSkillEntry[] = [];
    const seenCanonicalPaths = new Set<string>();

    for (const sel of selected) {
      if (sel.alias.includes('..') || path.isAbsolute(sel.alias)) {
        dropped.push({ alias: sel.alias, reason: 'invalid-path', detail: 'path traversal bloqueado' });
        continue;
      }

      const rawPath = resolveSkillPath(this.opts.cwd, this.opts.baseDir, sel.alias);
      if (!rawPath) {
        dropped.push({ alias: sel.alias, reason: 'not-found', detail: 'SKILL.md não encontrada nos catálogos (.skills, skills, .agents/skills)' });
        continue;
      }

      const effectivePath = findV2Counterpart(this.opts.cwd, this.opts.baseDir, rawPath) ?? rawPath;
      const normPath = path.resolve(effectivePath);
      if (seenCanonicalPaths.has(normPath)) {
        dropped.push({ alias: sel.alias, reason: 'duplicate', detail: `alias resolve para o mesmo arquivo já carregado (${path.basename(path.dirname(normPath))})` });
        continue;
      }
      seenCanonicalPaths.add(normPath);

      const cached = readCachedSkillFile(effectivePath);
      if (!cached) {
        dropped.push({ alias: sel.alias, reason: 'not-found', detail: 'falha ao ler SKILL.md em disco' });
        continue;
      }

      const sourceCatalog = classifyCatalog(effectivePath);
      resolvedList.push({
        alias: sel.alias,
        canonicalName: cached.canonicalName,
        path: effectivePath,
        sourceCatalog,
      });

      let injectedText: string;
      const referencesLoaded: string[] = [];

      if (level === 'metadata') {
        injectedText = [
          `**Name:** ${cached.canonicalName} · **Version:** ${cached.version} · **Category:** ${cached.category}`,
          cached.description ? `**Description:** ${cached.description}` : '',
          `<!-- (nível metadata: conteúdo completo em ${effectivePath}) -->`,
        ]
          .filter(Boolean)
          .join('\n');
      } else {
        injectedText = layeredSkillSummary(effectivePath, maxLines);
        if (level === 'references') {
          const fm = parseFrontmatter(cached.rawContent);
          const refs = Array.isArray(fm?.data.references) ? (fm!.data.references as string[]) : [];
          const skillDir = path.dirname(effectivePath);
          for (const refRel of refs.slice(0, 2)) {
            if (typeof refRel !== 'string' || refRel.includes('..') || path.isAbsolute(refRel)) continue;
            const refCandidates = [
              path.join(skillDir, 'references', refRel),
              path.join(skillDir, refRel),
            ];
            for (const refPath of refCandidates) {
              const resolvedRef = path.resolve(refPath);
              if (!resolvedRef.startsWith(path.resolve(skillDir))) continue;
              if (fs.existsSync(resolvedRef) && fs.statSync(resolvedRef).isFile()) {
                try {
                  const refText = fs.readFileSync(resolvedRef, 'utf-8').split(/\r?\n/).slice(0, 40).join('\n');
                  injectedText += `\n\n#### Reference (${path.basename(resolvedRef)})\n${refText}`;
                  referencesLoaded.push(resolvedRef);
                } catch {
                  // ignora falha de leitura de referência opcional
                }
                break;
              }
            }
          }
        }
      }

      const { truncated, omittedSections } =
        level === 'metadata'
          ? { truncated: true, omittedSections: isV2Skill(cached.rawContent) ? splitTopLevelSections(parseFrontmatter(cached.rawContent)!.body).map((s) => s.title) : ['body'] }
          : extractOmittedAndTruncated(injectedText);

      const lines = injectedText.split('\n').length;
      const tokens = Math.max(1, Math.ceil(injectedText.length / 4));

      loadedList.push({
        alias: sel.alias,
        canonicalName: cached.canonicalName,
        version: cached.version,
        sha256: cached.sha256,
        level,
      });

      injectedList.push({
        alias: sel.alias,
        canonicalName: cached.canonicalName,
        tokens,
        lines,
        truncated,
        omittedSections,
      });

      validatedList.push({
        alias: sel.alias,
        passed: true,
        note: `SKILL.md (${sourceCatalog}, sha256:${cached.sha256.slice(0, 8)}) carregada e compilada`,
      });

      loadedEntries.push({
        alias: sel.alias,
        canonicalName: cached.canonicalName,
        version: cached.version,
        category: cached.category,
        description: cached.description,
        path: effectivePath,
        sourceCatalog,
        sha256: cached.sha256,
        level,
        selectionReason: sel.reason,
        injectedText,
        tokens,
        lines,
        truncated,
        omittedSections,
        referencesLoaded,
      });
    }

    const renderedPromptBlock =
      loadedEntries.length > 0
        ? `\n## SKILLS OBRIGATÓRIAS (MANDATÓRIO SEGUIR E APLICAR)\n` +
          `> ⚠️ **CLÁUSULA DE EXECUÇÃO OBRIGATÓRIA**: O agente em execução é ESTRITAMENTE OBRIGADO a seguir e aplicar os procedimentos, regras e padrões técnicos definidos nas skills abaixo. É expressamente proibido atuar sem invocar seus padrões:\n\n` +
          loadedEntries
            .map((entry) => `### Skill: ${entry.alias}\n${entry.injectedText}`)
            .join('\n\n') +
          '\n'
        : '';

    const totalTokensInjected = injectedList.reduce((acc, s) => acc + s.tokens, 0);

    return {
      loadedSkills: loadedEntries,
      provenance: {
        candidates: params.candidates,
        selected,
        resolved: resolvedList,
        loaded: loadedList,
        injected: injectedList,
        validated: validatedList,
        dropped,
        totalTokensInjected,
      },
      renderedPromptBlock,
    };
  }
}
