/**
 * Artifact Registry — artefatos como objetos rastreáveis, não só validados
 * na hora e descartados. Complementa contracts/artifacts.ts (que valida
 * schema/conteúdo de UM artefato) com um índice persistido: quem criou,
 * de que run, com que hash, dependendo de quais outros artefatos, e em que
 * versão (replan/retry pode reproduzir o mesmo nome mais de uma vez).
 *
 * Responde: "quem criou / quem consumiu / qual decisão gerou / qual
 * avaliação validou" — sem isso, um artefato vive só como Map efêmero
 * dentro de ExecuteCtx e desaparece ao fim do run.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sanitizeText } from '../text/unicode-hygiene.js';

export interface ArtifactProducer {
  runId: string;
  nodeId: string;
  agent?: string;
  skill?: string;
}

export interface ArtifactRecord {
  /** `${runId}:${nodeId}` — único por (run, nó); versionado quando reproduzido (replan/retry). */
  id: string;
  kind: string;
  name: string;
  version: number;
  producer: ArtifactProducer;
  createdAt: string;
  hash: string;
  size: number;
  valid: boolean;
  score: number;
  /** Ids (`runId:nodeId`) dos artefatos dos quais este depende. */
  dependencies: string[];
  /**
   * Caminho RELATIVO a `.izanagi/state/` do conteúdo persistido, quando o
   * content store está ligado. Ausente = só metadado (comportamento anterior,
   * e o que acontece quando o conteúdo excede o teto).
   */
  contentRef?: string;
  /** Tamanho original antes de qualquer truncamento no content store. */
  originalSize?: number;
  /** true quando o conteúdo gravado foi cortado para caber no teto. */
  truncated?: boolean;
  /**
   * Checksum COMPLETO do conteúdo (sha256 hex).
   *
   * `hash` continua sendo sha1 truncado em 12 hex (48 bits) porque é o que os
   * registros gravados carregam e o que a detecção de duplicação usa. 48 bits
   * são suficientes para "é o mesmo artefato de novo?" num run; não são para
   * "este arquivo é exatamente o que eu gravei", que é a pergunta de um
   * checksum. Ausente em registro escrito por versão anterior.
   */
  checksum?: string;
  /**
   * Metadado livre de quem produziu o artefato.
   *
   * Existe porque todo campo do registro é previsto por este arquivo, e quem
   * produz um artefato não tinha onde anexar contexto que o registro não
   * previsse. Tem teto (`MAX_METADATA_BYTES`) e é recusado inteiro quando
   * estoura: metadado é para contexto, e um campo livre sem teto vira o
   * segundo content store, sem nenhuma das garantias do primeiro.
   */
  metadata?: Record<string, unknown>;
  /**
   * Chave de REUSO: identifica os insumos que produziram este artefato.
   *
   * Dois nós com a mesma chave receberam exatamente a mesma pergunta, no mesmo
   * estado de projeto, com os mesmos insumos a montante. Ver `reuseKey()` para
   * o que entra e, principalmente, para a política de invalidação — sem ela
   * isto vira um cache que devolve resposta velha com cara de nova, que é pior
   * que não ter cache nenhum.
   */
  reuseKey?: string;
}

const ARTIFACTS_FILE_REL = path.join('.izanagi', 'state', 'artifacts.json');
const CONTENT_DIR_REL = path.join('.izanagi', 'state', 'artifacts');

/**
 * Teto de conteúdo gravado por artefato. Um artefato maior é truncado com
 * marca explícita: o registro declara `truncated: true` e `originalSize`, de
 * modo que ninguém leia um conteúdo cortado achando que é o inteiro.
 */
export const DEFAULT_MAX_CONTENT_BYTES = 512 * 1024;

/**
 * Teto do metadado livre por artefato. Pequeno de propósito: o índice inteiro
 * é lido e reescrito a cada registro, então metadado grande custa em TODO
 * registro seguinte, não só no seu.
 */
export const MAX_METADATA_BYTES = 4 * 1024;

export class ArtifactRegistry {
  private readonly file: string;
  private readonly contentDir: string;
  private readonly stateDir: string;
  private readonly maxContentBytes: number;
  private readonly persistContent: boolean;
  private records: ArtifactRecord[];

