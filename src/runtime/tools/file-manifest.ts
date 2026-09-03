/**
 * Manifesto de arquivos: transformar a saída do agente em arquivos de verdade.
 *
 * O Blueprint Engine (`cli/blueprint.ts`) já definia o contrato de
 * materialização — declare a árvore, escreva cada arquivo completo, zero stub —
 * mas só em `--prompt-only`, isto é, num texto para a pessoa colar em outra
 * ferramenta. Dentro do runtime, o contrato não existia: o agente entregava
 * código dentro de um artefato de texto, e o texto ia para o content store.
 *
 * Este módulo é o parser determinístico daquele contrato. Ele não interpreta
 * intenção: reconhece um marcador explícito e o bloco de código que vem depois.
 *
 * ## Formato reconhecido, e só ele
 *
 *     ### FILE: src/routes/pagination.ts
 *     ```ts
 *     export function paginate() { ... }
 *     ```
 *
 * O marcador aceita qualquer nível de heading, negrito ou comentário HTML —
 * variações que o mesmo modelo produz entre uma resposta e outra. O que NÃO é
 * aceito é inferir caminho de outro lugar (do texto ao redor, do nome da
 * linguagem na cerca). Adivinhar o destino de um arquivo que vai ser gravado é
 * o tipo de heurística cujo erro só aparece depois de gravado.
 *
 * ## Tudo ou nada
 *
 * A validação roda sobre o manifesto INTEIRO antes de qualquer escrita.
 * Materialização parcial que se declara concluída é a dishonestidade que a
 * verificação por evidência existe para impedir: o usuário veria "6 arquivos
 * escritos" sem saber que 3 foram recusados.
 */

import path from 'path';

/** Teto de arquivos por manifesto. Acima disso não é uma entrega, é um dump. */
export const MAX_FILES = 60;
/** Teto por arquivo. */
export const MAX_FILE_BYTES = 256 * 1024;
/** Teto do manifesto inteiro. */
export const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

/**
 * Marcas de trabalho não feito. Mesma lista do contrato de materialização do
 * Blueprint Engine: arquivo com stub não é arquivo entregue.
 */
const STUB_MARKERS = [/\bTODO\b/, /\bFIXME\b/, /implement later/i, /\bnot implemented\b/i, /^\s*\.\.\.\s*$/m];

export interface ManifestFile {
  /** Caminho relativo declarado pelo agente, normalizado para separador posix. */
  path: string;
  content: string;
  /** Linguagem da cerca, quando declarada. Informativo: não decide nada. */
  language?: string;
}

export interface ManifestParse {
  files: ManifestFile[];
  /** Marcadores encontrados sem bloco de código utilizável depois. */
  orphanMarkers: string[];
}

