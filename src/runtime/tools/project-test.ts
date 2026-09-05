/**
 * O comando de teste do PROJETO, executado de verdade.
 *
 * Até aqui a camada determinística do runtime tinha oito checks
 * (`artifact-valid | min-size | contains | not-contains | matches |
 * json-field | file-exists | references-exist`) e nenhum deles executava nada.
 * A consequência era medida e específica: a métrica `testResults` da avaliação
 * vinha de um artefato `test-results` que um AGENTE ESCREVEU. O runtime
 * reportava "testes passando" com base num texto produzido pelo mesmo processo
 * que deveria ser testado, que é exatamente a evidência circular que o
 * Verification Engine existe para recusar.
 *
 * ## Por que isto NÃO é o `code.execute`
 *
 * A sandbox de código bloqueia subprocessos de propósito, e afrouxar esse
 * isolamento para caber num item de roadmap seria trocar uma garantia real por
 * uma métrica. Este caminho é outro, e a diferença é qual é a fonte do comando:
 *
 *   code.execute  : o código vem do MODELO. Por isso roda isolado, sem
 *                   subprocesso, sem rede confiável e sem env herdado.
 *   project.test  : o comando vem do PROJETO (o `scripts.test` do manifesto, ou
 *                   o runner padrão da linguagem detectada) e o binário vem de
 *                   uma allowlist fixa deste arquivo. Nenhum campo de entrada
 *                   carrega um comando: não existe caminho pelo qual um modelo
 *                   escolha o que é executado.
 *
 * Rodar `npm test` num projeto é a mesma confiança de digitar `npm test` nele.
 * Por isso o caminho é OPT-IN (`--verify-tests`), a permissão é `shell` (que a
 * `PolicyEngine` nega a trust tier `generated` e `community`), o tempo tem
 * teto, e a saída tem teto declarado.
 *
 * ## O que este arquivo NÃO faz
 *
 * Não instala dependência, não escolhe framework de teste e não interpreta o
 * relatório: devolve o comando, o exit code e a saída cortada. "Passou" é
 * `exitCode === 0`, decidido pelo processo, não por leitura de texto — parsear
 * o stdout de um test runner para decidir aprovação seria reintroduzir a
 * adivinhação pelo lado da saída.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const DEFAULT_TEST_TIMEOUT_MS = 300_000;
export const MAX_TEST_OUTPUT_BYTES = 32 * 1024;

/**
 * Runners aceitos, por linguagem. O binário é fixo aqui: o projeto escolhe
 * QUAL runner (pelos arquivos que tem), nunca QUE COMANDO roda.
 */
export interface TestRunner {
  /** Identificador estável, usado no relatório e nos testes. */
  id: string;
  /** Binário e argumentos. Nada aqui vem de input. */
  command: string;
  args: string[];
  /** Por que este runner foi escolhido (aparece no artefato). */
  reason: string;
}

export interface DetectResult {
  runner?: TestRunner;
  /** Por que nenhum runner foi detectado. Presente quando `runner` é ausente. */
  reason?: string;
}

/**
 * Descobre o comando de teste a partir do que existe no diretório.
 *
 * Ordem por especificidade: um manifesto Node com `scripts.test` é o sinal mais
 * forte que um projeto pode dar sobre como se testa. Ausente ele, a presença do
 * manifesto da linguagem decide.
 *
 * `scripts.test` NÃO é lido como comando: o que é verificado é que o script
 * existe e não é o placeholder que o `npm init` escreve. O binário continua
 * sendo `npm`, e o que ele roda é o que o dono do projeto escreveu ali.
 */
export function detectTestRunner(dir: string): DetectResult {
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    let scripts: Record<string, unknown> = {};
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, unknown> };
      scripts = pkg.scripts ?? {};
    } catch {
      return { reason: 'package.json ilegível' };
    }
    const test = scripts.test;
    if (typeof test !== 'string' || test.trim().length === 0) {
      return { reason: 'package.json sem "scripts.test"' };
    }
    // O placeholder do `npm init` sai com exit 1 e não testa nada: aceitá-lo
    // faria o check reprovar todo projeto que nunca configurou teste, dizendo
    // "os testes falharam" sobre testes que não existem.
    if (/no test specified/i.test(test)) {
      return { reason: '"scripts.test" é o placeholder do npm init (nenhum teste configurado)' };
    }
    return {
      runner: {
        id: 'npm',
        command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args: ['test', '--silent'],
        reason: `package.json declara "scripts.test": ${clip(test, 120)}`,
      },
    };
  }

  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
    return { runner: { id: 'cargo', command: 'cargo', args: ['test'], reason: 'Cargo.toml na raiz' } };
  }
  if (fs.existsSync(path.join(dir, 'go.mod'))) {
    return { runner: { id: 'go', command: 'go', args: ['test', './...'], reason: 'go.mod na raiz' } };
  }
  for (const manifest of ['pyproject.toml', 'setup.cfg', 'pytest.ini', 'tox.ini']) {
    if (fs.existsSync(path.join(dir, manifest))) {
      return { runner: { id: 'pytest', command: 'python', args: ['-m', 'pytest', '-q'], reason: `${manifest} na raiz` } };
    }
  }
  return { reason: 'nenhum manifesto reconhecido (package.json, Cargo.toml, go.mod, pyproject.toml)' };
}