  /**
   * `persistContent` (default true) grava o CONTEÚDO do artefato em disco, não
   * só o metadado. Sem isso, o conteúdo vive apenas no Map efêmero do
   * ExecuteCtx e morre com o processo: `izanagi explain` não consegue mostrar
   * o que foi produzido e não existe reuso de artefato entre runs.
   */
  constructor(opts: { baseDir: string; persistContent?: boolean; maxContentBytes?: number }) {
    this.file = path.join(opts.baseDir, ARTIFACTS_FILE_REL);
    this.stateDir = path.join(opts.baseDir, '.izanagi', 'state');
    this.contentDir = path.join(opts.baseDir, CONTENT_DIR_REL);
    this.persistContent = opts.persistContent ?? true;
    this.maxContentBytes = opts.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
    this.records = this.load();
  }

  private load(): ArtifactRecord[] {
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        if (Array.isArray(raw)) return raw as ArtifactRecord[];
      }
    } catch {
      // arquivo corrompido — recomeça o índice, não derruba o runtime
    }
    return [];
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.records, null, 2), 'utf-8');
  }

  /**
   * Registra um artefato produzido. Se já existe um registro com o mesmo
   * `runId`+`nodeId` (retry/replan reprocessando o mesmo nó), incrementa a
   * versão em vez de duplicar o id.
   */
  register(input: {
    kind: string;
    name: string;
    producer: ArtifactProducer;
    hash: string;
    size: number;
    valid: boolean;
    score: number;
    dependencies?: string[];
    /** Conteúdo produzido. Quando presente e o content store está ligado, é gravado em disco. */
    content?: unknown;
    /** Metadado livre do produtor. Recusado inteiro acima de `MAX_METADATA_BYTES`. */
    metadata?: Record<string, unknown>;
    /** Chave de reuso (`reuseKey`). Ausente: o artefato não é reutilizável. */
    reuseKey?: string;
  }): ArtifactRecord {
    const id = `${input.producer.runId}:${input.producer.nodeId}`;
    const previousVersions = this.records.filter((r) => r.id === id);
    const version = previousVersions.length + 1;
    const record: ArtifactRecord = {
      id,
      kind: input.kind,
      name: input.name,
      version,
      producer: input.producer,
      createdAt: new Date().toISOString(),
      hash: input.hash,
      size: input.size,
      valid: input.valid,
      score: input.score,
      dependencies: input.dependencies ?? [],
      ...(input.content !== undefined ? { checksum: checksumOf(input.content) } : {}),
      ...(acceptMetadata(input.metadata) ?? {}),
      ...(input.reuseKey ? { reuseKey: input.reuseKey } : {}),
    };

    if (this.persistContent && input.content !== undefined) {
      const stored = this.writeContent(input.producer.runId, input.producer.nodeId, version, input.content);
      if (stored) {
        record.contentRef = stored.ref;
        record.originalSize = stored.originalSize;
        if (stored.truncated) record.truncated = true;
      }
    }

    this.records.push(record);
    this.save();
    return record;
  }

  /* ==================== CONTENT STORE ==================== */

  /**
   * Grava o conteúdo dentro de `.izanagi/state/artifacts/<runId>/`. O nome do
   * arquivo é derivado de nodeId+version e SANEADO: um nodeId vindo de uma
   * decomposição externa não pode escrever fora dessa pasta.
   */
  private writeContent(runId: string, nodeId: string, version: number, content: unknown): { ref: string; originalSize: number; truncated: boolean } | null {
    const text = typeof content === 'string' ? content : safeStringify(content);
    // Higiene de unicode antes de gravar: o que fica em disco é o mesmo texto
    // que qualquer outro caminho de escrita do framework produziria.
    const clean = sanitizeText(text).text;
    const originalSize = Buffer.byteLength(clean, 'utf-8');
    const truncated = originalSize > this.maxContentBytes;
    const body = truncated
      ? `${clean.slice(0, this.maxContentBytes)}\n\n[... conteúdo truncado pelo content store: ${originalSize} bytes originais, teto de ${this.maxContentBytes} ...]`
      : clean;

    const dir = path.join(this.contentDir, safeSegment(runId));
    const fileName = `${safeSegment(nodeId)}.v${version}.txt`;
    const target = path.join(dir, fileName);
    // Cinto e suspensório: mesmo com a sanitização acima, confirma que o alvo
    // final está dentro do content store antes de escrever.
    if (!path.resolve(target).startsWith(path.resolve(this.contentDir) + path.sep)) return null;

    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, body, 'utf-8');
    } catch {
      // Falha de escrita do conteúdo não pode derrubar o run: o metadado
      // continua válido, só não há contentRef.
      return null;
    }
    return { ref: path.relative(this.stateDir, target), originalSize, truncated };
  }

  /**
   * Lê o conteúdo persistido de um artefato. `null` quando o registro não tem
   * contentRef (content store desligado, conteúdo grande demais, ou registro
   * gravado por uma versão anterior do framework).
   */
  readContent(id: string, version?: number): string | null {
    const record = version === undefined ? this.get(id) : this.history(id).find((r) => r.version === version);
    if (!record?.contentRef) return null;
    const file = path.join(this.stateDir, record.contentRef);
    if (!path.resolve(file).startsWith(path.resolve(this.contentDir) + path.sep)) return null;
    try {
      return fs.readFileSync(file, 'utf-8');
    } catch {
      return null;
    }
  }

  /** Remove o conteúdo persistido de um run inteiro (o metadado permanece). */
  purgeContent(runId: string): number {
    const dir = path.join(this.contentDir, safeSegment(runId));
    if (!fs.existsSync(dir)) return 0;
    let removed = 0;
    try {
      removed = fs.readdirSync(dir).length;
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      return 0;
    }
    for (const record of this.records) {
      if (record.producer.runId === runId) {
        delete record.contentRef;
      }
    }
    this.save();
    return removed;
  }

  get(id: string): ArtifactRecord | undefined {
    // Última versão registrada é a atual.
    const versions = this.records.filter((r) => r.id === id);
    return versions[versions.length - 1];
  }

  /** Todas as versões de um artefato (histórico de replan/retry). */
  history(id: string): ArtifactRecord[] {
    return this.records.filter((r) => r.id === id).sort((a, b) => a.version - b.version);
  }

  /** Artefatos produzidos por um run, na ordem em que foram registrados. */
  forRun(runId: string): ArtifactRecord[] {
    return this.records.filter((r) => r.producer.runId === runId);
  }

  /**
   * Artefato de um run ANTERIOR que respondeu exatamente à mesma pergunta.
   *
   * Três condições, e cada uma é uma parte da política de invalidação:
   *
   *  - `reuseKey` idêntica: mesmos insumos, mesmo estado de projeto declarado,
   *    mesmo contrato (ver `reuseKey()`);
   *  - o artefato foi VÁLIDO. Reaproveitar o que não passou na validação
   *    economizaria a chamada e importaria o defeito;
   *  - dentro do prazo. Um artefato correto há seis meses descreve um projeto
   *    que provavelmente não existe mais, e a chave não tem como perceber isso
   *    sozinha: o prazo é o que impede o cache de envelhecer em silêncio.
   *
   * Devolve o registro MAIS RECENTE que satisfaz as três, com o conteúdo já
   * lido — sem conteúdo em disco não há reuso, só metadado.
   */
  findReusable(key: string, opts: { maxAgeMs: number; now?: number }): { record: ArtifactRecord; content: string } | null {
    const now = opts.now ?? Date.now();
    for (let i = this.records.length - 1; i >= 0; i--) {
      const record = this.records[i];
      if (record.reuseKey !== key || !record.valid) continue;
      const age = now - Date.parse(record.createdAt);
      if (!Number.isFinite(age) || age < 0 || age > opts.maxAgeMs) continue;
      const content = this.readContent(record.id, record.version);
      if (content === null) continue;
      return { record, content };
    }
    return null;
  }

  /** Quem consome (depende de) um artefato — rastreabilidade a jusante. */
  consumers(id: string): ArtifactRecord[] {
    return this.records.filter((r) => r.dependencies.includes(id));
  }

  /**
   * Linhagem COMPLETA de um artefato: tudo que entrou nele e tudo que saiu
   * dele, atravessando o grafo até o fim.
   *
   * `dependencies` e `consumers` respondem um salto: "de quem este depende" e
   * "quem depende deste". Um salto responde "de onde veio isto?" apenas quando
   * a cadeia tem tamanho um, e num grafo de sete nós ela nunca tem. As arestas
   * já estavam gravadas desde sempre; o que faltava era percorrê-las.
   *
   * Travessia em largura com marca de visitado: um ciclo (que o
   * `ExecutionGraphBuilder` recusa no plano, mas que um registro escrito à mão
   * ou uma decomposição externa pode produzir) termina em vez de girar.
   *
   * A ordem é por distância: os primeiros da lista são os vizinhos diretos.
   */
  lineage(id: string): { ancestors: ArtifactRecord[]; descendants: ArtifactRecord[] } {
    return {
      ancestors: this.walk(id, (current) => this.get(current)?.dependencies ?? []),
      descendants: this.walk(id, (current) => this.consumers(current).map((r) => r.id)),
    };
  }

  private walk(start: string, next: (id: string) => string[]): ArtifactRecord[] {
    const seen = new Set<string>([start]);
    const out: ArtifactRecord[] = [];
    let frontier = next(start).filter((n) => !seen.has(n));
    while (frontier.length > 0) {
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        if (seen.has(nodeId)) continue;
        seen.add(nodeId);
        const record = this.get(nodeId);
        // Dependência declarada sem registro correspondente (nó que não chegou
        // a produzir) some da linhagem em vez de virar um buraco: quem lê a
        // linhagem quer os artefatos que existem.
        if (record) out.push(record);
        for (const n of next(nodeId)) if (!seen.has(n)) nextFrontier.push(n);
      }
      frontier = nextFrontier;
    }
    return out;
  }

  /**
   * Compara duas versões de um artefato pelo CONTEÚDO, não só pelo score.
   *
   * `detectRegression` responde "piorou?" com dois números. Esta responde "o
   * que mudou?", que é a pergunta de quem vai decidir o que fazer com a
   * regressão. Sem conteúdo persistido nas duas pontas, `changed` fica
   * `undefined`: "não deu para comparar" nunca vira "não mudou".
   *
   * O diff é por LINHA e conta, não reconstrói o texto: um diff completo dentro
   * do índice seria o content store de novo, com outro nome.
   */
  compare(id: string, versionA: number, versionB: number): {
    a?: ArtifactRecord;
    b?: ArtifactRecord;
    scoreDelta?: number;
    sizeDelta?: number;
    /** Conteúdo idêntico byte a byte, por checksum. `undefined` sem checksum nos dois. */
    identical?: boolean;
    /** Linhas acrescentadas e removidas. `undefined` sem conteúdo nos dois. */
    changed?: { added: number; removed: number };
  } {
    const versions = this.history(id);
    const a = versions.find((r) => r.version === versionA);
    const b = versions.find((r) => r.version === versionB);
    if (!a || !b) return { ...(a ? { a } : {}), ...(b ? { b } : {}) };

    const identical = a.checksum && b.checksum ? a.checksum === b.checksum : undefined;
    const textA = this.readContent(id, versionA);
    const textB = this.readContent(id, versionB);
    const changed = textA !== null && textB !== null ? lineDelta(textA, textB) : undefined;

    return {
      a,
      b,
      scoreDelta: Math.round((b.score - a.score) * 1000) / 1000,
      sizeDelta: b.size - a.size,
      ...(identical !== undefined ? { identical } : {}),
      ...(changed ? { changed } : {}),
    };
  }

  /**
   * Regression Protection — compara a última versão registrada de um artefato
   * com a anterior (replan/retry após healing). Regressão = versão nova
   * inválida onde a anterior era válida, ou queda crítica de score (>= 0.3)
   * numa versão anterior que já era válida. Sem histórico anterior, nunca há
   * regressão (primeira versão não tem baseline pra comparar).
   */
  detectRegression(id: string): { regressed: boolean; previousScore?: number; currentScore?: number } {
    const versions = this.history(id);
    if (versions.length < 2) return { regressed: false };
    const previous = versions[versions.length - 2];
    const current = versions[versions.length - 1];
    if (!previous.valid) return { regressed: false, previousScore: previous.score, currentScore: current.score };
    const criticalDrop = !current.valid || previous.score - current.score >= 0.3;
    return { regressed: criticalDrop, previousScore: previous.score, currentScore: current.score };
  }
}


