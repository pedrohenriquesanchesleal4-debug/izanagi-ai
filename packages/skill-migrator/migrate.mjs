#!/usr/bin/env node
"use strict";

/**
 * skill-migrator — conversor determinístico skills/ (v1) → .skills/ (v2).
 *
 * ADR-004: deriva SKILL.md v2 do conteúdo REAL original. Proibido inventar
 * conteúdo falso ou deixar seção obrigatória vazia — qualquer falha de
 * preenchimento é erro loud, nunca stub silencioso.
 *
 * Garantias:
 *  - Determinístico e idempotente: mesma árvore de entrada → output byte-idêntico.
 *  - Fonte legado (skills/) somente leitura.
 *  - Zero dependências externas (Node >= 18).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CATEGORY_LABELS_PT,
  FALLBACK_VERIFICATION,
  RATIONALIZATIONS,
} from "./rationalizations.mjs";

export const SCHEMA_VERSION = "2.0.0";
export const REQUIRED_SECTIONS = [
  "Triggering Criteria",
  "Step-by-Step Workflow",
  "Verification Steps",
  "Common Rationalizations",
  "Red Flags",
  "Legacy Reference (v1)",
];

/** MCP tools por categoria (mapeamento fixo do contrato v2). */
const MCP_BY_CATEGORY = {
  engineering: ["mcp:fs_write", "mcp:execute_command"],
  testing: ["mcp:execute_command"],
  security: ["mcp:fs_read", "mcp:execute_command"],
  design: ["mcp:fs_read", "mcp:fs_write"],
  docs: ["mcp:fs_read", "mcp:fs_write"],
  devops: ["mcp:execute_command", "mcp:fs_write"],
  data: ["mcp:execute_command", "mcp:fs_read"],
  ai: ["mcp:fs_read", "mcp:fs_write", "mcp:execute_command"],
};

// ---------------------------------------------------------------------------
// Heurística de categoria
//
// Duas camadas por categoria (na ordem de prioridade abaixo):
//   namePatterns : regex forte aplicada ao NOME da skill → categoria imediata.
//   keywords     : sinais fracos aplicados a nome + descrição + corpo;
//                  exigem >= 2 ocorrências para vencer o fallback engineering.
// Ordem importa: domínios específicos antes dos genéricos.
// ---------------------------------------------------------------------------

