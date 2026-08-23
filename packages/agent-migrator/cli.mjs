#!/usr/bin/env node
"use strict";

/**
 * CLI do agent-migrator — migra definições de agentes v1 (agents/*.json)
 * → representação v2 em YAML estrito (.agents/agents/<slug>.yaml).
 *
 * Uso (a partir da raiz do repo):
 *   node packages/agent-migrator/cli.mjs [--src <dir>] [--dest <dir>] [--check] [--json]
 *
 * Flags:
 *   --src    diretório raiz dos JSONs de agentes (padrão: agents; varredura recursiva)
 *   --dest   destino dos YAMLs derivados      (padrão: .agents/agents)
 *   --check  modo verificação: recalcula os YAMLs esperados e compara byte-a-byte
 *            com o destino, sem escrever nada. Reporta drift, arquivos ausentes e
 *            órfãos (YAML sem JSON de origem). Exit 1 se fora de sincronia.
 *   --json   relatório estruturado em JSON no stdout (além do resumo humano)
 *
 * Códigos de saída: 0 = sincronizado · 1 = falhas/desvio detectado · 2 = uso inválido.
 *
 * Governança (ADR-005): agents/*.json permanece a fonte canônica; os YAMLs são
 * derivação determinística — NUNCA edite-os à mão. Regenerar: rode sem --check.
 */

import path from "node:path";
import process from "node:process";

import { migrateAll } from "./migrate.mjs";

function parseArgs(argv) {
  const args = {
    src: "agents",
    dest: ".agents/agents",
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
      "agent-migrator — agents/*.json (v1) → .agents/agents/<slug>.yaml (v2), determinístico e idempotente",
      "",
      "Uso: node packages/agent-migrator/cli.mjs [flags]",
      "",
      "  --src <dir>     fonte dos JSONs de agentes   (padrão: agents)",
      "  --dest <dir>    destino dos YAMLs derivados  (padrão: .agents/agents)",
      "  --check         verifica sincronia sem escrever (drift/missing/órfãos)",
      "  --json          imprime relatório JSON ao final",
      "  -h | --help     esta ajuda",
      "",
      "Exit codes: 0 sincronizado · 1 falha/desvio · 2 uso inválido",
      "",
    ].join("\n")
  );
}

const STATUS_LABELS = {
  written: "ok",
  ok: "ok",
  drift: "DRIFT",
  missing: "AUSENTE",
};

function formatReport(report) {
  const lines = [];
  lines.push(
    `agent-migrator :: src=${report.srcRoot} dest=${report.destRoot}${
      report.check ? " [CHECK — nada escrito]" : ""
    }`
  );
  lines.push("");
  for (const entry of report.entries) {
    const status = entry.status ?? "?";
    lines.push(
      `  ${STATUS_LABELS[status] ?? status.padEnd(7)}  ${entry.slug.padEnd(24)} ← ${entry.sourceRel.padEnd(
        32
      )} chains=${entry.chains} handoffs=${entry.handoffs} campos=${entry.fields}`
    );
  }
  for (const failure of report.failures) {
    lines.push(`  FALHA  ${failure.source}: ${failure.reason}`);
  }
  for (const orphan of report.orphans) {
    lines.push(`  ÓRFÃO  ${orphan} (YAML no destino sem JSON de origem — nunca apagado automaticamente)`);
  }
  lines.push("");
  lines.push(
    `Total: ${report.total} | Entradas: ${report.entries.length} | Falhas: ${report.failures.length} | Órfãos: ${report.orphans.length} | Tempo: ${(report.elapsedMs / 1000).toFixed(2)}s`
  );
  if (report.treeHash) {
    lines.push(`Tree hash (sha256): ${report.treeHash}`);
  }
  if (report.inSync === true) {
    lines.push("Status: EM SINCRONIA");
  } else if (report.inSync === false) {
    lines.push(
      report.check
        ? "Status: FORA DE SINCRONIA — regenere com: node packages/agent-migrator/cli.mjs"
        : "Status: FALHA — corrija os problemas antes de usar o catálogo"
    );
  }
  return lines.join("\n");
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `[agent-migrator] uso inválido: ${error instanceof Error ? error.message : String(error)}\n\n`
    );
    printUsage();
    process.exitCode = 2;
    return;
  }

  try {
    const report = await migrateAll({
      srcRoot: path.resolve(args.src),
      destRoot: path.resolve(args.dest),
      check: args.check,
    });

    process.stdout.write(formatReport(report) + "\n");
    if (args.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    }

    if (!report.inSync) {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(
      `[agent-migrator] erro fatal: ${error instanceof Error ? error.stack : String(error)}\n`
    );
    process.exitCode = 1;
  }
}

await main();
