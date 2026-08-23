#!/usr/bin/env node
"use strict";

/**
 * agent-migrator — conversor determinístico agents/*.json (v1) → .agents/agents/<slug>.yaml (v2).
 *
 * ADR-005 (.agents/memoria/decisoes.md): o legado agents/*.json permanece fonte
 * canônica (ADR-001, Strangler Fig segue válido); o YAML é representação DERIVADA —
 * interface de leitura v2 para CLIs e futuros consumers. Proibido editar os YAMLs à
 * mão: toda mudança nasce no JSON e se propaga por regeneração determinística.
 *
 * Garantias:
 *  - Determinístico e idempotente: mesma árvore de entrada → output byte-idêntico
 *    (ordem canônica de chaves, zero timestamps no output).
 *  - Fidelidade: todo campo presente no JSON é emitido; campo ausente é omitido;
 *    nada é inventado. Cada arquivo gerado passa por round-trip interno: o leitor
 *    do subconjunto relê o YAML e compara profundamente com a estrutura esperada.
 *  - Fonte legado (agents/) somente leitura; nada é escrito fora de --dest.
 *  - Falha loud: JSON inválido, campo obrigatório ausente, colisão de slug ou
 *    divergência de round-trip interrompe com motivo por arquivo — nunca stub.
 *  - Zero dependências externas (Node >= 18).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Versão do contrato de representação v2 (documentada no README, não emitida no YAML). */
export const SCHEMA_VERSION = "1.0.0";

/**
 * Ordem canônica de emissão das chaves (schema estrito v2).
 * Chaves presentes no JSON são emitidas nesta ordem; chaves desconhecidas (futuras)
 * são anexadas em ordem alfabética — migração nunca descarta conteúdo silenciosamente.
 * Campo ausente no JSON fonte = omitido no YAML (zero invenção).
 */
export const FIELD_ORDER = [
  // Identidade
  "name",
  "version",
  "model",
  "compatibility",
  "token_budget",
  "tokenBudget",
  // Papel e instruções nucleares
  "role",
  "identity",
  "purpose",
  // Skills e composição
  "skills",
  "optionalSkills",
  "chains",
  // Diretivas comportamentais
  "always",
  "never",
  // Genome: capacidades, fronteiras e integração
  "capabilities",
  "inputs",
  "outputs",
  "permissions",
  "handoffs",
  "memory",
  "evaluation",
  // Extensões opcionais observadas no corpus (ai-engineer, automation-engineer, discovery)
  "process",
  "references",
];

const ARRAY_FIELDS = new Set([
  "skills",
  "optionalSkills",
  "always",
  "never",
  "capabilities",
  "inputs",
  "outputs",
  "permissions",
  "handoffs",
  "memory",
  "process",
  "references",
]);

const STRING_FIELDS = new Set([
  "name",
  "version",
  "model",
  "compatibility",
  "role",
  "identity",
  "purpose",
]);

const NUMBER_FIELDS = new Set(["token_budget", "tokenBudget"]);

// ---------------------------------------------------------------------------
// Slug determinístico
// ---------------------------------------------------------------------------

/**
 * Slug estável: minúsculas, diacríticos removidos (NFD), sequências não
 * alfanuméricas colapsadas em "-", sem bordas. "Professor / Mentor" →
 * "professor-mentor"; "Form & UI Engineer" → "form-ui-engineer".
 */
export function slugify(text) {
  const slug = String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "agente";
}

// ---------------------------------------------------------------------------
// Emissor YAML (subconjunto estrito, determinístico)
//
// Regras de emissão:
//  - Chaves sempre bare (identificadores); valores string SEM "\n" vão entre
//    aspas duplas com escaping completo; strings multiline viram block scalars
//    literais (| / |- / |+) escolhidos pela contagem exata de newlines finais,
//    preservando o valor byte-a-byte.
//  - Numbers, booleans e null vão bare; coleções vazias como [] e {}.
// ---------------------------------------------------------------------------

const INDENT_UNIT = 2;

function pad(indent) {
  return " ".repeat(indent);
}

