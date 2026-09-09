/**
 * Agent CLI Adapter — executa nós do grafo delegando a um agente de codificação
 * JÁ INSTALADO E AUTENTICADO na máquina (hoje: `claude`, o Claude Code CLI),
 * em modo print (não interativo), por subprocesso.
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * Antes deste adapter, `izanagi run` sem API key caía em
 * `createHeadlessProducer`: o grafo era planejado de verdade, roteado de
 * verdade, verificado de verdade — e os nós eram SIMULADOS. O framework
 * orquestrava, mas não executava trabalho. Quem não quer colar uma chave de
 * API nem subir um modelo local ficava com um planejador, não com um runtime.
 *
 * O agente de codificação que a pessoa já usa no terminal resolve isso: ele já
 * está autenticado (assinatura/OAuth do próprio CLI), já roda local, e expõe
 * modo não interativo com telemetria de uso. Izanagi não precisa de chave
 * nenhuma — precisa de um executor. Este é o executor de custo zero de setup.
 *
 * NÃO é "mais um provider de LLM": é uma camada de PROCESSO. A diferença
 * prática está no que o CLI aceita e o que uma API HTTP não aceita:
 *
 *   Izanagi                     flag do `claude`
 *   -------------------------   --------------------------------
 *   modelo do papel             --model
 *   teto de custo do nó         --max-budget-usd
 *   política de tools           --restricted / --tools
 *   escrita (opt-in explícito)  --permission-mode acceptEdits
 *   sem estado residual         --no-session-persistence / --strict-mcp-config
 *   telemetria real             --output-format json (usage + total_cost_usd)
 *
 * O custo volta MEDIDO pelo próprio CLI (`total_cost_usd`), não estimado por
 * tabela de preço — é a única superfície do runtime onde o custo é fato.
 *
 * DECISÕES QUE PARECEM DETALHE E NÃO SÃO
 * --------------------------------------
 * 1. Prompt vai por STDIN, nunca por argv. O system prompt de um nó com chain
 *    de skills passa de 30KB; o limite de linha de comando do Windows é 32767
 *    caracteres para o comando inteiro. Por argv, o run quebraria justamente
 *    nos nós mais ricos. Por stdin não existe limite prático.
 *
 * 2. Default é `--restricted --tools ""`: nenhuma tool, nenhuma execução de
 *    comando, nenhum settings do projeto carregado. Medido nesta máquina, isso
 *    derruba o system prompt do CLI de 20848 para 4095 tokens de entrada
 *    (US$ 0,042 -> US$ 0,005 na mesma pergunta). Além de mais barato é mais
 *    determinístico e mais seguro: o produtor de artefato de um nó não precisa
 *    de shell. Quem quiser grounding no repositório liga tools de leitura;
 *    quem quiser escrita precisa pedir escrita.
 *
 * 3. `spawn` sem shell, argv em array: o objetivo do usuário entra como dado,
 *    nunca como texto interpretado por um shell.
 *
 * 4. Guarda de profundidade: um `izanagi run` disparado DE DENTRO de uma sessão
 *    do agente pode spawnar o agente (profundidade 0 -> 1). O que não pode é a
 *    recursão continuar. Estourado o teto, o adapter fica `configured: false` e
 *    o runtime degrada para headless com aviso, em vez de estourar no meio do
 *    grafo.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { CompletionOptions, CompletionResult, ModelAdapter } from './client.js';

/* ============================ CONFIGURAÇÃO ============================ */

/** Teto de profundidade de recursão (agente -> izanagi -> agente -> ...). */
export const DEFAULT_MAX_DEPTH = 1;

/**
 * Timeout por chamada. Um agente de codificação em modo print pode pensar por
 * bem mais tempo que um POST de chat completion (ele tem loop de raciocínio
 * próprio), então o default é maior que o do cliente HTTP e tem env separada.
 */
export const DEFAULT_TIMEOUT_MS = 300_000;

/** Teto de stdout acumulado (proteção de memória contra saída patológica). */
export const MAX_STDOUT_BYTES = 16 * 1024 * 1024;

