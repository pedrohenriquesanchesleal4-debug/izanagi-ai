/**
 * Critérios de aceite VINDOS DO USUÁRIO.
 *
 * O Commander sempre gerou critérios, e todos falam da FORMA do artefato:
 * `artifact-valid`, `min-size 200`, `contains "<campo do schema>"`,
 * `not-contains "TODO"`. Nada disso fala do que foi pedido: "adicionar
 * paginação em GET /users" não produzia nenhum critério sobre paginação, e a
 * especificação do runtime pede o contrário ("o Commander gera critérios
 * QUANDO o usuário não os fornece"). Como não havia por onde fornecer, o
 * "quando" era sempre.
 *
 * Aqui o usuário fornece. A regra de tradução é uma só e está no prefixo:
 *
 *   contains: paginação            -> determinístico, decidido sem modelo
 *   not-contains: TODO             -> determinístico
 *   matches: limit=\d+             -> determinístico (regex validada na carga)
 *   min-size: 500                  -> determinístico
 *   file-exists: src/routes.ts     -> determinístico, contra o disco
 *   json-field: total              -> determinístico
 *   references-exist               -> determinístico (sem valor)
 *   o endpoint aceita ?page e ?limit  -> semântico: precisa de juiz
 *
 * O default é SEMÂNTICO de propósito. Um critério em prosa é o que uma pessoa
 * escreve naturalmente, e transformá-lo em `contains` da frase inteira
 * reprovaria toda entrega correta que usasse outras palavras: um check
 * determinístico inventado sobre uma frase é pior que nenhum check, porque
 * parece evidência. Sem juiz configurado o critério semântico fica UNVERIFIED,
 * que é "não medi", nunca "está errado".
 */

import type { AcceptanceCriterion, DeterministicCheck, TaskContract } from './task-contract.js';

/** Prefixos que viram check determinístico. Qualquer outra coisa é semântica. */
const DETERMINISTIC_PREFIXES = [
  'contains',
  'not-contains',
  'matches',
  'min-size',
  'file-exists',
  'json-field',
  'references-exist',
] as const;

type Prefix = (typeof DETERMINISTIC_PREFIXES)[number];

export interface ParsedAcceptance {
  /** Critérios prontos para entrar num contrato. */
  criteria: AcceptanceCriterion[];
  /**
   * Entradas recusadas, com o motivo. Recusa NÃO é silenciosa: um critério que
   * o usuário escreveu e o runtime descartou sem avisar é a pior forma de
   * verificação, porque o run termina VERIFIED sem ter medido o que foi pedido.
   */
  issues: string[];
}

/**
 * Converte as linhas do usuário em critérios.
 *
 * `id` é derivado da posição (`user:1`, `user:2`), não do texto: o texto pode
 * repetir, e dois critérios com o mesmo id calariam um deles na verificação.
 */
export function parseAcceptance(lines: string[]): ParsedAcceptance {
  const criteria: AcceptanceCriterion[] = [];
  const issues: string[] = [];

  lines.forEach((raw, i) => {
    const text = raw.trim();
    if (text.length === 0) {
      issues.push(`critério ${i + 1}: vazio`);
      return;
    }
    const id = `user:${i + 1}`;
    const parsed = parseOne(text);
    if (parsed.kind === 'invalid') {
      issues.push(`critério ${i + 1} ("${clip(text)}"): ${parsed.reason}`);
      return;
    }
    if (parsed.kind === 'semantic') {
      criteria.push({ id, description: text, kind: 'semantic' });
      return;
    }
    criteria.push({ id, description: text, kind: 'deterministic', check: parsed.check });
  });

  return { criteria, issues };
}

type ParseOne =
  | { kind: 'semantic' }
  | { kind: 'deterministic'; check: DeterministicCheck }
  | { kind: 'invalid'; reason: string };

function parseOne(text: string): ParseOne {
  const prefix = DETERMINISTIC_PREFIXES.find(
    (p) => text === p || text.toLowerCase().startsWith(`${p}:`),
  );
  if (!prefix) return { kind: 'semantic' };
  const value = text.slice(text === prefix ? prefix.length : prefix.length + 1).trim();
  return checkFor(prefix, value, text);
}

