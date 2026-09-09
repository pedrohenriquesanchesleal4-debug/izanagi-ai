import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AgentCLIAdapter,
  AGENT_CLI_PROVIDERS,
  agentCLIStatus,
  claudeCLISpec,
  currentDepth,
  DEFAULT_MAX_DEPTH,
  findExecutable,
  isSuppressedInTests,
  READ_TOOLS,
  runAgentCLI,
  SYSTEM_OPEN,
  TASK_OPEN,
  toolPolicyFromEnv,
  WRITE_TOOLS,
  type AgentCLIRequest,
  type AgentCLISpec,
} from '../llm/agent-cli.js';
import {
  AGENT_CLI_MIN_RECOMMENDED_BUDGET,
  AGENT_CLI_OVERHEAD_TOKENS,
  AGENT_CLI_TOKENS_PER_NODE,
  LLMClient,
  measuredTokensPerNode,
  recommendedBudget,
} from '../llm/client.js';
import { cacheKey } from '../cache/response-cache.js';
import { AgentCapabilityRegistry } from '../registry/capabilities.js';
import { validateArtifact } from '../contracts/artifacts.js';
import { surveyProject } from '../tools/project-survey.js';
import { parseRunArgs } from '../../cli/commands/run.js';
import { ModelRouter, DEFAULT_PROVIDERS } from '../model/router.js';

/* ============================ FIXTURES REAIS ============================ */

/**
 * Saída REAL de `claude -p --output-format json` (CLI v2.1.266), reduzida aos
 * campos que o adapter consome. Fixture capturada da máquina, não inventada:
 * é o contrato que o parse tem que honrar, e um teste contra JSON imaginado
 * provaria apenas que o parse concorda consigo mesmo.
 */
const CLAUDE_SUCCESS_JSON = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'OK',
  total_cost_usd: 0.005222,
  duration_ms: 2086,
  num_turns: 1,
  usage: {
    input_tokens: 4095,
    output_tokens: 38,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
  modelUsage: {
    'claude-haiku-4-5-20251001': { canonicalModel: 'claude-haiku-4-5', costUSD: 0.005222 },
  },
  permission_denials: [],
});

/** Saída REAL de um run abortado por `--max-budget-usd` (mesmo CLI). */
const CLAUDE_BUDGET_JSON = JSON.stringify({
  type: 'result',
  subtype: 'error_max_budget_usd',
  is_error: true,
  result: null,
  terminal_reason: 'budget_exhausted',
  total_cost_usd: 0.0008587,
  num_turns: 1,
});

/** Saída REAL com prompt cache quente (cache_read populado). */
const CLAUDE_CACHED_JSON = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'artefato',
  total_cost_usd: 0.041916,
  usage: {
    input_tokens: 10,
    output_tokens: 42,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 20848,
  },
});

/* ============================ SPEC FALSO (spawn de verdade) ============================ */

/**
 * CLI falso para exercitar o caminho de processo REAL (spawn, stdin, stdout,
 * exit code, env, timeout) sem gastar cota de nenhum modelo. O binário é o
 * próprio `node`: existe no PATH nas duas plataformas e não precisa de bit de
 * execução nem de extensão no Windows.
 */
function fakeSpec(scriptPath: string, extra: string[] = []): AgentCLISpec {
  return {
    provider: 'fake-cli',
    bin: 'node',
    label: 'Fake CLI',
    install: 'instale o fake',
    buildArgs: (req) => [scriptPath, ...extra, '--model', req.model, '--policy', req.toolPolicy],
    buildStdin: (req) => claudeCLISpec.buildStdin(req),
    parse: (stdout) => claudeCLISpec.parse(stdout),
  };
}

function writeScript(name: string, body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-agentcli-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

/** Script que devolve o JSON de sucesso e, opcionalmente, ecoa o que recebeu. */
const ECHO_SCRIPT = `
let data = '';
process.stdin.on('data', (c) => { data += c; });
process.stdin.on('end', () => {
  const out = {
    type: 'result', subtype: 'success', is_error: false,
    result: JSON.stringify({ argv: process.argv.slice(2), stdin: data, depth: process.env.IZANAGI_AGENT_CLI_DEPTH ?? null }),
    total_cost_usd: 0.001,
    usage: { input_tokens: 100, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  };
  process.stdout.write(JSON.stringify(out));
});
`;

/**
 * Ambiente que LIBERA o executor: dentro do test runner ele é suprimido por
 * padrão (ver isSuppressedInTests), e estes testes precisam justamente
 * exercitar o caminho de processo.
 */
function liveEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { ...process.env, IZANAGI_AGENT_CLI_IN_TESTS: '1', ...extra };
}