/**
 * Custo fixo de tokens que o CLI hospedeiro cobra por chamada, MEDIDO nesta
 * máquina com `--restricted --tools ""` (o default do adapter): 4095 tokens de
 * entrada só do system prompt do próprio agente, antes de qualquer instrução
 * do Izanagi. Com as customizações do projeto carregadas o número foi 20848.
 *
 * O runtime precisa desse número porque o orçamento de um nó não é só o
 * prompt que o Izanagi escreve: um `--budget` pequeno estoura no primeiro nó e
 * o usuário lê "orçamento da fase execution esgotado" sem saber por quê.
 */
export const AGENT_CLI_OVERHEAD_TOKENS = 4_095;

/**
 * Tokens observados num nó de specialist real (chain de skills + contrato +
 * artefato de código): 12,5k de entrada e 5,4k de saída. É a unidade de
 * planejamento honesta para "quanto custa um nó neste executor".
 */
export const AGENT_CLI_TOKENS_PER_NODE = 18_000;

/**
 * Piso de `--budget` recomendado para um run de um nó neste executor:
 * AGENT_CLI_TOKENS_PER_NODE dividido pela fatia da fase `execution` (0,65 no
 * peso default), arredondado. Abaixo disso o run falha por orçamento, não por
 * qualidade — e falhar por orçamento mal declarado é o pior tipo de falha,
 * porque parece falha do modelo.
 */
export const AGENT_CLI_MIN_RECOMMENDED_BUDGET = 30_000;

/**
 * O mesmo nó com `--agent-tools read`, MEDIDO: 47,4k de entrada e 20,3k de
 * saída (67,7k no total). Ler o repositório multiplica o custo por ~3,8x
 * porque o agente faz várias voltas de tool antes de responder.
 *
 * O número existe para que o aviso de orçamento seja honesto por política em
 * vez de citar um único valor que só vale para o caso sem tools.
 */
export const AGENT_CLI_TOKENS_PER_NODE_WITH_TOOLS = 68_000;

/** Piso recomendado por política de tools (mesma conta do caso sem tools). */
export const AGENT_CLI_MIN_BUDGET_WITH_TOOLS = 105_000;

/** Piso de `--budget` recomendado para um nó, dada a política de tools. */
export function recommendedBudget(policy: AgentCLIToolPolicy): number {
  return policy === 'none' ? AGENT_CLI_MIN_RECOMMENDED_BUDGET : AGENT_CLI_MIN_BUDGET_WITH_TOOLS;
}

/** Tokens medidos de um nó, dada a política de tools. */
export function measuredTokensPerNode(policy: AgentCLIToolPolicy): number {
  return policy === 'none' ? AGENT_CLI_TOKENS_PER_NODE : AGENT_CLI_TOKENS_PER_NODE_WITH_TOOLS;
}

/** Política de tools do subprocesso. */
export type AgentCLIToolPolicy = 'none' | 'read' | 'write';

/** Tools de leitura usadas em `policy: 'read'` (grounding no repositório real). */
export const READ_TOOLS = ['Read', 'Grep', 'Glob'];

/** Tools de `policy: 'write'`: leitura + escrita de arquivo. Sem Bash, de propósito. */
export const WRITE_TOOLS = [...READ_TOOLS, 'Write', 'Edit'];

function envInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const v = Number(env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Profundidade atual da cadeia de subprocessos de agente. */
export function currentDepth(env: NodeJS.ProcessEnv = process.env): number {
  const v = Number(env.IZANAGI_AGENT_CLI_DEPTH);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function maxDepth(env: NodeJS.ProcessEnv = process.env): number {
  const v = Number(env.IZANAGI_AGENT_CLI_MAX_DEPTH);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : DEFAULT_MAX_DEPTH;
}

/**
 * Política de tools declarada pelo ambiente.
 *
 * `write` NÃO é acessível por acidente: exige o valor literal `write`, porque
 * é o único valor que autoriza o subprocesso a alterar arquivos do projeto.
 */
export function toolPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): AgentCLIToolPolicy {
  const v = (env.IZANAGI_AGENT_CLI_TOOLS ?? '').trim().toLowerCase();
  if (v === 'write') return 'write';
  if (v === 'read') return 'read';
  return 'none';
}

/**
 * Dentro de um test runner o executor fica DESLIGADO por padrão.
 *
 * Sem isto, qualquer teste que chame a CLI em processo (`cli.test`,
 * `cli-hitl.test`) passaria a spawnar o agente de verdade e a suíte gastaria
 * cota real da assinatura de quem rodou `npm test` — medido: um único teste de
 * compatibilidade de flag saiu de milissegundos para 28 segundos de chamada de
 * modelo. O default seguro é o inverso: teste roda headless.
 *
 * `IZANAGI_AGENT_CLI_IN_TESTS=1` libera, para quem quer justamente um teste de
 * integração contra o CLI instalado.
 */
export function isSuppressedInTests(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.IZANAGI_AGENT_CLI_IN_TESTS) return false;
  return Boolean(env.NODE_TEST_CONTEXT);
}