/**
 * Prazo padrão de reuso de artefato entre runs.
 *
 * Sete dias. O número é uma escolha, e o motivo dela é que a chave de reuso
 * NÃO consegue enxergar tudo que importa: ela cobre o contrato, os insumos a
 * montante e o levantamento do projeto quando existe, e não cobre o que mudou
 * no mundo fora disso (uma dependência atualizada, um requisito que virou
 * outro). O prazo é o único mecanismo que expira o que a chave não vê.
 */
export const DEFAULT_REUSE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Chave de reuso de um artefato: o que precisa ser idêntico para a resposta
 * anterior ainda ser a resposta.
 *
 * Entra tudo que muda a PERGUNTA:
 *
 *   kind        : o tipo de artefato pedido
 *   objective   : o objetivo do contrato daquela tarefa
 *   constraints : as restrições, que mudam o que é aceitável
 *   acceptance  : os critérios pelos quais a saída será cobrada
 *   agent/role  : quem responde, porque a resposta depende de quem responde
 *   upstream    : os checksums dos artefatos consumidos, EM ORDEM
 *   project     : impressão do projeto (checksum do survey), quando houve
 *
 * O que NÃO entra: o runId, o horário, o modelo escolhido. Os dois primeiros
 * fariam toda chave ser única e o reuso nunca aconteceria; o modelo fica de
 * fora porque a pergunta é a mesma, e trocar de modelo não invalida uma
 * resposta que passou pela mesma verificação.
 *
 * O que a chave NÃO consegue ver está coberto pelo prazo
 * (`DEFAULT_REUSE_MAX_AGE_MS`), e um run sem survey não declara estado de
 * projeto nenhum: por isso o campo entra como `sem-survey`, que é uma chave
 * DIFERENTE de qualquer run que tenha levantado o projeto. Reaproveitar entre
 * os dois seria assumir que o projeto não importava.
 */