/** `dist/runtime/tests/x.test.js` -> raiz do repositório. */
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');

const REQ: AgentCLIRequest = { model: 'claude-haiku-4-5', prompt: 'objetivo', toolPolicy: 'none' };

/* ============================ DETECÇÃO ============================ */

test('agent-cli: findExecutable acha o binário no PATH respeitando PATHEXT', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-path-'));
  const ext = process.platform === 'win32' ? '.CMD' : '';
  fs.writeFileSync(path.join(dir, `faketool${ext}`), '', 'utf8');

  const env = { PATH: dir, PATHEXT: '.COM;.EXE;.CMD' } as NodeJS.ProcessEnv;
  assert.equal(findExecutable('faketool', env), path.join(dir, `faketool${ext}`));
  assert.equal(findExecutable('inexistente-xyz', env), null);
});

test('agent-cli: diretório inexistente no PATH não quebra a busca', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-path-'));
  const env = { PATH: [path.join(dir, 'nao-existe'), dir].join(path.delimiter), PATHEXT: '.CMD' } as NodeJS.ProcessEnv;
  assert.equal(findExecutable('nada', env), null);
});

test('agent-cli: binário ausente deixa o adapter não configurado com motivo acionável', () => {
  const adapter = new AgentCLIAdapter(claudeCLISpec, { env: { PATH: '' } });
  assert.equal(adapter.configured, false);
  assert.match(adapter.unavailableReason ?? '', /não encontrado no PATH/);
  assert.match(adapter.unavailableReason ?? '', /Claude Code/);
});

test('agent-cli: IZANAGI_AGENT_CLI_DISABLED desliga mesmo com binário presente', () => {
  const script = writeScript('fake.js', ECHO_SCRIPT);
  const adapter = new AgentCLIAdapter(fakeSpec(script), {
    env: liveEnv({ IZANAGI_AGENT_CLI_DISABLED: '1' }),
  });
  assert.equal(adapter.configured, false);
  assert.match(adapter.unavailableReason ?? '', /IZANAGI_AGENT_CLI_DISABLED/);
});

test('agent-cli: teto de profundidade impede recursão agente -> izanagi -> agente', () => {
  const script = writeScript('fake.js', ECHO_SCRIPT);
  const noDepth = new AgentCLIAdapter(fakeSpec(script), { env: liveEnv() });
  assert.equal(noDepth.configured, true);
  assert.equal(currentDepth({} as NodeJS.ProcessEnv), 0);

  const atCeiling = new AgentCLIAdapter(fakeSpec(script), {
    env: liveEnv({ IZANAGI_AGENT_CLI_DEPTH: String(DEFAULT_MAX_DEPTH) }),
  });
  assert.equal(atCeiling.configured, false);
  assert.match(atCeiling.unavailableReason ?? '', /profundidade de recursão/);
});

test('agent-cli: agentCLIStatus é determinístico e cobre todo provider registrado', () => {
  const status = agentCLIStatus({ PATH: '' } as NodeJS.ProcessEnv);
  assert.equal(status.length, AGENT_CLI_PROVIDERS.length);
  for (const s of status) {
    assert.equal(s.available, false);
    assert.ok(s.reason && s.reason.length > 0);
    assert.ok(s.install.length > 0);
  }
});

test('agent-cli: dentro de test runner o executor fica suprimido por padrão', () => {
  const script = writeScript('fake.js', ECHO_SCRIPT);
  // Sem IZANAGI_AGENT_CLI_IN_TESTS: é o ambiente que `npm test` produz.
  const suprimido = new AgentCLIAdapter(fakeSpec(script), {
    env: { ...process.env, NODE_TEST_CONTEXT: 'child-v8', IZANAGI_AGENT_CLI_IN_TESTS: '' },
  });
  assert.equal(isSuppressedInTests({ NODE_TEST_CONTEXT: 'child-v8' } as NodeJS.ProcessEnv), true);
  assert.equal(isSuppressedInTests({} as NodeJS.ProcessEnv), false);
  assert.equal(suprimido.configured, false, 'npm test não pode gastar cota real da assinatura');
  assert.match(suprimido.unavailableReason ?? '', /test runner/);

  const liberado = new AgentCLIAdapter(fakeSpec(script), { env: liveEnv() });
  assert.equal(liberado.configured, true);
});

