/**
 * Entrega: o run grava o que produziu, e a verificação depende da gravação.
 *
 * Até aqui um `izanagi run` terminava com os artefatos em
 * `.izanagi/state/artifacts/<runId>/` — visíveis por `izanagi explain
 * --artifacts`, invisíveis para o projeto. O trabalho existia e não era
 * entregue.
 *
 * O nó de entrega fecha isso e, de quebra, é o primeiro nó `kind: 'tool'`
 * gerado pelo PLANEJAMENTO em produção. Isso importa por um motivo de
 * verificação, não de conveniência: um critério `file-exists` sobre um arquivo
 * que ninguém escreveu é teatro — passa quando o arquivo já existia por outro
 * motivo, e falha sem dizer nada sobre o trabalho. Aqui o arquivo é escrito
 * pela `ToolRegistry`, com permissão declarada no contrato e política aplicada
 * antes, e o mesmo caminho é conferido depois. O critério passa a significar
 * "o runtime gravou isto", que é evidência.
 *
 * Menor privilégio: o contrato do nó concede `fs:write` e nada mais. Nenhum
 * outro nó do grafo recebe permissão nenhuma, então nenhum outro nó escreve.
 */

import path from 'path';
import type { GraphNode } from '../types.js';
import type { AcceptanceCriterion, TaskContract } from '../contracts/task-contract.js';

/**
 * Kinds que descrevem o PROCESSO do run, não o produto dele.
 *
 * `project-survey` e `materialization` entram aqui porque são, respectivamente,
 * o que o run leu antes de trabalhar e o comprovante do que ele gravou —
 * úteis para auditar a execução, e não a entrega que alguém pediu.
 */
const PROCESS_KINDS = new Set(['evaluation', 'critique', 'trace', 'project-survey', 'materialization']);

/** Teto por artefato no documento entregue, com o corte declarado no próprio texto. */
export const MAX_SECTION_CHARS = 128 * 1024;

/** Id do nó de entrega. Fixo: `izanagi explain` e os testes referenciam por nome. */
export const DELIVER_NODE_ID = 'deliver';

/** Id do nó de materialização. */
export const MATERIALIZE_NODE_ID = 'materialize';

/**
 * Contrato de materialização levado ao PROMPT do agente.
 *
 * O Blueprint Engine já dizia isto — declare a árvore, escreva cada arquivo
 * completo, zero stub — mas só em `--prompt-only`, num texto para a pessoa
 * colar em outra ferramenta. Dentro do runtime o contrato não existia, e o
 * parser só reconhece o que foi combinado: pedir o formato é o que torna a
 * materialização determinística em vez de adivinhação sobre a saída.
 */
export const MATERIALIZATION_CONSTRAINT =
  'ao entregar código, declare CADA arquivo com o marcador "### FILE: <caminho relativo>" ' +
  'seguido do bloco de código completo em cerca tripla; caminho relativo ao projeto, ' +
  'arquivo inteiro e funcional, zero TODO/FIXME/stub (arquivo com marca de trabalho não feito é recusado inteiro)';

export interface DeliverableArtifact {
  nodeId: string;
  kind: string;
  content: unknown;
  valid: boolean;
}

export interface DeliverableInput {
  objective: string;
  runId: string;
  mode: string;
  /** Ordem do grafo. Artefato fora dela entra no fim, na ordem em que apareceu. */
  order?: string[];
  artifacts: DeliverableArtifact[];
}