/* ============================ DETECÇÃO DE BINÁRIO ============================ */

/**
 * Procura um executável no PATH sem shell e sem `which`/`where` (spawnar um
 * processo só para descobrir se dá para spawnar outro é caro e, no Windows,
 * depende de qual shell atende).
 *
 * No Windows testa as extensões do PATHEXT: `claude` no disco é `claude.exe`,
 * e `fs.existsSync('claude')` daria falso negativo.
 */
export function findExecutable(bin: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
  const isWin = process.platform === 'win32';
  const exts = isWin
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir.replace(/^"|"$/g, ''), bin + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        /* diretório inexistente no PATH é normal — segue */
      }
    }
  }
  return null;
}

/* ============================ SPEC DE UM CLI ============================ */

/** Requisição normalizada que o spec traduz para argv do CLI concreto. */
export interface AgentCLIRequest {
  model: string;
  /** Instruções de operação do nó (system prompt compilado pelo Izanagi). */
  system?: string;
  /** Mensagem do usuário/objetivo. */
  prompt: string;
  toolPolicy: AgentCLIToolPolicy;
  /** Teto de custo desta chamada, em USD. Ausente = sem teto no subprocesso. */
  maxCostUsd?: number;
  /** Agente nativo do host a assumir a sessão (passthrough opcional). */
  agent?: string;
}

/** Resposta normalizada extraída do stdout do CLI. */
export interface AgentCLIResponse {
  text: string;
  /** Tokens realmente consumidos (entrada + criação/leitura de cache + saída). */
  tokens: number;
  /** Tokens servidos do cache de prompt, quando o CLI reporta. */
  cachedTokens?: number;
  /** Custo medido pelo próprio CLI, em USD. */
  costUsd?: number;
  /** Modelo que o CLI de fato usou, quando reportado. */
  model?: string;
}

export interface AgentCLISpec {
  /** Id do provider no ModelRouter/LLMClient (ex.: `claude-cli`). */
  readonly provider: string;
  /** Nome do executável no PATH (sem extensão). */
  readonly bin: string;
  /** Nome legível para mensagens ao usuário. */
  readonly label: string;
  /** Como instalar/autenticar, citado quando o binário não é encontrado. */
  readonly install: string;
  buildArgs(req: AgentCLIRequest): string[];
  /** Texto enviado por stdin (prompt e, se necessário, o system embutido). */
  buildStdin(req: AgentCLIRequest): string;
  /** Lança `Error` quando o próprio CLI reportou falha. */
  parse(stdout: string): AgentCLIResponse;
}

/* ============================ SPEC: CLAUDE CODE ============================ */

/**
 * Contrato mínimo do JSON de `claude -p --output-format json`, restrito aos
 * campos que este adapter consome. Verificado contra a saída real do CLI
 * v2.1.266 (ver CHANGELOG desta versão).
 */
interface ClaudePrintResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<string, { canonicalModel?: string }>;
  permission_denials?: unknown[];
}

/**
 * Delimitadores do bloco de instruções enviado por stdin.
 *
 * O system prompt do Izanagi não cabe em argv (ver cabeçalho), e o CLI não lê
 * system por stdin. A saída é mandar o bloco marcado no corpo da mensagem e
 * usar `--append-system-prompt` (curto, cabe em argv) apenas para dizer ao
 * agente COMO tratar esse bloco. Assim a instrução continua tendo estatuto de
 * instrução, sem depender de flag não documentada.
 */