/* ============================ POLÍTICA DE TOOLS ============================ */

test('agent-cli: política default é `none` e exige o literal `write` para liberar escrita', () => {
  assert.equal(toolPolicyFromEnv({} as NodeJS.ProcessEnv), 'none');
  assert.equal(toolPolicyFromEnv({ IZANAGI_AGENT_CLI_TOOLS: '' } as NodeJS.ProcessEnv), 'none');
  assert.equal(toolPolicyFromEnv({ IZANAGI_AGENT_CLI_TOOLS: '1' } as NodeJS.ProcessEnv), 'none');
  assert.equal(toolPolicyFromEnv({ IZANAGI_AGENT_CLI_TOOLS: 'true' } as NodeJS.ProcessEnv), 'none');
  // Espaco/caixa nao mudam a intencao declarada: ' Read ' vale 'read'.
  assert.equal(toolPolicyFromEnv({ IZANAGI_AGENT_CLI_TOOLS: ' Read ' } as NodeJS.ProcessEnv), 'read');
  assert.equal(toolPolicyFromEnv({ IZANAGI_AGENT_CLI_TOOLS: 'read' } as NodeJS.ProcessEnv), 'read');
  assert.equal(toolPolicyFromEnv({ IZANAGI_AGENT_CLI_TOOLS: 'WRITE' } as NodeJS.ProcessEnv), 'write');
});

test('agent-cli: argv de política `none` não carrega nenhuma tool nem permissão de escrita', () => {
  const args = claudeCLISpec.buildArgs(REQ);
  assert.ok(args.includes('--restricted'));
  const i = args.indexOf('--tools');
  assert.notEqual(i, -1);
  assert.equal(args[i + 1], '');
  assert.equal(args.includes('--permission-mode'), false);
  assert.equal(args.includes('--dangerously-skip-permissions'), false);
  assert.equal(args.includes('--allow-dangerously-skip-permissions'), false);
  // Sem estado residual entre nós do grafo.
  assert.ok(args.includes('--no-session-persistence'));
  assert.ok(args.includes('--strict-mcp-config'));
  // Modo print com JSON: é de onde vem a telemetria de token/custo.
  assert.ok(args.includes('--print'));
  assert.equal(args[args.indexOf('--output-format') + 1], 'json');
  assert.equal(args[args.indexOf('--model') + 1], 'claude-haiku-4-5');
});

test('agent-cli: política `read` libera só leitura, sem acceptEdits', () => {
  const args = claudeCLISpec.buildArgs({ ...REQ, toolPolicy: 'read' });
  assert.equal(args[args.indexOf('--tools') + 1], READ_TOOLS.join(','));
  assert.equal(args.includes('--permission-mode'), false);
  assert.equal(READ_TOOLS.includes('Write'), false);
  assert.equal(READ_TOOLS.includes('Bash'), false);
});

test('agent-cli: política `write` libera escrita de arquivo e nunca shell', () => {
  const args = claudeCLISpec.buildArgs({ ...REQ, toolPolicy: 'write' });
  assert.equal(args[args.indexOf('--tools') + 1], WRITE_TOOLS.join(','));
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'acceptEdits');
  assert.equal(WRITE_TOOLS.includes('Bash'), false);
});

test('agent-cli: teto de custo e agente do host entram em argv só quando pedidos', () => {
  const sem = claudeCLISpec.buildArgs(REQ);
  assert.equal(sem.includes('--max-budget-usd'), false);
  assert.equal(sem.includes('--agent'), false);

  const com = claudeCLISpec.buildArgs({ ...REQ, maxCostUsd: 0.25, agent: 'architect' });
  assert.equal(com[com.indexOf('--max-budget-usd') + 1], '0.25');
  assert.equal(com[com.indexOf('--agent') + 1], 'architect');

  // Teto zerado (orçamento já esgotado) não vira `--max-budget-usd 0`: isso
  // abortaria a chamada no subprocesso com um erro de budget que o Budget
  // Controller do runtime já sabe reportar melhor.
  const zero = claudeCLISpec.buildArgs({ ...REQ, maxCostUsd: 0 });
  assert.equal(zero.includes('--max-budget-usd'), false);
});

