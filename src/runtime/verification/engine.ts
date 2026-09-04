/**
 * Verification Engine 2.0: evidência, não declaração.
 *
 * A pergunta que este módulo responde não é "o agente disse que terminou?" e
 * sim "existe evidência de que terminou?". Três camadas:
 *
 *   determinística : checks executados sem modelo nenhum (schema do artefato,
 *                    tamanho, presença/ausência de termos, regex, campo JSON,
 *                    existência de arquivo).
 *   evidência      : artefatos declarados como prova existem e são válidos.
 *   semântica      : juiz externo (modelo ou humano). SEM juiz configurado, o
 *                    critério fica UNKNOWN e o veredito NUNCA vira VERIFIED
 *                    só porque nada falhou.
 *
 * Essa última regra é o ponto: a ausência de verificação semântica não pode
 * ser confundida com aprovação semântica.
 */

import fs from 'fs';
import path from 'path';
import { validateArtifact } from '../contracts/artifacts.js';
import { checkGroundedness } from './groundedness.js';
import type { AcceptanceCriterion, DeterministicCheck, TaskContract } from '../contracts/task-contract.js';

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'FAILED';

/**
 * Fração mínima de caminhos citados que precisam existir no projeto.
 *
 * Metade, e não mais: o artefato legítimo mistura o que existe com o que ele
 * propõe criar, e um piso alto reprovaria o trabalho junto com a alucinação.
 * Abaixo de metade não é mistura — é um layout que não é o deste projeto.
 */
export const DEFAULT_GROUNDEDNESS_RATIO = 0.5;

/**
 * Resultado de um critério.
 *
 * A distinção que importa é entre `unknown` e `not-applicable`, e ela não é
 * cosmética:
 *
 *   unknown        : havia uma pergunta a responder e a resposta não foi
 *                    obtida (juiz semântico ausente, `file-exists` sem raiz).
 *                    NUNCA vira aprovação — é a regra que impede "ninguém
 *                    reprovou, então passou".
 *   not-applicable : a pergunta não existe para este artefato. Groundedness
 *                    num texto que não cita caminho nenhum não está sem
 *                    resposta: está respondida por vacuidade, e não há como o
 *                    artefato estar errado sobre caminhos que ele não citou.
 *
 * Tratar o segundo caso como `unknown` fazia todo artefato de prosa cair em
 * UNVERIFIED por um critério que não tinha o que medir nele — e um critério
 * que reprova por não se aplicar é um critério que ninguém vai manter ligado.
 *
 * Só um check que consegue PROVAR a inaplicabilidade devolve `not-applicable`.
 * Na dúvida, `unknown`.
 */
export interface CheckResult {
  criterionId: string;
  description: string;
  layer: 'deterministic' | 'evidence' | 'semantic';
  outcome: 'pass' | 'fail' | 'unknown' | 'not-applicable';
  message?: string;
  optional: boolean;
}

export interface EvidenceItem {
  kind: 'artifact' | 'file' | 'test';
  ref: string;
  valid: boolean;
  detail?: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  /** Fração de critérios obrigatórios aprovados em [0,1]. */
  score: number;
  checks: CheckResult[];
  evidence: EvidenceItem[];
  /** Descrições dos critérios obrigatórios NÃO aprovados. */
  unmet: string[];
  reason: string;
  /** Tokens gastos pelo juiz semântico nesta verificação (0 sem juiz). */
  judgeTokens: number;
  /** Modelo que julgou, quando houve julgamento. */
  judgeModel?: string;
}

/** Veredito de um juiz semântico sobre UM critério. */
export interface JudgeVerdict {
  pass: boolean;
  message?: string;
  /**
   * O juiz não conseguiu decidir (saída ilegível, erro de rede, timeout). Vira
   * `unknown`, nunca `fail`: um juiz que não respondeu não reprova ninguém, e
   * também não aprova. É a mesma regra da ausência de juiz.
   */
  inconclusive?: boolean;
  /** Custo do julgamento, para o Budget Controller cobrar a fase de avaliação. */
  tokens?: number;
  model?: string;
}

/**
 * Juiz semântico injetável: recebe o critério e o conteúdo, devolve veredito.
 * Pode ser síncrono (heurística, humano em memória) ou assíncrono (modelo).
 */
export type SemanticJudge = (input: { criterion: AcceptanceCriterion; content: string; objective: string }) => JudgeVerdict | Promise<JudgeVerdict>;

export interface VerifyInput {
  contract: TaskContract;
  /** Conteúdo produzido pelo nó. */
  content: unknown;
  /** Artefatos do run, por nodeId (para critérios de evidência). */
  artifacts?: Map<string, { kind: string; content: unknown; valid: boolean }>;
  /** Raiz para resolver `file-exists`. Sem baseDir, o check fica UNKNOWN. */
  baseDir?: string;
  judge?: SemanticJudge;
}

function toText(content: unknown): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

