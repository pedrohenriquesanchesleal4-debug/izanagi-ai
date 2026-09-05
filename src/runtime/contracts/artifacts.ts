/**
 * Contracts & Artifacts — schemas de artefatos + validação programática.
 *
 * Artefato inválido → INVALID → REPAIR → RE-EVALUATE.
 * O validators.ts aplica os schemas sobre artefatos (string | objeto) e
 * devolve issues estruturadas.
 */

import crypto from 'crypto';
import type { ArtifactKind, ArtifactRef, ArtifactSchema } from '../types.js';
import { sanitizeText } from '../text/unicode-hygiene.js';

const STUB_PATTERNS = [
  /TODO/i,
  /FIXME/i,
  /XXX/i,
  /implement later/i,
  /placeholder/i,
  /not implemented/i,
  /lorem ipsum/i,
];

/**
 * Schemas padrão dos artefatos importantes do framework.
 * `kind` → schema. Compatível com a classe ArtifactRef.
 */
export const ARTIFACT_SCHEMAS: Record<ArtifactKind, ArtifactSchema> = {
  requirements: {
    kind: 'requirements',
    required: ['title', 'functional', 'acceptance'],
    minSize: 200,
    forbidden: ['[ ] checklist', '[x] 1.', 'TODO'],
  },
  architecture: {
    kind: 'architecture',
    required: ['context', 'decision', 'layers'],
    minSize: 300,
    forbidden: ['TODO', '// implement later'],
  },
  'database-schema': {
    kind: 'database-schema',
    required: ['model', 'relations'],
    minSize: 200,
    forbidden: ['TODO'],
    validate: (c) => {
      if (typeof c !== 'string') return ['conteúdo não textual'];
      const issues: string[] = [];
      if (!/index|unique|@id|primary key|primary_key/i.test(c)) issues.push('schema sem chave primária detectada');
      if (!/relation|references|foreign|\.prisma|create table/i.test(c)) issues.push('schema sem relacionamentos detectados');
      return issues;
    },
    simulationHint: 'create table exemplo (id integer primary key, relacionado_id integer references outra_tabela(id));',
  },
  'api-contract': {
    kind: 'api-contract',
    required: ['method', 'path', 'request', 'response'],
    minSize: 200,
    forbidden: ['TODO'],
  },
  'security-report': {
    kind: 'security-report',
    required: ['severity', 'vulnerabilities', 'remediation'],
    minSize: 300,
    forbidden: ['TODO'],
  },
  'test-plan': {
    kind: 'test-plan',
    required: ['unit', 'integration', 'scenarios'],
    minSize: 200,
    forbidden: ['TODO'],
  },
  'implementation-plan': {
    kind: 'implementation-plan',
    required: ['steps', 'files'],
    minSize: 200,
    forbidden: ['TODO', '// implement later'],
  },
  evaluation: {
    kind: 'evaluation',
    required: ['verdict', 'score', 'metrics'],
    minSize: 100,
  },
  'benchmark-report': {
    kind: 'benchmark-report',
    required: ['summary', 'results'],
    minSize: 100,
  },
  research: {
    kind: 'research',
    required: ['findings', 'sources'],
    minSize: 200,
  },
  trace: {
    kind: 'trace',
    required: ['runId', 'spans'],
    minSize: 50,
  },
  /**
   * Crítica adversarial. O schema exige o formato ESTRUTURADO porque a crítica
   * não é um texto para humano ler: é a entrada de uma decisão de runtime
   * (`parseCritique` -> `isBlocking` -> correção do nó criticado). Crítica em
   * prosa livre reprova aqui de propósito, e a retentativa pede o formato.
   */
  critique: {
    kind: 'critique',
    required: ['status', 'issues'],
    // Teto baixo de propósito: uma crítica que aprova é legitimamente curta
    // (`{"status":"approved","issues":[]}`). Quem garante a qualidade aqui são
    // os campos obrigatórios, não o tamanho.
    minSize: 20,
  },
  /**
   * Entrega gravada em disco pelo nó de tool. O artefato NÃO é o documento: é
   * o comprovante da escrita (`{ written: <caminho> }`) devolvido pela
   * `ToolRegistry`. Por isso `written` é obrigatório e o teto de tamanho é
   * baixo — um comprovante grande significaria que alguém trocou o
   * comprovante pelo conteúdo, e a verificação passaria a conferir a coisa
   * errada.
   */
  delivery: {
    kind: 'delivery',
    required: ['written'],
    minSize: 12,
  },
  /**
   * Levantamento determinístico do repositório, produzido pela tool
   * `project.survey`. Os campos obrigatórios são os que um agente a jusante
   * precisa para não inventar a stack: a raiz, o que foi detectado e a forma
   * da árvore. `truncated` é obrigatório de propósito — um survey que não
   * declara o próprio corte vira conclusão errada sobre um projeto que só foi
   * lido pela metade.
   */
  'project-survey': {
    kind: 'project-survey',
    required: ['root', 'stack', 'tree', 'truncated'],
    minSize: 40,
  },
  /**
   * Comprovante de materialização devolvido por `project.materialize`.
   * `candidates` é obrigatório junto com `written` para que "nenhum arquivo
   * declarado" (`candidates: 0`) não se confunda com "escreveu": os dois casos
   * têm `written` vazio, e sem o primeiro campo eles seriam indistinguíveis.
   */
  materialization: {
    kind: 'materialization',
    required: ['dir', 'candidates', 'written'],
    minSize: 20,
  },
  /**
   * Resultado da execução do comando de teste do projeto (`project.test`).
   *
   * `passed` NÃO é campo obrigatório de propósito: ele é ausente quando o
   * comando não chegou a rodar, e exigi-lo forçaria o "não medi" a virar
   * `false`, que se lê como "os testes falharam". `exitCode` e `command` são
   * obrigatórios porque sem eles o artefato não diz o que foi executado nem
   * como terminou, e um relatório de teste que não diz isso não é evidência.
   */
  'test-run': {
    kind: 'test-run',
    required: ['command', 'runner', 'exitCode'],
    minSize: 20,
    capturedOutput: true,
  },
  raw: {
    kind: 'raw',
    required: [],
    minSize: 0,
  },
};

