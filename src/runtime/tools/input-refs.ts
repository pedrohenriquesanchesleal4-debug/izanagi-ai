/**
 * Referências de artefato dentro do input de uma tool.
 *
 * Um nó de tool é declarado no PLANO, antes de qualquer execução. O que ele
 * precisa escrever, porém, só existe DEPOIS que os nós anteriores produziram
 * seus artefatos. Sem uma forma de referenciar isso, um nó de tool só serve
 * para entrada constante — e é por isso que o caminho seguro existia sem
 * ninguém passar por ele em produção.
 *
 * A ponte é um marcador declarativo no input, resolvido pelo runtime
 * imediatamente antes da chamada:
 *
 *   { file: 'out/api.md', content: { $artifact: 'architecture' } }
 *   { file: 'out/run.md',  content: { $deliverable: true } }
 *
 * Resolução DETERMINÍSTICA e sem modelo: é substituição de valor, não
 * interpretação. Referência a nó inexistente é erro, nunca string vazia —
 * escrever um arquivo vazio e chamar isso de entrega é a falha silenciosa que
 * a verificação por evidência existe para impedir.
 *
 * ## O limite que não se afrouxa
 *
 * `code.execute` NÃO aceita marcador nenhum. Substituir saída de modelo dentro
 * de código que vai ser executado é injeção com outro nome, e o fato de a
 * sandbox isolar filesystem e processo não torna o código executado inócuo:
 * ele ainda tem rede, e ainda decide o que devolver para a verificação. Quem
 * precisa levar artefato para dentro de um script grava o arquivo com
 * `fs.write` e lê de lá, dentro da zona permitida.
 */

/** Marcador de artefato de um nó específico. */
export interface ArtifactRefMarker {
  $artifact: string;
}

/** Marcador do documento único com tudo que o run produziu. */
export interface DeliverableMarker {
  $deliverable: true;
}

/** Como o runtime resolve cada marcador. Injetado pelo Orchestrator. */
export interface RefResolution {
  /** Conteúdo textual do artefato daquele nó. Lança quando o nó não produziu nada. */
  artifact(nodeId: string): string;
  /** Documento único com os artefatos do run. */
  deliverable(): string;
}

/**
 * Tools que recusam marcador em QUALQUER campo do input. Regra por tool, não
 * por campo: um campo esquecido numa allowlist vira exatamente o buraco que a
 * regra tentava fechar.
 */
export const REF_FORBIDDEN_TOOLS = new Set(['code.execute']);

/** Profundidade máxima do input percorrido. Input mais fundo que isto não é input, é acidente. */
const MAX_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Marcador é objeto com EXATAMENTE a chave do marcador — nada de chave extra passando junto. */
function markerOf(value: unknown): { kind: 'artifact'; nodeId: string } | { kind: 'deliverable' } | null {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1) return null;
  if (keys[0] === '$artifact') {
    const nodeId = value.$artifact;
    if (typeof nodeId !== 'string' || nodeId.trim().length === 0) {
      throw new Error('marcador $artifact precisa nomear um nó (string não vazia)');
    }
    return { kind: 'artifact', nodeId: nodeId.trim() };
  }
  if (keys[0] === '$deliverable') {
    if (value.$deliverable !== true) {
      throw new Error('marcador $deliverable só aceita o valor true');
    }
    return { kind: 'deliverable' };
  }
  return null;
}

/** True quando o input carrega algum marcador (usado para recusar antes de resolver). */
export function hasRefMarker(input: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return false;
  try {
    if (markerOf(input)) return true;
  } catch {
    // Marcador malformado ainda é marcador: recusar é o comportamento certo.
    return true;
  }
  if (Array.isArray(input)) return input.some((item) => hasRefMarker(item, depth + 1));
  if (isPlainObject(input)) return Object.values(input).some((item) => hasRefMarker(item, depth + 1));
  return false;
}

/**
 * Substitui os marcadores do input pelos valores reais. Nunca muda a forma do
 * input: só troca folhas. Input sem marcador volta idêntico.
 */
export function resolveToolInput(toolId: string, input: unknown, res: RefResolution): unknown {
  if (REF_FORBIDDEN_TOOLS.has(toolId)) {
    if (hasRefMarker(input)) {
      throw new Error(
        `tool "${toolId}" não aceita marcador de artefato no input: substituir saída de modelo dentro de código executado é injeção. ` +
          'Grave o artefato com fs.write e leia o arquivo dentro do script.',
      );
    }
    return input;
  }
  return walk(input, res, 0);
}

function walk(value: unknown, res: RefResolution, depth: number): unknown {
  if (depth > MAX_DEPTH) return value;
  const marker = markerOf(value);
  if (marker) {
    return marker.kind === 'artifact' ? res.artifact(marker.nodeId) : res.deliverable();
  }
  if (Array.isArray(value)) return value.map((item) => walk(item, res, depth + 1));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = walk(item, res, depth + 1);
    return out;
  }
  return value;
}
