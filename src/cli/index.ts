import fs from 'fs';
import path from 'path';
import { getPackageDir, resolveFrameworkRoot, resolveStateRoot } from '../installer.js';

import { doctorCommand } from './commands/doctor.js';
import { listCommand } from './commands/list.js';
import { initCommand } from './commands/init.js';
import { compileCommand } from './commands/compile.js';
import { runCommand } from './commands/run.js';
import { createCommand } from './commands/create.js';
import { chatCommand } from './commands/chat.js';
import { exportCommand } from './commands/export.js';
import { agentCommand } from './commands/agent.js';
import { skillCommand } from './commands/skill.js';
import { workflowCommand } from './commands/workflow.js';
import { traceCommand } from './commands/trace.js';
import { evalCommand } from './commands/eval.js';
import { benchmarkCommand } from './commands/benchmark.js';
import { memoryCommand } from './commands/memory.js';
import { diagnoseCommand } from './commands/diagnose.js';
import { dashboardCommand } from './commands/dashboard.js';
import { resumeCommand } from './commands/resume.js';
import { approveCommand } from './commands/approve.js';
import { rejectCommand } from './commands/reject.js';
import { explainCommand } from './commands/explain.js';
import { polyglotCommand } from './commands/polyglot.js';
import { modelsCommand } from './commands/models.js';
import { budgetCommand } from './commands/budget.js';

/**
 * `packageDir` é SEMPRE a instalação do próprio izanagi-ai (node_modules/izanagi-ai ou
 * o checkout do repo) — só serve pra ler o `package.json` do pacote (versão) e como
 * fallback quando o projeto do usuário ainda não rodou `izanagi init`.
 *
 * `baseDir` é o que TODO comando de runtime (run/doctor/memory/trace/agent/skill/...)
 * recebe como raiz real do PROJETO DO USUÁRIO: prioriza `.agents/` do diretório atual
 * (projeto inicializado), senão cai pro `packageDir`. Bug corrigido em 2026-08-15:
 * antes, `baseDir` era sempre `packageDir` (nunca olhava pro cwd do usuário) — todo
 * comando de runtime lia/escrevia dentro da própria instalação do pacote em vez do
 * projeto real, algo que só passava despercebido rodando o CLI de dentro do próprio
 * checkout do framework (onde as duas coisas coincidem por acidente).
 */
const packageDir = getPackageDir();
const baseDir = resolveFrameworkRoot(process.cwd());

/**
 * Raiz do ESTADO deste projeto (`.izanagi/state`), que NÃO é a mesma coisa que
 * `baseDir`.
 *
 * `baseDir` responde "de onde leio agentes e skills?" e cai na instalação do
 * pacote quando o projeto não tem `.agents/` — o que está certo para assets.
 * Usar a mesma raiz para o estado fazia todo projeto não inicializado gravar
 * trace, artefato (com conteúdo) e memória dentro de `node_modules/izanagi-ai/`,
 * compartilhados entre todos esses projetos: `izanagi trace` listava execução
 * de outro projeto, e um `npm update` apagava o histórico.
 *
 * Projeto inicializado não muda de lugar.
 */
const stateDir = resolveStateRoot(process.cwd());

function showVersion(): void {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8'));
  console.log(`Izanagi AI CLI v${pkg.version}`);
}