function quoteString(value) {
  let out = '"';
  for (const ch of String(value)) {
    const code = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += ch;
  }
  return out + '"';
}

/**
 * Converte um objeto ordenado (Map-preserving) em linhas YAML do subconjunto.
 * Retorna string terminada em "\n".
 */
export function emitYaml(root) {
  const lines = emitMapEntries(root, 0);
  return lines.join("\n") + "\n";
}

function emitMapEntries(obj, indent) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    lines.push(...emitKeyValue(key, value, indent));
  }
  return lines;
}

function emitKeyValue(key, value, indent) {
  const keyPrefix = `${pad(indent)}${key}:`;

  if (value === null) return [`${keyPrefix} null`];
  if (typeof value === "boolean") return [`${keyPrefix} ${value}`];
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`número não finito em "${key}" (NaN/Infinity não são YAML válido)`);
    }
    return [`${keyPrefix} ${String(value)}`];
  }
  if (typeof value === "string") {
    if (value.includes("\n")) {
      // Indicador de chomping cola na chave ("identity: |-"); corpo vem indentado.
      const block = emitBlockScalar(value, indent + INDENT_UNIT);
      return [`${keyPrefix} ${block[0]}`, ...block.slice(1)];
    }
    return [`${keyPrefix} ${quoteString(value)}`];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${keyPrefix} []`];
    const lines = [keyPrefix];
    for (const item of value) {
      lines.push(...emitListItem(item, indent + INDENT_UNIT));
    }
    return lines;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return [`${keyPrefix} {}`];
    const lines = [keyPrefix];
    lines.push(...emitMapEntries(value, indent + INDENT_UNIT));
    return lines;
  }
  throw new Error(`tipo não suportado na chave "${key}": ${typeof value}`);
}

function emitListItem(item, indent) {
  const dash = `${pad(indent)}-`;
  if (item === null) return [`${dash} null`];
  if (typeof item === "boolean") return [`${dash} ${item}`];
  if (typeof item === "number") {
    if (!Number.isFinite(item)) throw new Error("número não finito em item de lista");
    return [`${dash} ${String(item)}`];
  }
  if (typeof item === "string") {
    if (item.includes("\n")) {
      // Item textual multiline: bloco aninhado sob o traço.
      return [dash, ...emitBlockScalar(item, indent + INDENT_UNIT)];
    }
    return [`${dash} ${quoteString(item)}`];
  }
  if (Array.isArray(item)) {
    throw new Error("listas aninhadas não fazem parte do subconjunto emitido");
  }
  if (typeof item === "object") {
    const entries = Object.entries(item);
    if (entries.length === 0) return [`${dash} {}`];
    // Primeiro par na linha do traço (`- to: "x"`); demais na continuação,
    // alinhados com a chave do primeiro par.
    const [firstKey, firstValue] = entries[0];
    const lines = [];
    const isPlainScalar =
      firstValue === null ||
      typeof firstValue === "boolean" ||
      typeof firstValue === "number" ||
      (typeof firstValue === "string" && !firstValue.includes("\n"));
    const isEmptyCollection =
      (Array.isArray(firstValue) && firstValue.length === 0) ||
      (!Array.isArray(firstValue) &&
        typeof firstValue === "object" &&
        firstValue !== null &&
        Object.keys(firstValue).length === 0);
    if (isPlainScalar || isEmptyCollection) {
      lines.push(`${dash} ${inlineScalarPair(firstKey, firstValue)}`);
    } else if (typeof firstValue === "string" && firstValue.includes("\n")) {
      lines.push(`${dash} ${firstKey}:`);
      lines.push(...emitBlockScalar(firstValue, indent + INDENT_UNIT));
    } else {
      throw new Error(
        `primeiro par de mapa-lista deve ser escalar ou coleção vazia ("${firstKey}")`
      );
    }
    for (const [k, v] of entries.slice(1)) {
      lines.push(...emitKeyValue(k, v, indent + INDENT_UNIT));
    }
    return lines;
  }
  throw new Error(`tipo não suportado em item de lista: ${typeof item}`);
}

/** Renderiza `chave: valor` para escalares simples e coleções vazias. */
function inlineScalarPair(key, value) {
  if (value === null) return `${key}: null`;
  if (typeof value === "boolean") return `${key}: ${value}`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("número não finito em mapa-lista");
    return `${key}: ${String(value)}`;
  }
  if (typeof value === "string") return `${key}: ${quoteString(value)}`;
  if (Array.isArray(value)) return `${key}: []`;
  if (Object.keys(value).length === 0) return `${key}: {}`;
  throw new Error(`valor não suportado em par inline "${key}"`);
}

/**
 * Block scalar literal com chomping exato:
 *  - sem "\n" final            → "|-"  (strip)
 *  - exatamente um "\n" final  → "|"   (clip)
 *  - múltiplos "\n" finais     → "|+"  (keep, preserva todos)
 * Linhas vazias internas e à direita são emitidas como linhas fisicamente vazias.
 */
function emitBlockScalar(value, contentIndent) {
  const parts = String(value).split("\n");
  let chomp;
  let body;
  if (parts[parts.length - 1] !== "") {
    chomp = "|-";
    body = parts;
  } else {
    parts.pop(); // remove o terminador artificial do split
    let trailingBlanks = 0;
    for (let i = parts.length - 1; i >= 0 && parts[i] === ""; i--) trailingBlanks++;
    chomp = trailingBlanks === 0 ? "|" : "|+";
    body = parts; // linhas em branco finais permanecem (são conteúdo real)
  }
  const contentPad = pad(contentIndent);
  const lines = [chomp];
  for (const part of body) {
    lines.push(part === "" ? "" : contentPad + part);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Leitor do subconjunto (usado no round-trip interno e no modo --check)
// ---------------------------------------------------------------------------

/**
 * Parseia exatamente o subconjunto emitido por emitYaml: mapas/listas por
 * indentação, escalares double-quoted com escapes, números/boolean/null bare,
 * coleções vazias inline ([]/{}) e block scalars |, |-, |+ com chomping fiel.
 * Qualquer linha fora do subconjunto é erro loud.
 */
export function readYamlSubset(text) {
  const rawLines = text.replace(/^\uFEFF/, "").split("\n");
  let pos = 0;

  // Chaves bare aceitam letras Unicode (corpus tem chains como "critérios_bdd").
  const KEY_VALUE = /^("[^"]*"|[\p{L}_][\p{L}\p{N}_.-]*)\s*:\s?(.*)$/u;

  function indentOf(line) {
    return line.match(/^ */)[0].length;
  }

  /** Avança pos sobre linhas vazias/comentário; retorna próxima linha útil ou null. */
  function peekSignificant() {
    while (pos < rawLines.length) {
      const trimmed = rawLines[pos].trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        pos += 1;
        continue;
      }
      return rawLines[pos];
    }
    return null;
  }

  function parseNode(minIndent) {
    const line = peekSignificant();
    if (line === null || indentOf(line) < minIndent) return null;
    const ind = indentOf(line);
    const trimmed = line.trim();
    if (/^-(?:\s|$)/.test(trimmed)) return parseList(ind);
    return parseMap(ind);
  }

  function parseMap(indent) {
    const obj = {};
    while (true) {
      const line = peekSignificant();
      if (line === null) break;
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) {
        throw new Error(`indentação inesperada: "${line.trim()}"`);
      }
      const trimmed = line.trim();
      if (/^-(?:\s|$)/.test(trimmed)) break;
      const km = trimmed.match(KEY_VALUE);
      if (!km) {
        throw new Error(`par chave-valor fora do subconjunto: "${trimmed}"`);
      }
      pos += 1;
      const key = km[1].startsWith('"') ? JSON.parse(km[1]) : km[1];
      fillPair(obj, key, km[2], indent);
    }
    return obj;
  }

  function fillPair(obj, key, inlineRaw, keyIndent) {
    const inline = inlineRaw.trim();
    if (inline === "") {
      const next = peekSignificant();
      if (next === null || indentOf(next) <= keyIndent) {
        obj[key] = null;
        return;
      }
      obj[key] = parseNode(keyIndent + 1);
      return;
    }
    if (/^\|(?:[+-]?)$/.test(inline)) {
      obj[key] = collectBlockScalar(inline, keyIndent);
      return;
    }
    obj[key] = parseScalar(inline, `"${key}"`);
  }

  /**
   * Coleta linhas cruas do bloco até dedent (linha não-vazia com indent <=
   * keyIndent) ou EOF. Semântica de reconstrução acordada com o emissor:
   *  - parada por dedent: todas as linhas coletadas pertencem ao bloco;
   *  - parada por EOF: descarta EXATAMENTE UM "" final (artefato do \n de fim
   *    de arquivo — o emissor nunca termina documento com bloco seguido de
   *    linha extra, e o split final produz esse fantasma).
   * Valor = linhas dedentadas joinadas + "\n" final, ajustado pelo chomping.
   */
  function collectBlockScalar(indicator, keyIndent) {
    const region = [];
    let stoppedAtEof = true;
    while (pos < rawLines.length) {
      const line = rawLines[pos];
      if (line.trim() === "") {
        region.push("");
        pos += 1;
        continue;
      }
      if (indentOf(line) <= keyIndent) {
        stoppedAtEof = false;
        break;
      }
      region.push(line);
      pos += 1;
    }
    if (stoppedAtEof && region.length && region[region.length - 1] === "") {
      region.pop();
    }
    if (!region.some((l) => l !== "")) {
      throw new Error("block scalar sem corpo");
    }
    let contentIndent = -1;
    for (const line of region) {
      if (line !== "") {
        contentIndent = indentOf(line);
        break;
      }
    }
    const dedented = region.map((l) => (l === "" ? "" : l.slice(contentIndent)));
    let value = dedented.join("\n") + "\n";
    if (indicator === "|-") value = value.replace(/\n+$/, "");
    else if (indicator === "|") value = value.replace(/\n+$/, "") + "\n";
    else if (indicator === "|+") {
      /* keep: preserva tudo */
    } else {
      throw new Error(`indicador de block scalar desconhecido: "${indicator}"`);
    }
    return value;
  }

  function parseList(indent) {
    const arr = [];
    while (true) {
      const line = peekSignificant();
      if (line === null) break;
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) {
        throw new Error(`indentação inesperada em lista: "${line.trim()}"`);
      }
      const m = line.trim().match(/^-(?:\s+(.*))?$/);
      if (!m) break;
      pos += 1;
      const inline = (m[1] ?? "").trim();
      if (inline === "") {
        const child = parseNode(indent + 1);
        arr.push(child);
        continue;
      }
      // Bloco escalar como item inteiro ("- |-"): região pertence ao traço.
      if (/^\|(?:[+-]?)$/.test(inline)) {
        arr.push(collectBlockScalar(inline, indent));
        continue;
      }
      const km = inline.match(KEY_VALUE);
      if (!km) {
        arr.push(parseScalar(inline, "item de lista"));
        continue;
      }
      // Mapa iniciado inline no traço ("- to: "x""); pares seguintes têm
      // indent > dashIndent e não começam com "- ".
      const item = {};
      fillPair(item, km[1].startsWith('"') ? JSON.parse(km[1]) : km[1], km[2], indent);
      while (true) {
        const nxt = peekSignificant();
        if (nxt === null) break;
        const nInd = indentOf(nxt);
        if (nInd <= indent) break;
        const nTrim = nxt.trim();
        if (/^-(?:\s|$)/.test(nTrim)) {
          throw new Error(`lista aninhada dentro de item de lista não suportada: "${nTrim}"`);
        }
        const km2 = nTrim.match(KEY_VALUE);
        if (!km2) {
          throw new Error(`continuação de mapa-lista inválida: "${nTrim}"`);
        }
        pos += 1;
        fillPair(item, km2[1].startsWith('"') ? JSON.parse(km2[1]) : km2[1], km2[2], nInd);
      }
      arr.push(item);
    }
    return arr;
  }

  function parseScalar(s, ctx) {
    if (s.startsWith('"')) {
      let out = "";
      let i = 1;
      while (i < s.length) {
        const ch = s[i];
        if (ch === "\\") {
          const n = s[i + 1];
          if (n === '"') out += '"';
          else if (n === "\\") out += "\\";
          else if (n === "n") out += "\n";
          else if (n === "t") out += "\t";
          else if (n === "r") out += "\r";
          else if (n === "u") {
            out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
            i += 4;
          } else {
            throw new Error(`escape desconhecido \\${n} em ${ctx}`);
          }
          i += 2;
          continue;
        }
        if (ch === '"') {
          const rest = s.slice(i + 1).trim();
          if (rest) throw new Error(`conteúdo após aspas em ${ctx}: "${rest}"`);
          return out;
        }
        out += ch;
        i += 1;
      }
      throw new Error(`string sem fechamento em ${ctx}`);
    }
    if (s === "[]") return [];
    if (s === "{}") return {};
    if (s === "null" || s === "~") return null;
    if (s === "true") return true;
    if (s === "false") return false;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) return parseFloat(s);
    throw new Error(`escalar fora do subconjunto em ${ctx}: "${s}"`);
  }

  const result = parseNode(0);
  const leftover = peekSignificant();
  if (leftover !== null) {
    throw new Error(`linha não consumida pelo leitor: "${leftover.trim()}"`);
  }
  return result === null ? {} : result;
}

// ---------------------------------------------------------------------------
// Comparação profunda com caminho (mensagens de erro precisas)
// ---------------------------------------------------------------------------

export function deepEqual(a, b, at = "$") {
  if (a === b) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      throw new Error(`${at}: comprimento difere (${a.length} ≠ ${b.length})`);
    }
    for (let i = 0; i < a.length; i++) deepEqual(a[i], b[i], `${at}[${i}]`);
    return;
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) {
      throw new Error(
        `${at}: chaves diferem ([${ka.join(", ")}] ≠ [${kb.join(", ")}])`
      );
    }
    for (const k of ka) deepEqual(a[k], b[k], `${at}.${k}`);
    return;
  }
  throw new Error(
    `${at}: valores diferem (${JSON.stringify(a)} ≠ ${JSON.stringify(b)})`
  );
}

// ---------------------------------------------------------------------------
// Validação do JSON fonte (falha loud, nunca stub)
// ---------------------------------------------------------------------------

export function validateAgentSource(agent, label) {
  if (typeof agent !== "object" || agent === null || Array.isArray(agent)) {
    throw new Error("raiz do JSON não é um objeto");
  }
  if (typeof agent.name !== "string" || agent.name.trim() === "") {
    throw new Error('campo obrigatório "name" ausente ou vazio');
  }
  const hasRole =
    (typeof agent.role === "string" && agent.role.trim() !== "") ||
    (typeof agent.purpose === "string" && agent.purpose.trim() !== "");
  if (!hasRole) {
    throw new Error('papel ausente: "role" ou "purpose" deve estar preenchido');
  }
  for (const field of STRING_FIELDS) {
    if (field in agent && typeof agent[field] !== "string") {
      throw new Error(`campo "${field}" deveria ser string`);
    }
  }
  for (const field of NUMBER_FIELDS) {
    if (field in agent && typeof agent[field] !== "number") {
      throw new Error(`campo "${field}" deveria ser número`);
    }
  }
  for (const field of ARRAY_FIELDS) {
    if (field in agent && !Array.isArray(agent[field])) {
      throw new Error(`campo "${field}" deveria ser array`);
    }
  }
  if ("chains" in agent) {
    const chains = agent.chains;
    if (typeof chains !== "object" || chains === null || Array.isArray(chains)) {
      throw new Error('campo "chains" deveria ser objeto');
    }
    for (const [chainName, steps] of Object.entries(chains)) {
      if (
        !Array.isArray(steps) ||
        steps.some((s) => typeof s !== "string")
      ) {
        throw new Error(`chain "${chainName}" deveria ser array de strings`);
      }
    }
  }
  if ("evaluation" in agent) {
    const ev = agent.evaluation;
    if (typeof ev !== "object" || ev === null || Array.isArray(ev)) {
      throw new Error('campo "evaluation" deveria ser objeto');
    }
  }
  if ("handoffs" in agent) {
    for (const h of agent.handoffs) {
      if (typeof h !== "object" || h === null || Array.isArray(h)) {
        throw new Error("handoff deveria ser objeto");
      }
    }
  }
  void label;
}

// ---------------------------------------------------------------------------
// Renderização do YAML v2
// ---------------------------------------------------------------------------

/**
 * Ordena as chaves segundo FIELD_ORDER; desconhecidas vão ao final em ordem
 * alfabética (determinismo preservado, conteúdo nunca descartado).
 */
function orderFields(agent) {
  const ordered = {};
  for (const field of FIELD_ORDER) {
    if (field in agent) ordered[field] = agent[field];
  }
  const known = new Set(FIELD_ORDER);
  const extras = Object.keys(agent)
    .filter((k) => !known.has(k))
    .sort();
  for (const k of extras) ordered[k] = agent[k];
  return ordered;
}

/**
 * Monta o documento YAML completo: cabeçalho de governança + mapa com
 * `source` + campos do agente em ordem canônica. Função pura.
 */
export function renderAgentYaml(sourceRel, agent) {
  const header = [
    `# Gerado por packages/agent-migrator a partir de ${sourceRel} (fonte canônica do agente).`,
    "# NÃO EDITAR À MÃO: derivação determinística de agents/*.json — alterações manuais serão",
    "# sobrescritas na próxima regeneração (ADR-005; Strangler Fig: JSON permanece a verdade).",
    "# Regenerar: node packages/agent-migrator/cli.mjs",
  ];
  const body = { source: sourceRel, ...orderFields(agent) };
  return header.join("\n") + "\n" + emitYaml(body);
}