/**
 * Executa um check determinístico. `unknown` só acontece quando falta um
 * insumo do ambiente (ex.: `file-exists` sem baseDir), nunca por ambiguidade
 * de interpretação.
 */
export function runCheck(
  check: DeterministicCheck,
  ctx: { content: unknown; text: string; kind: string; baseDir?: string },
): { outcome: 'pass' | 'fail' | 'unknown' | 'not-applicable'; message?: string } {
  switch (check.kind) {
    case 'artifact-valid': {
      const report = validateArtifact(ctx.kind as never, ctx.content);
      return report.valid
        ? { outcome: 'pass' }
        : { outcome: 'fail', message: check.message ?? report.issues.slice(0, 3).join('; ') };
    }
    case 'min-size': {
      const size = ctx.text.trim().length;
      return size >= check.bytes
        ? { outcome: 'pass' }
        : { outcome: 'fail', message: check.message ?? `conteúdo com ${size} bytes, mínimo ${check.bytes}` };
    }
    case 'contains': {
      const haystack = check.caseSensitive ? ctx.text : ctx.text.toLowerCase();
      const needle = check.caseSensitive ? check.text : check.text.toLowerCase();
      return haystack.includes(needle)
        ? { outcome: 'pass' }
        : { outcome: 'fail', message: check.message ?? `texto obrigatório ausente: "${check.text}"` };
    }
    case 'not-contains': {
      const haystack = check.caseSensitive ? ctx.text : ctx.text.toLowerCase();
      const needle = check.caseSensitive ? check.text : check.text.toLowerCase();
      return haystack.includes(needle)
        ? { outcome: 'fail', message: check.message ?? `texto proibido presente: "${check.text}"` }
        : { outcome: 'pass' };
    }
    case 'matches': {
      let re: RegExp;
      try {
        re = new RegExp(check.pattern, check.flags);
      } catch {
        return { outcome: 'unknown', message: `regex inválida no check: /${check.pattern}/${check.flags ?? ''}` };
      }
      return re.test(ctx.text)
        ? { outcome: 'pass' }
        : { outcome: 'fail', message: check.message ?? `conteúdo não casa com /${check.pattern}/` };
    }
    case 'json-field': {
      if (typeof ctx.content !== 'object' || ctx.content === null) {
        return { outcome: 'fail', message: check.message ?? `conteúdo não é objeto: campo "${check.field}" não verificável` };
      }
      const value = (ctx.content as Record<string, unknown>)[check.field];
      return value !== undefined && value !== null && value !== ''
        ? { outcome: 'pass' }
        : { outcome: 'fail', message: check.message ?? `campo obrigatório ausente: "${check.field}"` };
    }
    case 'file-exists': {
      if (!ctx.baseDir) return { outcome: 'unknown', message: 'sem baseDir: existência de arquivo não verificável' };
      const target = path.resolve(ctx.baseDir, check.path);
      // Nunca sai da raiz declarada: um plano gerado não checa /etc/passwd.
      if (!target.startsWith(path.resolve(ctx.baseDir))) {
        return { outcome: 'fail', message: `caminho fora da raiz permitida: ${check.path}` };
      }
      return fs.existsSync(target)
        ? { outcome: 'pass' }
        : { outcome: 'fail', message: check.message ?? `arquivo não existe: ${check.path}` };
    }
    case 'references-exist': {
      if (!ctx.baseDir) return { outcome: 'unknown', message: 'sem baseDir: referências do artefato não conferíveis' };
      const report = checkGroundedness(ctx.text, ctx.baseDir);
      if (report.ratio === null) {
        // Artefato que não cita caminho nenhum (uma ADR, um relatório de
        // pesquisa) não está SEM resposta: está respondido por vacuidade. Não
        // há como estar errado sobre caminhos que não citou. `unknown` aqui
        // derrubaria todo artefato de prosa para UNVERIFIED por um critério
        // que não tinha o que medir nele.
        return { outcome: 'not-applicable', message: 'o artefato não cita caminho de arquivo: nada a conferir contra o projeto' };
      }
      const min = check.minRatio ?? DEFAULT_GROUNDEDNESS_RATIO;
      if (report.ratio >= min) return { outcome: 'pass' };
      return {
        outcome: 'fail',
        message:
          check.message ??
          `${report.ungrounded.length} de ${report.total} caminho(s) citado(s) não existem no projeto ` +
            `(nem o arquivo, nem o diretório): ${report.ungrounded.slice(0, 4).join(', ')}`,
      };
    }
    default:
      return { outcome: 'unknown', message: 'tipo de check desconhecido' };
  }
}