function checkFor(prefix: Prefix, value: string, original: string): ParseOne {
  if (prefix === 'references-exist') {
    if (value.length === 0) return { kind: 'deterministic', check: { kind: 'references-exist' } };
    const ratio = Number(value);
    if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
      return { kind: 'invalid', reason: 'references-exist aceita uma razão entre 0 e 1, ou nenhum valor' };
    }
    return { kind: 'deterministic', check: { kind: 'references-exist', minRatio: ratio } };
  }

  if (value.length === 0) {
    return { kind: 'invalid', reason: `"${prefix}:" sem valor` };
  }

  switch (prefix) {
    case 'contains':
      return { kind: 'deterministic', check: { kind: 'contains', text: value, message: `a entrega precisa cobrir: ${clip(original)}` } };
    case 'not-contains':
      return { kind: 'deterministic', check: { kind: 'not-contains', text: value, message: `a entrega não pode conter "${value}"` } };
    case 'matches': {
      try {
        new RegExp(value);
      } catch (err) {
        return { kind: 'invalid', reason: `regex inválida: ${err instanceof Error ? err.message : String(err)}` };
      }
      return { kind: 'deterministic', check: { kind: 'matches', pattern: value, message: `a entrega precisa casar com /${value}/` } };
    }
    case 'min-size': {
      const bytes = Number(value);
      if (!Number.isInteger(bytes) || bytes <= 0) {
        return { kind: 'invalid', reason: 'min-size aceita um número inteiro de bytes maior que zero' };
      }
      return { kind: 'deterministic', check: { kind: 'min-size', bytes } };
    }
    case 'file-exists':
      return { kind: 'deterministic', check: { kind: 'file-exists', path: value, message: `arquivo esperado ausente: ${value}` } };
    case 'json-field':
      return { kind: 'deterministic', check: { kind: 'json-field', field: value } };
  }
}

/**
 * Kinds de artefato que descrevem o PROCESSO do run, não o produto.
 *
 * Cobrar um critério do usuário do levantamento do projeto ou do relatório de
 * avaliação reprovaria a etapa por não conter o que ela nunca deveria conter.
 * A lista espelha `orchestration/delivery.ts` de propósito: as duas respondem
 * à mesma pergunta ("isto é entrega ou é rastro?").
 */
const PROCESS_KINDS = new Set(['evaluation', 'critique', 'trace', 'project-survey', 'materialization', 'delivery', 'test-run']);

/**
 * A quais contratos os critérios do usuário se aplicam.
 *
 * As tarefas TERMINAIS que produzem produto: as que nenhuma outra tarefa de
 * produto consome. É onde o trabalho está inteiro. Aplicar o mesmo critério a
 * todo nó reprovaria a pesquisa por não conter o código, e multiplicaria a
 * chamada de juiz por nó do grafo, que é o custo que esta arquitetura existe
 * para não pagar.
 */
export function acceptanceTargets(contracts: TaskContract[]): string[] {
  const product = contracts.filter((c) => !c.tool && !PROCESS_KINDS.has(String(c.expectedOutput.kind)));
  if (product.length === 0) return [];
  const consumed = new Set<string>();
  for (const c of product) for (const dep of c.dependencies) consumed.add(dep);
  const sinks = product.filter((c) => !consumed.has(c.id));
  return (sinks.length > 0 ? sinks : product).map((c) => c.id);
}

/**
 * Acrescenta os critérios do usuário aos contratos-alvo.
 *
 * Os critérios determinísticos entram TAMBÉM em `verification.deterministic`,
 * que é a lista que a Verification Engine aplica ao artefato: um critério que
 * fica só em `acceptance` é registrado e não é medido.
 */
export function applyAcceptance(contracts: TaskContract[], criteria: AcceptanceCriterion[]): TaskContract[] {
  if (criteria.length === 0) return contracts;
  const targets = new Set(acceptanceTargets(contracts));
  if (targets.size === 0) return contracts;
  const checks = criteria.filter((c) => c.kind === 'deterministic' && c.check).map((c) => c.check as DeterministicCheck);
  return contracts.map((c) => {
    if (!targets.has(c.id)) return c;
    return {
      ...c,
      acceptance: [...c.acceptance, ...criteria],
      verification: { ...c.verification, deterministic: [...c.verification.deterministic, ...checks] },
      constraints: [
        ...c.constraints,
        // O critério vira RESTRIÇÃO no prompt além de virar verificação: pedir
        // a coisa e só depois cobrá-la desperdiça a tentativa que o agente
        // teria acertado sabendo o que era cobrado.
        `a entrega será verificada contra estes critérios do usuário: ${criteria.map((k) => k.description).join('; ')}`,
      ],
    };
  });
}

function clip(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
