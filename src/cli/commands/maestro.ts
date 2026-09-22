/**
 * `izanagi maestro init | plan | run | goal | list | show | remove-playbook`.
 *
 * A ponte para o RunMaestro: planeja com o Commander, converte o grafo em
 * Auto Run docs e despacha via `maestro-cli`. Dispatcher fino: a lógica vive
 * em `src/runtime/maestro/`.
 *
 * Registro no `src/cli/index.ts` (case 'maestro') é feito pelo orquestrador
 * junto da remoção do canvas, fora do escopo deste comando.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Commander, type CommanderInput } from '../../runtime/orchestration/commander.js';
import { parseAcceptance } from '../../runtime/contracts/acceptance.js';
import type { ExecutionMode } from '../../runtime/contracts/task-contract.js';
import { exportGraphToDocs } from '../../runtime/maestro/export-plan.js';
import { runMaestro, streamMaestro } from '../../runtime/maestro/cli.js';
import { maestroInit } from '../../runtime/maestro/init.js';
import { summarizeGoal, summarizeRun } from '../../runtime/maestro/events.js';
import type { GoalEvent, MaestroEvent, RunEvent } from '../../runtime/maestro/types.js';

const MODES: ReadonlySet<string> = new Set(['direct', 'assisted', 'orchestrated', 'autonomous']);

const HELP = `\x1b[1mizanagi maestro\x1b[0m: ponte para o RunMaestro (runmaestro.ai)

Planeja com o Commander e despacha via maestro-cli. O Maestro é o executor;
o Izanagi é o planejador e tradutor do grafo em Auto Run docs.

Uso:
  izanagi maestro init [--name N] [--channel TYPE] [--workspace DIR]
      Cria um agente Maestro vinculado a um workspace (seletor de provider).

  izanagi maestro plan "<objetivo>" [--mode M] [--acceptance A] [--out DIR]
      Commander -> Auto Run docs em .maestro/playbooks/<slug>/.
      --mode: direct|assisted|orchestrated|autonomous
      --acceptance: critério de aceite (repita a flag para vários)

  izanagi maestro run <doc|playbook-id>... --agent <id> [--model M] [--effort E] [--json]
      Executa docs gerados. Arg que não é .md ou tem prefixo playbook: delega a playbook <id>.

  izanagi maestro goal <agent-id> "<objetivo>" [--exit-criteria T] [--max-iterations N] [--json]
      Modo Goal-Driven: sem doc/checkbox.

  izanagi maestro list agents|playbooks [-a ID]
  izanagi maestro show playbook <id>
  izanagi maestro remove-playbook <agent-id> <playbook-id>

Exit codes do maestro-cli: 0 ok, 1 falha, 2 uso, 3 app desktop não rodando,
4 app desatualizado, 5 timeout (ver documento para detalhes).

Exemplos:
  izanagi maestro init
  izanagi maestro plan "Adicionar paginação em GET /users" --mode orchestrated
  izanagi maestro run .maestro/playbooks/meu-slug/01-fase-1.md --agent ag-1 --json
`;

const FLAGS_INIT = new Set(['--name', '--channel', '--workspace']);
const FLAGS_PLAN = new Set(['--mode', '--acceptance', '--out']);
const FLAGS_RUN = new Set(['--agent', '--model', '--effort', '--json']);
const FLAGS_GOAL = new Set(['--exit-criteria', '--max-iterations', '--json']);

function positional(args: string[], flags: ReadonlySet<string>): string[] {
  return args.filter((a) => !flags.has(a) && !a.startsWith('-') && !a.startsWith('--'));
}

function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

/** Coleta o valor de TODAS as ocorrências da flag (ex.: vários --acceptance). */
function collectFlag(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) {
      const value = args[i + 1];
      if (value !== undefined) values.push(value);
    }
  }
  return values;
}