/* ============================ STDIN ============================ */

test('agent-cli: system e objetivo vão por stdin em blocos delimitados, nunca por argv', () => {
  const system = 'INSTRUÇÕES DO NÓ'.repeat(4000); // ~64KB, muito acima do limite de argv do Windows
  const stdin = claudeCLISpec.buildStdin({ ...REQ, system, prompt: 'construa X' });
  assert.ok(stdin.includes(SYSTEM_OPEN));
  assert.ok(stdin.includes(TASK_OPEN));
  assert.ok(stdin.includes('construa X'));
  assert.ok(stdin.length > 32767);

  const args = claudeCLISpec.buildArgs({ ...REQ, system, prompt: 'construa X' });
  assert.equal(args.some((a) => a.length > 4000), false, 'nenhum argumento pode carregar o system prompt');
  assert.equal(args.some((a) => a.includes('construa X')), false, 'o objetivo não pode entrar em argv');
});

test('agent-cli: sem system, o stdin carrega apenas o bloco de tarefa', () => {
  const stdin = claudeCLISpec.buildStdin(REQ);
  assert.equal(stdin.includes(SYSTEM_OPEN), false);
  assert.ok(stdin.startsWith(TASK_OPEN));
});

/* ============================ PARSE ============================ */

test('agent-cli: parse soma os tokens faturados e usa o custo MEDIDO pelo CLI', () => {
  const r = claudeCLISpec.parse(CLAUDE_SUCCESS_JSON);
  assert.equal(r.text, 'OK');
  assert.equal(r.tokens, 4095 + 38);
  assert.equal(r.costUsd, 0.005222);
  assert.equal(r.model, 'claude-haiku-4-5');
  assert.equal(r.cachedTokens, 0);
});

test('agent-cli: tokens de cache contam como entrada faturada (senão o budget mente)', () => {
  const r = claudeCLISpec.parse(CLAUDE_CACHED_JSON);
  assert.equal(r.tokens, 10 + 42 + 20848);
  assert.equal(r.cachedTokens, 20848);
});

test('agent-cli: run abortado por teto de custo do próprio CLI vira erro, não artefato vazio', () => {
  assert.throws(() => claudeCLISpec.parse(CLAUDE_BUDGET_JSON), /error_max_budget_usd/);
});

test('agent-cli: stdout vazio ou não-JSON vira erro explícito', () => {
  assert.throws(() => claudeCLISpec.parse('   '), /stdout vazio/);
  assert.throws(() => claudeCLISpec.parse('isso não é json'), /não é JSON válido/);
});

/* ============================ PROCESSO (spawn real) ============================ */

test('agent-cli: spawn entrega stdin ao processo e devolve o stdout parseado', async () => {
  const script = writeScript('echo.js', ECHO_SCRIPT);
  const adapter = new AgentCLIAdapter(fakeSpec(script), { env: liveEnv() });
  assert.equal(adapter.configured, true);

  const result = await adapter.complete({
    model: 'claude-haiku-4-5',
    system: 'sistema do nó',
    messages: [{ role: 'user', content: 'objetivo real' }],
  });

  const echoed = JSON.parse(result.text) as { argv: string[]; stdin: string; depth: string | null };
  assert.ok(echoed.stdin.includes('objetivo real'));
  assert.ok(echoed.stdin.includes('sistema do nó'));
  assert.equal(result.tokens, 110);
  assert.equal(result.costUsd, 0.001);
  assert.equal(result.provider, 'fake-cli');
  assert.ok(result.latencyMs >= 0);
});

test('agent-cli: o filho recebe profundidade incrementada (guarda de recursão atravessa o processo)', async () => {
  const script = writeScript('echo.js', ECHO_SCRIPT);
  const adapter = new AgentCLIAdapter(fakeSpec(script), { env: liveEnv() });
  const result = await adapter.complete({ model: 'm', messages: [{ role: 'user', content: 'x' }] });
  const echoed = JSON.parse(result.text) as { depth: string | null };
  assert.equal(echoed.depth, '1');
});