export async function runCLI(args: string[]): Promise<void> {
  const raw = args[0] || 'help';
  const command = raw.toLowerCase();
  const rest = args.slice(1);

  switch (command) {
    case 'init':
      await initCommand(rest);
      break;

    case 'list':
    case 'skills':
    case 'agents': {
      const filter = rest[0] || (command === 'skills' ? 'skills' : command === 'agents' ? 'agents' : 'all');
      listCommand(baseDir, filter);
      break;
    }

    case 'agent':
      agentCommand(baseDir, rest);
      break;

    case 'skill':
      await skillCommand(baseDir, rest);
      break;

    case 'workflow':
      workflowCommand(baseDir, rest);
      break;

    case 'run':
    case 'resolve':
      await runCommand(baseDir, rest, stateDir);
      break;

    case 'trace':
      traceCommand(stateDir, rest);
      break;

    case 'eval':
    case 'evaluate':
      evalCommand(stateDir, rest);
      break;

    case 'benchmark':
    case 'bench':
    // "arena" é o nome do mesmo sistema de benchmark na nomenclatura do roadmap
    // (seção 13) — mesmo handler, sem reimplementar nada (regra "não crie
    // comandos redundantes"); `benchmark`/`bench` continuam funcionando por
    // compatibilidade com quem já usa a CLI hoje.
    case 'arena':
      await benchmarkCommand(baseDir, rest, stateDir);
      break;

    case 'memory':
      memoryCommand(stateDir, rest);
      break;

    case 'models':
      modelsCommand(baseDir, rest);
      break;

    case 'budget':
      budgetCommand(stateDir, rest);
      break;

    case 'diagnose':
      diagnoseCommand(baseDir, stateDir);
      break;

    case 'dashboard':
      dashboardCommand(stateDir, rest);
      break;

    case 'resume':
      await resumeCommand(baseDir, rest, stateDir);
      break;

    case 'approve':
      await approveCommand(baseDir, rest, stateDir);
      break;

    case 'reject':
      await rejectCommand(baseDir, rest, stateDir);
      break;

    case 'explain':
      explainCommand(stateDir, rest);
      break;

    // Ponte de diagnóstico com os núcleos poliglotas (Rust/Go/Python/packages TS):
    // só checagens de existência + probes baratos, nunca executa os núcleos.
    case 'polyglot':
      await polyglotCommand(rest);
      break;

    case 'chat':
    case 'repl':
    case 'interactive':
      chatCommand(baseDir);
      break;

    case 'create':
      createCommand(baseDir, rest[0], rest[1]);
      break;

    case 'compile':
    case 'build':
      compileCommand(baseDir, rest[0], rest[1]);
      break;

    case 'doctor':
    case 'check':
    case 'validate':
      doctorCommand(baseDir, rest, stateDir);
      break;

    case 'export':
      exportCommand(rest);
      break;

    case 'version':
    case '-v':
    case '--version':
      showVersion();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.error(`\x1b[31mUnknown option:\x1b[0m ${raw}\n`);
      showHelp();
      break;
  }
}

