import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ExecutionController,
  classifyDetailedError,
  computeBackoffWithJitter,
  evaluateDelegationBenefit,
  formatValidationCorrection,
  hashToolArgs,
  normalizeToolArgs,
  parseRetryAfterMs,
  resolveModeAlias,
  strategyForMode,
} from '../orchestration/execution-controller.js';
import { Orchestrator } from '../orchestrator.js';
import { Commander } from '../orchestration/commander.js';
import { MemoryStore } from '../memory/store.js';
import { DecisionJournal } from '../memory/decisions.js';
import { classifyTask, parseRunArgs, resolveChainForCategory } from '../../cli/commands/run.js';
import type { IzanagiEvent } from '../observability/events.js';

function tmpDir(prefix = 'izanagi-ec-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('ExecutionController: normaliza argumentos de tools de forma determinística e deduplica leituras idempotentes', () => {
  const dir = tmpDir();
  try {
    const h1 = hashToolArgs('fs.read', { path: 'src\\index.ts', encoding: 'utf-8' });
    const h2 = hashToolArgs('fs.read', { encoding: 'utf-8', path: './src/index.ts' });
    assert.equal(h1.argsHash, h2.argsHash, 'ordem de chaves e separadores de caminho devem produzir o mesmo hash');
    assert.deepEqual(
      JSON.parse(normalizeToolArgs('fs.read', { b: 2, path: 'foo\\bar  ' })),
      { tool: 'fs.read', input: { b: 2, path: 'foo/bar' } },
    );

    const ctrl = new ExecutionController({
      runId: 'run-dedup',
      objective: 'ler arquivo e validar',
      mode: 'orchestrated',
    });

    // 1ª chamada: não duplicada, sem cache
    const firstCheck = ctrl.checkToolCall('fs.read', { path: 'package.json' }, 'n1');
    assert.equal(firstCheck.duplicate, false);
    assert.equal(firstCheck.reusable, false);

    ctrl.recordToolExecution({
      toolId: 'fs.read',
      rawArgs: { path: 'package.json' },
      nodeId: 'n1',
      ok: true,
      result: '{"name":"izanagi-ai"}',
      durationMs: 4,
    });

    // 2ª chamada idêntica com o mesmo estado do workspace: reaproveita resultado em memória
    const secondCheck = ctrl.checkToolCall('fs.read', { path: './package.json' }, 'n2');
    assert.equal(secondCheck.duplicate, true);
    assert.equal(secondCheck.reusable, true);
    assert.equal(secondCheck.cachedResult, '{"name":"izanagi-ai"}');
    assert.equal(ctrl.snapshot().toolRepeatsAvoided, 1);

    // Após escrita no arquivo, a revisão do workspace avança e invalida o cache de leitura
    ctrl.recordToolExecution({
      toolId: 'fs.write',
      rawArgs: { path: 'package.json', content: '{"name":"izanagi-ai","version":"2"}' },
      nodeId: 'n2',
      ok: true,
      result: { written: 'package.json' },
      durationMs: 3,
    });

    const thirdCheck = ctrl.checkToolCall('fs.read', { path: 'package.json' }, 'n3');
    assert.equal(thirdCheck.reusable, false, 'escrita no workspace deve invalidar cache de leitura anterior');
    assert.ok(ctrl.snapshot().modifiedFiles.includes('package.json'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ExecutionController: bloqueia tool que retorna erro repetidamente com os mesmos argumentos', () => {
  const ctrl = new ExecutionController({
    runId: 'run-tool-err',
    objective: 'executar comando',
    mode: 'assisted',
  });

  ctrl.recordToolExecution({
    toolId: 'code.execute',
    rawArgs: { code: 'throw new Error("boom")' },
    nodeId: 'exec-1',
    ok: false,
    error: 'exit code 1: boom',
    durationMs: 12,
  });

  const repeat = ctrl.checkToolCall('code.execute', { code: 'throw new Error("boom")' }, 'exec-1');
  assert.equal(repeat.duplicate, true);
  assert.equal(repeat.stagnantRepeat, true);
  assert.match(repeat.reason ?? '', /já falhou com os mesmos argumentos/);
  assert.ok(ctrl.snapshot().stagnationSignals.some((s) => s.kind === 'repeated_tool_no_change'));
});

test('ExecutionController: detecta repetição do mesmo plano e repetição da mesma saída de etapa', () => {
  const ctrl = new ExecutionController({
    runId: 'run-plan-loop',
    objective: 'implementar feature X',
    mode: 'autonomous',
  });

  const p1 = ctrl.recordPlanUpdate('g1', 'autonomous', [
    { id: 'architect', agent: 'architect', status: 'pending' },
    { id: 'implement', agent: 'senior-engineer', status: 'pending' },
  ]);
  assert.equal(p1.changed, true);

  const p2 = ctrl.recordPlanUpdate('g1', 'autonomous', [
    { id: 'architect', agent: 'architect', status: 'pending' },
    { id: 'implement', agent: 'senior-engineer', status: 'pending' },
  ]);
  assert.equal(p2.changed, false);
  assert.match(p2.stagnation?.detail ?? '', /mesma topologia ativa/);
  assert.ok(ctrl.snapshot().stagnationSignals.some((s) => s.kind === 'same_plan_repeated'));

  // Saída idêntica na mesma etapa sem evolução de score
  const s1 = ctrl.recordStageOutcome({
    nodeId: 'implement',
    attempt: 1,
    kind: 'code-patch',
    contentHash: 'hash-abc',
    valid: false,
    score: 0.3,
    unmetCriteria: ['c1', 'c2', 'c3'],
  });
  assert.equal(s1.progressed, false);

  const s2 = ctrl.recordStageOutcome({
    nodeId: 'implement',
    attempt: 2,
    kind: 'code-patch',
    contentHash: 'hash-abc',
    valid: false,
    score: 0.3,
    unmetCriteria: ['c1', 'c2', 'c3'],
  });
  assert.equal(s2.progressed, false);
  assert.equal(s2.stagnation?.kind, 'same_artifact_hash');
});

test('ExecutionController: previne handoff circular A -> B -> A e avalia benefício de delegação', () => {
  const ctrl = new ExecutionController({
    runId: 'run-handoff',
    objective: 'corrigir falha de integração',
    mode: 'orchestrated',
  });

  const h1 = ctrl.recordHandoff('senior-engineer', 'bug-hunter', 'node-1', 'investigar erro');
  assert.equal(h1.allowed, true);

  const h2 = ctrl.recordHandoff('bug-hunter', 'senior-engineer', 'node-1', 'devolver para engineer');
  assert.equal(h2.allowed, false, 'deve bloquear ciclo A -> B -> A no mesmo nó');
  assert.equal(h2.cycleDetected, true);
  assert.ok(ctrl.snapshot().stagnationSignals.some((s) => s.kind === 'handoff_cycle'));

  // Benefício de delegação
  const trivialDel = evaluateDelegationBenefit({
    complexity: 1,
    domainsCount: 1,
    wordCount: 5,
    isQuestionOrTrivial: true,
  });
  assert.equal(trivialDel.shouldDelegate, false);
  assert.equal(trivialDel.recommendedMode, 'direct');

  const shortFixDel = evaluateDelegationBenefit({
    complexity: 2,
    domainsCount: 2,
    wordCount: 7,
    isQuestionOrTrivial: false,
  });
  assert.equal(shortFixDel.shouldDelegate, false);
  assert.equal(shortFixDel.recommendedMode, 'assisted');
});

test('ExecutionController: classifica as 14 categorias de erro e calcula backoff com Retry-After', () => {
  assert.equal(classifyDetailedError('429 Too Many Requests: rate limit reached').category, 'rate_limit');
  assert.equal(classifyDetailedError('Request timed out after 30000ms (ETIMEDOUT)').category, 'timeout');
  assert.equal(classifyDetailedError('Failed to authenticate: OAuth session expired').category, 'auth_failure');
  assert.equal(classifyDetailedError('permissão negada pela PolicyEngine').category, 'permission_denied');
  assert.equal(classifyDetailedError('executor indisponível: claude-cli saiu com código 1').category, 'tool_unavailable');
  assert.equal(classifyDetailedError('Cannot find module "zod"').category, 'missing_dependency');
  assert.equal(classifyDetailedError('missing env variable DATABASE_URL').category, 'configuration_error');
  assert.equal(classifyDetailedError('validação falhou: campo obrigatório ausente').category, 'incorrect_model_output');
  assert.equal(classifyDetailedError('suíte do projeto reprovada: 2 assertions failed').category, 'test_failure');
  assert.equal(classifyDetailedError('TypeError: Cannot read properties of undefined').category, 'code_error');
  assert.equal(classifyDetailedError('503 Service Unavailable').category, 'transient_network');

  assert.equal(parseRetryAfterMs('429 rate limit; Retry-After: 3'), 3000);
  assert.equal(
    computeBackoffWithJitter(500, 1, { factor: 1.6, maxMs: 60_000, retryAfterMs: 4000, jitterRatio: 0 }),
    4000,
  );
});

test('Orchestrator + ExecutionController: injeta feedback estruturado de validação no retry e converge', async () => {
  const dir = tmpDir('izanagi-retry-fb-');
  try {
    const plan = new Commander().plan({
      objective: 'Criar auditoria de segurança OWASP para o endpoint de login',
      mode: 'orchestrated',
    });

    const seenCorrections: Array<string | undefined> = [];
    let securityCalls = 0;

    const events: IzanagiEvent[] = [];
    const orch = new Orchestrator({
      baseDir: process.cwd(),
      stateDir: dir,
      workspaceDir: dir,
      command: 'run',
      task: 'Criar auditoria de segurança OWASP para o endpoint de login',
      category: 'security_audit',
      primaryAgent: 'security',
      skillChain: ['security-privacy'],
      plan,
      onEvent: (e) => events.push(e),
      produce: (node, ctx) => {
        if (node.outputs?.[0] === 'security-report') {
          securityCalls++;
          seenCorrections.push(typeof node.metadata?.correction === 'string' ? node.metadata.correction : undefined);
          if (securityCalls === 1) {
            // 1ª tentativa: incompleta (sem severity/vulnerabilities/remediation)
            return {
              kind: 'security-report',
              content: 'Relatório curto sem os campos exigidos pelo contrato.',
              tokens: 200,
              model: 'mock-model',
            };
          }
        }
        // 2ª tentativa (e demais nós): completa (> 300 bytes e todos os campos de contrato)
        return {
          kind: node.outputs?.[0] ?? 'raw',
          content: [
            '# Relatório de Segurança OWASP — Endpoint de Autenticação (/login)',
            '- severity: HIGH (CVSS 8.2 — exposição de credenciais e brute-force)',
            '- vulnerabilities: SQL Injection na cláusula de busca de usuário e ausência de rate limit por IP/conta no endpoint POST /login',
            '- remediation: substituir interpolação por prepared statements parametrizados, aplicar Argon2id e rate limit com janela deslizante',
            '- context: serviço de autenticação central da API REST sob tráfego público',
            '- decision: isolar middleware de validação Zod + rate limiter Redis antes do controller',
            '- layers: presentation (middleware), application (AuthService), infrastructure (UserRepository)',
            '- steps: 1. parametrizar query; 2. adicionar validação Zod; 3. ativar rate-limit; 4. criar suíte de regressão',
            '- files: src/auth/login.ts, src/middleware/rate-limit.ts, tests/auth.test.ts',
            '- verdict: PASS',
            '- score: 0.95',
            '- metrics: correctness=0.95, security=0.95, coverage=0.90',
          ].join('\n'),
          tokens: 300,
          model: 'mock-model',
        };
      },
    });

    const res = await orch.run();
    assert.equal(res.status, 'PASS');
    assert.equal(securityCalls, 2, 'nó deve ter sido reexecutado exatamente 1 vez');
    assert.equal(seenCorrections[0], undefined, '1ª tentativa não tem correção prévia');
    assert.ok(
      seenCorrections[1] && seenCorrections[1].includes('Critérios de aceitação reprovados'),
      `2ª tentativa deve receber os critérios exatos reprovados, recebeu: ${seenCorrections[1]}`,
    );
    assert.ok(events.some((e) => e.name === 'validation.failed'), 'deve emitir evento validation.failed');
    assert.ok(events.some((e) => e.name === 'retry.scheduled'), 'deve emitir evento retry.scheduled');
    assert.ok(events.some((e) => e.name === 'progress.detected'), 'deve emitir evento progress.detected');
    assert.ok(res.executionState, 'OrchestrationResult deve incluir executionState snapshot');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Orchestrator + ExecutionController: falha exclusiva de autenticação/infraestrutura aborta na 1ª tentativa e NÃO contamina a memória', async () => {
  const dir = tmpDir('izanagi-infra-mem-');
  try {
    const plan = new Commander().plan({
      objective: 'Implementar função pura de validação de CPF',
      mode: 'direct',
    });

    const orch = new Orchestrator({
      baseDir: process.cwd(),
      stateDir: dir,
      workspaceDir: dir,
      command: 'run',
      task: 'Implementar função pura de validação de CPF',
      category: 'implementation',
      primaryAgent: 'senior-engineer',
      skillChain: ['clean-code-validator'],
      plan,
      produce: () => {
        throw new Error(
          'executor indisponível: claude-cli saiu com código 1 — Failed to authenticate. API Error: 401 {"error":{"message":"OAuth session expired"}}',
        );
      },
    });

    const res = await orch.run();
    assert.equal(res.status, 'FAIL');
    // Não deve ter injetado testResults=1 falso quando todos os nós falharam sem rodar testes
    assert.equal(res.evaluation?.metrics.testResults, undefined);

    const mem = new MemoryStore({ baseDir: dir });
    const stats = mem.agentStats('senior-engineer');
    assert.equal(
      stats?.runs ?? 0,
      0,
      'falha de OAuth/infraestrutura não deve penalizar as estatísticas do agente na memória',
    );
    const journal = new DecisionJournal({ baseDir: dir });
    const burned = journal.findRelevant('Implementar função pura de validação de CPF', { kind: 'agent-routing' });
    assert.ok(
      burned.every((d) => d.outcome?.status !== 'FAIL'),
      'DecisionJournal não deve marcar agente como FAIL quando a causa foi infraestrutura/autenticação',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI classifyTask & mode aliases: "Qual a capital da França?" não casa com "api" e --mode fast|standard|deep funciona', () => {
  const fr = classifyTask('Qual a capital da França?');
  assert.equal(fr.category, 'question', '"capital" jamais deve acionar categoria backend por conter a substring "api"');
  const chain = resolveChainForCategory(
    {
      chains: {
        saas: ['memoria-projeto', 'architect', 'database', 'frontend', 'editorial-layout', 'conversion-copywriting'],
        feature: ['memoria-projeto', 'frontend', 'qa'],
      },
    },
    fr.category,
  );
  assert.deepEqual(chain, ['conciseness'], 'pergunta simples deve carregar chain mínima em vez da chain de SaaS');

  // Feature comum em senior-engineer resolve para `feature`, não para `saas`
  const feat = classifyTask('Criar endpoint REST para listagem de pedidos');
  assert.equal(feat.category, 'backend');
  const featChain = resolveChainForCategory(
    {
      chains: {
        saas: ['memoria-projeto', 'architect', 'database', 'frontend', 'editorial-layout', 'conversion-copywriting'],
        feature: ['memoria-projeto', 'frontend', 'qa'],
      },
    },
    feat.category,
  );
  assert.deepEqual(featChain, ['memoria-projeto', 'frontend', 'qa']);

  // Aliases de modo na CLI (--mode fast|standard|deep)
  assert.equal(resolveModeAlias('fast'), 'direct');
  assert.equal(resolveModeAlias('standard'), 'orchestrated');
  assert.equal(resolveModeAlias('deep'), 'autonomous');
  assert.equal(strategyForMode('direct'), 'fast');
  assert.equal(strategyForMode('assisted', 2), 'fast');
  assert.equal(strategyForMode('assisted', 3), 'standard');
  assert.equal(strategyForMode('orchestrated'), 'standard');
  assert.equal(strategyForMode('autonomous'), 'deep');

  assert.equal(parseRunArgs(['--mode', 'fast', 'pergunta']).mode, 'direct');
  assert.equal(parseRunArgs(['--mode=standard', 'tarefa']).mode, 'orchestrated');
  assert.equal(parseRunArgs(['--mode=deep', 'arquitetura']).mode, 'autonomous');

  const formatted = formatValidationCorrection({
    nodeId: 'n1',
    attempt: 1,
    errorCategory: 'incorrect_model_output',
    unmetCriteria: ['campo severity ausente'],
    errorMessage: 'validação falhou',
    plannedChange: 'incluir campo severity',
  });
  assert.match(formatted, /Critérios de aceitação reprovados/);
  assert.match(formatted, /campo severity ausente/);
});
