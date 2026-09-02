/**
 * Execução de código em sandbox: o isolamento que o `execute_code` exigia.
 *
 * Programmatic tool calling colapsa uma sequência de chamadas de tool num
 * script só, e economiza round-trips de inferência. O bloqueio nunca foi o
 * colapso: era o isolamento. Rodar código gerado por modelo no mesmo processo
 * do runtime dá a ele o filesystem inteiro, as variáveis de ambiente com as
 * chaves de API, e a capacidade de abrir processos.
 *
 * Aqui o isolamento é do RUNTIME, não de checagem de string sobre o código —
 * varredura de `import` é evasível e dá falsa sensação de segurança. O script
 * roda num processo Node separado com o Permission Model ligado.
 *
 * ## O que está isolado (verificado, não presumido)
 *
 *   filesystem     : só o diretório de trabalho da própria execução. Ler fora
 *                    dele falha com ERR_ACCESS_DENIED, imposto pelo Node.
 *   subprocessos   : `child_process` falha com ERR_ACCESS_DENIED.
 *   worker threads : bloqueados. Addons nativos e WASI também.
 *   ambiente       : env montado do zero. Nenhuma variável do processo pai
 *                    atravessa, então nenhuma chave de API atravessa.
 *   tempo          : timeout com kill.
 *   saída          : teto de bytes, com truncamento declarado.
 *
 * ## O que NÃO está isolado
 *
 *   rede : o Permission Model do Node não cobre rede (medido: `fetch` funciona
 *          com `--permission` ligado). Um script pode fazer requisição de
 *          saída. Isolar isso exigiria container ou firewall de processo, que
 *          é outra ordem de dependência.
 *
 * Por isso a tool exige permissão `shell` no contrato, e a `PolicyEngine` já
 * nega `shell` para trust tier `generated` e `community`: na prática, só código
 * partindo do próprio framework ou do dono do processo executa. Este limite
 * está declarado aqui, no README e no SYSTEM.md — não é para ser descoberto
 * depois.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

/** Versão mínima do Node com Permission Model utilizável. */
const MIN_NODE_MAJOR = 20;
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

export interface SandboxRequest {
  /** Código ESM a executar. Roda como módulo: `await` de topo é permitido. */
  code: string;
  /** Raiz do projeto. O diretório de trabalho é criado DENTRO dela. */
  baseDir: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  /**
   * Concede leitura (nunca escrita) da raiz do projeto. Falso por padrão:
   * um script que precisa do repositório inteiro para rodar provavelmente não
   * deveria ser um script gerado.
   */
  allowProjectRead?: boolean;
}

export interface SandboxResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  /** Saída cortada pelo teto de bytes. */
  truncated: boolean;
  durationMs: number;
  /** Diretório de trabalho da execução (já removido quando `cleaned`). */
  workDir: string;
  error?: string;
}

/** Isolamento disponível neste runtime, ou a razão de não estar. */
export function sandboxAvailability(): { available: boolean; reason?: string } {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
    return {
      available: false,
      reason: `Permission Model exige Node >= ${MIN_NODE_MAJOR} (rodando ${process.versions.node})`,
    };
  }
  return { available: true };
}

/**
 * Ambiente mínimo do processo filho.
 *
 * Montado do ZERO em vez de filtrado: uma allowlist erra fechando (falta uma
 * variável e o script não roda), uma denylist erra abrindo (esqueceu um nome e
 * a chave vazou). Só entram as variáveis sem as quais o Node não inicia.
 */
function minimalEnv(workDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'sandbox',
    TMPDIR: workDir,
    TEMP: workDir,
    TMP: workDir,
  };
  // Windows precisa destas para carregar as DLLs do sistema.
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'windir', 'COMSPEC', 'PATHEXT']) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

/**
 * Executa o código em processo isolado. Nunca lança: erro de spawn, timeout e
 * saída não-zero voltam como resultado, porque quem chamou precisa decidir o
 * que fazer com a falha — não ser interrompido por ela.
 */