function showHelp(): void {
  console.log(`
\x1b[1m\x1b[36mIzanagi AI CLI - Modular Skill & Agent Framework for Autonomous AI Coding\x1b[0m

\x1b[1mUsage:\x1b[0m
  izanagi <command> [options]

  \x1b[1mCommands:\x1b[0m
  \x1b[32minit [dir] [--packs a,b,c]\x1b[0m      Creates a project with selectable skill packs (.agents).
  \x1b[32mchat / repl\x1b[0m                   Launches interactive CLI shell (REPL mode).
  \x1b[32mrun [agent] --task "<task>"\x1b[0m     Adaptive Runtime: Commander + graph + roteamento por papel + verificação + trace + healing.
                          (--mode direct|assisted|orchestrated|autonomous força o modo de execução)
                          (--budget N · --max-cost N · --model <id> · --local · --cache · --no-commander · --no-judge · --json · --notify-webhook=<url>)
                          (--output <dir> grava a entrega do run no projeto; --no-survey desliga a leitura do projeto antes de decidir)
                          (--acceptance "<critério>" repetível: o que a ENTREGA precisa cumprir; --allow-tool <id> restringe as tools do run)
                          (--verify-tests roda o comando de teste do PROJETO no fim do grafo: a métrica de teste passa a vir do exit code)
                          (--min-quality 0..1 compara estratégias e escolhe a mais barata que atinge o piso de VERIFICAÇÃO)
                          (--prompt-only só compila izanagi-prompt.md, sem executar)
  \x1b[32mcreate <agent|skill> <name>\x1b[0m    Bare scaffold, no validation/security-scan — quick manual starting point.
  \x1b[32mcompile <agent> [file]\x1b[0m         Compiles ready-to-use prompt for an Agent (e.g. architect, security).
  \x1b[32mlist [skills|agents]\x1b[0m           Lists all registered skills and agents.
  \x1b[32mdoctor [--deep]\x1b[0m                Validates framework integrity + runtime (deep).
  \x1b[32magent list|inspect|create <req>\x1b[0m Agent Genome: lista/inspeciona/gera via Agent Factory (validado, recomendado).
  \x1b[32mskill list|search|inspect|create\x1b[0m Skill Manifest: lista/busca/inspeciona/gera via Skill Factory (validado, recomendado).
  \x1b[32mworkflow list|inspect <name>\x1b[0m   Execution Graph templates e composições.
  \x1b[32mtrace [run-id]\x1b[0m                 Observabilidade: lista/mostra execuções.
  \x1b[32meval [file|--metrics|--report]\x1b[0m Avalia artefatos/resultados (Evaluation Engine).
  \x1b[32mbenchmark list|run|memory\x1b[0m      Suíte de benchmarks (run --execute mede execução real) + benchmark memory (busca e compressão).
  \x1b[32mmemory inspect|search <q>\x1b[0m      Memória persistente (patterns, learnings, stats).
  \x1b[32mmodels [--json]\x1b[0m                Catálogo de modelos + roteamento por papel (commander/specialist/worker).
  \x1b[32mbudget [run-id] [--json]\x1b[0m       Para onde foi o orçamento: tokens por fase, custo, cache, degradação.
  \x1b[32mdiagnose\x1b[0m                       Diagnóstico profundo do runtime.
  \x1b[32mpolyglot status [--json|--strict]\x1b[0m Saúde dos núcleos poliglotas (Rust, Go, Python, packages TS) — diagnóstico, exit 0; --strict sai 1 se algo ausente.
  \x1b[32mdashboard [--port N]\x1b[0m           Sobe o Dashboard local (Run Explorer, Arena, Memory) em http://localhost.
  \x1b[32mresume <run-id>\x1b[0m                Retoma execução interrompida/pausada a partir do checkpoint.
  \x1b[32mapprove <run-id> [node-id]\x1b[0m     Aprova ação de alto risco pausada (human-in-the-loop) e retoma.
  \x1b[32mreject <run-id> [node-id] [--reason]\x1b[0m Rejeita ação pausada e retoma (nó falha com o motivo).
  \x1b[32mexplain <run-id> [--artifacts] [--conversation]\x1b[0m  Por que o Izanagi decidiu isso: decisões, conversa entre agentes, healing, veredito e artefatos.
  \x1b[32mexport --cli <target>\x1b[0m         Exports framework adapters for other AI CLIs
                          (claude, codex, cursor, copilot, kimi, all).
  \x1b[32mversion\x1b[0m                       Displays Izanagi AI version.

\x1b[1mOptions:\x1b[0m
  \x1b[32m--version, -v\x1b[0m                  Displays version.
  \x1b[32m--help, -h\x1b[0m                     Displays help.
  \x1b[32m--packs <ids>\x1b[0m                 Skip interactive selection: comma-separated pack ids
                          (core,agents,skills,architecture,coding,database,devops,security,testing,memory,optimization,teaching).

\x1b[1mExamples:\x1b[0m
  izanagi init my-project
  izanagi init my-project --packs core,agents,coding,database
  izanagi run "Refactor user authentication to JWT"
  izanagi run "Create a login page" --prompt-only
  izanagi run "Converta 10 dólares para reais"                  (modo direct: 1 chamada, sem grafo)
  izanagi run "..." --mode autonomous --max-cost 0.50
  izanagi run "..." --local --cache
  izanagi run "adicionar paginação em GET /users" --output docs   (lê o projeto, entrega o arquivo em docs/)
  izanagi run "..." --no-survey                                   (não levanta o projeto antes de decidir)
  izanagi run "adicionar paginação em GET /users" \\
    --acceptance "o endpoint aceita ?page e ?limit" \\
    --acceptance "contains: LIMIT"                                (critério em prosa vira semântico; com prefixo, determinístico)
  izanagi run "..." --allow-tool fs.read --allow-tool fs.write    (allowlist de tools do run inteiro)
  izanagi run "..." --min-quality 0.5                             (a estratégia mais barata que ainda produz essa evidência)
  izanagi run "..." --output src --verify-tests                   (materializa e roda npm test: evidência de execução, não de texto)
  izanagi models
  izanagi budget
  izanagi run architect --task "Design a microservices architecture"
  izanagi run my-agent --task "Create a login page"
  izanagi agent inspect architect
  izanagi skill search database
  izanagi workflow inspect fullstack
  izanagi trace
  izanagi eval --report <run-id>
  izanagi benchmark run security
  izanagi benchmark run architecture --execute
  izanagi benchmark memory
  izanagi run "..." --json --notify-webhook=https://exemplo/hook   (para cron / Task Scheduler)
  izanagi agent create "migração de PHP legado para Laravel"    (Agent Factory: validado, use este)
  izanagi create agent my-agent                                  (scaffold cru, sem validação)
  izanagi compile architect system_prompt.md
  izanagi list skills
  izanagi doctor --deep
`);
}