export const SYSTEM_OPEN = '<izanagi:instructions>';
export const SYSTEM_CLOSE = '</izanagi:instructions>';
export const TASK_OPEN = '<izanagi:task>';
export const TASK_CLOSE = '</izanagi:task>';

/** Contrato de operação passado em argv (curto por necessidade). */
export const CLAUDE_CONTRACT = [
  'You are executing one node of an Izanagi execution graph in non-interactive mode.',
  `Treat the ${SYSTEM_OPEN} block as your operating instructions and the ${TASK_OPEN} block as the objective.`,
  'Produce only the requested artifact as your final message: no preamble, no summary of what you did, no questions.',
].join(' ');

export const claudeCLISpec: AgentCLISpec = {
  provider: 'claude-cli',
  bin: 'claude',
  label: 'Claude Code CLI',
  install: 'instale e autentique o Claude Code (https://claude.com/claude-code) — nenhuma API key é necessária',

  buildArgs(req) {
    const args = [
      '--print',
      '--output-format', 'json',
      '--model', req.model,
      // Sem estado residual: um nó do grafo não deve deixar sessão em disco
      // nem herdar MCP do projeto (custo, latência e superfície de risco).
      '--no-session-persistence',
      '--strict-mcp-config',
      '--append-system-prompt', CLAUDE_CONTRACT,
    ];

    // `--restricted` remove as tools que rodam comando/código e ignora os
    // arquivos de settings: é o piso de segurança do subprocesso. Fica ligado
    // nas três políticas — o que muda é quais tools voltam por `--tools`.
    args.push('--restricted');
    if (req.toolPolicy === 'none') {
      args.push('--tools', '');
    } else if (req.toolPolicy === 'read') {
      args.push('--tools', READ_TOOLS.join(','));
    } else {
      args.push('--tools', WRITE_TOOLS.join(','));
      // Único ponto do adapter que autoriza alteração de arquivo. Sem isto, a
      // tool de escrita existiria e cada uso abriria um prompt de permissão
      // que ninguém pode responder em modo print (viraria negação silenciosa).
      args.push('--permission-mode', 'acceptEdits');
    }

    if (req.maxCostUsd !== undefined && req.maxCostUsd > 0) {
      args.push('--max-budget-usd', String(req.maxCostUsd));
    }
    if (req.agent) args.push('--agent', req.agent);

    return args;
  },

  buildStdin(req) {
    const blocks: string[] = [];
    if (req.system) blocks.push(`${SYSTEM_OPEN}\n${req.system}\n${SYSTEM_CLOSE}`);
    blocks.push(`${TASK_OPEN}\n${req.prompt}\n${TASK_CLOSE}`);
    return blocks.join('\n\n');
  },

  parse(stdout) {
    const trimmed = stdout.trim();
    if (!trimmed) throw new Error('claude-cli: stdout vazio (o CLI não produziu resultado)');

    let data: ClaudePrintResult;
    try {
      data = JSON.parse(trimmed) as ClaudePrintResult;
    } catch {
      throw new Error(`claude-cli: stdout não é JSON válido: ${trimmed.slice(0, 300)}`);
    }

    if (data.is_error || (data.subtype && data.subtype !== 'success')) {
      const detail = (data.result ?? '').slice(0, 400) || data.subtype || 'motivo não reportado';
      throw new Error(`claude-cli falhou (${data.subtype ?? 'error'}): ${detail}`);
    }

    const u = data.usage ?? {};
    // Tokens de criação e de leitura de cache SÃO tokens de entrada faturados
    // (em faixas diferentes). Somá-los é o que faz o contador do runtime
    // bater com a fatura; ignorá-los faria o budget engine achar que uma
    // chamada de 27k tokens de contexto custou 10.
    const tokens =
      (u.input_tokens ?? 0) +
      (u.output_tokens ?? 0) +
      (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0);

    const canonical = Object.values(data.modelUsage ?? {})[0]?.canonicalModel;
    const cached = u.cache_read_input_tokens;

    return {
      text: data.result ?? '',
      tokens,
      ...(typeof cached === 'number' ? { cachedTokens: cached } : {}),
      ...(typeof data.total_cost_usd === 'number' ? { costUsd: data.total_cost_usd } : {}),
      ...(canonical ? { model: canonical } : {}),
    };
  },
};

