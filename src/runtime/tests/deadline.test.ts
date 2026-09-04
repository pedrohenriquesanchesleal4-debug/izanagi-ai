import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DeadlineExceededError,
  MIN_DEADLINE_MS,
  resolveDeadlineMs,
  withDeadline,
} from '../orchestration/deadline.js';
import { Orchestrator } from '../orchestrator.js';
import type { ExecuteCtx } from '../orchestrator.js';
import type { GraphNode } from '../types.js';
import { MemoryStore } from '../memory/store.js';
import { Commander } from '../orchestration/commander.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-deadline-'));
}

test('deadline: sem prazo declarado o trabalho passa intocado', async () => {
  const result = await withDeadline(async () => 'pronto', undefined, 'no-x');
  assert.equal(result, 'pronto');
});

test('deadline: trabalho dentro do prazo devolve o resultado', async () => {
  const result = await withDeadline(async () => 'ok', 5000, 'no-x');
  assert.equal(result, 'ok');
});

test('deadline: trabalho além do prazo rejeita com DeadlineExceededError', async () => {
  await assert.rejects(
    () => withDeadline(() => new Promise((resolve) => setTimeout(() => resolve('tarde'), 3000)), MIN_DEADLINE_MS, 'no-lento'),
    (err: unknown) => {
      assert.ok(err instanceof DeadlineExceededError);
      assert.equal(err.label, 'no-lento');
      assert.equal(err.timeoutMs, MIN_DEADLINE_MS);
      // A mensagem precisa conter "timeout": é ela que faz o `Healer`
      // classificar como `recoverable` e retentar em vez de abortar.
      assert.match(err.message, /timeout/i);
      return true;
    },
  );
});

test('deadline: trabalho que falha DEPOIS do prazo não derruba o processo', async () => {
  // Sem o `catch` vazio na promise perdedora, esta rejeição tardia viraria
  // `unhandledRejection` e transformaria um nó lento em crash do run.
  const rejections: unknown[] = [];
  const onRejection = (err: unknown) => rejections.push(err);
  process.on('unhandledRejection', onRejection);
  try {
    await assert.rejects(
      () => withDeadline(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('falha tardia')), 1200)),
        MIN_DEADLINE_MS,
        'no-y',
      ),
      DeadlineExceededError,
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.deepEqual(rejections, [], 'nenhuma rejeição não tratada');
  } finally {
    process.off('unhandledRejection', onRejection);
  }
});

test('deadline: resolve o MENOR prazo entre contrato e nó', () => {
  assert.equal(resolveDeadlineMs([60_000, 5_000]), 5_000);
  assert.equal(resolveDeadlineMs([5_000, 60_000]), 5_000);
});

test('deadline: ausência, zero e negativo significam SEM prazo, nunca prazo zero', () => {
  assert.equal(resolveDeadlineMs([]), undefined);
  assert.equal(resolveDeadlineMs([undefined, undefined]), undefined);
  assert.equal(resolveDeadlineMs([0]), undefined);
  assert.equal(resolveDeadlineMs([-1]), undefined);
  // Abaixo do piso o prazo derrubaria trabalho legítimo: ignorado.
  assert.equal(resolveDeadlineMs([MIN_DEADLINE_MS - 1]), undefined);
  // Valor inválido não contamina um válido.
  assert.equal(resolveDeadlineMs([0, 4_000]), 4_000);
});

test('deadline: nó cujo producer pendura é derrubado pelo prazo do nó, e o run não trava', async () => {
  const baseDir = tmpDir();
  const memory = new MemoryStore({ baseDir });
  let calls = 0;

  // Plano real do Commander: é ele quem declara `timeoutMs` por nó em produção.
  // Aqui o prazo é encurtado para o piso, e é isso que precisa valer — sem o
  // prazo aplicado este producer nunca resolveria e o teste estouraria pelo
  // timeout do runner em vez de por decisão do runtime.
  const plan = new Commander().plan({ objective: 'Converter 10 dólares para reais', mode: 'direct' });
  for (const node of plan.graph.nodes) node.timeoutMs = MIN_DEADLINE_MS;

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: 'implementation',
    primaryAgent: 'senior-engineer',
    skillChain: [],
    plan,
    produce: (_node: GraphNode, _ctx: ExecuteCtx) => {
      calls++;
      return new Promise(() => {}) as never;
    },
  });
  orchestrator.setMemory(memory);

  const result = await orchestrator.run();

  assert.ok(calls > 0, 'o producer foi chamado');
  assert.notEqual(result.status, 'PASS');
  const failed = result.graph.nodes.filter((n) => n.status === 'failed');
  assert.ok(failed.length > 0, 'algum nó falhou por prazo');
  assert.ok(
    failed.some((n) => /timeout/i.test(n.error ?? '')),
    `erro do nó deveria citar timeout: ${failed.map((n) => n.error).join(' | ')}`,
  );
  fs.rmSync(baseDir, { recursive: true, force: true });
});
