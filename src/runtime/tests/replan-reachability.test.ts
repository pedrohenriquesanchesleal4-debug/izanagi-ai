import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Healer, classifyFailure } from '../recovery/healing.js';
import { MemoryStore } from '../memory/store.js';
import { Commander } from '../orchestration/commander.js';
import { parseRunArgs } from '../../cli/commands/run.js';
import { LOCAL_MAX_CONCURRENCY } from '../orchestration/concurrency.js';

/**
 * O Plano B do Commander (trocar agente → subir papel → quebrar a tarefa) só
 * era alcançado por falha de PLANEJAMENTO, ou seja quando a mensagem de erro
 * casava `/plan|graph|cycle|topological/`. Reprovação da Verification Engine
 * classifica como `validation` e ia direto para "troca a skill e tenta de
 * novo", com o MESMO agente, MESMO papel e MESMA decomposição, até esgotar
 * `maxAttempts`. Na prática o caminho de falha mais comum do runtime era
 * exatamente o "repetir" que o replanejamento existe para evitar.
 */

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-replan-'));
}

function healInput(baseDir: string, attempt: number) {
  return {
    nodeId: 'execute',
    agent: 'senior-engineer',
    skill: 'tdd',
    error: 'verificação reprovada: critério de aceite "contains title" não comprovado',
    attempt,
    maxAttempts: 3,
    elapsedMs: 1000,
    maxTimeMs: 900_000,
    tokensUsed: 500,
    maxTokens: 32_000,
    memory: new MemoryStore({ baseDir }),
  };
}

test('replan: reprovação de verificação classifica como validation', () => {
  assert.equal(
    classifyFailure('verificação reprovada: critério de aceite "contains title" não comprovado'),
    'validation',
  );
});

test('replan: 1ª falha de validação troca a skill (a correção mais barata primeiro)', () => {
  const baseDir = tmpDir();
  try {
    const decision = new Healer().heal(healInput(baseDir, 1));
    assert.equal(decision.action.kind, 'skill_replacement');
    assert.equal(decision.retryNow, true);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('replan: 2ª falha de validação vai para replan, não repete a troca de skill', () => {
  const baseDir = tmpDir();
  try {
    const decision = new Healer().heal(healInput(baseDir, 2));
    assert.equal(decision.action.kind, 'replan');
    assert.equal(decision.action.failureKind, 'validation');
    assert.match(decision.action.message, /replanejando/i);
    // Replan não é retry imediato: quem reconstrói o grafo é o Commander.
    assert.notEqual(decision.retryNow, true);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('replan: falha transitória segue retry mesmo na 2ª tentativa', () => {
  // A mudança precisa ser cirúrgica: 429 é transitório e retentar é a resposta
  // correta, não replanejar.
  const baseDir = tmpDir();
  try {
    const decision = new Healer().heal({ ...healInput(baseDir, 2), error: '429 rate limit' });
    assert.equal(decision.action.kind, 'retry');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('replan: hard limit continua vencendo o replan', () => {
  // Na última tentativa o corte é abort: replanejar sem tentativa sobrando
  // gastaria o planejamento para não executar nada.
  const baseDir = tmpDir();
  try {
    const decision = new Healer().heal(healInput(baseDir, 3));
    assert.equal(decision.action.kind, 'abort');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('replan: o Commander devolve um Plano B para o nó reprovado', () => {
  // Fecha a ponta: o caminho aberto acima chega num replan que realmente muda
  // a estratégia, em vez de reabrir o mesmo nó.
  const commander = new Commander();
  const plan = commander.plan({ objective: 'Auditar a segurança da API de pagamentos', mode: 'autonomous' });
  const target = plan.graph.nodes.find((n) => n.agent) ?? plan.graph.nodes[0];
  const result = commander.replan(
    { graph: plan.graph },
    {
      nodeId: target.id,
      error: 'verificação reprovada: critério não comprovado',
      attempt: 2,
      unmet: ['contains title'],
      ...(target.agent ? { agent: target.agent } : {}),
    },
    { objective: plan.runObjective },
  );
  assert.ok(result, 'replan devolveu um plano');
  assert.ok(result.changes.length > 0, `o Plano B precisa mudar algo: ${JSON.stringify(result.changes)}`);
});

/* ==================== TETO DE CONCORRÊNCIA ==================== */

test('concurrency: --local serializa o pool (GPU única não ganha com paralelismo)', () => {
  const parsed = parseRunArgs(['--local', 'auditar a API']);
  assert.equal(parsed.local, true);
  // O teto não vem do parse: vem de `runRuntime` compondo `budgetLimits`. O que
  // este teste fixa é que `--local` chega parseado e que o valor default local
  // é 1, que era a constante sem nenhuma referência no repositório.
  assert.equal(LOCAL_MAX_CONCURRENCY, 1);
  assert.equal(parsed.maxConcurrency, undefined);
});

test('concurrency: --max-concurrency é aceito pela CLI e vence o default local', () => {
  const parsed = parseRunArgs(['--local', '--max-concurrency', '4', 'auditar a API']);
  assert.equal(parsed.maxConcurrency, 4);
  const inline = parseRunArgs(['--max-concurrency=2', 'auditar a API']);
  assert.equal(inline.maxConcurrency, 2);
});

test('concurrency: valor inválido de --max-concurrency é ignorado, não vira 0', () => {
  // Pool 0 significaria "sem teto" no `runWithConcurrency`, o oposto do que o
  // usuário pediu ao passar um número.
  assert.equal(parseRunArgs(['--max-concurrency', '0', 'x']).maxConcurrency, undefined);
  assert.equal(parseRunArgs(['--max-concurrency', 'abc', 'x']).maxConcurrency, undefined);
  assert.equal(parseRunArgs(['--max-concurrency', '-3', 'x']).maxConcurrency, undefined);
});
