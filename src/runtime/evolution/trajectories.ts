/**
 * Trajetórias: transformar execução repetida em procedimento reutilizável.
 *
 * O `LearningEngine` já converte FALHA em padrão. O caminho simétrico — SUCESSO
 * virar conhecimento — não existia: um run `VERIFIED` de 5 tarefas era
 * registrado como estatística agregada e o procedimento em si se perdia.
 *
 * O risco desta ideia é óbvio e é o motivo de ela ter ficado parada: sintetizar
 * uma skill a cada run bem-sucedido produz uma biblioteca de skills genéricas
 * que ninguém usa e que competem com as boas no ranking. Por isso a barra aqui
 * é RECORRÊNCIA, não sucesso: a mesma forma de execução precisa se repetir e
 * dar certo várias vezes antes de virar procedimento.
 *
 * O que faz uma trajetória ser "a mesma": a assinatura é a sequência de
 * (agente → kind de artefato) das tarefas verificadas, não o texto do objetivo.
 * Dois runs sobre objetivos diferentes que percorreram o mesmo caminho SÃO a
 * mesma trajetória — é justamente essa generalidade que faz o procedimento
 * valer alguma coisa.
 */

import crypto from 'crypto';

/** Uma tarefa concluída, como ela entra na assinatura da trajetória. */
export interface TrajectoryStep {
  nodeId: string;
  agent?: string;
  kind: string;
  verified: boolean;
}

export interface Trajectory {
  /** Hash estável da sequência (agente → kind). */
  signature: string;
  /** Sequência legível, para o procedimento gerado e para o `izanagi memory`. */
  steps: string[];
  domains: string[];
  occurrences: number;
  /** Runs em que a trajetória fechou com tudo verificado. */
  successes: number;
  firstSeen: string;
  lastSeen: string;
  /** Objetivos que percorreram este caminho. Amostra, não histórico completo. */
  examples: string[];
  /** Skill já sintetizada a partir desta trajetória, quando houver. */
  synthesizedSkill?: string;
}

/** Repetições necessárias antes de uma trajetória virar procedimento. */
export const MIN_OCCURRENCES_TO_SYNTHESIZE = 3;
/** Passos mínimos: uma trajetória de 1 passo é uma tarefa, não um procedimento. */
export const MIN_STEPS = 2;
/** Objetivos de exemplo guardados por trajetória. */
const MAX_EXAMPLES = 5;

/**
 * Assinatura de uma execução. Só entram tarefas VERIFICADAS: um caminho que
 * inclui um passo não comprovado não é um procedimento que valha repetir.
 *
 * Devolve `null` quando a execução é curta demais para ser procedimento.
 */
export function signatureOf(steps: TrajectoryStep[]): { signature: string; steps: string[] } | null {
  const verified = steps.filter((s) => s.verified);
  if (verified.length < MIN_STEPS) return null;
  const readable = verified.map((s) => `${s.agent ?? s.nodeId} -> ${s.kind}`);
  const signature = crypto.createHash('sha1').update(readable.join(' | ')).digest('hex').slice(0, 12);
  return { signature, steps: readable };
}

/** A trajetória já se repetiu o bastante para virar procedimento? */
export function isRecurrent(t: Trajectory): boolean {
  return t.occurrences >= MIN_OCCURRENCES_TO_SYNTHESIZE && t.successes >= MIN_OCCURRENCES_TO_SYNTHESIZE && !t.synthesizedSkill;
}

/**
 * Corpo da skill procedural derivada de uma trajetória.
 *
 * Descreve o CAMINHO observado, não invenções sobre o domínio: cada linha sai
 * de um passo que realmente aconteceu e foi verificado N vezes. Uma skill que
 * afirmasse mais do que a trajetória mostra seria exatamente o AI slop que o
 * framework proíbe.
 */
export function describeTrajectory(t: Trajectory): string {
  const linhas = t.steps.map((s, i) => `${i + 1}. ${s}`);
  return [
    `Procedimento observado em ${t.occurrences} execuções, todas verificadas.`,
    '',
    '## Sequência',
    ...linhas,
    '',
    '## Quando aplicar',
    t.domains.length > 0
      ? `Objetivos nos domínios: ${t.domains.join(', ')}.`
      : 'Domínio não classificado nas execuções observadas.',
    '',
    '## Objetivos que percorreram este caminho',
    ...t.examples.map((e) => `- ${e}`),
    '',
    '## Limite desta skill',
    'Isto é a descrição de um caminho que funcionou, não uma garantia de que',
    'funcionará. A sequência foi observada; as decisões dentro de cada passo',
    'continuam sendo do agente responsável por ele.',
  ].join('\n');
}

/**
 * Nome derivado da trajetória. Determinístico: a mesma trajetória gera sempre
 * o mesmo nome, então re-sintetizar não cria duplicata.
 */
export function skillNameFor(t: Trajectory): string {
  const dominio = t.domains[0] ?? 'geral';
  return `procedimento-${dominio}-${t.signature.slice(0, 6)}`;
}
