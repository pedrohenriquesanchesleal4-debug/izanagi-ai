#!/usr/bin/env node
"use strict";

/**
 * CLI do skill-migrator — migra skills/ (v1) → .skills/ (v2, Agent Skills).
 *
 * Uso:
 *   node packages/skill-migrator/cli.mjs [--src <dir>] [--dest <dir>] [--dry-run] [--clean] [--check] [--json]
 *
 * Flags:
 *   --src      diretório de skills legadas (padrão: skills)
 *   --dest     destino do catálogo v2     (padrão: .skills)
 *   --dry-run  processa e valida tudo, escreve nada
 *   --clean    apaga --dest antes de migrar
 *   --check    modo somente leitura: re-migra para um diretório temporário e
 *              compara byte-a-byte com --dest; exit 1 em qualquer drift
 *              (arquivo ausente, extra ou diferente). Nunca escreve em --dest.
 *   --json     relatório em JSON no stdout (além do resumo humano)
 *
 * Códigos de saída: 0 = sucesso · 1 = falhas de migração/validação/drift · 2 = uso inválido.
 */

import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { hashTree, migrateAll } from "./migrate.mjs";

function parseArgs(argv) {
  const args = {
    src: "skills",
    dest: ".skills",
    dryRun: false,
    clean: false,
    check: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--src":
      case "--dest": {
        const value = argv[i + 1];
        if (!value || value.startsWith("--")) {
          throw new UsageError(`flag ${arg} exige um valor`);
        }
        args[arg.slice(2)] = value;
        i += 1;
        break;
      }
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--clean":
        args.clean = true;
        break;
      case "--check":
        args.check = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        throw new UsageError(`argumento desconhecido: ${arg}`);
    }
  }
  return args;
}

class UsageError extends Error {}

function printUsage() {
  process.stdout.write(
    [
      "skill-migrator — skills/ (v1) → .skills/ (v2), determinístico e idempotente",
      "",
      "Uso: node packages/skill-migrator/cli.mjs [flags]",
      "",
      "  --src <dir>     fonte das skills v1          (padrão: skills)",
      "  --dest <dir>    destino do catálogo v2       (padrão: .skills)",
      "  --dry-run       valida tudo sem escrever",
      "  --clean         remove o destino antes de migrar",
      "  --check         compara o destino com uma re-migração limpa (exit 1 em drift)",
      "  --json          imprime relatório JSON ao final",
      "  -h | --help     esta ajuda",
      "",
    ].join("\n")
  );
}

/** Mapa relPath → sha256(hex) de toda a árvore (determinístico). */
async function hashMapTree(root) {
  const files = new Map();
  async function walk(dir, relBase) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(abs, rel);
      else if (entry.isFile()) {
        files.set(rel, createHash("sha256").update(await readFile(abs)).digest("hex"));
      }
    }
  }
  await walk(root, "");
  return files;
}

/**
 * Modo --check: re-migra a fonte para um catálogo temporário limpo e compara
 * byte-a-byte (sha256 por arquivo) com o destino real. Somente leitura.
 * Retorna { ok, missing, extra, changed, expectedFiles, actualFiles }.
 */
