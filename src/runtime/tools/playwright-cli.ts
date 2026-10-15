/**
 * Playwright CLI Tool — automação de navegador com foco em economia de tokens e validação real.
 *
 * Ao contrário de MCPs que expõem a árvore de acessibilidade inteira (consumindo dezenas
 * de milhares de tokens por ação), esta ferramenta executa ações pontuais e determinísticas
 * (navigate, screenshot, inspect, check) retornando resumos compactos e estruturados.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const DEFAULT_BROWSER_TIMEOUT_MS = 30_000;
export const MAX_BROWSER_OUTPUT_BYTES = 16 * 1024;

export interface PlaywrightBrowserOptions {
  action: 'navigate' | 'screenshot' | 'inspect' | 'check';
  url: string;
  selector?: string;
  screenshotPath?: string;
  timeoutMs?: number;
  dir: string;
}

export interface PlaywrightBrowserResult {
  ok: boolean;
  action: string;
  url: string;
  title?: string;
  status?: number;
  headings?: string[];
  consoleErrors?: string[];
  screenshotFile?: string;
  interactiveElements?: { buttons: number; inputs: number; links: number };
  error?: string;
  durationMs: number;
}

/**
 * Script inline executado pelo Node no diretório do projeto.
 * Importa dinamicamente 'playwright' se disponível.
 */
function buildRunnerScript(opts: PlaywrightBrowserOptions): string {
  return `
import { createRequire } from 'module';
const require = createRequire(process.cwd() + '/');

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e1) {
    try {
      playwright = require('playwright');
    } catch (e2) {
      console.log(JSON.stringify({
        ok: false,
        error: 'Playwright não encontrado no projeto. Instale com: npm i -D playwright && npx playwright install'
      }));
      process.exit(0);
    }
  }

  const { chromium } = playwright;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    const response = await page.goto(${JSON.stringify(opts.url)}, {
      timeout: ${Math.min(opts.timeoutMs ?? DEFAULT_BROWSER_TIMEOUT_MS, 60_000)},
      waitUntil: 'domcontentloaded'
    });

    const status = response ? response.status() : 0;
    const title = await page.title();

    let headings = [];
    try {
      headings = await page.$$eval('h1, h2, h3', els => els.slice(0, 8).map(e => (e.textContent || '').trim()).filter(Boolean));
    } catch {}

    let screenshotFile = undefined;
    if (${JSON.stringify(opts.action)} === 'screenshot' || ${JSON.stringify(Boolean(opts.screenshotPath))}) {
      const targetPath = ${JSON.stringify(opts.screenshotPath || 'screenshot.png')};
      await page.screenshot({ path: targetPath, fullPage: false });
      screenshotFile = targetPath;
    }

    let interactiveElements = undefined;
    if (${JSON.stringify(opts.action)} === 'inspect') {
      try {
        const counts = await page.evaluate(() => ({
          buttons: document.querySelectorAll('button, [role="button"]').length,
          inputs: document.querySelectorAll('input, select, textarea').length,
          links: document.querySelectorAll('a[href]').length
        }));
        interactiveElements = counts;
      } catch {}
    }

    await browser.close();

    console.log(JSON.stringify({
      ok: status < 400 && consoleErrors.length === 0,
      action: ${JSON.stringify(opts.action)},
      url: ${JSON.stringify(opts.url)},
      title,
      status,
      headings,
      consoleErrors,
      screenshotFile,
      interactiveElements
    }));
  } catch (err) {
    if (browser) await browser.close();
    console.log(JSON.stringify({
      ok: false,
      action: ${JSON.stringify(opts.action)},
      url: ${JSON.stringify(opts.url)},
      error: err instanceof Error ? err.message : String(err)
    }));
  }
}

main().catch(err => {
  console.log(JSON.stringify({
    ok: false,
    error: err instanceof Error ? err.message : String(err)
  }));
});
`;
}

export async function runBrowserPlaywright(opts: PlaywrightBrowserOptions): Promise<PlaywrightBrowserResult> {
  const start = Date.now();
  const scriptContent = buildRunnerScript(opts);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', scriptContent], {
      cwd: opts.dir,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 2000);
    }, Math.min(opts.timeoutMs ?? DEFAULT_BROWSER_TIMEOUT_MS, 60_000));

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_BROWSER_OUTPUT_BYTES) {
        stdout += chunk.toString('utf-8');
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('close', () => {
      clearTimeout(timeout);
      const durationMs = Date.now() - start;

      if (timedOut) {
        return resolve({
          ok: false,
          action: opts.action,
          url: opts.url,
          error: `Operação do navegador expirou após ${opts.timeoutMs ?? DEFAULT_BROWSER_TIMEOUT_MS}ms`,
          durationMs,
        });
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve({
          ...parsed,
          durationMs,
        });
      } catch {
        resolve({
          ok: false,
          action: opts.action,
          url: opts.url,
          error: stderr.trim() || stdout.trim() || 'Erro desconhecido na execução do Playwright',
          durationMs,
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        action: opts.action,
        url: opts.url,
        error: `Falha ao iniciar processo do navegador: ${err.message}`,
        durationMs: Date.now() - start,
      });
    });
  });
}