/** Estrutura esperada após o parse do documento (para o round-trip interno). */
function expectedParsed(sourceRel, agent) {
  return { source: sourceRel, ...orderFields(agent) };
}

// ---------------------------------------------------------------------------
// Varredura da árvore e hash
// ---------------------------------------------------------------------------

async function listJsonFiles(srcRoot) {
  const files = [];
  async function walk(dir, relBase) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // superfície determinística e segura
      const abs = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push({ abs, rel });
    }
  }
  await walk(srcRoot, "");
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files;
}

/** Hash estável da árvore (paths relativos + sha256 dos conteúdos). */
export async function hashTree(root) {
  const files = [];
  async function walk(dir, relBase) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.isFile()) files.push(rel);
    }
  }
  await walk(root, "");
  files.sort();
  const hash = createHash("sha256");
  for (const rel of files) {
    const content = await readFile(path.join(root, rel));
    hash.update(rel);
    hash.update("\u0000");
    hash.update(createHash("sha256").update(content).digest("hex"));
    hash.update("\u0001");
  }
  return { hash: hash.digest("hex"), fileCount: files.length };
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Migração da árvore
// ---------------------------------------------------------------------------

/**
 * Converte todos os agents/*.json (varredura recursiva) para .agents/agents/<slug>.yaml.
 *
 * check=false (padrão): escreve os YAMLs derivados.
 * check=true: compara bytes esperados vs existentes sem escrever nada — classifica
 * cada agente como ok | drift | missing e detecta órfãos (YAMLs no destino sem JSON
 * de origem). Órfãos NUNCA são apagados silenciosamente: viram erro de sincronia.
 */