export function reuseKey(input: {
  kind: string;
  objective: string;
  constraints: string[];
  acceptance: string[];
  agent?: string;
  role?: string;
  upstreamChecksums: string[];
  projectFingerprint?: string;
}): string {
  const material = [
    `kind:${input.kind}`,
    `objective:${input.objective.trim()}`,
    `constraints:${input.constraints.join('|')}`,
    `acceptance:${input.acceptance.join('|')}`,
    `agent:${input.agent ?? 'nenhum'}`,
    `role:${input.role ?? 'nenhum'}`,
    `upstream:${input.upstreamChecksums.join('|')}`,
    `project:${input.projectFingerprint ?? 'sem-survey'}`,
  ].join('\n');
  return crypto.createHash('sha256').update(material, 'utf-8').digest('hex');
}

/**
 * Checksum do conteúdo: sha256 completo.
 *
 * Sobre o MESMO texto que o content store grava (serialização tolerante), para
 * que o checksum descreva o que está no disco e não uma representação
 * paralela do mesmo objeto.
 */
function checksumOf(content: unknown): string {
  const text = typeof content === 'string' ? content : safeStringify(content);
  return crypto.createHash('sha256').update(sanitizeText(text).text, 'utf-8').digest('hex');
}

/**
 * Metadado livre, dentro do teto. Acima dele o campo é recusado INTEIRO e o
 * registro fica sem metadado: gravar a metade que coube produziria um metadado
 * que parece completo e não é.
 */