export interface TestRunResult {
  /** Comando efetivamente executado, para o relatório. */
  command: string;
  runner: string;
  /** Por que este runner. */
  detectedBy: string;
  /**
   * `exitCode === 0`. Ausente quando o comando não chegou a rodar: "não medi"
   * nunca vira `false`, que se leria como "os testes falharam".
   */
  passed?: boolean;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
  /** Presente quando o comando não pôde ser executado (binário ausente, etc). */
  error?: string;
}

/**
 * Executa o runner detectado. Nunca lança: binário ausente, timeout e saída
 * não-zero voltam como resultado, porque quem chamou precisa registrar a falha
 * e não ser interrompido por ela.
 *
 * O ambiente do processo pai É herdado aqui, ao contrário da sandbox de código:
 * um test runner precisa de PATH, de HOME e do que o projeto configurou. Esta é
 * a diferença de confiança entre executar o comando do projeto e executar o
 * código de um modelo, e é o motivo de o caminho ser opt-in.
 */
export async function runProjectTests(opts: {
  dir: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
}): Promise<TestRunResult> {
  const started = Date.now();
  const { runner, reason } = detectTestRunner(opts.dir);
  if (!runner) {
    return {
      command: '(nenhum)',
      runner: 'none',
      detectedBy: reason ?? 'não detectado',
      exitCode: null,
      timedOut: false,
      durationMs: Date.now() - started,
      stdout: '',
      stderr: '',
      truncated: false,
      error: `nenhum comando de teste detectado em "${opts.dir}": ${reason ?? 'motivo desconhecido'}`,
    };
  }

  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS, 1_000), 900_000);
  const maxBytes = opts.maxOutputBytes ?? MAX_TEST_OUTPUT_BYTES;
  const command = `${runner.command} ${runner.args.join(' ')}`;

  return await new Promise<TestRunResult>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(runner.command, runner.args, {
        cwd: opts.dir,
        env: process.env,
        // `shell: false` é a garantia: sem shell não há expansão, não há `&&`,
        // não há pipe. O binário é o da allowlist e os argumentos são os deste
        // arquivo, mesmo que algum deles contenha um caractere especial.
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        command,
        runner: runner.id,
        detectedBy: runner.reason,
        exitCode: null,
        timedOut: false,
        durationMs: Date.now() - started,
        stdout: '',
        stderr: '',
        truncated: false,
        error: `falha ao executar "${command}": ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let settled = false;

    const append = (current: string, chunk: string): string => {
      if (current.length >= maxBytes) {
        truncated = true;
        return current;
      }
      const room = maxBytes - current.length;
      if (chunk.length > room) {
        truncated = true;
        return current + chunk.slice(0, room);
      }
      return current + chunk;
    };

    child.stdout?.on('data', (c: Buffer) => {
      stdout = append(stdout, c.toString('utf-8'));
    });
    child.stderr?.on('data', (c: Buffer) => {
      stderr = append(stderr, c.toString('utf-8'));
    });

    const finish = (result: Omit<TestRunResult, 'command' | 'runner' | 'detectedBy' | 'durationMs' | 'stdout' | 'stderr' | 'truncated'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve({
        command,
        runner: runner.id,
        detectedBy: runner.reason,
        durationMs: Date.now() - started,
        stdout,
        stderr,
        truncated,
        ...result,
      });
    };

    // Kill do GRUPO não é possível de forma portável aqui, então o kill é do
    // processo: um runner que deixa filho vivo é problema do projeto, e
    // registrar o timeout é mais honesto que esperar indefinidamente.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ exitCode: null, timedOut: true, error: `tempo esgotado após ${timeoutMs}ms` });
    }, timeoutMs);

    const onAbort = () => {
      child.kill('SIGKILL');
      finish({ exitCode: null, timedOut: false, error: 'execução cancelada' });
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', (err) => {
      finish({
        exitCode: null,
        timedOut: false,
        error: `falha ao executar "${command}": ${err instanceof Error ? err.message : String(err)}`,
      });
    });

    child.on('close', (code) => {
      finish({ passed: code === 0, exitCode: code, timedOut: false });
    });
  });
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
