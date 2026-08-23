import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCLI } from '../../cli/index.js';
import { buildNodePrompt, parseRunArgs, runRuntime } from '../../cli/commands/run.js';
import {
  DYNAMIC_MARKER,
  MIN_CACHEABLE_TOKENS,
  splitStaticDynamic,
  estimateStaticTokens,
} from '../../runtime/llm/prompt-cache.js';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** RULES.md sintético com >4096 chars ANTES do header "## 3." (elegível a cache). */
function writeBigRules(dir: string): string {
  const body = Array.from({ length: 160 }, (_, i) => `- Golden rule ${i + 1}: mantenha o prefixo estático byte-idêntico entre chamadas para o provider cachear.`).join('\n');
  const tail = Array.from({ length: 60 }, (_, i) => `- skill específica ${i + 1} que NÃO deve entrar na fundação`).join('\n');
  const content = `# IZANAGI AI: Operating Rules\n\n## 1. Golden Rules\n${body}\n\n## 2. Communication Rules\nSeja direto e técnico.\n\n## 3. Skills\n${tail}\n`;
  const file = path.join(dir, 'RULES.md');
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

/** Isola o processo num cwd vazio (sem .agents/RULES.md nem skills reais) durante o teste. */
async function inSandbox<T>(fn: () => T | Promise<T>): Promise<T> {
  const origCwd = process.cwd();
  const sandbox = tmpDir('izanagi-capc-cwd-');
  process.chdir(sandbox);
  try {
    return await fn();
  } finally {
    process.chdir(origCwd);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

async function capture(fn: () => void | Promise<void>): Promise<{ logs: string[]; errors: string[] }> {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (m?: unknown) => { logs.push(String(m)); };
  console.error = (m?: unknown) => { errors.push(String(m)); };
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.error = origError;
  }
  return { logs, errors };
}

/** Artefato mock rico: menciona os campos required de TODOS os schemas conhecidos, sem padrões stub. */
const MOCK_ARTIFACT = [
  '# Artefato de validação do pipeline',
  '',
  '- title: Implementação completa da funcionalidade solicitada.',
  '- functional: comportamento funcional descrito ponta a ponta com tratamento de erros.',
  '- acceptance: critérios de aceite verificáveis por teste automatizado.',
  '- context: contexto arquitetural, decision registrada e layers afetadas.',
  '- model: modelo de dados com relations explícitas entre entidades.',
  '- method GET path /api/exemplo com request e response tipados.',
  '- severity baixa; vulnerabilities auditadas e remediation proposta.',
  '- unit e integration cobertos; scenarios documentados.',
  '- steps de execução, files entregues, verdict positivo com score alto.',
  '- metrics consolidadas, summary executivo, results completos.',
  '- findings catalogados com sources citadas para rastreabilidade.',
  '- runId e spans registrados para rastreabilidade completa da execução.',
].join('\n');

test('buildNodePrompt: RULES.md grande → marker presente e estático elegível ao cache', async () => {
  await inSandbox(() => {
    const baseDir = tmpDir('izanagi-capc-base-');
    try {
      writeBigRules(baseDir);
      const prompt = buildNodePrompt(
        { id: 'n1', kind: 'agent', outputs: ['raw'] },
        { task: 'tarefa de teste', agent: {}, skillChain: [] },
        baseDir,
      );
      assert.ok(prompt.includes(DYNAMIC_MARKER), 'marker CAPC esperado no prompt');
      const split = splitStaticDynamic(prompt);
      assert.equal(split.hasMarker, true);
      assert.match(split.staticText, /Regra suprema/);
      assert.match(split.staticText, /FUNDAÇÃO OPERACIONAL \(RULES\.md · seções 1–2\)/);
      assert.match(split.staticText, /Golden rule 1:/);
      assert.doesNotMatch(split.staticText, /skill específica 1/, 'corte deve parar no header "## 3."');
      assert.match(split.dynamicText, /Nó em execução: "n1"/);
      assert.ok(
        estimateStaticTokens(split.staticText) >= MIN_CACHEABLE_TOKENS,
        `estático (${estimateStaticTokens(split.staticText)} tokens) deve atingir o piso ${MIN_CACHEABLE_TOKENS}`,
      );
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

test('buildNodePrompt: bloco estático BYTE-IDÊNTICO entre nós distintos (volátil difere)', async () => {
  await inSandbox(() => {
    const baseDir = tmpDir('izanagi-capc-eq-');
    try {
      writeBigRules(baseDir);
      const mk = (id: string, output: string) =>
        buildNodePrompt({ id, kind: 'agent', outputs: [output] }, { task: 'mesma tarefa', agent: {}, skillChain: [] }, baseDir);
      const a = splitStaticDynamic(mk('planejar', 'implementation-plan'));
      const b = splitStaticDynamic(mk('implementar', 'raw'));
      assert.equal(a.hasMarker && b.hasMarker, true);
      assert.equal(a.staticText, b.staticText, 'prefixo estático deve ser igual entre nós (condição de cache)');
      assert.notEqual(a.dynamicText, b.dynamicText, 'parte volátil deve carregar o nó');
      assert.match(a.dynamicText, /"planejar"/);
      assert.match(b.dynamicText, /"implementar"/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

test('--no-cache-foundation: flag parseada e buildNodePrompt volta ao formato pré-wave (sem marker/fundação)', async () => {
  const parsed = parseRunArgs(['--no-cache-foundation']);
  assert.equal(parsed.noCacheFoundation, true);
  assert.equal(parseRunArgs([]).noCacheFoundation, false);

  await inSandbox(() => {
    const baseDir = tmpDir('izanagi-capc-off-');
    try {
      writeBigRules(baseDir);
      const prompt = buildNodePrompt(
        { id: 'n1', kind: 'agent', outputs: ['raw'] },
        { task: 'tarefa', agent: {}, skillChain: [] },
        baseDir,
        { noCacheFoundation: true },
      );
      assert.doesNotMatch(prompt, new RegExp(DYNAMIC_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.doesNotMatch(prompt, /FUNDAÇÃO OPERACIONAL/, 'fundação não deve entrar com a flag');
      assert.match(prompt, /# IZANAGI AI — Adaptive Runtime · Nó "n1"/, 'header pré-wave com o nó embutido');
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

test('sem RULES.md: sem marker, sem fundação e sem crash (guard retrocompatível)', async () => {
  await inSandbox(() => {
    const baseDir = tmpDir('izanagi-capc-empty-');
    try {
      const prompt = buildNodePrompt(
        { id: 'n1', kind: 'agent', outputs: ['raw'] },
        { task: 'tarefa', agent: {}, skillChain: [] },
        baseDir,
      );
      assert.equal(prompt.includes(DYNAMIC_MARKER), false);
      assert.doesNotMatch(prompt, /FUNDAÇÃO OPERACIONAL/);
      assert.match(prompt, /# IZANAGI AI — Adaptive Runtime · Nó "n1"/);
      assert.match(prompt, /## TAREFA\ntarefa/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

test('telemetria: client mockado com cachedTokens → linha final somada + verbose por nó', async () => {
  await inSandbox(async () => {
    const baseDir = tmpDir('izanagi-capc-tel-');
    try {
      let calls = 0;
      const fakeClient = {
        configuredProviders: () => ['openai'],
        complete: async () => {
          calls++;
          return {
            text: MOCK_ARTIFACT,
            tokens: 500,
            latencyMs: 1,
            model: 'mock-model',
            provider: 'openai',
            cachedTokens: 250,
          };
        },
      };
      const opts = {
        task: 'escrever testes unitarios qa',
        category: 'testing',
        agentId: 'qa',
        skillChain: [] as string[],
        agent: { name: 'qa' } as any,
        verbose: false,
        client: fakeClient,
      };

      // Run silencioso: só a linha final agregada.
      const out = await capture(() => runRuntime(baseDir, { ...opts }));
      const all = out.logs.join('\n');
      assert.ok(calls >= 1, 'client mockado deve ter sido chamado');
      const m = all.match(/\[tokens\] entrada (\d+) · cache-hit (\d+) \((\d+)% do input\)/);
      assert.ok(m, `linha agregada ausente no output:\n${all}`);
      assert.equal(Number(m[1]), calls * 500, 'entrada deve somar result.tokens de todos os nós');
      assert.equal(Number(m[2]), calls * 250, 'cache-hit deve somar cachedTokens ?? 0');
      assert.equal(Number(m[3]), 50, 'percentual do input servido do cache');
      assert.doesNotMatch(all, /nó ".*": entrada 500/, 'verbose desligado não imprime linha por nó');

      // Run verbose: uma linha por chamada.
      calls = 0;
      const outV = await capture(() => runRuntime(baseDir, { ...opts, verbose: true }));
      const perNode = outV.logs.filter((l) => l.includes('[tokens]') && l.includes(': entrada 500'));
      assert.equal(perNode.length, calls, 'verbose deve imprimir exatamente uma linha por nó produzido');
      assert.match(outV.logs.join('\n'), /\[tokens\] entrada \d+ · cache-hit \d+ \(\d+% do input\)/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

test('telemetria headless: nenhuma linha [tokens] no output (nem agregada, nem por nó)', async () => {
  await inSandbox(async () => {
    const baseDir = tmpDir('izanagi-capc-headless-');
    try {
      let called = false;
      const headlessClient = {
        configuredProviders: () => [],
        complete: async () => {
          called = true;
          return { text: MOCK_ARTIFACT, tokens: 500, latencyMs: 1, model: 'x', provider: 'openai' };
        },
      };
      const out = await capture(() =>
        runRuntime(baseDir, {
          task: 'escrever testes unitarios qa',
          category: 'testing',
          agentId: 'qa',
          skillChain: [],
          agent: { name: 'qa' } as any,
          verbose: true,
          client: headlessClient,
        }),
      );
      assert.equal(called, false, 'headless nunca deve chamar o LLM');
      assert.equal(out.logs.some((l) => l.includes('[tokens]')), false, '[tokens] é proibido em modo headless');
      assert.match(out.logs.join('\n'), /Modo headless/);
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });
});

test('E2E --prompt-only: izanagi-prompt.md válido gerado no repo-fonte (sem marker, caminho pré-wave)', async () => {
  const promptPath = path.resolve(process.cwd(), 'izanagi-prompt.md');
  try {
    const out = await capture(() => runCLI(['run', 'corrigir bug de login', '--prompt-only']));
    assert.match(out.logs.join('\n'), /Ready-to-use AI prompt generated/);
    assert.ok(fs.existsSync(promptPath));
    const md = fs.readFileSync(promptPath, 'utf-8');
    assert.match(md, /IZANAGI AI READY-TO-USE PROMPT/);
    assert.match(md, /## USER TASK/);
    assert.match(md, /## COMPUTED SKILL CHAIN/);
    assert.match(md, /### SKILL: /, 'pelo menos uma skill resolvida na chain');
    assert.equal(md.includes(DYNAMIC_MARKER), false, '--prompt-only segue no formato pronto para colar (sem marker)');
  } finally {
    fs.rmSync(promptPath, { force: true });
  }
});