/** Marcador de arquivo, nas formas que um modelo realmente produz. */
const FILE_MARKER = /^(?:#{1,6}\s*|\*\*\s*|<!--\s*|\/\/\s*)?FILE\s*:\s*([^\s*<>|"']+)\s*(?:\*\*|-->)?\s*$/i;
/** Abertura/fechamento de cerca, com info string opcional. */
const FENCE = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;

/**
 * Extrai os arquivos declarados. Determinístico e tolerante ao que não
 * reconhece: texto entre marcadores é ignorado, não vira conteúdo de arquivo.
 */
export function parseFileManifest(text: string): ManifestParse {
  const lines = String(text ?? '').split('\n');
  const files: ManifestFile[] = [];
  const orphanMarkers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const marker = FILE_MARKER.exec(lines[i]);
    if (!marker) continue;
    const declared = marker[1].trim().replace(/^[`"']|[`"']$/g, '');

    // Procura a PRÓXIMA cerca. Um marcador seguido de prosa e só então de uma
    // cerca continua valendo (modelo costuma explicar antes de escrever), mas
    // um segundo marcador no meio corta: o bloco pertence ao marcador mais
    // próximo, nunca ao anterior.
    let j = i + 1;
    let open: RegExpExecArray | null = null;
    for (; j < lines.length; j++) {
      if (FILE_MARKER.test(lines[j])) break;
      const fence = FENCE.exec(lines[j]);
      if (fence) {
        open = fence;
        break;
      }
    }
    if (!open) {
      orphanMarkers.push(declared);
      continue;
    }

    const closer = open[1];
    const body: string[] = [];
    let k = j + 1;
    let closed = false;
    for (; k < lines.length; k++) {
      const candidate = FENCE.exec(lines[k]);
      if (candidate && candidate[1].startsWith(closer[0]) && candidate[1].length >= closer.length && candidate[2] === '') {
        closed = true;
        break;
      }
      body.push(lines[k]);
    }
    if (!closed) {
      // Cerca não fechada: o resto do texto seria engolido como conteúdo do
      // arquivo. Recusar é mais seguro do que gravar um arquivo com a resposta
      // inteira do modelo dentro.
      orphanMarkers.push(declared);
      continue;
    }

    files.push({
      path: declared.replace(/\\/g, '/'),
      content: `${body.join('\n')}\n`,
      ...(open[2] ? { language: open[2] } : {}),
    });
    i = k;
  }

  return { files, orphanMarkers };
}

export interface ManifestRejection {
  path: string;
  reason: string;
}

export interface ManifestValidation {
  accepted: ManifestFile[];
  rejected: ManifestRejection[];
}

/**
 * Valida o manifesto inteiro ANTES de escrever qualquer coisa.
 *
 * Caminho é validado aqui além da checagem de zona da `ToolRegistry`: aquela
 * responde "está dentro da sandbox?", esta responde "é um caminho que o agente
 * tinha o direito de declarar?". Um caminho absoluto que por acaso caia dentro
 * da zona ainda é um agente decidindo onde gravar.
 */
export function validateManifest(parsed: ManifestParse): ManifestValidation {
  const accepted: ManifestFile[] = [];
  const rejected: ManifestRejection[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  for (const marker of parsed.orphanMarkers) {
    rejected.push({ path: marker, reason: 'marcador de arquivo sem bloco de código fechado depois dele' });
  }

  for (const file of parsed.files) {
    const declared = file.path;
    if (accepted.length >= MAX_FILES) {
      rejected.push({ path: declared, reason: `manifesto acima do teto de ${MAX_FILES} arquivos` });
      continue;
    }
    if (path.isAbsolute(declared) || /^[A-Za-z]:/.test(declared)) {
      rejected.push({ path: declared, reason: 'caminho absoluto: o destino é escolhido por quem executa, não pelo agente' });
      continue;
    }
    const normalized = path.posix.normalize(declared);
    if (normalized.startsWith('..') || normalized.split('/').includes('..')) {
      rejected.push({ path: declared, reason: 'caminho sai do diretório de saída' });
      continue;
    }
    if (normalized.includes('\0') || normalized.trim().length === 0) {
      rejected.push({ path: declared, reason: 'caminho inválido' });
      continue;
    }
    if (seen.has(normalized)) {
      rejected.push({ path: declared, reason: 'caminho declarado duas vezes no mesmo manifesto' });
      continue;
    }
    if (file.content.trim().length === 0) {
      rejected.push({ path: declared, reason: 'arquivo vazio: entregar o caminho sem o conteúdo é entregar um stub' });
      continue;
    }
    const bytes = Buffer.byteLength(file.content, 'utf-8');
    if (bytes > MAX_FILE_BYTES) {
      rejected.push({ path: declared, reason: `arquivo acima do teto de ${MAX_FILE_BYTES} bytes` });
      continue;
    }
    if (totalBytes + bytes > MAX_TOTAL_BYTES) {
      rejected.push({ path: declared, reason: `manifesto acima do teto total de ${MAX_TOTAL_BYTES} bytes` });
      continue;
    }
    const stub = STUB_MARKERS.find((re) => re.test(file.content));
    if (stub) {
      rejected.push({ path: declared, reason: `contém marca de trabalho não feito (${stub.source}): o contrato de materialização proíbe stub` });
      continue;
    }
    seen.add(normalized);
    totalBytes += bytes;
    accepted.push({ ...file, path: normalized });
  }

  return { accepted, rejected };
}
