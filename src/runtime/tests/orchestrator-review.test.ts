import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Orchestrator, type ExecuteCtx } from '../orchestrator.js';
import { Commander } from '../orchestration/commander.js';
import { MemoryStore } from '../memory/store.js';
import { TraceStore } from '../observability/tracer.js';
import type { GraphNode } from '../types.js';

/**
 * Gate de Revisão do Orquestrador (`orchestrator-review`).
 *
 * A especificação de execução exige que o orquestrador use o modelo SUPERIOR
 * para planejar/coordenar, os orquestrados um modelo inferior, e que ele
 * REVISE a entrega consolidada com o modelo mais RÁPIDO antes de aprovar.
 *
 * O Commander já roteia por papel (commander→premium, specialist→balanced,
 * worker→fast). O que faltava era o GATE: um nó no fim do grafo, papel
 * `worker` (modelo mais rápido do catálogo), que recebe os artefatos
 * terminais de produto e produz uma `critique` estruturada — o mecanismo A2A
 * que o runtime já interpreta (`interpretCritique` → reabre o alvo com
 * correção mínima). Aprovação aprova; bloqueio reabre; e como um nó que
 * produz crítica volta à fila com `attempts` zerado, o review SEMPRE roda no
 * modelo mais rápido, mesmo quando a reabertura acontece.
 */

const LONG = 'Conteúdo real, completo e pronto para produção deste artefato. '.repeat(20);

function validContentFor(kind: string | undefined): string {
  const req: Record<string, string> = {
    'security-report': 'severity vulnerabilities remediation',
    remediation: 'fixes steps verification',
    architecture: 'context decision layers',
    'database-schema': 'model relations @id primary key references',
    'api-contract': 'method path request response',
    'test-plan': 'unit integration scenarios',
    'implementation-plan': 'steps files',
    requirements: 'title functional acceptance',
    research: 'findings sources',
    evaluation: 'verdict score metrics',
  };
  return LONG + ((kind && req[kind]) || '');
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-review-'));
}

/** Nós de PRODUTO revisados: agent/evaluator/validator, fora tools/gates/approvals e fora o próprio gate. */
function terminalProductNodes(plan: ReturnType<Commander['plan']>): GraphNode[] {
  return plan.graph.nodes.filter(
    (n) =>
      n.id !== 'orchestrator-review' &&
      (n.kind ?? 'agent') !== 'tool' &&
      (n.kind ?? 'agent') !== 'gate' &&
      (n.kind ?? 'agent') !== 'approval' &&
      !(n.outputs ?? []).includes('critique') &&
      n.id !== 'survey',
  );
}

test('review: modos orchestrated e autonomous incluem o gate com papel worker, dependente dos terminais de produto', () => {
  for (const mode of ['orchestrated', 'autonomous'] as const) {
    const plan = new Commander().plan({ objective: 'Auditar a segurança OWASP da API de login e propor remediação', mode });
    const review = plan.graph.nodes.find((n) => n.id === 'orchestrator-review');
    assert.ok(review, `modo ${mode} deveria ter o orchestrator-review`);
    assert.ok((review!.outputs ?? []).includes('critique'), 'o gate produz critique estruturada (mecanismo A2A de reabertura)');
    assert.notEqual(review!.metadata?.optional, true, 'o gate de aprovação NÃO pode ser dispensado por early stopping');
    assert.equal(review!.metadata?.role, 'worker', 'o gate revisa com o modelo MAIS RÁPIDO (papel worker)');

    const terminals = terminalProductNodes(plan).map((n) => n.id);
    assert.ok(terminals.length > 0, `modo ${mode} tem terminais de produto`);
    for (const t of terminals) {
      assert.ok((review!.dependencies ?? []).includes(t), `gate deveria depender do terminal "${t}"`);
    }
  }
});

test('review: modos direct e assisted NÃO têm o gate (proporcional ao problema)', () => {
  const direct = new Commander().plan({ objective: 'Converta 10 dólares para reais' });
  assert.equal(direct.mode, 'direct');
  assert.ok(!direct.graph.nodes.some((n) => n.id === 'orchestrator-review'), 'direct não tem gate');

  const assisted = new Commander().plan({ objective: 'Renomeie a função getData para fetchData', mode: 'assisted' });
  assert.ok(!assisted.graph.nodes.some((n) => n.id === 'orchestrator-review'), 'assisted não tem gate');
});