export async function migrateAll({ srcRoot, destRoot, check = false }) {
  const startedAt = process.hrtime.bigint();

  const srcStat = await stat(srcRoot);
  if (!srcStat.isDirectory()) throw new Error(`--src não é diretório: ${srcRoot}`);

  const resolvedSrc = path.resolve(srcRoot);
  const resolvedDest = path.resolve(destRoot);
  if (resolvedDest === resolvedSrc || resolvedDest.startsWith(resolvedSrc + path.sep)) {
    throw new Error("--dest não pode estar dentro de --src (fonte intocada)");
  }
  if (resolvedSrc.startsWith(resolvedDest + path.sep)) {
    throw new Error("--src não pode estar dentro de --dest (evita reprocessar output)");
  }

  const jsonFiles = await listJsonFiles(resolvedSrc);

  // Caminho relativo do JSON ao PAI de srcRoot: com padrões repo (src="agents"),
  // resulta em "agents/<arquivo>.json" independentemente do cwd.
  const srcParent = path.dirname(resolvedSrc);

  const report = {
    srcRoot: resolvedSrc,
    destRoot: resolvedDest,
    check,
    total: jsonFiles.length,
    entries: [],
    failures: [],
    orphans: [],
    treeHash: null,
    inSync: null,
    elapsedMs: 0,
  };

  const prepared = [];

  for (const { abs, rel } of jsonFiles) {
    try {
      const raw = await readFile(abs, "utf8");
      let agent;
      try {
        agent = JSON.parse(raw);
      } catch (error) {
        throw new Error(`JSON inválido: ${error.message}`);
      }
      validateAgentSource(agent, rel);

      const slug = slugify(agent.name);
      const sourceRel = path.relative(srcParent, abs).split(path.sep).join("/");
      const rendered = renderAgentYaml(sourceRel, agent);

      // Round-trip interno: o leitor do subconjunto relê o render e compara
      // profundamente com a estrutura esperada (inclui o campo `source`).
      const reparsed = readYamlSubset(rendered);
      deepEqual(reparsed, expectedParsed(sourceRel, agent));

      prepared.push({
        name: agent.name,
        slug,
        sourceRel,
        sourceAbs: abs,
        yaml: rendered,
        destAbs: path.join(resolvedDest, `${slug}.yaml`),
        chains: "chains" in agent ? Object.keys(agent.chains).length : 0,
        handoffs: Array.isArray(agent.handoffs) ? agent.handoffs.length : 0,
        fields: Object.keys(agent).length,
      });
    } catch (error) {
      report.failures.push({
        source: rel,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Colisão de slug = ambiguidade de endereçamento v2: erro loud ANTES de escrever.
  const bySlug = new Map();
  for (const entry of prepared) {
    const previous = bySlug.get(entry.slug);
    if (previous) {
      report.failures.push({
        source: `${previous.sourceRel} ↔ ${entry.sourceRel}`,
        reason: `colisão de slug "${entry.slug}" (ambos derivariam o mesmo YAML)`,
      });
      continue;
    }
    bySlug.set(entry.slug, entry);
  }

  if (report.failures.length === 0) {
    if (!check) {
      await mkdir(resolvedDest, { recursive: true });
      for (const entry of prepared) {
        await writeFile(entry.destAbs, entry.yaml, "utf8");
        entry.status = "written";
      }
    } else {
      for (const entry of prepared) {
        if (!(await exists(entry.destAbs))) {
          entry.status = "missing";
          continue;
        }
        const actual = await readFile(entry.destAbs, "utf8");
        entry.status = actual === entry.yaml ? "ok" : "drift";
      }
    }

    // Órfãos: YAMLs presentes no destino sem origem correspondente.
    if (await exists(resolvedDest)) {
      const existing = await listYamlFiles(resolvedDest);
      const expectedSlugs = new Set(prepared.map((e) => e.slug));
      for (const rel of existing) {
        if (!expectedSlugs.has(rel.replace(/\.yaml$/, ""))) {
          report.orphans.push(rel);
        }
      }
    }
  }

  report.inSync =
    report.failures.length === 0 &&
    report.orphans.length === 0 &&
    prepared.every((e) => (check ? e.status === "ok" : e.status === "written"));

  report.elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  report.treeHash =
    report.failures.length === 0 && (await exists(resolvedDest))
      ? (await hashTree(resolvedDest)).hash
      : null;
  report.entries = prepared;
  return report;
}

async function listYamlFiles(root) {
  const files = [];
  async function walk(dir, relBase) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const abs = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.isFile() && entry.name.endsWith(".yaml")) files.push(rel);
    }
  }
  await walk(root, "");
  return files.sort((a, b) => a.localeCompare(b));
}
