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
}

const ARTIFACTS_FILE_REL = path.join('.izanagi', 'state', 'artifacts.json');
const CONTENT_DIR_REL = path.join('.izanagi', 'state', 'artifacts');

/**
 * Teto de conteúdo gravado por artefato. Um artefato maior é truncado com
 * marca explícita: o registro declara `truncated: true` e `originalSize`, de
 * modo que ninguém leia um conteúdo cortado achando que é o inteiro.
 */
export const DEFAULT_MAX_CONTENT_BYTES = 512 * 1024;

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

  /** Quem consome (depende de) um artefato — rastreabilidade a jusante. */
  consumers(id: string): ArtifactRecord[] {
    return this.records.filter((r) => r.dependencies.includes(id));
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