test('review: o gate usa o modelo mais rápido do catálogo através do roteamento por papel', () => {
  const plan = new Commander().plan({ objective: 'Auditar a segurança OWASP da API de login', mode: 'orchestrated' });
  const review = plan.graph.nodes.find((n) => n.id === 'orchestrator-review')!;
  const contract = plan.contracts.find((c) => c.id === review.id);
  assert.equal(contract?.role, 'worker', 'contrato do gate carrega papel worker');
  // O paper worker é o tier fast no TIER_FOR_ROLE (commander=premium,
  // specialist=balanced, worker=fast): o mesmo tier do haiku/gpt-4o-mini/flash.
  assert.equal(review.metadata?.role, 'worker');
});

test('review: crítica bloqueante do gate reabre o alvo com correção, e a reexecução fecha o run', async () => {
  const baseDir = tmpDir();
  let reviewCalls = 0;
  const plan = new Commander().plan({ objective: 'Auditar a segurança OWASP da API de login', mode: 'orchestrated' });
  const reviewNode = plan.graph.nodes.find((n) => n.id === 'orchestrator-review')!;
  const targetId = (reviewNode.dependencies ?? [])[0];
  assert.ok(targetId, 'gate tem alvo');

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode) => {
      if (node.id === 'orchestrator-review') {
        reviewCalls++;
        if (reviewCalls === 1) {
          // Primeira revisão reprova o alvo: problema crítico nomeado.
          return {
            content: JSON.stringify({
              status: 'needs_revision',
              issues: [{ severity: 'critical', artifact: targetId, description: 'sql injection na autenticação', suggestedFix: 'usar query parametrizada' }],
            }),
            kind: 'critique',
          };
        }
        // Segunda revisão (após a correção): aprova.
        return { content: JSON.stringify({ status: 'approved', issues: [] }), kind: 'critique' };
      }
      // Demais nós produzem conteúdo válido; o alvo reaberto também responde.
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.ok(reviewCalls >= 2, `gate deveria revisar de novo após reabrir o alvo (chamadas: ${reviewCalls})`);
  assert.equal(result.status, 'PASS');
  const target = result.graph.nodes.find((n) => n.id === targetId);
  assert.equal(target?.status, 'succeeded', 'alvo reaberto e corrigido fecha como succeeded');
  const conversations = (result.conversation ?? []).filter((c) => c.type === 'critique' || c.type === 'correction');
  assert.ok(conversations.length >= 2, 'o protocolo A2A registra a crítica e a correção');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('review: segunda reprovação bloqueante do MESMO alvo NUNCA fecha em PASS', async () => {
  // A rodada corretiva tem limite de UMA (anti ping-pong). Se o gate reprova o
  // mesmo nó duas vezes, aprovar seria contradizer a própria condição de
  // aprovação: o run termina em FAIL, nunca em PASS silencioso.
  const baseDir = tmpDir();
  const plan = new Commander().plan({ objective: 'Auditar a segurança OWASP da API de login', mode: 'orchestrated' });
  const reviewNode = plan.graph.nodes.find((n) => n.id === 'orchestrator-review')!;
  const targetId = (reviewNode.dependencies ?? [])[0];

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode) => {
      if (node.id === 'orchestrator-review') {
        // Sempre reprova o mesmo alvo: a correção que o mock produz nunca é
        // suficiente, e o gate não pode aprovar.
        return {
          content: JSON.stringify({
            status: 'needs_revision',
            issues: [{ severity: 'critical', artifact: targetId, description: 'vulnerabilidade persistente', suggestedFix: 'corrigir de verdade' }],
          }),
          kind: 'critique',
        };
      }
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.notEqual(result.status, 'PASS', 'gate que reprovou duas vezes o mesmo alvo não pode aprovar o run');
  const target = result.graph.nodes.find((n) => n.id === targetId);
  assert.equal(target?.status, 'failed', 'o alvo duplamente reprovado permanece failed');
  assert.ok(target?.error && target.error.includes('orquestrador'), 'o erro registra a reprovação do gate');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('review: early stopping NUNCA corta o gate — tudo verificado, crítica opcional pulada, gate executa', async () => {
  // Cenário: modo autonomous, TODOS os nós produzem conteúdo válido. O crítico
  // adversarial (reforço opcional) é pulado pelo early stopping; o
  // orchestrator-review (condição da aprovação, não opcional) TEM que rodar.
  const baseDir = tmpDir();
  const executed: string[] = [];
  const plan = new Commander().plan({ objective: 'Auditar a segurança OWASP da API de login', mode: 'autonomous' });
  const hasCritic = plan.graph.nodes.some((n) => n.agent === 'adversarial-critic');
  assert.ok(hasCritic, 'o modo autonomous tem crítico adversarial opcional');

  const orchestrator = new Orchestrator({
    baseDir,
    command: 'test',
    task: plan.runObjective,
    category: plan.classification.category,
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode) => {
      executed.push(node.id);
      if (node.id === 'orchestrator-review' || node.agent === 'adversarial-critic') {
        return { content: JSON.stringify({ status: 'approved', issues: [] }), kind: 'critique' };
      }
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir }));
  orchestrator.setStore(new TraceStore({ baseDir }));

  const result = await orchestrator.run();
  assert.equal(result.status, 'PASS');
  assert.ok(executed.includes('orchestrator-review'), 'o gate executa mesmo com tudo verificado (não é opcional)');
  assert.ok(!executed.includes('critic'), 'o reforço adversarial opcional foi cortado pelo early stopping');
  fs.rmSync(baseDir, { recursive: true, force: true });
});

test('review: materialização acontece DEPOIS da aprovação do gate', async () => {
  // Com --output, o materialize depende do gate: só se grava o que foi
  // aprovado. Antes desta aresta, materialize e review rodavam no MESMO batch
  // e o materialize gravava a versão PRÉ-revisão — o diretório com a versão
  // reprovada, a entrega com a corrigida: dois resultados no mesmo run.
  const workspace = tmpDir();
  let reviewCalls = 0;
  const objective = 'auditar a seguranca da API';
  const plan = new Commander().plan({ objective, mode: 'orchestrated', output: 'entregas' });
  const manifestFrom = plan.graph.nodes.find(
    (n) => n.outputs?.[0] === 'fixes' && n.id !== 'orchestrator-review',
  )?.id;
  assert.ok(manifestFrom, 'o template de segurança tem nó que carrega código ("fixes")');

  const orchestrator = new Orchestrator({
    baseDir: workspace,
    workspaceDir: workspace,
    command: 'test',
    task: objective,
    category: 'security_audit',
    primaryAgent: 'security',
    skillChain: [],
    plan,
    produce: (node: GraphNode) => {
      if (node.id === 'orchestrator-review') {
        reviewCalls++;
        if (reviewCalls === 1) {
          return {
            content: JSON.stringify({
              status: 'needs_revision',
              issues: [{ severity: 'critical', artifact: manifestFrom, description: 'fix incompleto', suggestedFix: 'cobrir o caso X' }],
            }),
            kind: 'critique',
          };
        }
        return { content: JSON.stringify({ status: 'approved', issues: [] }), kind: 'critique' };
      }
      return { content: validContentFor(node.outputs?.[0]), kind: node.outputs?.[0] ?? 'raw' };
    },
  });
  orchestrator.setMemory(new MemoryStore({ baseDir: workspace }));
  orchestrator.setStore(new TraceStore({ baseDir: workspace }));

  const result = await orchestrator.run();
  const materialize = result.graph.nodes.find((n) => n.id === 'materialize');
  assert.equal(materialize?.status, 'succeeded', 'o materialize executou');
  assert.ok(reviewCalls >= 2, 'o gate revisou, reprovou, e revisou de novo a correção');
  // A aresta materialize→gate constrói a ordem topológica: o batch do gate vem
  // ANTES do batch do materialize, então só se grava o aprovado.
  const batches = result.graph.parallelBatches;
  const reviewBatch = batches.findIndex((b) => b.includes('orchestrator-review'));
  const materializeBatch = batches.findIndex((b) => b.includes('materialize'));
  assert.ok(reviewBatch >= 0 && materializeBatch > reviewBatch, `gate (batch ${reviewBatch}) deveria preceder materialize (batch ${materializeBatch})`);
  fs.rmSync(workspace, { recursive: true, force: true });
});