export async function runInSandbox(request: SandboxRequest): Promise<SandboxResult> {
  const started = Date.now();
  const availability = sandboxAvailability();
  const workDir = path.join(request.baseDir, '.izanagi', 'state', 'sandbox', crypto.randomBytes(6).toString('hex'));
  const base: Omit<SandboxResult, 'ok'> = {
    stdout: '',
    stderr: '',
    exitCode: null,
    timedOut: false,
    truncated: false,
    durationMs: 0,
    workDir,
  };

  if (!availability.available) {
    // Sem isolamento não se executa. Rodar "só desta vez" sem sandbox é como
    // essa classe de vulnerabilidade costuma entrar.
    return { ...base, ok: false, durationMs: Date.now() - started, error: `execução recusada: ${availability.reason}` };
  }
  if (typeof request.code !== 'string' || request.code.trim().length === 0) {
    return { ...base, ok: false, durationMs: Date.now() - started, error: 'código vazio' };
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutput = request.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  let scriptFile: string;
  try {
    fs.mkdirSync(workDir, { recursive: true });
    scriptFile = path.join(workDir, 'script.mjs');
    fs.writeFileSync(scriptFile, request.code, 'utf-8');
  } catch (err) {
    return { ...base, ok: false, durationMs: Date.now() - started, error: `não foi possível preparar a sandbox: ${message(err)}` };
  }

  const args = [
    '--permission',
    `--allow-fs-read=${workDir}`,
    `--allow-fs-write=${workDir}`,
    ...(request.allowProjectRead ? [`--allow-fs-read=${path.resolve(request.baseDir)}`] : []),
    scriptFile,
  ];

  return await new Promise<SandboxResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let settled = false;

    const child = spawn(process.execPath, args, {
      cwd: workDir,
      env: minimalEnv(workDir),
      // Sem herdar stdin: script não interage, e esperar entrada é uma forma
      // silenciosa de travar até o timeout.
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const append = (target: 'out' | 'err', chunk: Buffer) => {
      const current = target === 'out' ? stdout : stderr;
      if (current.length >= maxOutput) {
        truncated = true;
        return;
      }
      const room = maxOutput - current.length;
      const text = chunk.toString('utf-8');
      const slice = text.length > room ? text.slice(0, room) : text;
      if (slice.length < text.length) truncated = true;
      if (target === 'out') stdout += slice;
      else stderr += slice;
    };

    child.stdout?.on('data', (c: Buffer) => append('out', c));
    child.stderr?.on('data', (c: Buffer) => append('err', c));

    // Timeout MARCA e mata; quem resolve é o `close`. Resolver aqui deixaria o
    // processo morrendo com o diretório de trabalho ainda aberto — no Windows
    // isso vira EPERM na limpeza, e o resíduo fica para trás.
    let killed = false;
    const timer = setTimeout(() => {
      if (settled) return;
      killed = true;
      child.kill('SIGKILL');
      // Rede de segurança: processo que não fecha depois do SIGKILL não pode
      // segurar o runtime para sempre.
      graceTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        finish({ timedOut: true, exitCode: null, error: `execução excedeu ${timeoutMs}ms e o processo não encerrou` });
      }, 2000);
    }, timeoutMs);
    let graceTimer: NodeJS.Timeout | undefined;

    const finish = (extra: { timedOut: boolean; exitCode: number | null; error?: string }) => {
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);
      cleanup(workDir);
      resolve({
        ok: !extra.timedOut && extra.exitCode === 0 && !extra.error,
        stdout: truncated ? `${stdout}\n[saída truncada em ${maxOutput} bytes]` : stdout,
        stderr,
        exitCode: extra.exitCode,
        timedOut: extra.timedOut,
        truncated,
        durationMs: Date.now() - started,
        workDir,
        ...(extra.error ? { error: extra.error } : {}),
      });
    };

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      finish({ timedOut: false, exitCode: null, error: `falha ao iniciar a sandbox: ${message(err)}` });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (killed) {
        finish({ timedOut: true, exitCode: null, error: `execução excedeu ${timeoutMs}ms e foi encerrada` });
        return;
      }
      finish({
        timedOut: false,
        exitCode: code,
        ...(code === 0 ? {} : { error: `script terminou com código ${code}` }),
      });
    });
  });
}

/** Remove o diretório de trabalho. Falha aqui não invalida o resultado. */
function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Diretório preso por antivírus ou handle aberto: o resultado da execução
    // continua válido, e o que sobra é lixo em .izanagi/state/sandbox/.
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
