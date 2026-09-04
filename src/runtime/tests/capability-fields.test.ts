import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';

/**
 * O registry descartava no `parse()` três campos que os 22 agentes core
 * declaram em 22/22 arquivos: `model`, `permissions` e `evaluation`. O
 * Commander não tinha como perguntar "este agente pede modelo forte?" nem
 * "como se verifica o que ele produz?" sem abrir o JSON.
 */

/** `dist/runtime/tests/x.test.js` → raiz do repositório (onde vive `agents/`). */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-cap-'));
}

test('capabilities: os 22 agentes core expõem modelHint, declaredPermissions e evaluation', () => {
  const registry = new AgentCapabilityRegistry({ baseDir: repoRoot });
  const agents = registry.list();
  assert.ok(agents.length >= 22, `esperado 22+ agentes, veio ${agents.length}`);

  for (const agent of agents) {
    // O campo é obrigatório na forma (array), e vazio quando o agente não pede
    // nada: lista vazia é declaração ("não preciso"), e é o que os core dizem.
    assert.ok(Array.isArray(agent.declaredPermissions), `${agent.id}: declaredPermissions precisa ser array`);
  }

  const withHint = agents.filter((a) => a.modelHint !== undefined);
  assert.equal(withHint.length, agents.length, 'todos os agentes core declaram model');

  const withEval = agents.filter((a) => a.evaluation !== undefined);
  assert.equal(withEval.length, agents.length, 'todos os agentes core declaram evaluation.metrics');
  for (const agent of withEval) {
    assert.ok((agent.evaluation?.metrics.length ?? 0) > 0, `${agent.id}: métricas não vazias`);
  }
});

test('capabilities: agente com declaredPermissions em prosa preserva o texto, sem virar permissão de runtime', () => {
  // A distinção é de segurança: `declaredPermissions` é prosa do autor do
  // agente ("ler agents/"), NÃO o formato `fs:read`/`shell` que a
  // `PolicyEngine` autoriza. Um agente não se autoriza declarando o que quer.
  const registry = new AgentCapabilityRegistry({ baseDir: repoRoot });
  const architect = registry.get('agent-architect');
  assert.ok(architect, 'agent-architect existe');
  assert.ok(architect.declaredPermissions.length > 0, 'agent-architect declara permissões em prosa');
  const runtimeFormat = /^(fs:(read|write)|shell|net)$/;
  assert.ok(
    architect.declaredPermissions.every((p) => !runtimeFormat.test(p)),
    `prosa e não formato de runtime: ${architect.declaredPermissions.join(' | ')}`,
  );
});

test('capabilities: evaluation ausente ou sem métrica não vira minScore 0', () => {
  const dir = tmpDir();
  try {
    const agentsDir = path.join(dir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentsDir, 'sem-eval-agent.json'),
      JSON.stringify({ name: 'sem-eval', role: 'faz coisas de teste', skills: [], chains: {} }),
    );
    fs.writeFileSync(
      path.join(agentsDir, 'eval-vazio-agent.json'),
      JSON.stringify({ name: 'eval-vazio', role: 'faz coisas de teste', evaluation: { metrics: [], minScore: 0.9 } }),
    );

    const registry = new AgentCapabilityRegistry({ baseDir: dir });
    // Métrica sem declaração é ausência de critério, nunca `minScore: 0` (que
    // afirmaria que qualquer nota serve).
    assert.equal(registry.get('sem-eval')?.evaluation, undefined);
    assert.equal(registry.get('eval-vazio')?.evaluation, undefined);
    assert.equal(registry.get('sem-eval')?.modelHint, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('capabilities: ids() encontra os agentes do projeto, não uma lista literal', () => {
  // A lista literal do orquestrador tinha 19 ids e esquecia 3 dos core
  // (`ai-engineer`, `evaluator`, `form-engineer`), além de ignorar qualquer
  // agente do projeto do usuário. Ela decidia se a Agent Factory geraria um
  // agente novo, então a consequência era sintetizar para uma lacuna coberta.
  const ids = new AgentCapabilityRegistry({ baseDir: repoRoot }).ids();
  for (const missing of ['ai-engineer', 'evaluator', 'form-engineer']) {
    assert.ok(ids.includes(missing), `${missing} precisa aparecer em ids()`);
  }
  assert.ok(ids.length >= 22, `esperado 22+, veio ${ids.length}`);
});
