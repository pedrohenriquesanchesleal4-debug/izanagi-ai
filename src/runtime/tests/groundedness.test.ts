/**
 * Groundedness: o artefato cita lugares que existem?
 *
 * A Verification Engine já perguntava se o artefato tem os campos do schema e o
 * tamanho mínimo. Não perguntava se o conteúdo corresponde a alguma realidade —
 * e é por aí que a alucinação passava: um plano bem formatado, com todos os
 * campos, citando `app/controllers/users.rb` num projeto sem `app/`.
 *
 * O que estes testes protegem é a fronteira que dá VALOR à checagem: reprovar
 * quem inventou o layout, sem reprovar quem propôs arquivo novo num diretório
 * real. Errar para o lado da reprovação é pior que não checar — faz o usuário
 * desconfiar da verificação inteira.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkGroundedness, extractPathReferences } from '../verification/groundedness.js';
import { runCheck, DEFAULT_GROUNDEDNESS_RATIO, VerificationEngine } from '../verification/engine.js';
import { Commander } from '../orchestration/commander.js';
import type { TaskContract } from '../contracts/task-contract.js';

function projectRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-ground-'));
  fs.mkdirSync(path.join(root, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'db'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'routes', 'users.ts'), 'export const users = 1');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"loja"}');
  return root;
}

/* ============================ extração ============================ */

test('extração: pega caminho de arquivo e ignora rota HTTP', () => {
  const refs = extractPathReferences('Alterar src/routes/users.ts para paginar GET /users e POST /orders.');
  assert.deepEqual(refs, ['src/routes/users.ts']);
});

test('extração: ignora URL, caminho de sistema e diretório derivado', () => {
  const refs = extractPathReferences(
    'Ver https://exemplo.com/docs/api.md, /etc/nginx/nginx.conf, node_modules/react/index.js e ~/config/app.yml',
  );
  assert.deepEqual(refs, []);
});

test('extração: exige separador de diretório E extensão conhecida', () => {
  assert.deepEqual(extractPathReferences('leia package.json e o README'), [], 'nome solto é ambíguo demais');
  assert.deepEqual(extractPathReferences('config/app.zzz é o arquivo'), [], 'extensão desconhecida não é caminho de projeto');
  assert.deepEqual(extractPathReferences('use `src/db/schema.sql` aqui'), ['src/db/schema.sql']);
});

test('extração: normaliza "./" e deduplica', () => {
  const refs = extractPathReferences('./src/routes/users.ts e src/routes/users.ts são o mesmo arquivo');
  assert.deepEqual(refs, ['src/routes/users.ts']);
});

/* ============================ a fronteira que importa ============================ */