const CATEGORY_RULES = [
  {
    category: "testing",
    namePatterns:
      /\b(qa|test|testing|tdd|verify|evaluat\w*|critiqu\w*|accessib\w*)\b/i,
    keywords:
      /\b(testes?|testing|tdd|qa|mock\w*|coverage|cobertura|regress\w*|verific\w*|verif\w*|e2e|playwright|assert\w*|flaky|suite|veredicto|verdict)\b/gi,
  },
  {
    category: "security",
    namePatterns: /\b(secur\w*|privacy|privac\w*|auditor|defense)\b/i,
    keywords:
      /\b(seguran[çc]a|segura|security|owasp|vulnerab\w*|cve|lgpd|gdpr|auth\w*|credencial\w*|secret\w*|hardening|injection|threat|ataque|privacidade)\b/gi,
  },
  {
    // (?<!anti-) impede capturar "anti-ai-slop" (domínio DESIGN, não IA).
    category: "ai",
    namePatterns:
      /(?<!anti-)ai\b|\bagentic\b|\bagents?\b|\bprompt|\bmcp\b|\bllm\b|\btokens?\b|hallucinat\w*/i,
    keywords:
      /\b(llm|agentes?|swarm|prompt|rag|embedding\w*|vector|mcp|modelo|hallucinat\w*|alucina\w*|calibr\w*|suposi[çc][ão]es?|tokens?)\b/gi,
  },
  {
    category: "data",
    namePatterns: /\b(data|dados|database|spreadsheet|planilha|er-diagram)\b/i,
    keywords:
      /\b(banco[s]? de dados|modelagem|nosql|sql|etl|mongo\w*|postgres\w*|redis|elasticsearch|kafka|message queue|streaming|warehouse|planilha\w*|excel|csv|dataset\w*)\b/gi,
  },
  {
    category: "design",
    namePatterns:
      /\b(design|ui|ux|frontend|visual|motion|animation|layout|anti-ai)\b/i,
    keywords:
      /\b(design|tipografia|typography|paleta|palette|layout|grid|anima[çc]\w*|motion|scrollytelling|estiliz\w*|tailwind|css|formul[áa]rios?|forms?|wizard|craft|visual)\b/gi,
  },
  {
    category: "devops",
    namePatterns:
      /\b(devops|sre|cloud|iac|terraform|docker|kubernetes|k8s|release|monitoring|observability|scalability|serverless|chaos|feature.?flag|performance|perf|seo|risk|optimiz\w*|otimiz\w*|logging)\b/i,
    keywords:
      /\b(ci\/cd|pipeline|deploy\w*|rollback|docker|kubernetes|k8s|terraform|iac|infra\w*|cloud|monitor\w*|observab\w*|sre|slis?\b|slos?\b|slas?\b|scalab\w*|escala\b|serverless|incident\w*|chaos|feature flag\w*|performance|lat[êe]ncia|cache\w*|cold start|lighthouse|core web vitals|seo|logging|logs?\b|sprint\w*|milestone\w*|backlog|riscos?|release|changelog|canary|healthcheck|uptime|gargal\w*)\b/gi,
  },
  {
    category: "docs",
    namePatterns:
      /\b(docs?|documentation|readme|writer|writing|diagram|uml|professor|copywriting|memori\w*|mem[óo]ria|research|pesquis\w*)\b/i,
    keywords:
      /\b(documenta[çc]\w*|readme|docs?\b|manual|diagrama\w*|mermaid|plantuml|uml\b|tutorial|explica\w*|ensin\w*|professor|copywriting|comunica[çc]\w*|mem[óo]ria|memoria|handoff|sess[ãa]o|pesquis\w*|research|fontes)\b/gi,
  },
  {
    // Engenharia: strong-name na fase 1 (protege domínios inequívocos de
    // engenharia contra weak hits alheios, ex.: systematic-debugging vs testing).
    // `automation|reviewer` por último: qualquer "X-automation" não reivindicado
    // por categoria anterior é engenharia; idem reviewer (reviewers de outras
    // categorias já casaram suas strongs antes, pois esta é a última regra).
    category: "engineering",
    namePatterns:
      /\b(debug\w*|bugs?|refactor\w*|architect\w*|clean-code|dry-kiss|solid-validator|complexity-analyzer|api-automation|automation|graphql|websocket|payments?-billing|i18n|l10n|wasm|migration|surgical-patch|lean-build|tech-lead|principal-engineer|staff-engineer|cto-advisor|task-planner|requirement-analyzer|technology-selection|tradeoff-analyzer|alternative-solution|investigate-first|root-cause|failure-patterns|error-recovery|technical-debt|code-reviewer)\b/i,
    keywords: null,
  },
];
/** Fallback final quando nenhuma categoria atinge limiar. */
const DEFAULT_CATEGORY = "engineering";
/** Termos fracos distintos mínimos para atribuir categoria sem hit forte. */
const WEAK_THRESHOLD = 2;

/**
 * Conta termos DISTINTOS com agrupamento por prefixo mínimo (≥4 chars):
 * "token"/"tokens", "agente"/"agentes", "teste"/"testes" contam como um só.
 * Determinística (entrada ordenada) e sem stemmer externo.
 */
function distinctTermCount(terms) {
  const normalized = [
    ...new Set(
      terms.map((t) =>
        t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      )
    ),
  ].sort();
  const clusters = [];
  for (const term of normalized) {
    const merged = clusters.some((cluster) => {
      const n = Math.min(4, cluster.length, term.length);
      return cluster.slice(0, n) === term.slice(0, n);
    });
    if (!merged) clusters.push(term);
  }
  return clusters.length;
}

/**
 * Infere a categoria da skill a partir de nome + descrição + headings.
 * Fase 1: padrão forte no NOME (ordem das regras decide empates).
 * Fase 2: >= 2 termos fracos DISTINTOS da mesma categoria em nome+descrição+
 *         headings — nunca corpo corrido, que cita "teste"/"segurança" de
 *         passagem e viesaria tudo.
 * Determinística: mesma entrada → mesma saída.
 */
