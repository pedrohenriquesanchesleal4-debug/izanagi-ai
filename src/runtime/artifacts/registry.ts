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
}

const ARTIFACTS_FILE_REL = path.join('.izanagi', 'state', 'artifacts.json');

export class ArtifactRegistry {
  private readonly file: string;
  private records: ArtifactRecord[];

  constructor(opts: { baseDir: string }) {
    this.file = path.join(opts.baseDir, ARTIFACTS_FILE_REL);
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
    this.records.push(record);
    this.save();
    return record;
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
}
