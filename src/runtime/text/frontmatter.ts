/**
 * Front-matter de skills + Progressive Disclosure em camadas para prompts.
 *
 * Política (Wave 7 / ADR memória W7-C):
 *  - Skills v2 (.skills/<name>/SKILL.md, geradas pelo skill-migrator): o prompt
 *    recebe SEMPRE os metadados leves do front-matter (name/description/gatilhos)
 *    e o corpo entra seletivo por prioridade de seção: Step-by-Step Workflow e
 *    Red Flags primeiro (essenciais), Verification Steps e Common Rationalizations
 *    depois, até esgotar o orçamento de linhas. Seções fora da prioridade
 *    (ex.: "Legacy Reference (v1)", duplicata integral do conteúdo antigo) nunca
 *    entram; tudo que foi omitido/truncado é declarado num comentário final que
 *    aponta para o arquivo completo.
 *  - Skills legadas (sem front-matter v2): comportamento compatível de truncamento
 *    pelas primeiras maxLines linhas com comentário final (byte-a-byte igual ao anterior).
 *
 * Parser YAML mínimo determinístico (scalars, listas inline e block lists,
 * mapas aninhados consumidos sem valor). Zero dependências.
 */

import fs from 'fs';
import path from 'path';

export interface FrontmatterData {
  /** Chaves top-level: scalars (string) ou listas (string[]). Mapas aninhados são ignorados. */
  data: Record<string, string | string[]>;
  /** Corpo integral do arquivo após o fechamento do front-matter. */
  body: string;
}

function unquote(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
}

/** Valor inline: lista `[a, b]` vira string[], resto vira scalar string. */
function parseInlineValue(inline: string): string | string[] {
  if (/^\[.*\]$/.test(inline)) {
    return inline
      .slice(1, -1)
      .split(',')
      .map((s) => unquote(s))
      .filter((s) => s.length > 0);
  }
  return unquote(inline);
}

/**
 * Faz parse do front-matter `--- ... ---`. Nunca lança: retorna null quando
 * não há front-matter válido (skill legada sem cabeçalho).
 */
export function parseFrontmatter(source: string): FrontmatterData | null {
  const text = source.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if ((lines[0] ?? '').trim() !== '---') return null;

  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() === '---') {
      closeIndex = i;
      break;
    }
  }
  if (closeIndex === -1) return null;

  const data: Record<string, string | string[]> = {};
  let i = 1;
  while (i < closeIndex) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    const keyMatch = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!keyMatch) {
      i++;
      continue;
    }
    const key = keyMatch[1];
    const inline = keyMatch[2].trim();

    if (inline !== '') {
      data[key] = parseInlineValue(inline);
      i++;
      continue;
    }

    // Bloco: lista `- item` (mesma indentação) ou mapa aninhado (ignorado).
    i++;
    const items: string[] = [];
    let childIndent = -1;
    let sawNestedMap = false;
    while (i < closeIndex) {
      const cur = lines[i];
      if (!cur.trim()) {
        const next = lines[i + 1];
        if (next !== undefined && /^\s/.test(next) && next.trim() !== '') {
          i++;
          continue;
        }
        break;
      }
      if (!/^\s/.test(cur)) break;
      const indent = cur.match(/^\s*/)![0].length;
      if (childIndent === -1) childIndent = indent;
      const listItem = cur.trim().match(/^-\s+(.*)$/);
      if (listItem && !sawNestedMap) {
        items.push(unquote(listItem[1]));
      } else if (!listItem) {
        sawNestedMap = true;
      }
      i++;
    }
    if (!sawNestedMap && items.length > 0) data[key] = items;
  }

  return { data, body: lines.slice(closeIndex + 1).join('\n') };
}

export interface SkillSection {
  title: string;
  lines: string[];
}