export function inferCategory(name, description, body) {
  const nameText = String(name || "");
  const contextText = [
    description ?? "",
    extractHeadings(body ?? "", 12).join("\n"),
  ].join("\n");

  for (const rule of CATEGORY_RULES) {
    if (rule.namePatterns.test(nameText)) return rule.category;
  }
  for (const rule of CATEGORY_RULES) {
    if (!rule.keywords) continue;
    const matches = [
      ...(contextText.match(rule.keywords) ?? []),
      ...(nameText.match(rule.keywords) ?? []),
    ];
    if (!matches.length) continue;
    if (distinctTermCount(matches) >= WEAK_THRESHOLD) return rule.category;
  }
  return DEFAULT_CATEGORY;
}

// ---------------------------------------------------------------------------
// Parser YAML mínimo (apenas os formatos presentes na fonte v1)
// ---------------------------------------------------------------------------

function unquoteScalar(raw) {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  // Desfaz escapes comuns de aspas duplas YAML.
  value = value.replace(/\\"/g, '"').replace(/\\'/g, "'");
  return value.trim();
}

/**
 * Extrai e parseia front-matter `--- ... ---` de um SKILL.md v1.
 * Suporta escalares simples (com ou sem aspas) e block scalars `>` / `|`
 * (folded/literal com indentação), únicos formatos usados pela fonte.
 * Retorna { data, body } onde body é o texto integral após o fechamento.
 */
export function parseFrontmatter(source) {
  const text = source.replace(/^\uFEFF/, "");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new Error("front-matter ausente (arquivo não começa com '---')");
  }
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closeIndex = i;
      break;
    }
  }
  if (closeIndex === -1) throw new Error("front-matter sem fechamento '---'");

  const fmLines = lines.slice(1, closeIndex);
  const data = parseYamlSubset(fmLines);
  const body = lines.slice(closeIndex + 1).join("\n");
  return { data, body };
}

/**
 * Parser YAML do subconjunto usado pelo contrato v1/v2: escalares
 * (com/sem aspas), block scalars > e |, mapas aninhados por indentação e
 * listas "- item". Zero dependências; erros loud em linha estranha.
 */
function parseYamlSubset(fmLines) {
  // Remove linhas vazias/comentário uma única vez (ordem preservada).
  const items = fmLines.filter((l) => l.trim() && !l.trim().startsWith("#"));

  const BLOCK_SCALAR = /^(>|>[-+]|\||\|[-+])$/;
  const KEY = /^(\s*)([A-Za-z_][\w-]*)\s*:\s*(.*)$/;
  const LIST_ITEM = /^(\s*)-\s+(.*)$/;

  function parseBlock(start, minIndent) {
    if (start >= items.length) return { value: undefined, next: start };
    const first = items[start].match(LIST_ITEM);
    if (first && first[1].length >= minIndent) {
      const array = [];
      let i = start;
      while (i < items.length) {
        const line = items[i];
        const li = line.match(LIST_ITEM);
        if (!li || li[1].length !== first[1].length) break;
        array.push(unquoteScalar(li[2]));
        i += 1;
      }
      return { value: array, next: i };
    }
    const obj = {};
    let i = start;
    while (i < items.length) {
      const km = items[i].match(KEY);
      if (!km || km[1].length !== indentOf(items[start])) break;
      if (km[1].length < minIndent) break;
      const key = km[2];
      const inline = km[3].trim();
      if (BLOCK_SCALAR.test(inline)) {
        const chunk = [];
        i += 1;
        while (i < items.length && /^\s/.test(items[i])) {
          chunk.push(items[i].trim());
          i += 1;
        }
        obj[key] = inline.startsWith("|") ? chunk.join("\n") : chunk.join(" ");
      } else if (inline === "") {
        const childIndent = i + 1 < items.length ? indentOf(items[i + 1]) : Infinity;
        if (childIndent <= km[1].length) {
          obj[key] = null; // chave sem bloco nem valor
          i += 1;
        } else {
          const nested = parseBlock(i + 1, childIndent);
          obj[key] = nested.value;
          i = nested.next;
        }
      } else {
        obj[key] = unquoteScalar(inline);
        i += 1;
      }
    }
    return { value: obj, next: i };
  }

  function indentOf(line) {
    return line.match(/^\s*/)[0].length;
  }

  const result = parseBlock(0, 0);
  if (result.next < items.length) {
    throw new Error(
      `linha de front-matter não reconhecida: "${items[result.next]}"`
    );
  }
  return result.value ?? {};
}