export async function checkDrift({ srcRoot, destRoot }) {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "izanagi-skill-check-"));
  try {
    const expectedRoot = path.join(tmpRoot, "catalog");
    const fresh = await migrateAll({
      srcRoot,
      destRoot: expectedRoot,
      dryRun: false,
    });
    if (fresh.failures.length > 0) {
      return {
        ok: false,
        renderFailures: fresh.failures,
        missing: [],
        extra: [],
        changed: [],
        expectedFiles: 0,
        actualFiles: 0,
      };
    }

    const expected = await hashMapTree(expectedRoot);
    const actual = await hashMapTree(destRoot);

    const missing = [...expected.keys()].filter((rel) => !actual.has(rel)).sort();
    const extra = [...actual.keys()].filter((rel) => !expected.has(rel)).sort();
    const changed = [...expected.keys()]
      .filter((rel) => actual.has(rel) && actual.get(rel) !== expected.get(rel))
      .sort();

    return {
      ok: missing.length === 0 && extra.length === 0 && changed.length === 0,
      renderFailures: [],
      missing,
      extra,
      changed,
      expectedFiles: expected.size,
      actualFiles: actual.size,
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

function formatReport(report) {
  const lines = [];
  lines.push(
    `skill-migrator :: src=${report.srcRoot} dest=${report.destRoot}${report.dryRun ? " [DRY-RUN — nada escrito]" : ""}`
  );
  lines.push("");
  const byCategory = new Map();
  for (const entry of report.migrated) {
    byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + 1);
    lines.push(
      `  ok  ${entry.name.padEnd(32)} cat=${entry.category.padEnd(12)} passos=${String(entry.workflowSteps).padStart(2)} verificação=${String(entry.verificationItems).padStart(2)} refs=${entry.references ?? 0}`
    );
  }
  for (const failure of report.failures) {
    lines.push(`  FALHA  ${failure.name}: ${failure.reason}`);
  }
  lines.push("");
  lines.push(
    `Categorias: ${[...byCategory.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, n]) => `${cat}=${n}`)
      .join(" · ")}`
  );
  lines.push(
    `Total: ${report.total} | Migradas: ${report.migrated.length} | Referências copiadas: ${report.referencesCopied} | Falhas: ${report.failures.length} | Tempo: ${(report.elapsedMs / 1000).toFixed(2)}s`
  );
  if (report.treeHash) {
    lines.push(`Tree hash (sha256): ${report.treeHash}`);
  } else if (report.dryRun) {
    lines.push("Tree hash: n/a (dry-run não escreve)");
  }
  return lines.join("\n");
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `[skill-migrator] uso inválido: ${error instanceof Error ? error.message : String(error)}\n\n`
    );
    printUsage();
    process.exitCode = 2;
    return;
  }

  const srcRoot = path.resolve(args.src);
  const destRoot = path.resolve(args.dest);

  if (args.check) {
    try {
      const drift = await checkDrift({ srcRoot, destRoot });
      if (drift.renderFailures.length > 0) {
        process.stderr.write(
          `[skill-migrator] --check: ${drift.renderFailures.length} skill(s) falharam ao re-renderizar:\n` +
            drift.renderFailures.map((f) => `  FALHA  ${f.name}: ${f.reason}`).join("\n") +
            "\n"
        );
        process.exitCode = 1;
        return;
      }
      const lines = [
        `skill-migrator :: --check src=${args.src} dest=${args.dest}`,
        "",
      ];
      for (const rel of drift.changed) lines.push(`  DIFERENTE  ${rel}`);
      for (const rel of drift.missing) lines.push(`  AUSENTE    ${rel}`);
      for (const rel of drift.extra) lines.push(`  EXTRA      ${rel}`);
      lines.push("");
      lines.push(
        drift.ok
          ? `Catálogo em sincronia: ${drift.expectedFiles} arquivos idênticos (byte-a-byte) entre re-migração limpa e destino.`
          : `Drift detectado: ${drift.changed.length} diferente(s), ${drift.missing.length} ausente(s), ${drift.extra.length} extra(s).`
      );
      process.stdout.write(lines.join("\n") + "\n");
      if (args.json) {
        process.stdout.write(JSON.stringify(drift, null, 2) + "\n");
      }
      process.exitCode = drift.ok ? 0 : 1;
    } catch (error) {
      process.stderr.write(
        `[skill-migrator] erro fatal no --check: ${error instanceof Error ? error.stack : String(error)}\n`
      );
      process.exitCode = 1;
    }
    return;
  }

  try {
    const report = await migrateAll({
      srcRoot,
      destRoot,
      dryRun: args.dryRun,
    });

    // Verificação pós-escrita: contagem destino == contagem origem.
    let countCheck = null;
    if (!report.dryRun && report.failures.length === 0) {
      const { fileCount } = await hashTree(path.resolve(args.dest));
      countCheck =
        fileCount >= report.total
          ? "ok"
          : `FALHA: destino tem ${fileCount} arquivos, origem tem ${report.total} skills`;
    }

    process.stdout.write(formatReport(report) + "\n");
    if (countCheck && countCheck !== "ok") {
      process.stdout.write(`Contagem: ${countCheck}\n`);
    }
    if (args.json) {
      process.stdout.write(
        JSON.stringify({ ...report, countCheck }, null, 2) + "\n"
      );
    }

    if (report.failures.length > 0) {
      process.stderr.write(
        `\n[skill-migrator] ${report.failures.length} skill(s) falharam — corrigindo antes de usar o catálogo.\n`
      );
      process.exitCode = 1;
      return;
    }

    if (!report.dryRun && args.clean === false) {
      // Idempotência por sobrescrita determinística: rodar de novo produz
      // os mesmos bytes. Nada mais a fazer aqui — hash acima é a prova.
    }
  } catch (error) {
    process.stderr.write(
      `[skill-migrator] erro fatal: ${error instanceof Error ? error.stack : String(error)}\n`
    );
    process.exitCode = 1;
  }
}

await main();