/** Divide o corpo em seções de heading `## ` (exato; `###` fica dentro da pai). */
export function splitTopLevelSections(body: string): SkillSection[] {
  const sections: SkillSection[] = [];
  let current: SkillSection | null = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = { title: heading[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

/** Reconhece skill v2: front-matter presente + seção canônica Step-by-Step Workflow. */
export function isV2Skill(content: string): boolean {
  const fm = parseFrontmatter(content);
  return fm !== null && /^## Step-by-Step Workflow\s*$/m.test(fm.body);
}

/** Gatilhos leves: bullets "- **Ativar quando:** ..." da seção Triggering Criteria. */
export function extractActivationTriggers(body: string): string[] {
  const section = splitTopLevelSections(body).find((s) => s.title === 'Triggering Criteria');
  if (!section) return [];
  const triggers: string[] = [];
  for (const line of section.lines) {
    const m = line.match(/^\s*-\s+\*\*Ativar quando:\*\*\s*(.+?)\s*$/);
    if (m) triggers.push(m[1]);
  }
  return triggers;
}

/** Ordem canônica de prioridade do corpo no prompt: essenciais antes das de suporte. */
const SECTION_PRIORITY = [
  'Step-by-Step Workflow',
  'Red Flags',
  'Verification Steps',
  'Common Rationalizations',
];

function trimSectionContent(lines: string[]): string[] {
  const content = lines.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
  return content ? content.split('\n') : [];
}

/**
 * Resumo em camadas de uma skill v2 dentro do orçamento de linhas.
 * O cabeçalho de metadados NUNCA é cortado pelo budget (objetivo 1b).
 */
export function buildV2Summary(
  data: Record<string, string | string[]>,
  body: string,
  fullPath: string,
  maxLines: number,
): string {
  const name = typeof data.name === 'string' && data.name ? data.name : path.basename(path.dirname(fullPath));
  const version = typeof data.version === 'string' ? data.version : '';
  const category = typeof data.category === 'string' ? data.category : '';
  const description = typeof data.description === 'string' ? data.description : '';
  const triggers = extractActivationTriggers(body);

  const out: string[] = [];
  out.push('<!-- skill v2 (progressive disclosure): metadados sempre presentes; corpo entra por prioridade de seção -->');
  const metaLine = [
    `**Name:** ${name}`,
    version ? `**Version:** ${version}` : '',
    category ? `**Category:** ${category}` : '',
  ].filter(Boolean).join(' · ');
  out.push(metaLine);
  if (description) out.push(`**Description:** ${description}`);
  if (triggers.length > 0) out.push(`**Ativar quando:** ${triggers.join('; ')}`);

  let used = out.length;
  const sections = splitTopLevelSections(body);
  const includedTitles = new Set<string>();
  const truncatedTitles: string[] = [];

  for (const title of SECTION_PRIORITY) {
    const section = sections.find((s) => s.title === title);
    if (!section) continue;
    includedTitles.add(section.title);

    const remaining = maxLines - used;
    if (remaining <= 2) break;
    const contentLines = trimSectionContent(section.lines);
    if (contentLines.length === 0) continue;

    out.push('');
    out.push(`## ${section.title}`);
    used += 2;

    const room = Math.max(0, maxLines - used);
    if (contentLines.length <= room) {
      out.push(...contentLines);
      used += contentLines.length;
    } else {
      out.push(...contentLines.slice(0, room));
      used += room;
      truncatedTitles.push(section.title);
      break;
    }
  }

  // Tudo que existe no corpo mas ficou fora da política é declarado (nunca silencioso).
  const omittedTitles: string[] = [];
  for (const section of sections) {
    if (!includedTitles.has(section.title) && !truncatedTitles.includes(section.title)) {
      omittedTitles.push(section.title);
    }
  }

  if (omittedTitles.length > 0 || truncatedTitles.length > 0) {
    const parts: string[] = [];
    if (omittedTitles.length > 0) parts.push(`seções omitidas: ${omittedTitles.join(', ')}`);
    if (truncatedTitles.length > 0) parts.push(`seções truncadas: ${truncatedTitles.join(', ')}`);
    out.push('');
    out.push(`<!-- (skill v2 parcial em ${used} linhas, budget ${maxLines}: ${parts.join(' · ')} · conteúdo completo em ${fullPath}) -->`);
  }

  return out.join('\n');
}

/**
 * Truncamento legado (compat): mantido byte-a-byte igual ao comportamento
 * anterior do run para skills/documentos fora do formato v2.
 */
export function legacySummary(content: string, fullPath: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join('\n') + `\n\n<!-- (skill truncada em ${maxLines} linhas — veja ${fullPath} para o conteúdo completo) -->`;
}

/**
 * Ponto de entrada: lê a skill e aplica a política em camadas.
 * v2 (front-matter + seções canônicas) → progressive disclosure;
 * legada → truncamento compatível.
 */
export function layeredSkillSummary(fullPath: string, maxLines: number): string {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = parseFrontmatter(content);
  if (fm && /^## Step-by-Step Workflow\s*$/m.test(fm.body)) {
    return buildV2Summary(fm.data, fm.body, fullPath, maxLines);
  }
  return legacySummary(content, fullPath, maxLines);
}

/**
 * Contraparte v2 de uma skill resolvida no catálogo .skills/:
 * `<root>/skills/<name>/SKILL.md` → `<root>/.skills/<name>/SKILL.md`.
 * Procura em cwd e baseDir; null quando não há catálogo v2 (instalação legada).
 */
export function findV2Counterpart(cwd: string, baseDir: string, resolvedPath: string): string | null {
  const marker = `${path.sep}skills${path.sep}`;
  const idx = resolvedPath.lastIndexOf(marker);
  if (idx === -1) return null;
  const relAfter = resolvedPath.slice(idx + marker.length);
  if (!relAfter || relAfter.includes('..')) return null;
  for (const root of [cwd, baseDir]) {
    const candidate = path.join(root, '.skills', relAfter);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}