/** Classifica o argumento de `run`: caminho de doc ou id de playbook. */
function classifyDocArg(raw: string): { kind: 'doc'; file: string } | { kind: 'playbook'; id: string } {
  if (raw.startsWith('playbook:')) return { kind: 'playbook', id: raw.slice('playbook:'.length) };
  const abs = path.resolve(raw);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return { kind: 'doc', file: abs };
  return { kind: 'playbook', id: raw };
}

function isGoalEvent(e: MaestroEvent): e is GoalEvent {
  return (
    e.type === 'goal_start' ||
    e.type === 'goal_iteration_start' ||
    e.type === 'goal_iteration_complete' ||
    e.type === 'goal_complete'
  );
}

async function initSub(rest: string[]): Promise<void> {
  const workspace = path.resolve(flagValue(rest, '--workspace') ?? process.cwd());
  const result = await maestroInit({
    workspace,
    name: flagValue(rest, '--name'),
    channel: flagValue(rest, '--channel'),
  });

  if (!result.created) {
    console.error(`\n\x1b[31mFalha ao criar o agente Maestro:\x1b[0m ${result.error ?? 'sem detalhes'}`);
    if (result.output) console.error(result.output);
    process.exit(1);
  }

  console.log(`\n\x1b[32m✔\x1b[0m Agente Maestro criado: \x1b[1m${result.agentName}\x1b[0m (channel ${result.channel})`);
  if (result.agentId) console.log(`  id: ${result.agentId}`);
  console.log(`  auto-run folder: ${result.autoRunFolder}`);
  console.log('\nPróximo passo: \x1b[33mizanagi maestro plan "<objetivo>"\x1b[0m\n');
}

async function planSub(rest: string[]): Promise<void> {
  const objective = positional(rest, FLAGS_PLAN)[0];
  if (!objective) {
    throw new Error('Uso: izanagi maestro plan "<objetivo>" [--mode M] [--acceptance A] [--out DIR]');
  }

  const modeRaw = flagValue(rest, '--mode');
  if (modeRaw && !MODES.has(modeRaw)) {
    throw new Error(`Modo inválido: "${modeRaw}" (esperado direct|assisted|orchestrated|autonomous)`);
  }
  const acceptanceLines = collectFlag(rest, '--acceptance');
  const parsedAcceptance = acceptanceLines.length > 0 ? parseAcceptance(acceptanceLines) : null;
  if (parsedAcceptance && parsedAcceptance.issues.length > 0) {
    // Recusa não é silenciosa: o usuário corrige antes de exportar.
    throw new Error(`Critério(s) de aceite inválido(s): ${parsedAcceptance.issues.join('; ')}`);
  }

  const input: CommanderInput = {
    objective,
    ...(modeRaw ? { mode: modeRaw as ExecutionMode } : {}),
    ...(parsedAcceptance ? { acceptance: parsedAcceptance.criteria } : {}),
  };
  const plan = new Commander().plan(input);

  const outRaw = flagValue(rest, '--out') ?? path.join(process.cwd(), '.maestro', 'playbooks');
  const exported = exportGraphToDocs(plan.graph, {
    out: path.resolve(outRaw),
    footer: `plano ${plan.mode} · ${plan.contracts.length} contrato(s) · ${plan.estimate.nodes} nó(s)`,
  });

  console.log(`\n\x1b[35m=== Izanagi -> Maestro: plano exportado ===\x1b[0m`);
  console.log(`  objetivo: ${objective.slice(0, 90)}`);
  console.log(`  modo: ${plan.mode} · nós: ${plan.estimate.nodes} · batches: ${plan.graph.parallelBatches.length}`);
  if (exported.docs.length === 0) {
    console.log(`\n  \x1b[33mNenhuma task de execução no grafo:\x1b[0m nada foi escrito.`);
    console.log(`  \x1b[90mNós pulados (tool/gate do runtime): ${exported.skipped.join(', ') || 'nenhum'}\x1b[0m\n`);
    return;
  }
  for (const doc of exported.docs) {
    console.log(`  • ${doc.filename} (${doc.tasks.length} task(s))${doc.tasks.some((t) => t.hitl) ? ' · HITL' : ''}`);
  }
  console.log(`  \x1b[90m${exported.taskCount} task(s) · ${exported.hitlCount} HITL · ${exported.skipped.length} nó(s) pulado(s)\x1b[0m`);
  console.log(`  docs em: \x1b[33m${exported.dir}\x1b[0m`);
  console.log(`  rodar: \x1b[33mizanagi maestro run "${path.join(exported.dir, exported.docs[0]!.filename)}" --agent <id> --json\x1b[0m\n`);
}