/**
 * Normaliza conteúdo em string para validação.
 *
 * `JSON.stringify(undefined)` devolve `undefined`, não uma string: sem o
 * fallback, validar o retorno de uma tool que não devolve nada estourava com
 * "Cannot read properties of undefined" em vez de reprovar o artefato.
 */
function toText(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2) ?? String(content);
  } catch {
    return String(content);
  }
}

export function hashContent(content: string): string {
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 12);
}

export interface ValidationReport {
  kind: ArtifactKind;
  valid: boolean;
  issues: string[];
  /** Score de conformidade [0,1]. */
  score: number;
}

/**
 * Valida um artefato contra o schema do seu kind.
 */
/**
 * Cache de validacao. `validateArtifact` e uma funcao pura da entrada e roda
 * varias vezes sobre o MESMO conteudo dentro de um run: uma vez no portao de
 * schema, outra como criterio `artifact-valid` da Verification Engine, outra na
 * deteccao de regressao, e de novo a cada retentativa que produz identico.
 *
 * Ressalva honesta: isto economiza CPU, nao token. Nenhuma chamada de modelo e
 * evitada aqui, e o cache NAO aparece na telemetria de economia por isso.
 */
const VALIDATION_CACHE = new Map<string, ValidationReport>();
const VALIDATION_CACHE_MAX = 512;

function cacheValidation(key: string, report: ValidationReport): ValidationReport {
  // Eviction FIFO simples: a chave mais antiga sai. Um LRU de verdade nao se
  // paga aqui, porque o acesso dentro de um run e quase todo recente.
  if (VALIDATION_CACHE.size >= VALIDATION_CACHE_MAX) {
    const oldest = VALIDATION_CACHE.keys().next().value;
    if (oldest !== undefined) VALIDATION_CACHE.delete(oldest);
  }
  VALIDATION_CACHE.set(key, report);
  return report;
}

/** Esvazia o cache de validacao (testes e processos de vida longa). */
export function clearValidationCache(): void {
  VALIDATION_CACHE.clear();
}

export function validateArtifact(kind: ArtifactKind, content: unknown): ValidationReport {
  const schema = ARTIFACT_SCHEMAS[kind] ?? ARTIFACT_SCHEMAS.raw;
  const issues: string[] = [];
  const text = toText(content);
  // Chave pelo hash do texto normalizado: conteudo identico no mesmo kind
  // produz, por construcao, o mesmo relatorio.
  const cacheKey = `${kind}:${text.length}:${hashContent(text)}`;
  const cached = VALIDATION_CACHE.get(cacheKey);
  if (cached) return cached;

  if (text.trim().length < (schema.minSize ?? 0)) {
    issues.push(`conteúdo muito pequeno (${text.length} bytes, mínimo ${schema.minSize})`);
  }

  // Objeto estruturado: verifica campos obrigatórios
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;
    for (const field of schema.required) {
      if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
        issues.push(`campo obrigatório ausente: "${field}"`);
      }
    }
  } else if (schema.required.length > 0) {
    // Texto puro: verifica se contém os termos de estrutura
    for (const field of schema.required) {
      if (!text.toLowerCase().includes(field.toLowerCase())) {
        issues.push(`estrutura ausente no texto: menção a "${field}" não encontrada`);
      }
    }
  }

  for (const f of schema.forbidden ?? []) {
    if (text.includes(f)) issues.push(`conteúdo proibido detectado: "${f}"`);
  }
  // A varredura anti-stub pressupõe texto AUTORAL. Num artefato que é saída
  // capturada de um processo, ela mede o vocabulário do programa que rodou.
  if ((schema.forbidden?.length ?? 0) === 0 && !schema.capturedOutput) {
    for (const p of STUB_PATTERNS) {
      if (p.test(text)) {
        issues.push(`stub/lazy-code detectado: padrão "${p.source}"`);
        break;
      }
    }
  }

  if (schema.validate) {
    issues.push(...schema.validate(content));
  }

  const valid = issues.length === 0;
  const score = Math.max(0, 1 - issues.length * 0.15);
  return cacheValidation(cacheKey, { kind, valid, issues: Array.from(new Set(issues)).slice(0, 12), score });
}

