/**
 * Três fechamentos de gap com uma coisa em comum: cada um existia como
 * "limitação conhecida" e virava vermelho ou decisão errada em produção.
 *
 *  - simulação headless derivada do schema REAL (antes: todo kind tipado
 *    reprovava e o run terminava FAIL por motivo alheio ao runtime);
 *  - estatística de agente por domínio (antes: média global punia um agente
 *    bom em backend por ir mal em frontend);
 *  - cache da validação determinística (função pura chamada várias vezes sobre
 *    o mesmo conteúdo dentro de um run).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ARTIFACT_SCHEMAS,
  SIMULATION_BANNER,
  clearValidationCache,
  simulatedArtifact,
  validateArtifact,
} from '../contracts/artifacts.js';
import { createHeadlessProducer } from '../execute.js';
import { MemoryStore } from '../memory/store.js';
import { Commander } from '../orchestration/commander.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import type { ArtifactKind, GraphNode } from '../types.js';

const CTX = { nodeId: 'scan', label: 'security', objective: 'auditar a API de login' };

/* ============================ simulação headless ============================ */

test('headless: a simulação de TODO kind registrado passa no validador de verdade', () => {
  const kinds = Object.keys(ARTIFACT_SCHEMAS) as ArtifactKind[];
  assert.ok(kinds.length >= 12, 'o catálogo de schemas encolheu: revisar este teste');
  for (const kind of kinds) {
    const content = simulatedArtifact(kind, CTX);
    const report = validateArtifact(kind, content);
    assert.equal(report.valid, true, `simulação de "${kind}" reprovou: ${report.issues.join('; ')}`);
  }
});

test('headless: a simulação declara que é simulação, no próprio conteúdo', () => {
  const texto = simulatedArtifact('security-report', CTX) as string;
  assert.ok(texto.includes(SIMULATION_BANNER));
  const critica = simulatedArtifact('critique', CTX) as { status: string; note: string };
  assert.equal(critica.status, 'approved');
  assert.ok(critica.note.includes(SIMULATION_BANNER), 'crítica simulada não pode se passar por crítica real');
});

test('headless: kind com validação custom recebe o que a validação exige', () => {
  const schema = ARTIFACT_SCHEMAS['database-schema'];
  assert.ok(schema.simulationHint, 'schema com validate precisa declarar o hint da simulação');
  const content = simulatedArtifact('database-schema', CTX) as string;
  assert.deepEqual(schema.validate!(content), [], 'a simulação deveria satisfazer a validação custom');
});

test('headless: o producer usa a simulação do schema do nó', async () => {
  const producer = createHeadlessProducer('auditar a API de login');
  const node = { id: 'scan', kind: 'agent', agent: 'security', outputs: ['security-report'], status: 'pending' } as GraphNode;
  const result = await producer(node, {} as never);
  assert.equal(result.kind, 'security-report');
  assert.equal(result.model, 'cli-headless');
  assert.equal(validateArtifact('security-report', result.content).valid, true);
});

/* ============================ estatística por domínio ============================ */

function tmpMemory(): { memory: MemoryStore; baseDir: string } {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-domain-'));
  return { memory: new MemoryStore({ baseDir }), baseDir };
}

test('memória: o run conta em todos os domínios que tocou, e no agregado', () => {
  const { memory, baseDir } = tmpMemory();
  memory.recordAgentRun('senior-engineer', { success: false, score: 0.2, tokens: 100, domains: ['frontend'] });
  memory.recordAgentRun('senior-engineer', { success: true, score: 0.9, tokens: 100, domains: ['backend'] });
  memory.recordAgentRun('senior-engineer', { success: true, score: 0.9, tokens: 100, domains: ['backend', 'database'] });

  assert.equal(memory.agentStats('senior-engineer')!.runs, 3);
  assert.equal(memory.agentStats('senior-engineer', 'backend')!.successes, 2);
  assert.equal(memory.agentStats('senior-engineer', 'frontend')!.successes, 0);
  assert.equal(memory.agentStats('senior-engineer', 'database')!.runs, 1);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('memória: domínio sem histórico devolve ausência, não zero', () => {
  const { memory, baseDir } = tmpMemory();
  memory.recordAgentRun('qa', { success: true, score: 0.9, tokens: 10, domains: ['testing'] });
  assert.equal(memory.agentStats('qa', 'devops'), undefined, 'ausência de histórico não é histórico ruim');
  assert.ok(memory.agentStats('qa'), 'o agregado continua disponível');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('memória: estado gravado antes do recorte por domínio continua legível', () => {
  const { memory, baseDir } = tmpMemory();
  memory.recordAgentRun('devops', { success: true, score: 0.8, tokens: 50 });
  const stats = memory.agentStats('devops')!;
  assert.equal(stats.runs, 1);
  assert.equal(stats.byDomain, undefined);
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('memória: agente ruim em frontend não é descartado de um trabalho de backend', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-domain-cmd-'));
  fs.mkdirSync(path.join(baseDir, 'agents'), { recursive: true });
  for (const id of ['alfa-engineer', 'beta-engineer']) {
    fs.writeFileSync(
      path.join(baseDir, 'agents', `${id}-agent.json`),
      JSON.stringify({
        name: id,
        role: 'Implementar endpoint de API backend com validacao',
        capabilities: ['endpoint', 'api', 'backend', 'validacao'],
        skills: ['tdd'],
        chains: { implement: ['tdd'] },
        token_budget: 4096,
      }),
      'utf-8',
    );
  }
  const registry = new AgentCapabilityRegistry({ baseDir });
  const objective = 'Implementar o endpoint de API backend com validacao de dados';

  const base = new Commander().plan({ objective, mode: 'assisted', capabilities: registry });
  const escolhido = base.contracts[0].agent!;

  // Péssimo em frontend, ótimo em backend. O objetivo é backend.
  const memory = {
    findRelevantFailures: () => [],
    agentStats: (agent: string, domain?: string) => {
      if (agent !== escolhido) return undefined;
      if (domain === 'backend') return { runs: 6, successes: 6, failures: 0 };
      if (domain === 'frontend') return { runs: 6, successes: 0, failures: 6 };
      return { runs: 12, successes: 6, failures: 6 };
    },
  };

  const plan = new Commander().plan({ objective, mode: 'assisted', capabilities: registry, memory });
  assert.equal(plan.contracts[0].agent, escolhido, 'o recorte por domínio deveria prevalecer sobre a média global');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

/* ============================ cache de validação ============================ */

test('cache: conteúdo idêntico no mesmo kind devolve o relatório já computado', () => {
  clearValidationCache();
  const content = simulatedArtifact('research', CTX);
  const first = validateArtifact('research', content);
  const second = validateArtifact('research', content);
  assert.equal(first, second, 'a segunda validação do mesmo conteúdo deveria vir do cache');
  clearValidationCache();
  assert.notEqual(validateArtifact('research', content), first, 'clearValidationCache precisa realmente esvaziar');
});

test('cache: conteúdo diferente, ou kind diferente, não compartilha relatório', () => {
  clearValidationCache();
  const a = validateArtifact('raw', 'conteudo A');
  const b = validateArtifact('raw', 'conteudo B');
  assert.notEqual(a, b);
  const comoResearch = validateArtifact('research', 'conteudo A');
  assert.notEqual(comoResearch, a);
  assert.equal(comoResearch.kind, 'research');
});