async function dispatchStream(base: string[], label: string): Promise<void> {
  const events: MaestroEvent[] = [];
  const result = await streamMaestro(
    [...base, '--json'],
    (event) => {
      events.push(event);
      console.log(JSON.stringify(event));
    },
    {},
  );
  const runEvents = events.filter((e): e is RunEvent => !isGoalEvent(e));
  const summary = summarizeRun(runEvents);
  if (summary.success !== null) {
    const status = summary.success ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m';
    console.log(`  ${status} ${label}: ${summary.totalTasksCompleted} task(s) concluída(s)`);
    if (summary.totalCost !== undefined) console.log(`    custo: $${summary.totalCost.toFixed(4)}`);
  }
  for (const s of summary.stalled) {
    console.error(`  \x1b[33m!\x1b[0m stalled: ${s.document} (${s.reason ?? 'sem motivo'}) · ${s.remaining ?? 0} restante(s)`);
  }
  if (summary.halted) console.error(`  \x1b[33m!\x1b[0m halt: ${summary.haltedReason ?? 'sem motivo'}`);
  for (const g of summary.gated) {
    console.error(`  \x1b[33m!\x1b[0m gated (HITL, headless pula): ${g.document} (${g.reason ?? 'sem motivo'})`);
  }
  console.log('');
}

async function dispatchPlain(base: string[], label: string): Promise<void> {
  const result = await runMaestro(base, {});
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.code !== 0) {
    console.error(`\n\x1b[31m${label}:\x1b[0m ${result.message}\n`);
  } else {
    console.log(`\n\x1b[32m✔\x1b[0m ${label} concluído (exit 0)\n`);
  }
}

async function runSub(rest: string[]): Promise<void> {
  const docs = positional(rest, FLAGS_RUN);
  if (docs.length === 0) {
    throw new Error('Uso: izanagi maestro run <doc|playbook-id>... --agent <id> [--model M] [--effort E] [--json]');
  }
  const agent = flagValue(rest, '--agent');
  const asJson = rest.includes('--json');
  const model = flagValue(rest, '--model');
  const effort = flagValue(rest, '--effort');
  const extra = [...(model ? ['--model', model] : []), ...(effort ? ['--effort', effort] : [])];

  for (const raw of docs) {
    const kind = classifyDocArg(raw);
    if (kind.kind === 'playbook') {
      const base = ['playbook', kind.id, ...extra];
      if (asJson) {
        await dispatchStream(base, `playbook ${kind.id}`);
      } else {
        await dispatchPlain(base, `playbook ${kind.id}`);
      }
      continue;
    }
    if (!agent) {
      throw new Error('Uso: --agent <id> é obrigatório para docs Auto Run');
    }
    const base = ['run-doc', kind.file, '--agent', agent, ...extra];
    if (asJson) {
      await dispatchStream(base, `doc ${path.basename(kind.file)}`);
    } else {
      await dispatchPlain(base, `doc ${path.basename(kind.file)}`);
    }
  }
}

