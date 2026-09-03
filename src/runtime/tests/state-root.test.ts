/**
 * Onde vive o estado de um projeto.
 *
 * `baseDir` responde "de onde leio agentes e skills?" e cai na instalação do
 * pacote quando o projeto não tem `.agents/` — o que está certo para assets.
 * Usar a MESMA raiz para o estado fazia todo projeto não inicializado gravar
 * trace, artefato (com conteúdo) e memória dentro de `node_modules/izanagi-ai/`,
 * compartilhados entre todos esses projetos. Na prática: `izanagi trace`
 * listava execução de outro projeto, e um `npm update` apagava o histórico.
 *
 * Encontrado procurando o trace de um run de teste e achando 300 traces de
 * outros projetos no diretório do framework.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveFrameworkRoot, resolveStateRoot } from '../../installer.js';
import { Orchestrator } from '../orchestrator.js';
import { Commander } from '../orchestration/commander.js';
import { createHeadlessProducer } from '../execute.js';
import { TraceStore } from '../observability/tracer.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-state-'));
}

test('raiz de estado: projeto SEM .agents fica com o próprio diretório, não com a instalação do pacote', () => {
  const projeto = tmpDir();
  assert.equal(resolveStateRoot(projeto), path.resolve(projeto));
  assert.notEqual(
    resolveStateRoot(projeto),
    resolveFrameworkRoot(projeto),
    'assets caem na instalação do pacote; estado não pode acompanhar',
  );
  fs.rmSync(projeto, { recursive: true, force: true });
});

test('raiz de estado: projeto inicializado NÃO muda de lugar', () => {
  const projeto = tmpDir();
  fs.mkdirSync(path.join(projeto, '.agents', 'core'), { recursive: true });
  const esperado = path.join(projeto, '.agents');
  assert.equal(resolveStateRoot(projeto), esperado);
  assert.equal(resolveFrameworkRoot(projeto), esperado, 'aqui as duas coincidem, e é por isso que o bug passava despercebido');
  fs.rmSync(projeto, { recursive: true, force: true });
});

test('orchestrator: stateDir separa o estado do run da raiz de assets', async () => {
  const assets = tmpDir();
  const projeto = tmpDir();
  const objective = 'auditar a seguranca da API';

  const orchestrator = new Orchestrator({
    baseDir: assets,
    stateDir: projeto,
    workspaceDir: projeto,
    command: 'test',
    task: objective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan: new Commander().plan({ objective, mode: 'assisted' }),
    produce: createHeadlessProducer(objective),
  });
  const result = await orchestrator.run();

  assert.equal(fs.existsSync(path.join(projeto, '.izanagi', 'state', 'traces')), true, 'o trace é do projeto');
  assert.equal(
    fs.existsSync(path.join(assets, '.izanagi', 'state')),
    false,
    'a instalação do framework não pode acumular estado de projeto nenhum',
  );
  assert.ok(new TraceStore({ baseDir: projeto }).load(result.trace.runId), 'e precisa ser legível de volta pela raiz do projeto');
  fs.rmSync(assets, { recursive: true, force: true });
  fs.rmSync(projeto, { recursive: true, force: true });
});

test('orchestrator: sem stateDir o comportamento é exatamente o de antes (default = baseDir)', async () => {
  const baseDir = tmpDir();
  const objective = 'auditar a seguranca da API';
  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: objective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan: new Commander().plan({ objective, mode: 'assisted' }),
    produce: createHeadlessProducer(objective),
  });
  await orchestrator.run();
  assert.equal(fs.existsSync(path.join(baseDir, '.izanagi', 'state', 'traces')), true);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('isolamento: dois projetos não veem o trace um do outro', async () => {
  const assets = tmpDir();
  const a = tmpDir();
  const b = tmpDir();

  const runIn = async (projeto: string, objective: string) => {
    const o = new Orchestrator({
      baseDir: assets,
      stateDir: projeto,
      workspaceDir: projeto,
      command: 'test',
      task: objective,
      category: 'implementation',
      primaryAgent: 'senior-engineer',
      skillChain: [],
      plan: new Commander().plan({ objective, mode: 'assisted' }),
      produce: createHeadlessProducer(objective),
    });
    return (await o.run()).trace.runId;
  };

  const runA = await runIn(a, 'implementar login no projeto A');
  const runB = await runIn(b, 'implementar checkout no projeto B');

  assert.ok(new TraceStore({ baseDir: a }).load(runA));
  assert.equal(new TraceStore({ baseDir: a }).load(runB), null, 'o projeto A não pode enxergar o run do projeto B');
  assert.equal(new TraceStore({ baseDir: b }).load(runA), null);
  for (const d of [assets, a, b]) fs.rmSync(d, { recursive: true, force: true });
});