function toText(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function clipSection(text: string): string {
  if (text.length <= MAX_SECTION_CHARS) return text;
  return `${text.slice(0, MAX_SECTION_CHARS)}\n\n<!-- seção truncada em ${MAX_SECTION_CHARS} chars · conteúdo completo em .izanagi/state/artifacts/ -->`;
}

function fence(kind: string, text: string): string {
  // Conteúdo JSON vira bloco de código; markdown produzido por agente entra
  // como está, senão a entrega viraria markdown escapado dentro de markdown.
  const trimmed = text.trim();
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  return looksJson ? `\`\`\`json\n${trimmed}\n\`\`\`` : trimmed;
}

/**
 * Monta o documento único do run. Determinístico: mesma entrada, mesmo texto
 * (nenhum timestamp, nenhuma ordenação por acaso de Map).
 *
 * Artefato inválido NÃO é omitido: entra marcado. Sumir com o que não passou
 * na validação deixaria a entrega mais bonita do que o run foi.
 */
export function buildDeliverable(input: DeliverableInput): string {
  const rank = new Map((input.order ?? []).map((id, i) => [id, i]));
  const sorted = [...input.artifacts].sort((a, b) => {
    const ra = rank.get(a.nodeId) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.nodeId) ?? Number.MAX_SAFE_INTEGER;
    return ra === rb ? a.nodeId.localeCompare(b.nodeId) : ra - rb;
  });
  const product = sorted.filter((a) => !PROCESS_KINDS.has(a.kind));
  const process = sorted.filter((a) => PROCESS_KINDS.has(a.kind));

  const lines: string[] = [
    `# ${input.objective}`,
    '',
    `> Izanagi · run \`${input.runId}\` · modo \`${input.mode}\` · ${product.length} artefato(s) de produto, ${process.length} de processo.`,
    '',
  ];

  if (product.length === 0) {
    lines.push('_O run não produziu artefato de produto._', '');
  }
  for (const artifact of product) {
    lines.push(
      `## ${artifact.nodeId} · \`${artifact.kind}\`${artifact.valid ? '' : ' — **artefato inválido contra o schema**'}`,
      '',
      fence(artifact.kind, clipSection(toText(artifact.content))),
      '',
    );
  }

  if (process.length > 0) {
    lines.push('---', '', '## Processo', '');
    for (const artifact of process) {
      lines.push(
        `### ${artifact.nodeId} · \`${artifact.kind}\`${artifact.valid ? '' : ' — **inválido**'}`,
        '',
        fence(artifact.kind, clipSection(toText(artifact.content))),
        '',
      );
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Caminho do arquivo entregue, RELATIVO à raiz do projeto.
 *
 * Relativo de propósito: é o mesmo valor que a `ToolRegistry` resolve contra a
 * sandbox e que o check `file-exists` resolve contra a raiz. Um caminho
 * absoluto aqui faria os dois divergirem quando o processo roda com outro cwd.
 *
 * O nome sai do OBJETIVO, não do runId. O runId só existe depois que o
 * Orchestrator abre o trace, e o caminho precisa estar no contrato antes disso
 * — senão o critério `file-exists` não teria o que conferir. Como efeito
 * colateral desejado, repetir o mesmo objetivo reescreve a mesma entrega em
 * vez de acumular um arquivo por execução: entrega é produto, não log. O
 * histórico continua em `.izanagi/state/`, e o runId vai no cabeçalho do
 * documento.
 */
export function deliverableRelPath(outputDir: string, objective: string): string {
  return path.posix.join(normalizeDir(outputDir), `${slugify(objective)}.md`);
}

/** Teto do nome de arquivo: longo o suficiente para identificar, curto o suficiente para caber em qualquer FS. */
const MAX_SLUG_CHARS = 60;

/**
 * Slug do objetivo. Só ASCII: acento e caractere não-latino viram problema de
 * portabilidade de nome de arquivo entre sistemas, e o objetivo completo já
 * está no título do documento.
 */
export function slugify(objective: string): string {
  const ascii = objective
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length === 0) return 'entrega';
  if (ascii.length <= MAX_SLUG_CHARS) return ascii;
  // Corta em fronteira de palavra para o nome não terminar no meio de uma.
  const cut = ascii.slice(0, MAX_SLUG_CHARS);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > MAX_SLUG_CHARS / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

/** Normaliza o diretório declarado para forma posix relativa (sem `./`, sem barra final). */
function normalizeDir(dir: string): string {
  return dir.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '') || '.';
}

/**
 * Valida o destino ANTES de planejar. Fora da raiz do projeto o `fs.write` já
 * recusaria e o `file-exists` já reprovaria — mas descobrir isso depois de um
 * grafo inteiro executado desperdiça o run por um erro de digitação.
 */
export function validateOutputDir(baseDir: string, outputDir: string): { ok: true; rel: string } | { ok: false; error: string } {
  if (typeof outputDir !== 'string' || outputDir.trim().length === 0) {
    return { ok: false, error: 'diretório de saída vazio' };
  }
  const root = path.resolve(baseDir);
  const abs = path.isAbsolute(outputDir) ? path.resolve(outputDir) : path.resolve(root, outputDir);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return {
      ok: false,
      error: `"${outputDir}" fica fora do projeto (${root}). A entrega grava e verifica dentro da raiz — um destino fora dela seria recusado pela ToolRegistry na hora de escrever.`,
    };
  }
  const rel = path.relative(root, abs);
  return { ok: true, rel: normalizeDir(rel === '' ? '.' : rel) };
}

/**
 * Nó de materialização + contrato.
 *
 * Escreve os arquivos declarados pelos agentes num subdiretório da saída — e
 * NUNCA por cima do código do projeto. Essa é a fronteira que torna a
 * materialização defensável: o que o runtime produz fica num lugar que o
 * usuário nomeou e pode revisar, apagar ou copiar. Sobrescrever fonte exigiria
 * uma garantia que nenhuma verificação determinística consegue dar hoje.
 */
export function materializeNode(opts: {
  outputDir: string;
  objective: string;
  dependencies: string[];
  /** Nó cujo artefato carrega o manifesto (normalmente o de implementação). */
  manifestFrom: string;
}): { node: GraphNode; contract: TaskContract } {
  const dir = path.posix.join(normalizeDir(opts.outputDir), slugify(opts.objective));
  const spec = {
    id: 'project.materialize',
    input: { dir, manifest: { $artifact: opts.manifestFrom } },
  };
  const acceptance: AcceptanceCriterion[] = [
    {
      id: `${MATERIALIZE_NODE_ID}:valid`,
      description: 'comprovante de materialização válido contra o schema',
      kind: 'deterministic',
      check: { kind: 'artifact-valid' },
    },
    {
      id: `${MATERIALIZE_NODE_ID}:counted`,
      description: 'o comprovante diz quantos arquivos foram declarados',
      kind: 'deterministic',
      check: {
        kind: 'json-field',
        field: 'candidates',
        message: 'sem a contagem de declarados, "nenhum arquivo" e "escreveu" ficam indistinguíveis',
      },
    },
  ];

  const node: GraphNode = {
    id: MATERIALIZE_NODE_ID,
    kind: 'tool',
    outputs: ['materialization'],
    dependencies: [...opts.dependencies],
    status: 'pending',
    tokenBudget: 0,
    timeoutMs: 60_000,
    metadata: { role: 'worker', tool: spec },
  };

  const contract: TaskContract = {
    id: MATERIALIZE_NODE_ID,
    objective: `materializar em "${dir}" os arquivos declarados por "${opts.manifestFrom}"`,
    role: 'worker',
    inputs: [opts.manifestFrom],
    constraints: [],
    expectedOutput: { kind: 'materialization' },
    dependencies: [...opts.dependencies],
    priority: 'normal',
    budget: { maxTokens: 0, maxTimeMs: 60_000, maxToolCalls: 1 },
    verification: { deterministic: acceptance.map((c) => c.check!), requireAllCriteria: true },
    acceptance,
    permissions: ['fs:write'],
    tool: spec,
  };

  return { node, contract };
}

/** Diretório onde os arquivos materializados de um objetivo vão parar. */
export function materializeRelDir(outputDir: string, objective: string): string {
  return path.posix.join(normalizeDir(outputDir), slugify(objective));
}

/**
 * Nó de entrega + contrato. Sem agente de propósito: quem declarou a tool foi o
 * planejamento do próprio framework, então o trust tier é `builtin` e não o
 * `community` que um nó com agente desconhecido receberia.
 */
export function deliverNode(opts: {
  outputDir: string;
  objective: string;
  /** Ids dos nós que precisam concluir antes da entrega (tudo que produz artefato). */
  dependencies: string[];
}): { node: GraphNode; contract: TaskContract } {
  const file = deliverableRelPath(opts.outputDir, opts.objective);
  const acceptance: AcceptanceCriterion[] = [
    {
      id: `${DELIVER_NODE_ID}:written`,
      description: `a tool devolveu o caminho gravado`,
      kind: 'deterministic',
      check: { kind: 'json-field', field: 'written', message: 'a tool de escrita não devolveu o caminho gravado' },
    },
    {
      id: `${DELIVER_NODE_ID}:exists`,
      description: `o arquivo "${file}" existe no disco depois da execução`,
      kind: 'deterministic',
      check: { kind: 'file-exists', path: file, message: `entrega não encontrada em "${file}"` },
    },
  ];

  const node: GraphNode = {
    id: DELIVER_NODE_ID,
    kind: 'tool',
    outputs: ['delivery'],
    dependencies: [...opts.dependencies],
    status: 'pending',
    // Nó de tool não chama modelo: teto de token zero é o valor real, não um
    // placeholder. O Budget Controller cobra a tool call, não tokens.
    tokenBudget: 0,
    timeoutMs: 30_000,
    metadata: { role: 'worker', tool: { id: 'fs.write', input: { file, content: { $deliverable: true } } } },
  };

  const contract: TaskContract = {
    id: DELIVER_NODE_ID,
    objective: `gravar a entrega do run em "${file}"`,
    role: 'worker',
    inputs: [...opts.dependencies],
    constraints: [],
    expectedOutput: { kind: 'delivery' },
    dependencies: [...opts.dependencies],
    priority: 'normal',
    budget: { maxTokens: 0, maxTimeMs: 30_000, maxToolCalls: 1 },
    verification: {
      deterministic: acceptance.map((c) => c.check!).filter(Boolean),
      requireAllCriteria: true,
    },
    acceptance,
    permissions: ['fs:write'],
    tool: { id: 'fs.write', input: { file, content: { $deliverable: true } } },
  };

  return { node, contract };
}