async function goalSub(rest: string[]): Promise<void> {
  const pos = positional(rest, FLAGS_GOAL);
  const agent = pos[0];
  if (!agent) {
    throw new Error('Uso: izanagi maestro goal <agent-id> "<objetivo>" [--exit-criteria T] [--max-iterations N] [--json]');
  }
  const objective = pos.slice(1).join(' ');
  if (!objective) throw new Error('Objetivo é obrigatório: izanagi maestro goal <agent-id> "<objetivo>"');

  const exitCriteria = flagValue(rest, '--exit-criteria');
  const maxIterations = flagValue(rest, '--max-iterations');
  const base = [
    'goal-run',
    agent,
    objective,
    ...(exitCriteria ? ['--exit-criteria', exitCriteria] : []),
    ...(maxIterations ? ['--max-iterations', maxIterations] : []),
  ];

  if (rest.includes('--json')) {
    const events: MaestroEvent[] = [];
    await streamMaestro(
      [...base, '--json'],
      (event) => {
        events.push(event);
        console.log(JSON.stringify(event));
      },
      {},
    );
    const summary = summarizeGoal(events.filter(isGoalEvent));
    if (summary.success !== null) {
      const status = summary.success ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m';
      console.log(`  ${status} goal ${agent}: ${summary.iterations} iteração(ões) · progresso ${Math.round((summary.finalProgress ?? 0) * 100)}%`);
      if (summary.exitReason) console.log(`    exit: ${summary.exitReason}`);
      if (summary.deadlocks > 0) console.error(`  \x1b[33m!\x1b[0m ${summary.deadlocks} iteração(ões) em deadlock`);
      if (summary.lastRationale) console.log(`    último rationale: ${summary.lastRationale.slice(0, 120)}`);
    }
    console.log('');
    return;
  }
  await dispatchPlain(base, `goal ${agent}`);
}

async function listSub(rest: string[]): Promise<void> {
  const kind = rest.find((a) => a === 'agents' || a === 'playbooks');
  if (!kind) throw new Error('Uso: izanagi maestro list agents|playbooks [-a ID]');
  const id = flagValue(rest, '-a');
  const base = ['list', kind, ...(id ? ['-a', id] : [])];
  const result = await runMaestro(base, {});
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.code !== 0) console.error(`\n\x1b[31mlist ${kind}:\x1b[0m ${result.message}\n`);
}

async function showSub(rest: string[]): Promise<void> {
  const id = rest.find((a) => a !== 'playbook' && !a.startsWith('-'));
  if (rest[0] !== 'playbook' || !id) {
    throw new Error('Uso: izanagi maestro show playbook <id>');
  }
  const result = await runMaestro(['show', 'playbook', id], {});
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.code !== 0) console.error(`\n\x1b[31mshow playbook:\x1b[0m ${result.message}\n`);
}

async function removeSub(rest: string[]): Promise<void> {
  const ids = rest.filter((a) => !a.startsWith('-'));
  if (ids.length < 2) throw new Error('Uso: izanagi maestro remove-playbook <agent-id> <playbook-id>');
  await dispatchPlain(['remove-playbook', ids[0]!, ids[1]!], 'remove-playbook');
}

/**
 * Subcomando `izanagi maestro ...`.
 *
 * @param baseDir  Raiz dos ASSETS do framework (agentes, skills).
 * @param stateDir Raiz do ESTADO deste projeto (`.izanagi/state`).
 */
export async function maestroCommand(baseDir: string, args: string[], stateDir = baseDir): Promise<void> {
  const sub = args[0]?.toLowerCase() ?? 'help';
  const rest = args.slice(1);
  try {
    switch (sub) {
      case 'init':
        await initSub(rest);
        return;
      case 'plan':
        await planSub(rest);
        return;
      case 'run':
        await runSub(rest);
        return;
      case 'goal':
        await goalSub(rest);
        return;
      case 'list':
        await listSub(rest);
        return;
      case 'show':
        await showSub(rest);
        return;
      case 'remove-playbook':
      case 'remove':
        await removeSub(rest);
        return;
      case 'help':
      case '--help':
      case '-h':
        console.log(HELP);
        return;
      default:
        console.error(`\x1b[31mUnknown subcommand:\x1b[0m ${sub}\n`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n\x1b[31mMaestro:\x1b[0m ${message}\n`);
    console.log(HELP);
    process.exit(1);
  }
}