export class VerificationEngine {
  /**
   * Verifica um artefato contra o contrato. Determinístico exceto pela camada
   * semântica, que só roda com juiz injetado.
   */
  async verify(input: VerifyInput): Promise<VerificationResult> {
    const { contract } = input;
    const text = toText(input.content);
    const kind = contract.expectedOutput.kind;
    const checks: CheckResult[] = [];
    const evidence: EvidenceItem[] = [];
    let judgeTokens = 0;
    let judgeModel: string | undefined;

    for (const criterion of contract.acceptance) {
      const optional = criterion.optional === true;
      if (criterion.kind === 'deterministic') {
        const check = criterion.check;
        if (!check) {
          checks.push({ criterionId: criterion.id, description: criterion.description, layer: 'deterministic', outcome: 'unknown', message: 'critério determinístico sem check declarado', optional });
          continue;
        }
        const result = runCheck(check, { content: input.content, text, kind, ...(input.baseDir ? { baseDir: input.baseDir } : {}) });
        checks.push({ criterionId: criterion.id, description: criterion.description, layer: 'deterministic', outcome: result.outcome, ...(result.message ? { message: result.message } : {}), optional });
        continue;
      }

      if (criterion.kind === 'evidence') {
        const target = criterion.evidenceOf ?? '';
        const artifact = input.artifacts?.get(target);
        if (!artifact) {
          checks.push({ criterionId: criterion.id, description: criterion.description, layer: 'evidence', outcome: 'fail', message: `evidência ausente: artefato de "${target}" não foi produzido`, optional });
          evidence.push({ kind: 'artifact', ref: target, valid: false, detail: 'ausente' });
          continue;
        }
        evidence.push({ kind: 'artifact', ref: target, valid: artifact.valid, detail: artifact.kind });
        checks.push({
          criterionId: criterion.id,
          description: criterion.description,
          layer: 'evidence',
          outcome: artifact.valid ? 'pass' : 'fail',
          ...(artifact.valid ? {} : { message: `evidência inválida: artefato de "${target}" não passou na validação` }),
          optional,
        });
        continue;
      }

      // semantic
      if (!input.judge) {
        checks.push({ criterionId: criterion.id, description: criterion.description, layer: 'semantic', outcome: 'unknown', message: 'sem juiz semântico configurado', optional });
        continue;
      }
      const verdict = await input.judge({ criterion, content: text, objective: contract.objective });
      judgeTokens += verdict.tokens ?? 0;
      if (verdict.model) judgeModel = verdict.model;
      checks.push({
        criterionId: criterion.id,
        description: criterion.description,
        layer: 'semantic',
        outcome: verdict.inconclusive ? 'unknown' : verdict.pass ? 'pass' : 'fail',
        ...(verdict.message ? { message: verdict.message } : {}),
        optional,
      });
    }

    // Evidência adicional do próprio artefato produzido.
    const own = validateArtifact(kind as never, input.content);
    evidence.push({ kind: 'artifact', ref: contract.id, valid: own.valid, detail: `${kind}, score ${own.score.toFixed(2)}` });

    // Critério inaplicável sai da conta inteira: não conta como aprovado (não
    // houve prova) nem como pendente (não há o que provar). Contá-lo como
    // aprovado inflaria o score com nada.
    const required = checks.filter((c) => !c.optional && c.outcome !== 'not-applicable');
    const failed = required.filter((c) => c.outcome === 'fail');
    const unknown = required.filter((c) => c.outcome === 'unknown');
    const passed = required.filter((c) => c.outcome === 'pass');
    const score = required.length === 0 ? (own.valid ? 1 : 0) : passed.length / required.length;

    let status: VerificationStatus;
    let reason: string;
    if (failed.length > 0) {
      status = 'FAILED';
      reason = `${failed.length} critério(s) obrigatório(s) reprovado(s)`;
    } else if (unknown.length > 0) {
      // Nada falhou, mas nem tudo foi comprovado. Não é aprovação.
      status = 'UNVERIFIED';
      reason = `${unknown.length} critério(s) sem evidência conclusiva (ex.: semântico sem juiz)`;
    } else if (contract.verification.requireAllCriteria && checks.some((c) => c.optional && c.outcome === 'fail')) {
      status = 'FAILED';
      reason = 'política exige todos os critérios, inclusive os opcionais, e há opcional reprovado';
    } else {
      status = 'VERIFIED';
      reason = required.length === 0 ? 'sem critérios obrigatórios: artefato validado contra o schema' : `${passed.length}/${required.length} critérios obrigatórios comprovados`;
    }

    return {
      status,
      score,
      checks,
      evidence,
      unmet: [...failed, ...unknown].map((c) => c.description),
      reason,
      judgeTokens,
      ...(judgeModel ? { judgeModel } : {}),
    };
  }

  /**
   * Só `VERIFIED` conta como COMPROVADO.
   *
   * `UNVERIFIED` significa "nada falhou e nem tudo foi comprovado", e o
   * orquestrador deixa o nó seguir como `succeeded` — derrubá-lo transformaria
   * "não medi" em "está errado", e sem juiz semântico isso derrubaria todo run
   * sem provider. O que `isDone` decide é se o nó carrega a marca
   * `metadata.unverified`: aprovado sem prova precisa ser distinguível de
   * comprovado por quem lê o grafo, o trace e a conversa A2A.
   */
  static isDone(result: VerificationResult): boolean {
    return result.status === 'VERIFIED';
  }
}