test('agent-cli: objetivo com metacaracteres de shell chega verbatim e não é executado', async () => {
  const script = writeScript('echo.js', ECHO_SCRIPT);
  const adapter = new AgentCLIAdapter(fakeSpec(script), { env: liveEnv() });
  const hostil = 'objetivo && echo INJETADO > pwned.txt; rm -rf / | $(whoami) `id` %PATH%';

  const result = await adapter.complete({ model: 'm', messages: [{ role: 'user', content: hostil }] });
  const echoed = JSON.parse(result.text) as { stdin: string };
  assert.ok(echoed.stdin.includes(hostil), 'o texto tem que chegar íntegro ao processo');
  assert.equal(fs.existsSync(path.join(process.cwd(), 'pwned.txt')), false);
});

test('agent-cli: exit code diferente de zero vira erro com o stderr do CLI', async () => {
  const script = writeScript('fail.js', "process.stderr.write('falhou por credencial'); process.exit(3);");
  const adapter = new AgentCLIAdapter(fakeSpec(script), { env: liveEnv() });
  await assert.rejects(
    adapter.complete({ model: 'm', messages: [{ role: 'user', content: 'x' }] }),
    /código 3.*falhou por credencial/s,
  );
});

test('agent-cli: timeout mata o processo e reporta a env que ajusta o teto', async () => {
  const script = writeScript('sleep.js', 'setTimeout(() => process.stdout.write("{}"), 60000);');
  const adapter = new AgentCLIAdapter(fakeSpec(script), {
    env: liveEnv({ IZANAGI_AGENT_CLI_TIMEOUT_MS: '250' }),
  });
  await assert.rejects(
    adapter.complete({ model: 'm', messages: [{ role: 'user', content: 'x' }] }),
    /timeout após 250ms.*IZANAGI_AGENT_CLI_TIMEOUT_MS/s,
  );
});