test('groundedness: arquivo NOVO em diretório real é proposta, não alucinação', () => {
  const root = projectRoot();
  const report = checkGroundedness('Criar src/routes/pagination.ts reaproveitando src/routes/users.ts.', root);
  assert.equal(report.total, 2);
  assert.equal(report.grounded, 2, 'o diretório existe: propor arquivo dentro dele é trabalho');
  assert.deepEqual(report.ungrounded, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('groundedness: layout inventado é pego', () => {
  const root = projectRoot();
  const report = checkGroundedness('Editar app/controllers/users_controller.rb e config/routes.rb.', root);
  assert.equal(report.grounded, 0);
  assert.equal(report.ungrounded.length, 2);
  assert.equal(report.ratio, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('groundedness: caminho relativo à raiz de FONTE conta como fundamentado', () => {
  const root = projectRoot();
  // Falso positivo real, encontrado rodando a checagem contra o `docs/HANDOFF.md`
  // deste repositório: ele cita `runtime/protocol/conversation.ts`, que existe
  // em `src/runtime/...`. Dezessete de dezessete referências de um documento
  // correto saíam como inventadas. Gente e modelo escrevem caminho relativo à
  // raiz de fonte, não à raiz do repositório.
  const report = checkGroundedness('O handler vive em routes/users.ts e o schema em db/schema.sql.', root);
  assert.equal(report.ungrounded.length, 0, 'resolver só contra a raiz do repo reprova documento correto');
  assert.equal(report.ratio, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('groundedness: só o PRIMEIRO nível serve de raiz — descer mais faria tudo casar', () => {
  const root = projectRoot();
  // `routes/users.ts` casa por `src/` (primeiro nível). `users.ts` sozinho
  // dentro de um segundo nível NÃO deve fazer `qualquer/coisa.ts` passar.
  const report = checkGroundedness('Editar plataforma/interno/legado/user.rb aqui.', root);
  assert.deepEqual(report.ungrounded, ['plataforma/interno/legado/user.rb']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('groundedness: texto sem caminho nenhum devolve ratio null, não zero', () => {
  const root = projectRoot();
  const report = checkGroundedness('Recomendo adotar CQRS e separar leitura de escrita.', root);
  assert.equal(report.ratio, null, 'zero seria "reprovado"; null é "não há o que conferir"');
  fs.rmSync(root, { recursive: true, force: true });
});

/* ============================ check ============================ */

test('check: sem baseDir fica UNKNOWN em vez de fingir conferência', () => {
  const out = runCheck({ kind: 'references-exist' }, { content: 'src/a/b.ts', text: 'src/a/b.ts', kind: 'raw' });
  assert.equal(out.outcome, 'unknown');
});

test('check: artefato sem caminho citado é NOT-APPLICABLE, não UNKNOWN', () => {
  const root = projectRoot();
  const out = runCheck({ kind: 'references-exist' }, { content: 'texto', text: 'Use CQRS.', kind: 'raw', baseDir: root });
  // A distinção não é cosmética: `unknown` derruba o nó para UNVERIFIED, e
  // uma ADR que não cita arquivo nenhum não está sem resposta — está
  // respondida por vacuidade. Como `unknown`, o check reprovaria todo
  // artefato de prosa por não ter o que medir nele, e ninguém o manteria ligado.
  assert.equal(out.outcome, 'not-applicable');
  assert.notEqual(out.outcome, 'unknown');
  fs.rmSync(root, { recursive: true, force: true });
});

test('verificação: critério inaplicável não derruba o nó nem infla o score', async () => {
  const root = projectRoot();
  const contract: TaskContract = {
    id: 'adr',
    objective: 'decidir a arquitetura',
    role: 'commander',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 1000 },
    verification: { deterministic: [], requireAllCriteria: false },
    acceptance: [
      { id: 'adr:size', description: 'tem conteúdo', kind: 'deterministic', check: { kind: 'min-size', bytes: 10 } },
      { id: 'adr:grounded', description: 'caminhos citados existem', kind: 'deterministic', check: { kind: 'references-exist' } },
    ],
  };
  const result = await new VerificationEngine().verify({
    contract,
    content: 'Adotar CQRS separando leitura de escrita, sem citar arquivo nenhum.',
    baseDir: root,
  });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.score, 1, 'um critério obrigatório, um aprovado');
  assert.equal(result.checks.find((c) => c.criterionId === 'adr:grounded')?.outcome, 'not-applicable');
  assert.deepEqual(result.unmet, [], 'inaplicável não é pendência');
  fs.rmSync(root, { recursive: true, force: true });
});

test('check: metade dos caminhos reais passa no piso default; abaixo dele reprova com os nomes', () => {
  const root = projectRoot();
  const meio = runCheck(
    { kind: 'references-exist' },
    { content: '', text: 'src/routes/users.ts e app/models/user.rb', kind: 'raw', baseDir: root },
  );
  assert.equal(DEFAULT_GROUNDEDNESS_RATIO, 0.5);
  assert.equal(meio.outcome, 'pass', 'artefato legítimo mistura o que existe com o que propõe criar');

  const inventado = runCheck(
    { kind: 'references-exist' },
    { content: '', text: 'app/models/user.rb, app/views/index.erb, config/routes.rb', kind: 'raw', baseDir: root },
  );
  assert.equal(inventado.outcome, 'fail');
  assert.match(inventado.message ?? '', /app\/models\/user\.rb/, 'a reprovação precisa dizer QUAL caminho não existe');
  fs.rmSync(root, { recursive: true, force: true });
});

test('check: minRatio explícito vence o default', () => {
  const root = projectRoot();
  const ctx = { content: '', text: 'src/routes/users.ts e app/models/user.rb', kind: 'raw', baseDir: root };
  assert.equal(runCheck({ kind: 'references-exist', minRatio: 1 }, ctx).outcome, 'fail');
  assert.equal(runCheck({ kind: 'references-exist', minRatio: 0.4 }, ctx).outcome, 'pass');
  fs.rmSync(root, { recursive: true, force: true });
});

/* ============================ no contrato ============================ */

test('contrato: groundedness só é cobrada quando o run leu o projeto', () => {
  const semSurvey = new Commander().plan({ objective: 'adicionar paginacao em GET /users', mode: 'orchestrated' });
  assert.equal(
    semSurvey.contracts.some((c) => c.acceptance.some((a) => a.check?.kind === 'references-exist')),
    false,
    'cobrar um layout que nunca foi mostrado ao agente é reprovar por informação que o runtime não deu',
  );

  const comSurvey = new Commander().plan({ objective: 'adicionar paginacao em GET /users', mode: 'orchestrated', survey: true });
  const cobrados = comSurvey.contracts.filter((c) => c.acceptance.some((a) => a.check?.kind === 'references-exist'));
  assert.ok(cobrados.length > 0);
  // O nó de tool tem contrato próprio e não é cobrado por groundedness.
  assert.equal(cobrados.some((c) => c.tool !== undefined), false);
});

test('contrato: o check entra também na política de verificação, não só na lista de critérios', () => {
  const plan = new Commander().plan({ objective: 'adicionar paginacao em GET /users', mode: 'orchestrated', survey: true });
  const alvo = plan.contracts.find((c) => c.acceptance.some((a) => a.check?.kind === 'references-exist'))!;
  assert.ok(alvo.verification.deterministic.some((d) => d.kind === 'references-exist'));
});

/* ============================ ponta a ponta ============================ */

test('verificação: artefato que inventa o layout do projeto é REPROVADO', async () => {
  const root = projectRoot();
  const contract: TaskContract = {
    id: 'plan',
    objective: 'planejar a paginação',
    role: 'specialist',
    inputs: [],
    constraints: [],
    expectedOutput: { kind: 'raw' },
    dependencies: [],
    priority: 'normal',
    budget: { maxTokens: 1000 },
    verification: { deterministic: [{ kind: 'references-exist' }], requireAllCriteria: true },
    acceptance: [
      {
        id: 'plan:grounded',
        description: 'os caminhos citados existem no projeto',
        kind: 'deterministic',
        check: { kind: 'references-exist' },
      },
    ],
  };

  const inventado = await new VerificationEngine().verify({
    contract,
    content: 'Editar app/controllers/users_controller.rb, app/models/user.rb e config/routes.rb.',
    baseDir: root,
  });
  assert.equal(inventado.status, 'FAILED');
  assert.equal(inventado.unmet.length, 1);

  const real = await new VerificationEngine().verify({
    contract,
    content: 'Editar src/routes/users.ts e criar src/routes/pagination.ts.',
    baseDir: root,
  });
  assert.equal(real.status, 'VERIFIED');
  fs.rmSync(root, { recursive: true, force: true });
});
