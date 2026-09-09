/**
 * Varre o diretório temporário do sistema e remove o que os testes e scripts
 * do Izanagi criaram e não limparam.
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * Quase toda suíte do runtime cria seu próprio `fs.mkdtempSync(path.join(
 * os.tmpdir(), 'izanagi-<algo>-'))` e nenhuma remove no fim. Medido nesta
 * máquina: **3.517 diretórios** `izanagi-*` acumulados no TEMP do usuário
 * (`izanagi-mem` 384, `izanagi-tools` 264, `izanagi-dash` 240,
 * `izanagi-artifacts` 240, `izanagi-approvals` 216...). Cada `npm test` soma
 * mais uma rodada, e nada nunca subtrai.
 *
 * A alternativa "certa" seria um helper de cleanup em cada um dos ~40 arquivos
 * de teste. Isso é muito mais código para mudar, e um arquivo novo que esqueça
 * o helper volta a vazar em silêncio: a varredura por prefixo cobre o passado
 * e o futuro de uma vez, e roda como `posttest`.
 *
 * SEGURANÇA DA REMOÇÃO
 * --------------------
 * Só entra o que satisfaz TODAS as condições:
 *   1. está DIRETAMENTE dentro de `os.tmpdir()` (nunca recursivo, nunca fora);
 *   2. o nome começa com um dos prefixos que o próprio framework usa;
 *   3. é diretório (ou arquivo com o mesmo prefixo, caso de relatório solto).
 *
 * Nada de glob, nada de `rm -rf` com variável interpolada, nada de seguir
 * symlink: `fs.rmSync(dir, { recursive: true, force: true })` sobre um caminho
 * montado por `path.join` a partir de uma entrada de `readdirSync`.
 *
 * `--dry-run` lista sem remover. `--max-age-hours=N` preserva o que é recente
 * (default 0: remove tudo, que é o que um `posttest` quer).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Prefixos usados pelos testes/scripts do framework. Deliberadamente
 * específicos: `izanagi` sozinho pegaria um diretório de usuário chamado
 * `izanagi-notas`, e um limpador que apaga o que não criou é pior que o
 * vazamento que ele conserta.
 */
export const TEMP_PREFIXES = [
  'izanagi-agentcli-',
  'izanagi-approvals-',
  'izanagi-artifacts-',
  'izanagi-bm-',
  'izanagi-cap-',
  'izanagi-cat-',
  'izanagi-checkpoint-',
  'izanagi-cli-',
  'izanagi-cli-hitl-',
  'izanagi-dash-',
  'izanagi-decisions-',
  'izanagi-doctor-',
  'izanagi-factory-',
  'izanagi-hl-',
  'izanagi-learn-',
  'izanagi-mem-',
  'izanagi-model-',
  'izanagi-orb-',
  'izanagi-path-',
  'izanagi-polyglot-',
  'izanagi-prov-',
  'izanagi-rt-',
  'izanagi-scan-',
  'izanagi-survey-',
  'izanagi-tools-',
  'izanagi-tests-',
  'izanagi-tr-',
  'izanagi-verify-',
];

export interface CleanTempResult {
  scanned: number;
  removed: string[];
  kept: number;
  failed: Array<{ entry: string; reason: string }>;
}

/** `true` quando o nome casa com um prefixo do framework. */
export function isFrameworkTempEntry(name: string): boolean {
  return TEMP_PREFIXES.some((p) => name.startsWith(p));
}

export function cleanTemp(opts: { dryRun?: boolean; maxAgeHours?: number; tmpDir?: string } = {}): CleanTempResult {
  const root = opts.tmpDir ?? os.tmpdir();
  const cutoff = opts.maxAgeHours && opts.maxAgeHours > 0 ? Date.now() - opts.maxAgeHours * 3_600_000 : null;

  const result: CleanTempResult = { scanned: 0, removed: [], kept: 0, failed: [] };

  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch (err) {
    result.failed.push({ entry: root, reason: (err as Error).message });
    return result;
  }

  for (const entry of entries) {
    if (!isFrameworkTempEntry(entry)) continue;
    result.scanned++;

    const full = path.join(root, entry);
    if (cutoff !== null) {
      try {
        if (fs.statSync(full).mtimeMs > cutoff) {
          result.kept++;
          continue;
        }
      } catch {
        // Entrada que desapareceu entre o readdir e o stat: nada a fazer.
        continue;
      }
    }

    if (opts.dryRun) {
      result.removed.push(entry);
      continue;
    }

    try {
      fs.rmSync(full, { recursive: true, force: true });
      result.removed.push(entry);
    } catch (err) {
      // Diretório em uso (Windows segura handle de processo recém-morto) não é
      // motivo para abortar a varredura: some do relatório e volta na próxima.
      result.failed.push({ entry, reason: (err as Error).message });
    }
  }

  return result;
}

/** Execução como script (`node dist/scripts/clean-temp.js`). */
function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const ageArg = args.find((a) => a.startsWith('--max-age-hours='));
  const maxAgeHours = ageArg ? Number(ageArg.split('=')[1]) : 0;
  const quiet = args.includes('--quiet');

  const res = cleanTemp({ dryRun, ...(Number.isFinite(maxAgeHours) && maxAgeHours > 0 ? { maxAgeHours } : {}) });

  if (quiet && res.removed.length === 0 && res.failed.length === 0) return;

  const verb = dryRun ? 'seriam removidos' : 'removidos';
  console.log(
    `\x1b[36m[izanagi clean-temp]\x1b[0m ${res.removed.length} ${verb} de ${res.scanned} encontrados em ${os.tmpdir()}` +
      (res.kept > 0 ? ` (${res.kept} recentes preservados)` : '') +
      (res.failed.length > 0 ? ` \x1b[33m${res.failed.length} em uso\x1b[0m` : ''),
  );
}

// `import.meta.url` termina com o caminho do próprio arquivo quando ele É o
// entrypoint: evita rodar a varredura quando o módulo é só importado por teste.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