/** Specs conhecidos, por id de provider. */
export const AGENT_CLI_SPECS: Record<string, AgentCLISpec> = {
  [claudeCLISpec.provider]: claudeCLISpec,
};

/** Ids de provider servidos por CLI de agente (usado por CLI/SDK para mensagens). */
export const AGENT_CLI_PROVIDERS = Object.keys(AGENT_CLI_SPECS);

/* ============================ EXECUÇÃO DO SUBPROCESSO ============================ */

export interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
  aborted: boolean;
}

/**
 * Mata a árvore do processo. Um agente de codificação spawna filhos próprios;
 * no Windows `child.kill()` mata só o pai e deixa os netos vivos consumindo
 * cota de um run que já foi cancelado.
 */
function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).unref();
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    /* processo já morreu — nada a fazer */
  }
}

/** Executa o binário com argv em array (sem shell) e stdin fechado ao fim. */
export function runAgentCLI(
  bin: string,
  args: string[],
  stdin: string,
  opts: { cwd?: string; timeoutMs: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv },
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd ?? process.cwd(),
      env: opts.env ?? process.env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let timedOut = false;
    let aborted = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, opts.timeoutMs);

    const onAbort = () => {
      aborted = true;
      killTree(child.pid);
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    const cleanup = () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        killTree(child.pid);
        return;
      }
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      // stderr entra truncado: serve de diagnóstico numa mensagem de erro, não
      // de artefato — guardar megabytes dele só gastaria memória.
      if (stderr.length < 8192) stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ stdout, stderr, code, timedOut, aborted });
    });

    child.stdin.on('error', () => {
      /* EPIPE quando o CLI fecha stdin antes de ler tudo — o close acima decide */
    });
    child.stdin.end(stdin, 'utf8');
  });
}

/* ============================ ADAPTER ============================ */

/**
 * Adapter de um CLI de agente. Implementa `ModelAdapter`, então entra no
 * `LLMClient` como qualquer provider e atravessa run/SDK/models/juiz/arena sem
 * que nenhum chamador mude.
 */
export class AgentCLIAdapter implements ModelAdapter {
  readonly provider: string;
  private readonly spec: AgentCLISpec;
  private readonly env: NodeJS.ProcessEnv;
  private readonly cwd: string | undefined;
  private resolvedBin: string | null | undefined;

  constructor(
    spec: AgentCLISpec,
    opts: { env?: NodeJS.ProcessEnv; cwd?: string } = {},
  ) {
    this.spec = spec;
    this.provider = spec.provider;
    this.env = opts.env ?? process.env;
    this.cwd = opts.cwd;
  }

  /** Caminho absoluto do binário, memoizado (`null` = não está no PATH). */
  get binPath(): string | null {
    if (this.resolvedBin === undefined) {
      this.resolvedBin = findExecutable(this.spec.bin, this.env);
    }
    return this.resolvedBin;
  }

  /**
   * `true` quando o binário existe, o adapter não foi desligado e a
   * profundidade de recursão ainda cabe.
   *
   * Não verifica autenticação: não existe checagem barata e offline disso, e
   * spawnar o agente só para perguntar "você está logado?" custaria uma
   * chamada de modelo por run. Falha de auth aparece como erro real do CLI na
   * primeira chamada, com o stderr dele na mensagem.
   */
  get configured(): boolean {
    if (this.env.IZANAGI_AGENT_CLI_DISABLED) return false;
    if (isSuppressedInTests(this.env)) return false;
    if (currentDepth(this.env) >= maxDepth(this.env)) return false;
    return this.binPath !== null;
  }

