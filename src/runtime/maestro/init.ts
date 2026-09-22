/**
 * Inicialização da ponte com o Maestro: detecção de providers instalados e
 * criação interativa de agente via `maestro-cli create-agent`.
 *
 * O seletor lista SÓ os providers realmente detectados no PATH (mais a opção
 * "outro"), porque a máquina desta casa não tem Claude e um item não
 * selecionável seria ruído. Provider ausente fica fora; tipo custom entra pelo
 * "outro".
 */

import path from 'node:path';
import readline from 'node:readline/promises';
import type { MaestroCli, ProviderChannel, ProviderChannelId } from './types.js';
import { findInPath, resolveMaestroCli, runMaestro, INSTALL_HINT, type SpawnFn } from './cli.js';

/** Catálogo de channels suportados (spec §2: providers alvo). */
export const PROVIDER_DEFS: ReadonlyArray<{ id: ProviderChannelId; label: string; executable: string }> = [
  { id: 'claude-code', label: 'Claude Code', executable: 'claude' },
  { id: 'codex', label: 'OpenAI Codex', executable: 'codex' },
  { id: 'opencode', label: 'OpenCode', executable: 'opencode' },
  { id: 'copilot-cli', label: 'GitHub Copilot CLI', executable: 'copilot' },
  { id: 'factory-droid', label: 'Factory Droid', executable: 'factory-droid' },
  { id: 'hermes', label: 'Hermes', executable: 'hermes' },
  { id: 'pi', label: 'Pi', executable: 'pi' },
  { id: 'qwen3-coder', label: 'Qwen3 Coder', executable: 'qwen3-coder' },
  { id: 'omp', label: 'OMP', executable: 'omp' },
];

/** Detecta os providers instalados no PATH. Ausentes ficam com `installed: false`. */
export function detectProviders(): ProviderChannel[] {
  return PROVIDER_DEFS.map((def) => {
    const found = findInPath(def.executable);
    return {
      id: def.id,
      label: def.label,
      executable: def.executable,
      installed: found !== undefined,
      ...(found ? { path: found } : {}),
    };
  });
}

export interface InitFlowOptions {
  /** Diretório de trabalho do agente Maestro (default: cwd). */
  workspace: string;
  /** Nome do agente (default: nome da pasta do workspace). */
  name?: string;
  /** Channel/type pré-selecionado: pula o seletor interativo. */
  channel?: string;
  /** Pasta Auto Run (default: `<workspace>/.maestro/playbooks`). */
  autoRunFolder?: string;
  /** Binário do maestro-cli resolvido (sem isso, resolve solo). */
  cli?: MaestroCli;
  /** Injectável para testes (nunca spawnar maestro-cli real em teste). */
  spawnImpl?: SpawnFn;
  /** Streams do seletor interativo (default: stdin/stdout do processo). */
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface InitFlowResult {
  created: boolean;
  agentId?: string;
  agentName: string;
  channel: string;
  autoRunFolder: string;
  /** stdout bruto do maestro-cli para diagnóstico. */
  output: string;
  /** stderr/mensagem quando a criação falhou. */
  error?: string;
}

function parseAgentId(output: string): string | undefined {
  const line = output.trim().split('\n').find((l) => l.includes('{'));
  if (!line) return undefined;
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    for (const key of ['agentId', 'id', 'agent_id']) {
      const value = parsed[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
  } catch {
    // stdout não-parseável: segue sem id.
  }
  return undefined;
}

async function askChannel(rl: readline.Interface, providers: ProviderChannel[]): Promise<string> {
  console.log('\nProviders detectados nesta máquina:');
  if (providers.some((p) => p.installed)) {
    providers
      .filter((p) => p.installed)
      .forEach((p, i) => {
        console.log(`  [${i + 1}] ${p.label} (${p.path})`);
      });
  } else {
    console.log('  \x1b[90mNenhum provider conhecido no PATH.\x1b[0m');
  }
  console.log('  \x1b[90m[0] outro (digitar o type manualmente)\x1b[0m');
  const answer = (await rl.question('\nChannel (número ou outro): ')).trim();
  const index = Number.parseInt(answer, 10);
  if (Number.isInteger(index) && index >= 1) {
    const installed = providers.filter((p) => p.installed);
    const picked = installed[index - 1];
    if (picked) return picked.id;
  }
  if (answer.toLowerCase() === 'o' || answer.toLowerCase() === 'outro' || answer === '0') {
    const custom = (await rl.question('Type do channel: ')).trim();
    return custom.length > 0 ? custom : 'opencode';
  }
  return answer.length > 0 ? answer : 'opencode';
}

/**
 * Fluxo interativo (ou não) de criação de agente Maestro.
 * Retorna o resultado; NUNCA chama `process.exit` (responsabilidade da CLI).
 */
export async function maestroInit(opts: InitFlowOptions): Promise<InitFlowResult> {
  const cli = opts.cli ?? resolveMaestroCli();
  if (!cli) throw new Error(INSTALL_HINT);

  const workspace = path.resolve(opts.workspace);
  const autoRunFolder = opts.autoRunFolder ?? path.join(workspace, '.maestro', 'playbooks');
  const agentName = opts.name?.trim() || path.basename(workspace) || 'izanagi-agent';
  const providers = detectProviders();

  let channel = opts.channel?.trim();
  if (!channel) {
    const rl = readline.createInterface({
      input: opts.input ?? process.stdin,
      output: opts.output ?? process.stdout,
    });
    try {
      channel = await askChannel(rl, providers);
    } finally {
      rl.close();
    }
  }

  const args = ['create-agent', agentName, '-d', workspace, '-t', channel, '--auto-run-folder', autoRunFolder, '--json'];
  const result = await runMaestro(args, { cli, spawnImpl: opts.spawnImpl });

  if (result.code !== 0) {
    return {
      created: false,
      agentName,
      channel,
      autoRunFolder,
      output: result.stdout,
      error: result.stderr.trim() || result.message,
    };
  }

  return {
    created: true,
    ...(parseAgentId(result.stdout) ? { agentId: parseAgentId(result.stdout)! } : {}),
    agentName,
    channel,
    autoRunFolder,
    output: result.stdout,
  };
}