/**
 * Cria um ArtifactRef validado a partir de conteúdo.
 */
export function makeArtifact(kind: ArtifactKind, name: string, content: unknown, path?: string): ArtifactRef {
  // Unicode Hygiene (sempre ativa): hash/validação refletem o mesmo texto que
  // de fato seria gravado em disco via fs.write, não o texto bruto do modelo.
  const text = sanitizeText(toText(content)).text;
  const report = validateArtifact(kind, text);
  return {
    kind,
    name,
    path,
    size: text.length,
    hash: hashContent(text),
    valid: report.valid,
    issues: report.issues,
  };
}

/**
 * Valida um handoff entre agentes — só passa contexto relevante.
 */
export function validateHandoffShape(input: { from: string; to: string; reason: string; artifacts?: unknown[] }): string[] {
  const issues: string[] = [];
  if (!input.from) issues.push('handoff sem remetente (from)');
  if (!input.to) issues.push('handoff sem destinatário (to)');
  if (!input.reason || input.reason.length < 4) issues.push('handoff sem motivo claro (reason)');
  if (!input.artifacts || input.artifacts.length === 0) issues.push('handoff sem artefatos: contexto livre não deve ser passado');
  return issues;
}


/* ============================ SIMULAÇÃO HEADLESS ============================ */

/**
 * Marca que precisa sobreviver a qualquer edição deste módulo: quem lê o
 * artefato tem que saber, pelo próprio conteúdo, que nenhum modelo foi chamado.
 */
export const SIMULATION_BANNER = 'SIMULACAO HEADLESS: nenhum modelo foi chamado para produzir este artefato.';

/**
 * Conteúdo simulado que satisfaz o schema REAL de um kind.
 *
 * Existe porque, sem provider configurado, o producer headless devolvia sempre
 * a mesma forma genérica: para todo kind tipado o artefato reprovava por campo
 * obrigatório ausente, o nó entrava em healing e o run terminava FAIL por um
 * motivo que não tem relação nenhuma com o runtime. Quem experimenta o Izanagi
 * pela primeira vez via um vermelho que não era dele.
 *
 * O conteúdo sai do próprio schema (`required` + `minSize` + `simulationHint`),
 * então schema e simulação não podem divergir em silêncio: existe um teste que
 * valida a simulação de TODO kind registrado contra o validador de verdade.
 *
 * Isto NÃO apresenta simulação como execução: o banner está no conteúdo, o
 * `model` da chamada continua sendo `cli-headless` e a CLI segue avisando em
 * toda saída que rodou sem provider.
 */
export function simulatedArtifact(
  kind: ArtifactKind | string,
  ctx: { nodeId: string; label: string; objective: string },
): unknown {
  // Crítica é objeto estruturado por contrato: uma simulação não tem como
  // criticar coisa alguma, então aprova e diz por quê.
  if (kind === 'critique') {
    return {
      status: 'approved',
      issues: [],
      confidence: 0,
      note: `${SIMULATION_BANNER} Nenhuma critica real foi produzida para o no "${ctx.nodeId}".`,
    };
  }

  const schema = ARTIFACT_SCHEMAS[kind as ArtifactKind] ?? ARTIFACT_SCHEMAS.raw;
  const header = [
    `# ${kind} (simulado)`,
    SIMULATION_BANNER,
    `No: ${ctx.nodeId} (${ctx.label})`,
    `Objetivo: ${ctx.objective}`,
    'Conteudo gerado pelo runtime para exercitar o grafo sem provider configurado.',
  ].join('\n');

  const sections = schema.required.map(
    (field) =>
      `\n## ${field}\nSecao "${field}" preenchida pela simulacao headless para satisfazer o schema de "${kind}". ` +
      'Sem provider configurado nao existe conteudo real a registrar aqui.',
  );

  let text = [header, ...sections, ...(schema.simulationHint ? [`\n## detalhe\n${schema.simulationHint}`] : [])].join('\n');

  // Preenchimento determinístico até o piso do schema. Frase neutra de
  // propósito: nada que os STUB_PATTERNS reconheçam como código preguiçoso.
  const floor = schema.minSize ?? 0;
  const filler = ' Execucao simulada, sem chamada de modelo.';
  while (text.trim().length < floor) text += filler;

  return text;
}