// ---------------------------------------------------------------------------
// Extrações fiéis do corpo original
// ---------------------------------------------------------------------------

/** Título H1 original ou título derivado do nome (determinístico). */
export function deriveTitle(name, body) {
  const h1 = body.split("\n").find((l) => /^#\s+\S/.test(l));
  if (h1) return h1.replace(/^#\s+/, "").trim();
  return name
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

/** Headings `##` top-level do corpo (cap limit). */
export function extractHeadings(body, cap = 5) {
  const headings = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m && !m[1].startsWith("#")) {
      headings.push(m[1].replace(/#+\s*$/, "").trim());
      if (headings.length >= cap) break;
    }
  }
  return headings;
}

/** Frases da descrição que começam com "Use" (= gatilhos declarados). */
export function extractUseSentences(description) {
  const sentences = String(description || "")
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú"“])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const triggers = sentences.filter((s) => /^(use|ative|utilize)\b/i.test(s));
  const summary = sentences.filter((s) => !triggers.includes(s));
  return { triggers, summary };
}

function splitSections(body) {
  const sections = [];
  let current = null;
  for (const line of body.split("\n")) {
    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (heading) {
      current = { level: heading[1].length, title: heading[2], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

function renderSectionRaw(section) {
  return section.lines.join("\n").replace(/^\n+|\s+$/g, "").trim();
}

const WORKFLOW_HEADING = /(workflow|passo|step|fluxo|processo|roteiro|how[- ]to)/i;

/** Primeira sentença do texto, limpa de markdown, cap 90 chars (título fiel). */
function firstSentenceAsTitle(text) {
  const flat = text.replace(/[#*`>]/g, "").replace(/\s+/g, " ").trim();
  const sentence = flat.split(/(?<=[.!?:])\s/)[0] || flat;
  const clean = sentence.trim();
  if (!clean) return "";
  return clean.length <= 90 ? clean : `${clean.slice(0, 87).trimEnd()}...`;
}

/**
 * Extrai passos fiéis do corpo original. Cadeia de fallbacks (nunca inventa):
 *  1. Seção ## cujo heading casa com WORKFLOW_HEADING e possui subseções ###
 *     → 1 passo por subseção (conteúdo verbatim, incluindo código).
 *  2. Seção de workflow com lista ordenada top-level → 1 passo por item.
 *  3. Qualquer lista ordenada top-level do corpo → itens como passos.
 *  4. Prosa: parágrafos top-level → cada parágrafo vira um passo fiel.
 *  5. Último recurso: cada seção ##/### vira um passo ("Aplicar: <heading>").
 *
 * Nota: splitSections "achata" ### como seções irmãs; os filhos de um
 * workflow são recuperados varrendo as sections seguintes com level > 2.
 */
export function extractWorkflow(body) {
  const sections = splitSections(body);

  const wfIndex = sections.findIndex(
    (s) => s.level === 2 && WORKFLOW_HEADING.test(s.title)
  );
  if (wfIndex !== -1) {
    const wf = sections[wfIndex];

    // Filhos ### consecutivos logo após o heading do workflow.
    const children = [];
    let end = sections.length;
    for (let i = wfIndex + 1; i < sections.length; i++) {
      if (sections[i].level <= 2) {
        end = i;
        break;
      }
      if (sections[i].level === 3) {
        children.push({ title: sections[i].title, lines: [...sections[i].lines] });
      } else if (children.length) {
        // Level >= 4: conteúdo aninhado no último filho (preservado verbatim).
        const last = children[children.length - 1];
        last.lines.push(
          `${"#".repeat(sections[i].level)} ${sections[i].title}`,
          ...sections[i].lines
        );
      }
    }

    // (1): substeps ### com conteúdo real.
    if (children.some((c) => renderSectionRaw(c))) {
      const steps = [];
      const preamble = renderSectionRaw(wf);
      if (preamble) {
        steps.push({ title: "Contexto do workflow", body: preamble });
      }
      for (const child of children) {
        const raw = renderSectionRaw(child);
        if (!raw) continue;
        // Título original tipo "3. Pague a paginação": remove o número —
        // a numeração canônica é a do passo v2.
        const cleanTitle = child.title.replace(/^\d+\s*[.)]\s*/, "").trim();
        steps.push({ title: cleanTitle || child.title, body: raw });
      }
      if (steps.length) return { strategy: "workflow-section-steps", steps };
    }

    // (2): lista ordenada dentro da seção de workflow (incl. filhos achatados).
    const flatLines = [...wf.lines];
    for (const child of children) {
      flatLines.push(`### ${child.title}`, ...child.lines);
    }
    const ordered = collectOrderedItems(flatLines);
    if (ordered.length) {
      return { strategy: "workflow-section-ordered", steps: ordered };
    }
  }

  // (3): primeira lista ordenada top-level que NÃO seja lista de proibições
  // (anti-padrões ❌/"nunca"/"proibido" não são passos de execução).
  const allBlocks = collectOrderedBlocks(body.split("\n"));
  const positiveBlock = allBlocks.find((block) => !isProhibitionBlock(block));
  if (positiveBlock) {
    return { strategy: "top-level-ordered", steps: positiveBlock };
  }

  // (4): parágrafos de prosa top-level (título = primeira sentença).
  // Exige >= 2 parágrafos: prosa solitária não constitui step-by-step;
  // nesse caso as seções (5) representam melhor o conteúdo.
  const paragraphs = collectParagraphs(body);
  if (paragraphs.length >= 2) {
    return {
      strategy: "paragraphs-as-steps",
      steps: paragraphs.map((p, i) => ({
        title: firstSentenceAsTitle(p) || `Passo ${i + 1}`,
        body: p,
      })),
    };
  }

  // (5): seções viram passos de estudo/aplicação (conteúdo preservado).
  const sectionSteps = sections
    .map((s) => ({ section: s, raw: renderSectionRaw(s) }))
    .filter((s) => s.raw)
    .slice(0, 15)
    .map(({ section, raw }) => ({
      title: `Aplicar: ${section.title}`,
      body: raw,
    }));
  if (sectionSteps.length) return { strategy: "sections-as-steps", steps: sectionSteps };

  throw new Error("não foi possível extrair passos fiéis do corpo original");
}

/** Marcadores de lista de proibições/anti-padrões (não são passos). */
const PROHIBITION_MARKER =
  /^\s*(❌|🚫|⛔|❎|nunc\w*|proibi\w*|anti[- ]|evite|jamais|never|don'?t)\b/i;

/** true se a maioria dos itens do bloco for proibição/anti-padrão. */
function isProhibitionBlock(items) {
  const hits = items.filter((it) => PROHIBITION_MARKER.test(it.first)).length;
  return items.length > 0 && hits / items.length >= 0.5;
}

/**
 * Todos os blocos de lista ordenada top-level do corpo, agrupados e
 * convertidos em steps (usado para escolher o primeiro bloco "positivo").
 */
function collectOrderedBlocks(lines) {
  const blocks = [];
  let currentItems = null;
  let current = null;
  const closeBlock = () => {
    if (current) {
      currentItems.push(current);
      current = null;
    }
    if (currentItems && currentItems.length) {
      blocks.push(
        currentItems.slice(0, 15).map((it) => {
          const restRaw = it.rest.join("\n").replace(/\s+$/g, "").trim();
          return {
            title: firstSentenceAsTitle(it.first) || `Passo ${it.marker}`,
            body: [it.first, restRaw].filter(Boolean).join("\n\n"),
          };
        }).filter((s) => s.body.trim())
      );
    }
    currentItems = null;
  };
  for (const line of lines) {
    const item = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (item) {
      if (!currentItems) currentItems = [];
      if (current) currentItems.push(current);
      current = { marker: item[1], first: item[2], rest: [] };
    } else if (current) {
      if (/^#{2,3}\s/.test(line)) {
        closeBlock();
      } else {
        current.rest.push(line);
      }
    } else if (currentItems && !line.trim()) {
      // Linha vazia não fecha o bloco (itens com corpo multilinha).
    }
  }
  closeBlock();
  return blocks;
}

/** Itens de lista ordenada top-level agrupados com suas linhas de continuação. */
function collectOrderedItems(lines) {
  const items = [];
  let current = null;
  for (const line of lines) {
    const item = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (item) {
      if (current) items.push(current);
      current = { marker: item[1], first: item[2], rest: [] };
    } else if (current) {
      // Continua no item até novo item top-level ou heading.
      if (/^(#{2,3}\s)/.test(line)) {
        items.push(current);
        current = null;
      } else {
        current.rest.push(line);
      }
    }
  }
  if (current) items.push(current);

  return items.slice(0, 15).map((it) => {
    const restRaw = it.rest.join("\n").replace(/\s+$/g, "").trim();
    return {
      title: firstSentenceAsTitle(it.first) || `Passo ${it.marker}`,
      body: [it.first, restRaw].filter(Boolean).join("\n\n"),
    };
  }).filter((s) => s.body.trim());
}

/** Blocos de prosa top-level (fora de code fences), verbatim. */
function collectParagraphs(body) {
  const paragraphs = [];
  let buffer = [];
  let inFence = false;
  const flush = () => {
    if (buffer.length) {
      const text = buffer.join("\n").trim();
      if (text) paragraphs.push(text);
      buffer = [];
    }
  };
  for (const line of body.split("\n")) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      flush();
      continue;
    }
    if (inFence) continue;
    const isProse =
      line.trim() &&
      !/^#{1,6}\s/.test(line) &&
      !/^[-*+]\s/.test(line) &&
      !/^>\s?/.test(line) &&
      !/^\|/.test(line) &&
      !/^\d+[.)]\s/.test(line) &&
      // Horizontal rules (--- / *** / ___) não são prosa.
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
    if (isProse) buffer.push(line);
    else flush();
  }
  flush();
  return paragraphs.slice(0, 12);
}

/**
 * Verificação: checklist `- [ ]` real do corpo; senão bullets de seção de
 * qualidade/validação; senão fallback honesto específico da categoria.
 */
export function extractVerification(body, category) {
  const checkbox = body
    .split("\n")
    .filter((l) => /^\s*-\s+\[[ xX]?\]/.test(l))
    .map((l) => l.trim())
    .slice(0, 10);
  if (checkbox.length) {
    return { source: "checklist-original", items: checkbox };
  }

  const qualitySection = splitSections(body).find((s) =>
    /(checklist|valida|verifica|qualidade|quality|validation)/i.test(s.title)
  );
  if (qualitySection) {
    const bullets = qualitySection.lines
      .filter((l) => /^\s*[-*+]\s+\S/.test(l))
      .map((l) => `- ${l.trim().replace(/^[-*+]\s+/, "")}`)
      .slice(0, 8);
    if (bullets.length) {
      return { source: "quality-section-original", items: bullets };
    }
  }

  const fallback = FALLBACK_VERIFICATION[category];
  if (!fallback?.length) {
    throw new Error(`sem fallback de verificação para categoria "${category}"`);
  }
  return { source: `fallback-honesto:${category}`, items: fallback };
}

// ---------------------------------------------------------------------------
// Renderização v2
// ---------------------------------------------------------------------------

function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Enriquece a description original com gatilhos derivados do título/corpo. */
export function enrichDescription(description, title, headings) {
  const triggerHeads = headings.slice(0, 3).join("; ");
  const base = String(description || "").trim().replace(/\s+/g, " ");
  const triggers = [title.toLowerCase(), triggerHeads.toLowerCase()]
    .filter(Boolean)
    .join("; ");
  return `${base} Gatilhos de ativação: ${triggers}.`;
}

function renderRationalizations(category) {
  const lib = RATIONALIZATIONS[category];
  if (!lib) throw new Error(`biblioteca anti-racionalização ausente para "${category}"`);
  const lines = [];
  for (const entry of lib.rationalizations) {
    lines.push(`- **"${entry.says}"**`);
    lines.push(`  - Verdade: ${entry.truth}`);
  }
  return lines.join("\n");
}

function renderRedFlags(category) {
  const lib = RATIONALIZATIONS[category];
  if (!lib) throw new Error(`biblioteca anti-racionalização ausente para "${category}"`);
  return lib.redFlags.map((flag) => `- ${flag}`).join("\n");
}

function renderWorkflow(steps) {
  return steps
    .map((step, i) => `### Passo ${i + 1} — ${step.title}\n\n${step.body}`)
    .join("\n\n")
    .trim();
}

/**
 * Monta o SKILL.md v2 completo a partir do conteúdo REAL da skill v1.
 * Função pura: mesma entrada → mesmo bytes (idempotência estrutural).
 */
export function renderSkillV2({ name, description, body }) {
  if (!name) throw new Error("campo 'name' obrigatório no front-matter de origem");
  if (!description) throw new Error("campo 'description' obrigatório no front-matter de origem");

  const title = deriveTitle(name, body);
  const headings = extractHeadings(body);
  const category = inferCategory(name, description, body);
  const mcp = MCP_BY_CATEGORY[category];
  if (!mcp) throw new Error(`mapeamento MCP ausente para categoria "${category}"`);

  const workflow = extractWorkflow(body);
  const verification = extractVerification(body, category);
  const enrichedDescription = enrichDescription(description, title, headings);

  const legacyBody = body.replace(/^\n+/, "").replace(/\s+$/g, "");

  const fmToolsMcp = mcp.map((tool) => `    - ${tool}`).join("\n");

  return `---
name: ${yamlQuote(name)}
description: ${yamlQuote(enrichedDescription)}
version: ${SCHEMA_VERSION}
category: ${category}
tools:
  mcp:
${fmToolsMcp}
---

# ${title}

> Migrado deterministicamente de \`skills/${name}/SKILL.md\` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** ${CATEGORY_LABELS_PT[category]} (\`${category}\`)
- **Resumo:** ${extractUseSentences(description).summary.join(" ") || description}
${extractUseSentences(description)
  .triggers.map((t) => `- **Ativar quando:** ${t}`)
  .join("\n")}
- **Escopo canônico:** ${title}
- **Seções do corpo original:** ${headings.join(" · ") || "(corpo sem seções — conteúdo em fluxo único)"}
- **Ferramentas MCP esperadas:** ${mcp.join(", ")}

## Step-by-Step Workflow

<!-- estratégia de extração: ${workflow.strategy} -->

${renderWorkflow(workflow.steps)}

## Verification Steps

<!-- fonte da verificação: ${verification.source} -->

${verification.items.map((item) => `- ${item.startsWith("-") ? item.slice(1).trim() : item}`).join("\n")}

## Common Rationalizations

${renderRationalizations(category)}

## Red Flags

${renderRedFlags(category)}

## Legacy Reference (v1)

${legacyBody}
`;
}

// ---------------------------------------------------------------------------
// Migração da árvore
// ---------------------------------------------------------------------------

async function listSkillDirs(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  dirs.sort(); // determinismo de ordem
  return dirs;
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Hash estável de uma árvore de diretórios (paths + sha256 dos conteúdos). */
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

/**
 * Migra todas as skills de srcRoot para destRoot.
 * dryRun=true processa e valida tudo em memória sem escrever nada.
 * Retorna relatório estruturado; lança erro loud em qualquer violação.
 */
export async function migrateAll({ srcRoot, destRoot, dryRun = false }) {
  const startedAt = process.hrtime.bigint();
  const srcStat = await stat(srcRoot);
  if (!srcStat.isDirectory()) throw new Error(`--src não é diretório: ${srcRoot}`);

  const resolvedSrc = path.resolve(srcRoot);
  const resolvedDest = path.resolve(destRoot);
  if (
    resolvedDest === resolvedSrc ||
    resolvedDest.startsWith(resolvedSrc + path.sep)
  ) {
    throw new Error("--dest não pode estar dentro de --src (fonte intocada)");
  }

  const skillDirs = await listSkillDirs(srcRoot);
  const report = {
    srcRoot,
    destRoot,
    dryRun,
    total: skillDirs.length,
    migrated: [],
    referencesCopied: 0,
    failures: [],
  };

  for (const dirName of skillDirs) {
    const srcSkillDir = path.join(srcRoot, dirName);
    const skillFile = path.join(srcSkillDir, "SKILL.md");
    try {
      if (!(await exists(skillFile))) {
        throw new Error("SKILL.md ausente no diretório de origem");
      }
      const raw = await readFile(skillFile, "utf8");
      const { data, body } = parseFrontmatter(raw);
      if (data.name && data.name !== dirName) {
        throw new Error(
          `name do front-matter ("${data.name}") difere do diretório ("${dirName}")`
        );
      }
      const rendered = renderSkillV2({
        name: data.name || dirName,
        description: data.description,
        body,
      });

      // Auto-validação do render: nenhuma seção obrigatória vazia.
      validateRendered(rendered, dirName);

      const destSkillDir = path.join(destRoot, dirName);
      const entry = {
        name: dirName,
        category: rendered.match(/^category: (\S+)$/m)?.[1] ?? "?",
        workflowSteps: (rendered.match(/^### Passo \d+/gm) || []).length,
        verificationItems: countVerificationItems(rendered),
        destination: path.join(destSkillDir, "SKILL.md"),
      };

      if (!dryRun) {
        await mkdir(path.join(destSkillDir, "references"), { recursive: true });
        await writeFile(path.join(destSkillDir, "SKILL.md"), rendered, "utf8");

        const refSrc = path.join(srcSkillDir, "references.md");
        if (await exists(refSrc)) {
          // Cópia byte-a-byte (Buffer) — determinismo garantido.
          const refBytes = await readFile(refSrc);
          await writeFile(
            path.join(destSkillDir, "references", "references.md"),
            refBytes
          );
          report.referencesCopied += 1;
        }
      }
      report.migrated.push(entry);
    } catch (error) {
      report.failures.push({
        name: dirName,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  report.elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  report.treeHash = (await exists(destRoot)) && !dryRun
    ? (await hashTree(destRoot)).hash
    : null;
  return report;
}

function countVerificationItems(rendered) {
  const section = rendered.split("## Verification Steps")[1]?.split("\n## ")[0] ?? "";
  return (section.match(/^- \[.\]|^- (?!<)/gm) || []).length;
}

/**
 * Valida o SKILL.md gerado: front-matter completo + todas as seções
 * obrigatórias presentes e com conteúdo real (falha loud, nunca stub).
 */
export function validateRendered(rendered, skillName) {
  const problems = [];

  const requiredFm = ["name:", "description:", "version:", "category:", "tools:"];
  const fm = rendered.split(/^---$/m)[1] ?? "";
  for (const field of requiredFm) {
    if (!fm.includes(field)) problems.push(`front-matter sem "${field}"`);
  }
  if (!fm.includes(`version: ${SCHEMA_VERSION}`)) {
    problems.push(`front-matter sem version: ${SCHEMA_VERSION}`);
  }

  const parts = rendered.split(/^## /m).slice(1);
  const found = new Map();
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = part.slice(0, nl).trim();
    const content = part.slice(nl + 1).trim();
    found.set(heading, content);
  }
  for (const section of REQUIRED_SECTIONS) {
    const content = found.get(section);
    if (content === undefined) {
      problems.push(`seção obrigatória ausente: "${section}"`);
    } else {
      const meaningful = content.replace(/<!--[\s\S]*?-->/g, "").trim();
      if (!meaningful) problems.push(`seção obrigatória vazia: "${section}"`);
    }
  }
  if (problems.length) {
    throw new Error(
      `validação v2 falhou para "${skillName}":\n  - ${problems.join("\n  - ")}`
    );
  }
}

/** Remove a árvore de destino (usado apenas com --clean). */
export async function cleanDest(destRoot) {
  await rm(destRoot, { recursive: true, force: true });
}