function acceptMetadata(metadata?: Record<string, unknown>): { metadata: Record<string, unknown> } | undefined {
  if (!metadata || Object.keys(metadata).length === 0) return undefined;
  const encoded = safeStringify(metadata);
  if (Buffer.byteLength(encoded, 'utf-8') > MAX_METADATA_BYTES) return undefined;
  return { metadata };
}

/** Linhas acrescentadas e removidas entre dois textos, por multiconjunto. */
function lineDelta(a: string, b: string): { added: number; removed: number } {
  const count = (text: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (const line of text.split('\n')) map.set(line, (map.get(line) ?? 0) + 1);
    return map;
  };
  const left = count(a);
  const right = count(b);
  let added = 0;
  let removed = 0;
  for (const [line, n] of right) added += Math.max(0, n - (left.get(line) ?? 0));
  for (const [line, n] of left) removed += Math.max(0, n - (right.get(line) ?? 0));
  return { added, removed };
}

/** Serialização tolerante: conteúdo circular vira texto em vez de derrubar o run. */
function safeStringify(content: unknown): string {
  try {
    return JSON.stringify(content, null, 2) ?? String(content);
  } catch {
    return String(content);
  }
}

/**
 * Segmento de caminho seguro: só letras, números, ponto, hífen e sublinhado.
 * Um nodeId de decomposição externa (`../../etc/passwd`) vira um nome inerte.
 */
function safeSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'unnamed';
}