test('agent-cli: cancelamento do run aborta o subprocesso', async () => {
  const script = writeScript('sleep.js', 'setTimeout(() => process.stdout.write("{}"), 60000);');
  const adapter = new AgentCLIAdapter(fakeSpec(script), { env: liveEnv() });
  const controller = new AbortController();
  const pending = adapter.complete({
    model: 'm',
    messages: [{ role: 'user', content: 'x' }],
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 150);
  await assert.rejects(pending, /cancelada/);
});

test('agent-cli: runAgentCLI não usa shell (argv chega como lista, sem expansão)', async () => {
  const script = writeScript('argv.js', 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
  const res = await runAgentCLI(process.execPath, [script, '*', '$HOME', '&&'], '', { timeoutMs: 30_000 });
  assert.equal(res.code, 0);
  assert.deepEqual(JSON.parse(res.stdout), ['*', '$HOME', '&&']);
});

/* ============================ FLAG DO RUN E CACHE ============================ */

test('agent-cli: --agent-tools é parseado e valores inválidos não viram permissão', () => {
  assert.equal(parseRunArgs(['t']).agentTools, undefined);
  assert.equal(parseRunArgs(['t', '--agent-tools', 'read']).agentTools, 'read');
  assert.equal(parseRunArgs(['t', '--agent-tools=write']).agentTools, 'write');
  assert.equal(parseRunArgs(['t', '--agent-tools', 'WRITE']).agentTools, 'write');
  assert.equal(parseRunArgs(['t', '--agent-tools', 'none']).agentTools, 'none');
  // Valor inválido não pode "cair" numa política mais permissiva.
  assert.equal(parseRunArgs(['t', '--agent-tools', 'bash']).agentTools, undefined);
  assert.equal(parseRunArgs(['t', '--agent-tools', 'sim']).agentTools, undefined);
});

test('agent-cli: política de tools entra na chave do cache (leitura do repo muda a resposta)', () => {
  const base = { provider: 'claude-cli', model: 'claude-sonnet-5', system: 's', messages: [{ role: 'user', content: 'q' }] };
  const semTools = cacheKey(base);
  const comLeitura = cacheKey({ ...base, toolPolicy: 'read' });
  const comEscrita = cacheKey({ ...base, toolPolicy: 'write' });
  assert.notEqual(semTools, comLeitura);
  assert.notEqual(comLeitura, comEscrita);
  assert.equal(cacheKey({ ...base, toolPolicy: 'read' }), comLeitura, 'a chave tem que ser estável');
});

test('agent-cli: o piso de budget recomendado cobre o nó medido em cada política', () => {
  // 0.65 é a fatia default da fase `execution` (token/budget.ts).
  for (const policy of ['none', 'read', 'write'] as const) {
    assert.ok(
      recommendedBudget(policy) * 0.65 >= measuredTokensPerNode(policy),
      `piso de ${policy} não cobre o nó medido`,
    );
  }
  assert.equal(recommendedBudget('none'), AGENT_CLI_MIN_RECOMMENDED_BUDGET);
  assert.equal(measuredTokensPerNode('none'), AGENT_CLI_TOKENS_PER_NODE);
  // Ler o repositório custa mais que não ler: se o piso não subir junto, o
  // aviso passa a recomendar um teto que estoura.
  assert.ok(measuredTokensPerNode('read') > measuredTokensPerNode('none'));
  assert.ok(recommendedBudget('read') > recommendedBudget('none'));
  assert.ok(AGENT_CLI_TOKENS_PER_NODE > AGENT_CLI_OVERHEAD_TOKENS);
});

/* ============================ INTEGRAÇÃO COM O RUNTIME ============================ */

test('agent-cli: LLMClient registra o provider claude-cli entre os adapters', async () => {
  const client = new LLMClient();
  await assert.rejects(
    client.complete('provider-que-nao-existe', { model: 'm', messages: [] }),
    /claude-cli/,
    'a lista de adapters do erro deve incluir o executor sem chave',
  );
});

test('agent-cli: provider não utilizável reporta o que instalar, não uma chave a definir', async () => {
  const client = new LLMClient([new AgentCLIAdapter(claudeCLISpec, { env: { PATH: '', IZANAGI_AGENT_CLI_IN_TESTS: '1' } })]);
  assert.deepEqual(client.configuredProviders(), []);
  await assert.rejects(
    client.complete('claude-cli', { model: 'claude-haiku-4-5', messages: [] }),
    /não utilizável.*Claude Code/s,
  );
});

test('agent-cli: catálogo do router tem claude-cli com os três ids validados no CLI', () => {
  const provider = DEFAULT_PROVIDERS.find((p) => p.id === 'claude-cli');
  assert.ok(provider, 'claude-cli tem que estar no catálogo default, senão o router nunca o escolhe');
  assert.deepEqual(
    provider.models.map((m) => m.id).sort(),
    ['claude-haiku-4-5', 'claude-opus-5', 'claude-sonnet-5'],
  );
  assert.deepEqual(provider.models.map((m) => m.tier).sort(), ['balanced', 'fast', 'premium']);
});

test('agent-cli: com claude-cli como único provider, todo papel recebe modelo (nada fica headless)', () => {
  const provider = DEFAULT_PROVIDERS.find((p) => p.id === 'claude-cli');
  assert.ok(provider);
  const router = new ModelRouter([provider]);
  const ctx = {
    task: 'implementar autenticação',
    taskComplexity: 5 as const,
    reasoningRequirement: 'high' as const,
    risk: 0.4,
    tokenBudget: 20_000,
    requiresTools: false,
  };
  for (const role of ['commander', 'specialist', 'worker'] as const) {
    const routed = router.routeForRole(role, ctx);
    assert.equal(routed.provider, 'claude-cli');
    assert.ok(routed.model.id.startsWith('claude-'));
  }
});

/* ============================ REGRESSÃO: SURVEY DE PROJETO REAL ============================ */

test('artifacts: survey de projeto que contém "TODO" é artefato VÁLIDO, não stub', () => {
  // Reproduz o bug que abortava `izanagi run` no primeiro nó dentro de
  // qualquer repositório cujo README/arquivos mencionassem TODO: o survey é
  // saída capturada do disco, e a varredura anti-stub media o vocabulário do
  // projeto do usuário em vez do texto do modelo.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izanagi-survey-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0' }), 'utf8');
  fs.writeFileSync(path.join(dir, 'README.md'), '# Projeto\n\nTODO: escrever a documentação. FIXME depois.\n', 'utf8');

  const survey = surveyProject(dir);
  const report = validateArtifact('project-survey', survey);
  assert.equal(report.valid, true, `survey reprovado: ${report.issues.join(' | ')}`);
});

test('artifacts: recibo de materialização com caminho TODO.md continua válido', () => {
  const report = validateArtifact('materialization', {
    dir: 'out',
    candidates: 2,
    written: ['out/TODO.md', 'out/index.ts'],
  });
  assert.equal(report.valid, true, `recibo reprovado: ${report.issues.join(' | ')}`);
});

test('artifacts: texto AUTORAL com stub continua reprovado (a marca não é anistia geral)', () => {
  const report = validateArtifact('raw', 'function f() { /* TODO: implementar */ }');
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((i) => i.includes('stub/lazy-code')));
});

/* ============================ MODELO POR AGENTE ============================ */

test('router: o tier declarado pelo agente vence o default do papel', () => {
  const provider = DEFAULT_PROVIDERS.find((p) => p.id === 'claude-cli');
  assert.ok(provider);
  const router = new ModelRouter([provider]);
  const ctx = {
    task: 'projetar um agente novo',
    taskComplexity: 3 as const,
    reasoningRequirement: 'medium' as const,
    risk: 0.2,
    tokenBudget: 16_000,
    requiresTools: false,
  };

  // Sem hint, o papel decide: specialist -> balanced.
  const semHint = router.routeForRole('specialist', ctx);
  assert.equal(semHint.tier, 'balanced');

  // `agent-architect` declara `opus` no JSON: o nó dele sobe para premium.
  const comHint = router.routeForRole('specialist', ctx, ModelRouter.tierForHint('opus'));
  assert.equal(comHint.tier, 'premium');
  assert.ok(comHint.reasons.some((r) => r.includes('agente do nó pede tier')));

  // E um agente que pede o modelo barato desce, mesmo em papel de specialist:
  // é assimetria nos dois sentidos, não só escalada.
  assert.equal(router.routeForRole('specialist', ctx, ModelRouter.tierForHint('haiku')).tier, 'fast');
});

test('router: pin do usuário vence o hint do agente (quem paga a conta decide)', () => {
  const provider = DEFAULT_PROVIDERS.find((p) => p.id === 'claude-cli');
  assert.ok(provider);
  const router = new ModelRouter([provider]).withRolePolicy({ specialist: { model: 'claude-haiku-4-5' } });
  const ctx = {
    task: 'x',
    taskComplexity: 3 as const,
    reasoningRequirement: 'medium' as const,
    risk: 0.2,
    tokenBudget: 16_000,
    requiresTools: false,
  };
  const routed = router.routeForRole('specialist', ctx, ModelRouter.tierForHint('opus'));
  assert.equal(routed.model.id, 'claude-haiku-4-5');
});

test('router: hint desconhecido é ausência de hint, nunca um tier chutado', () => {
  assert.equal(ModelRouter.tierForHint(undefined), undefined);
  assert.equal(ModelRouter.tierForHint(''), undefined);
  assert.equal(ModelRouter.tierForHint('gpt-5'), undefined);
  assert.equal(ModelRouter.tierForHint('  OPUS '), 'premium');
  assert.equal(ModelRouter.tierForHint('Sonnet'), 'balanced');
  assert.equal(ModelRouter.tierForHint('haiku'), 'fast');
});

test('router: os 22 agentes core declaram um hint que o roteador entende', () => {
  // Um hint que o roteador não entende é um campo decorativo: o agente pensa
  // que pediu modelo e ninguém leu.
  const registry = new AgentCapabilityRegistry({ baseDir: REPO_ROOT });
  const core = new Set(
    fs.readdirSync(path.join(REPO_ROOT, 'agents'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/-agent\.json$/, '')),
  );
  const agents = registry.list().filter((a) => core.has(a.id));
  assert.ok(agents.length >= 22);
  for (const a of agents) {
    assert.ok(a.modelHint, `${a.id}: sem model declarado`);
    assert.ok(
      ModelRouter.tierForHint(a.modelHint),
      `${a.id}: hint "${a.modelHint}" não mapeia para nenhum tier`,
    );
  }
});