  /** Motivo de não estar utilizável, para mensagem ao usuário. `null` = utilizável. */
  get unavailableReason(): string | null {
    if (this.env.IZANAGI_AGENT_CLI_DISABLED) return 'desligado por IZANAGI_AGENT_CLI_DISABLED';
    if (isSuppressedInTests(this.env)) return 'suprimido dentro de test runner (IZANAGI_AGENT_CLI_IN_TESTS=1 libera)';
    const depth = currentDepth(this.env);
    if (depth >= maxDepth(this.env)) {
      return `profundidade de recursão no teto (${depth}/${maxDepth(this.env)}) — este run já está dentro de um agente`;
    }
    if (this.binPath === null) return `binário "${this.spec.bin}" não encontrado no PATH — ${this.spec.install}`;
    return null;
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const bin = this.binPath;
    if (!bin) throw new Error(`${this.spec.label}: ${this.unavailableReason}`);

    const req: AgentCLIRequest = {
      model: opts.model,
      ...(opts.system ? { system: opts.system } : {}),
      prompt: opts.messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n'),
      toolPolicy: opts.toolPolicy ?? toolPolicyFromEnv(this.env),
      ...(opts.maxCostUsd !== undefined ? { maxCostUsd: opts.maxCostUsd } : {}),
      ...(opts.agent ? { agent: opts.agent } : {}),
    };

    const started = Date.now();
    const result = await runAgentCLI(
      bin,
      this.spec.buildArgs(req),
      this.spec.buildStdin(req),
      {
        ...(this.cwd ? { cwd: this.cwd } : {}),
        timeoutMs: envInt(this.env, 'IZANAGI_AGENT_CLI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
        ...(opts.signal ? { signal: opts.signal } : {}),
        // Profundidade +1 no filho: é o que impede a recursão de continuar se
        // o agente resolver rodar `izanagi run` por conta própria.
        env: { ...this.env, IZANAGI_AGENT_CLI_DEPTH: String(currentDepth(this.env) + 1) },
      },
    );

    if (result.aborted) throw new Error(`${this.spec.label}: chamada cancelada`);
    if (result.timedOut) {
      throw new Error(`${this.spec.label}: timeout após ${envInt(this.env, 'IZANAGI_AGENT_CLI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)}ms (IZANAGI_AGENT_CLI_TIMEOUT_MS ajusta)`);
    }
    if (result.code !== 0) {
      const detail = (result.stderr.trim() || result.stdout.trim()).slice(0, 400) || 'sem saída';
      throw new Error(`${this.spec.label} saiu com código ${result.code}: ${detail}`);
    }

    const parsed = this.spec.parse(result.stdout);
    return {
      text: parsed.text,
      tokens: parsed.tokens,
      latencyMs: Date.now() - started,
      model: parsed.model ?? opts.model,
      provider: this.provider,
      ...(parsed.cachedTokens !== undefined ? { cachedTokens: parsed.cachedTokens } : {}),
      ...(parsed.costUsd !== undefined ? { costUsd: parsed.costUsd } : {}),
    };
  }
}

/** Adapters de CLI de agente conhecidos, prontos para o `LLMClient`. */
export function defaultAgentCLIAdapters(opts: { env?: NodeJS.ProcessEnv; cwd?: string } = {}): AgentCLIAdapter[] {
  return Object.values(AGENT_CLI_SPECS).map((spec) => new AgentCLIAdapter(spec, opts));
}

/**
 * Diagnóstico dos executores sem chave, para `izanagi doctor`/`models`.
 * Determinístico e offline: só olha PATH, env e profundidade.
 */
export function agentCLIStatus(env: NodeJS.ProcessEnv = process.env): Array<{
  provider: string;
  label: string;
  bin: string;
  path: string | null;
  available: boolean;
  reason: string | null;
  install: string;
}> {
  return Object.values(AGENT_CLI_SPECS).map((spec) => {
    const adapter = new AgentCLIAdapter(spec, { env });
    return {
      provider: spec.provider,
      label: spec.label,
      bin: spec.bin,
      path: adapter.binPath,
      available: adapter.configured,
      reason: adapter.unavailableReason,
      install: spec.install,
    };
  });
}

/**
 * Diretório temporário do adapter. Existe para os specs que precisarem de
 * arquivo auxiliar; o spec do Claude não precisa (tudo vai por stdin/argv).
 */
export function tempDir(): string {
  const dir = path.join(os.tmpdir(), 'izanagi-agent-cli');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
