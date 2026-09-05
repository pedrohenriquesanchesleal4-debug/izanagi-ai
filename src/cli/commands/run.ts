import fs from 'fs';
import path from 'path';
import { findAgentFile, loadSkillResolver, resolveSkillPath, loadProjectConfig } from '../framework.js';
import { buildBlueprintCtx } from '../blueprint.js';
import { Orchestrator, type ExecuteCtx, type OrchestrationResult } from '../../runtime/orchestrator.js';
import { LLMClient } from '../../runtime/llm/client.js';
import type { CompletionOptions, CompletionResult } from '../../runtime/llm/client.js';
import { DYNAMIC_MARKER, estimateStaticTokens, MIN_CACHEABLE_TOKENS } from '../../runtime/llm/prompt-cache.js';
import type { GraphNode } from '../../runtime/types.js';
import { layeredSkillSummary, findV2Counterpart } from '../../runtime/text/frontmatter.js';
import { printTrace } from './trace.js';
import { ContextResolver } from '../../runtime/orchestration/context-resolver.js';
import { MemoryStore } from '../../runtime/memory/store.js';
import { ResponseCache } from '../../runtime/cache/response-cache.js';
import { ExecutionBudget } from '../../runtime/token/execution-budget.js';
import { buildExecutionPlan, createHeadlessProducer, createLLMProducer, createSemanticJudge, LOCAL_PROVIDERS } from '../../runtime/execute.js';
import { LOCAL_MAX_CONCURRENCY } from '../../runtime/orchestration/concurrency.js';
import { DELIVER_NODE_ID, deliverableRelPath, validateOutputDir } from '../../runtime/orchestration/delivery.js';
import { looksLikeProject } from '../../runtime/tools/project-survey.js';
import { measureGroundedness } from '../../runtime/benchmarks/arena.js';
import { buildNotification, exitCodeFor, notifyWebhook, validateWebhookUrl } from '../../runtime/notify/webhook.js';
import { isExecutionMode, type ExecutionMode } from '../../runtime/contracts/task-contract.js';

interface RunArgs {
  agentId?: string;
  task?: string;
  /** Só compila e salva izanagi-prompt.md — não executa (sem graph/eval/trace). */
  promptOnly: boolean;
  verbose: boolean;
  /** Desliga a fundação estática (RULES.md) e o marker CAPC — prompt idêntico ao pré-wave. */
  noCacheFoundation: boolean;
  /** Força o modo de execução (`--mode direct|assisted|orchestrated|autonomous`). */
  mode?: ExecutionMode;
  /** Teto global de tokens do run (`--budget N`). */
  budget?: number;
  /** Teto global de custo em USD (`--max-cost N`). */
  maxCost?: number;
  /**
   * Teto de tarefas em voo (`--max-concurrency N`). O SDK sempre pôde declarar
   * este teto por `budgetLimits.maxConcurrency`; a CLI não tinha por onde.
   */
  maxConcurrency?: number;
  /** Fixa o modelo de todos os papéis (`--model <id>`). */
  model?: string;
  /** Restringe a execução a providers locais (`--local`). */
  local: boolean;
  /** Liga o cache local de respostas (`--cache`). */
  cache: boolean;
  /** Desliga o Commander e volta ao planejamento por categoria (`--no-commander`). */
  noCommander: boolean;
  /** Desliga o juiz semântico (`--no-judge`): critério semântico volta a ficar UNVERIFIED. */
  noJudge: boolean;
  /** Saída única em JSON no stdout, para o agendador do SO consumir (`--json`). */
  json: boolean;
  /** Diretório onde o run grava a entrega (`--output <dir>`), relativo à raiz do projeto. */
  output?: string;
  /** Força o levantamento do projeto (`--survey`), mesmo sem manifesto reconhecido. */
  survey?: boolean;
  /** Desliga o levantamento do projeto (`--no-survey`). */
  noSurvey?: boolean;
  /** Endpoint POST avisado no fim do run (`--notify-webhook=<url>`). */
  notifyWebhook?: string;
  /**
   * Critérios de aceite do usuário (`--acceptance "..."`, repetível).
   *
   * Sem isto, todo critério do run era gerado a partir do SCHEMA do artefato:
   * o plano verificava a forma da entrega e nunca o que foi pedido.
   */
  acceptance?: string[];
  /**
   * Allowlist de tools do run (`--allow-tool fs.read --allow-tool fs.write`).
   * Existia no Orchestrator, no SDK e no caso de benchmark; a CLI não tinha por
   * onde declarar. Ausente, vale a permissão do contrato de cada nó.
   */
  allowedTools?: string[];
  /**
   * Roda o comando de teste do projeto no fim do run (`--verify-tests`).
   *
   * Opt-in porque executa um processo do PROJETO (o `scripts.test` do
   * manifesto, ou o runner da linguagem detectada) com o ambiente herdado: a
   * mesma confiança de digitar `npm test`, e por isso decisão de quem roda.
   */
  verifyTests: boolean;
}

export function parseRunArgs(args: string[]): RunArgs {
  let agentId: string | undefined;
  let task: string | undefined;
  let promptOnly = false;
  let verbose = false;
  let noCacheFoundation = false;
  let mode: ExecutionMode | undefined;
  let budget: number | undefined;
  let maxCost: number | undefined;
  let model: string | undefined;
  let maxConcurrency: number | undefined;
  let local = false;
  let cache = false;
  let noCommander = false;
  let noJudge = false;
  let verifyTests = false;
  let json = false;
  let notifyWebhook: string | undefined;
  const acceptance: string[] = [];
  const allowedTools: string[] = [];
  let output: string | undefined;
  let survey = false;
  let noSurvey = false;
  const positionals: string[] = [];

  /** Aceita tanto `--flag valor` quanto `--flag=valor`. */
  const readValue = (arg: string, prefix: string, next: string | undefined): { value?: string; consumed: boolean } => {
    if (arg === prefix) return { value: next, consumed: true };
    if (arg.startsWith(`${prefix}=`)) return { value: arg.slice(prefix.length + 1), consumed: false };
    return { consumed: false };
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--task' || arg === '-t') {
      task = args[i + 1];
      i++;
    } else if (arg.startsWith('--task=')) {
      task = arg.slice(7);
    } else if (arg === '--prompt-only' || arg === '-p') {
      promptOnly = true;
    } else if (arg === '--no-cache-foundation') {
      noCacheFoundation = true;
    } else if (arg === '--runtime' || arg === '-r') {
      // Compatibilidade: execução via runtime é o comportamento default desde a
      // unificação dos caminhos de 'run' — a flag é aceita e ignorada (no-op).
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--mode' || arg.startsWith('--mode=')) {
      const read = readValue(arg, '--mode', args[i + 1]);
      if (read.consumed) i++;
      const value = (read.value ?? '').toLowerCase();
      if (isExecutionMode(value)) mode = value;
      else if (value) console.error(`\x1b[33mAviso:\x1b[0m modo desconhecido "${value}" — ignorado (use direct|assisted|orchestrated|autonomous).`);
    } else if (arg === '--budget' || arg.startsWith('--budget=')) {
      const read = readValue(arg, '--budget', args[i + 1]);
      if (read.consumed) i++;
      const n = Number(read.value);
      if (Number.isFinite(n) && n > 0) budget = Math.floor(n);
    } else if (arg === '--max-cost' || arg.startsWith('--max-cost=')) {
      const read = readValue(arg, '--max-cost', args[i + 1]);
      if (read.consumed) i++;
      const n = Number(read.value);
      if (Number.isFinite(n) && n >= 0) maxCost = n;
    } else if (arg === '--max-concurrency' || arg.startsWith('--max-concurrency=')) {
      const read = readValue(arg, '--max-concurrency', args[i + 1]);
      if (read.consumed) i++;
      const n = Number(read.value);
      if (Number.isFinite(n) && n >= 1) maxConcurrency = Math.floor(n);
    } else if (arg === '--model' || arg.startsWith('--model=')) {
      const read = readValue(arg, '--model', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) model = read.value;
    } else if (arg === '--local') {
      local = true;
    } else if (arg === '--cache') {
      cache = true;
    } else if (arg === '--no-commander') {
      noCommander = true;
    } else if (arg === '--no-judge') {
      noJudge = true;
    } else if (arg === '--verify-tests') {
      verifyTests = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--notify-webhook' || arg.startsWith('--notify-webhook=')) {
      const read = readValue(arg, '--notify-webhook', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) notifyWebhook = read.value;
    } else if (arg === '--acceptance' || arg.startsWith('--acceptance=')) {
      const read = readValue(arg, '--acceptance', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) acceptance.push(read.value);
    } else if (arg === '--allow-tool' || arg.startsWith('--allow-tool=')) {
      const read = readValue(arg, '--allow-tool', args[i + 1]);
      if (read.consumed) i++;
      // Aceita `--allow-tool fs.read,fs.write` e a forma repetida.
      if (read.value) allowedTools.push(...read.value.split(',').map((t) => t.trim()).filter(Boolean));
    } else if (arg === '--survey') {
      survey = true;
    } else if (arg === '--no-survey') {
      noSurvey = true;
    } else if (arg === '--output' || arg.startsWith('--output=')) {
      const read = readValue(arg, '--output', args[i + 1]);
      if (read.consumed) i++;
      if (read.value) output = read.value;
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  if (!task) {
    if (positionals.length > 1) {
      agentId = positionals[0];
      task = positionals.slice(1).join(' ');
    } else {
      task = positionals.join(' ');
    }
  } else if (positionals.length > 0 && !agentId) {
    agentId = positionals[0];
  }

  return {
    agentId,
    task,
    promptOnly,
    verbose,
    noCacheFoundation,
    ...(mode ? { mode } : {}),
    ...(budget !== undefined ? { budget } : {}),
    ...(maxCost !== undefined ? { maxCost } : {}),
    ...(model ? { model } : {}),
    ...(maxConcurrency !== undefined ? { maxConcurrency } : {}),
    local,
    cache,
    noCommander,
    noJudge,
    verifyTests,
    json,
    ...(notifyWebhook ? { notifyWebhook } : {}),
    ...(acceptance.length > 0 ? { acceptance } : {}),
    ...(allowedTools.length > 0 ? { allowedTools } : {}),
    ...(output ? { output } : {}),
    ...(survey ? { survey } : {}),
    ...(noSurvey ? { noSurvey } : {}),
  };
}

interface TaskClassification {
  category: string;
  agent: string;
}

export function classifyTask(desc: string): TaskClassification {
  const lower = desc.toLowerCase();

  if (
    lower.includes('animation') || lower.includes('animação') || lower.includes('animado') ||
    lower.includes('scrollytelling') || lower.includes('scroll animation') || lower.includes('scroll-driven') ||
    lower.includes('cinematic') || lower.includes('gsap') || lower.includes('anime.js') || lower.includes('animejs') ||
    lower.includes('framer motion') || lower.includes('lottie') || lower.includes('motion design') ||
    lower.includes('3d') || lower.includes('webgl') || lower.includes('three.js') || lower.includes('threejs') ||
    lower.includes('efeito ao rolar') || lower.includes('efeito de scroll') || lower.includes('site que parece vídeo') ||
    lower.includes('frames que passam') || lower.includes('hero animado') || lower.includes('partículas') || lower.includes('particulas')
  ) {
    return { category: 'frontend', agent: 'animation' };
  }
  if (lower.includes('architect') || lower.includes('microservice') || lower.includes('clean arch') || lower.includes('estrutura') || lower.includes('arquitet')) {
    return { category: 'architecture', agent: 'architect' };
  }
  // Páginas/componentes de UI vêm antes de security: "login page" é frontend, não auditoria
  if (lower.includes('frontend') || lower.includes('react') || lower.includes('page') || lower.includes('component') || lower.includes('css') || lower.includes('tailwind')) {
    return { category: 'frontend', agent: 'senior-engineer' };
  }
  if (lower.includes('security') || lower.includes('owasp') || lower.includes('vulnerab') || lower.includes('audit') || lower.includes('lgpd') || lower.includes('pentest')) {
    return { category: 'security_audit', agent: 'security' };
  }
  if (lower.includes('bug') || lower.includes('fix') || lower.includes('error') || lower.includes('crash') || lower.includes('debug')) {
    return { category: 'debugging', agent: 'bug-hunter' };
  }
  if (lower.includes('db') || lower.includes('database') || lower.includes('sql') || lower.includes('postgres') || lower.includes('migration') || lower.includes('mysql')) {
    return { category: 'database_design', agent: 'database' };
  }
  if (lower.includes('docker') || lower.includes('ci/cd') || lower.includes('pipeline') || lower.includes('deploy') || lower.includes('k8s') || lower.includes('kubernetes')) {
    return { category: 'devops_infra', agent: 'devops' };
  }
  if (
    lower.includes('automation') || lower.includes('automa') || lower.includes('automatiz') ||
    lower.includes('planilha') || lower.includes('spreadsheet') || lower.includes('excel') ||
    lower.includes('scrap') || lower.includes('etl') || lower.includes('playwright') ||
    lower.includes('selenium') || lower.includes('robô') || lower.includes('em massa') ||
    lower.includes('preencher formulário') || lower.includes('webhook')
  ) {
    return { category: 'automacao', agent: 'automation-engineer' };
  }
  if (lower.includes('test') || lower.includes('qa')) {
    return { category: 'testing', agent: 'qa' };
  }
  if (lower.includes('backend') || lower.includes('api') || lower.includes('endpoint') || lower.includes('laravel') || lower.includes('node')) {
    return { category: 'backend', agent: 'senior-engineer' };
  }
  if (lower.includes('login') || lower.includes('auth') || lower.includes('authentication')) {
    return { category: 'implementation', agent: 'senior-engineer' };
  }
  if (lower.includes('create') || lower.includes('build') || lower.includes('feature') || lower.includes('implement')) {
    return { category: 'implementation', agent: 'senior-engineer' };
  }
  if (lower.includes('saas') || lower.includes('app completo') || lower.includes('sistema completo') || lower.includes('fullstack')) {
    return { category: 'fullstack', agent: 'senior-engineer' };
  }

  return { category: 'implementation', agent: 'senior-engineer' };
}

export function resolveChainForCategory(agent: any, category: string): string[] {
  if (agent.chains && agent.chains[category] && Array.isArray(agent.chains[category])) {
    return agent.chains[category];
  }
  if (agent.chains && typeof agent.chains === 'object') {
    const first = Object.values(agent.chains)[0];
    if (Array.isArray(first)) return first;
  }
  if (Array.isArray(agent.skills) && agent.skills.length > 0) {
    return agent.skills.slice(0, 5);
  }
  return ['planner', 'reviewer', 'clean-code'];
}

/**
 * Compacta conteúdo de documento NÃO-skill (references curadas, SYSTEM.md,
 * RULES.md) para o prompt: mantém apenas as primeiras linhas até o limite.
 * Skills usam a política em camadas de `layeredSkillSummary` (front-matter
 * v2 primeiro, corpo por prioridade de seção; legadas caem neste truncamento).
 */
function summarizeSkill(fullPath: string, maxLines: number): string {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join('\n') + `\n\n<!-- (skill truncada em ${maxLines} linhas — veja ${fullPath} para o conteúdo completo) -->`;
}

function agentLabel(agent: any): string {
  return agent.name || 'Custom agent';
}

/**
 * @param baseDir  Raiz dos ASSETS do framework (agentes, skills, RULES.md).
 * @param stateDir Raiz do ESTADO deste projeto (`.izanagi/state`). Default:
 *                 `baseDir`, o comportamento anterior. Ver `resolveStateRoot`.
 */
export async function runCommand(baseDir: string, args: string[], stateDir = baseDir): Promise<void> {
  const parsed = parseRunArgs(args);
  const { agentId, task, promptOnly, verbose, noCacheFoundation } = parsed;

  if (!task) {
    console.error('\x1b[31mError:\x1b[0m Please provide a task description.');
    console.error('Usage: \x1b[1mizanagi run [agent] --task "<description>"\x1b[0m');
    console.error('Examples:');
    console.error('  izanagi run "Create a login page"   (Adaptive Runtime: graph + eval + trace + recovery + memory)');
    console.error('  izanagi run architect --task "Design a microservices architecture"');
    console.error('  izanagi run "..." --prompt-only   (só compila izanagi-prompt.md, sem executar)');
    console.error('  izanagi run "..." --no-cache-foundation   (desliga fundação RULES.md estática/marker de prompt caching)');
    process.exit(1);
  }

  // `--json` significa que quem lê o stdout é um programa. A saída humana é
  // silenciada ANTES de qualquer impressão, e `console.error` continua vivo:
  // erro real precisa chegar ao stderr do agendador.
  if (parsed.json) {
    const original = console.log;
    console.log = () => {};
    restoreConsole = () => {
      console.log = original;
    };
  }
  if (parsed.notifyWebhook) {
    const check = validateWebhookUrl(parsed.notifyWebhook);
    if (!check.ok) {
      console.error(`\x1b[31mError:\x1b[0m --notify-webhook: ${check.reason}`);
      process.exit(1);
    }
  }

  // `--output` é validado ANTES de planejar. Um destino fora da raiz seria
  // recusado pela ToolRegistry na hora de escrever — descobrir isso depois de
  // um grafo inteiro executado é jogar fora o run por um erro de digitação.
  let outputDir: string | undefined;
  if (parsed.output) {
    // Validado contra o CWD, não contra `baseDir`: a entrega é do PROJETO do
    // usuário. `baseDir` é a raiz do framework (`<projeto>/.agents`, ou a
    // própria instalação do pacote quando o projeto não foi inicializado) —
    // gravar a entrega lá dentro seria escondê-la no lugar onde ninguém
    // procura o resultado do próprio trabalho.
    const check = validateOutputDir(process.cwd(), parsed.output);
    if (!check.ok) {
      console.error(`\x1b[31mError:\x1b[0m --output: ${check.error}`);
      process.exit(1);
    }
    outputDir = check.rel;
  }

  const cwd = process.cwd();
  const projectConfig = loadProjectConfig(cwd);

  console.log('\n\x1b[36m=== Izanagi AI Decision Engine ===\x1b[0m');
  console.log(`\x1b[1mTask:\x1b[0m "${task}"\n`);

  // 1. Resolve o agente (explícito ou por classificação)
  let agentFile: string | null = null;
  let agent: any;
  let category = 'implementation';

  if (agentId) {
    agentFile = findAgentFile(cwd, baseDir, agentId);
    if (!agentFile) {
      console.error(`\x1b[31mError:\x1b[0m Agent "${agentId}" not found.`);
      console.error(`Check \x1b[33magents/\x1b[0m or run \x1b[33mizanagi list agents\x1b[0m to see available agents.`);
      process.exit(1);
    }
    agent = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
    category = classifyTask(task).category;
    console.log(`\x1b[32m✔ Agent resolved from file:\x1b[0m ${path.relative(cwd, agentFile)}`);
  } else {
    const classified = classifyTask(task);
    category = classified.category;
    agentFile = findAgentFile(cwd, baseDir, classified.agent);
    agent = agentFile ? JSON.parse(fs.readFileSync(agentFile, 'utf-8')) : { name: classified.agent, skills: [] };
  }

  const skillChain = resolveChainForCategory(agent, category);

  // Anti-redundância: deduplica ids e limita o tamanho da cadeia (evita prompt gigante)
  const MAX_CHAIN = 6;
  const compactSkillChain = skillChain.filter((s, i) => skillChain.indexOf(s) === i).slice(0, MAX_CHAIN);

  console.log(`\x1b[32m✔ Category Identified:\x1b[0m ${category}`);
  console.log(`\x1b[32m✔ Selected Agent:\x1b[0m ${agentLabel(agent)} (v${agent.version || '1.0.0'})`);
  if (agent.role) {
    console.log(`  \x1b[90mRole: ${agent.role}\x1b[0m`);
  }
  console.log(`\x1b[32m✔ Computed Skill Chain:\x1b[0m ${compactSkillChain.join(' -> ')}\n`);

  // 2. Valida as skills da chain no resolver
  const aliases = loadSkillResolver(cwd, baseDir);
  console.log('\x1b[1mSkill Chain Resolution:\x1b[0m');
  let resolvedCount = 0;

  for (const skill of compactSkillChain) {
    const skillPath = resolveSkillPath(cwd, baseDir, skill);
    if (skillPath) {
      const v2Path = findV2Counterpart(cwd, baseDir, skillPath);
      const sourceLabel = path.relative(cwd, v2Path ?? skillPath);
      const v2Tag = v2Path ? ' \x1b[90m[v2 progressive disclosure]\x1b[0m' : '';
      console.log(`  \x1b[32m✔\x1b[0m \x1b[1m${skill}\x1b[0m -> ${sourceLabel}${v2Tag}`);
      resolvedCount++;
    } else if (aliases[skill]) {
      console.log(`  \x1b[33m⚠\x1b[0m \x1b[1m${skill}\x1b[0m -> alias exists, but file not found (${aliases[skill]})`);
    } else {
      console.log(`  \x1b[33m⚠\x1b[0m \x1b[1m${skill}\x1b[0m -> not registered in core/skill-resolver.json`);
    }
  }

  // 3. Regras do agente
  if (agent.always && agent.always.length > 0) {
    console.log('\n\x1b[1mAgent Rules (always):\x1b[0m');
    agent.always.forEach((a: string) => console.log(`  • ${a}`));
  }

  const defaultAgent = (projectConfig && (projectConfig.defaultAgent as string)) || 'senior-engineer';

  // --prompt-only: só compila e salva izanagi-prompt.md (sem executar nada) — modo
  // explícito para quem quer colar o prompt manualmente em outra ferramenta de IA.
  if (promptOnly) {
    console.log('\n\x1b[1mExecution Plan (prompt-only — nada será executado):\x1b[0m');
    console.log('  1. Load Context & System Rules (SYSTEM.md / RULES.md)');
    console.log(`  2. Activate Agent [${agentLabel(agent)}] with ${resolvedCount}/${skillChain.length} skills resolved`);
    console.log('  3. Execute Skill Chain (sequential, dependency-aware)');
    console.log('  4. Apply Quality Gates: Security -> Style -> Clarity -> Conciseness -> Completeness');
    console.log('  5. Generate Output & Reflection Log\n');

    const roots = [path.join(cwd, '.agents'), baseDir];
    const findDoc = (name: string): string =>
      roots.map((r) => path.join(r, name)).find((p) => fs.existsSync(p)) || '';

    const systemContent = findDoc('SYSTEM.md');
    const rulesContent = findDoc('RULES.md');

    const compact = process.argv.includes('--compact') || !!(process.env.IZANAGI_COMPACT);

    let fullPrompt = `<!-- IZANAGI AI READY-TO-USE PROMPT -->\n`;
    fullPrompt += `<!-- TASK: ${task} -->\n`;
    fullPrompt += `<!-- AGENT: ${agent.name} (v${agent.version || '1.0.0'}) -->\n`;
    fullPrompt += `<!-- MODE: ${compact ? 'compact (economia de tokens)' : 'full'} -->\n\n`;

    fullPrompt += `## 🚨 CRITICAL EXECUTION MANDATE (ZERO CHECKLISTS / FULL-STACK REAL CODE)\n`;
    fullPrompt += `- **ABSOLUTELY FORBIDDEN:** Writing lazy task lists, checklists ([✓]), summary-only responses, or empty stubs/placeholders (TODO, // implement later).\n`;
    fullPrompt += `- **MANDATORY:** Generate 100% real, complete, production-ready code files for every layer requested (Landing Page + Auth + Dashboard/CRUD + Backend/Prisma Schema + README).\n`;
    fullPrompt += `- **HIGH-CRAFT UI:** Rich dark aesthetics (bg-zinc-950), glassmorphism, bento grids, micro-interactions, and robust TypeScript typing.\n\n`;

    // Blueprint Engine: manifiesto de arquivos + contrato de materialização + gates
    const bp = buildBlueprintCtx(task, baseDir);
    if (bp.scope !== 'other') {
      fullPrompt += bp.blueprint + `\n`;
    }

    fullPrompt += `## USER TASK\n${task}\n\n`;
    fullPrompt += `## AGENT IDENTITY & ROLE\n${agent.identity || agent.role}\n\n`;

    if (agent.always && agent.always.length > 0) {
      fullPrompt += `## MANDATORY AGENT RULES (ALWAYS)\n` + agent.always.map((a: string) => `- ${a}`).join('\n') + `\n\n`;
    }
    if (agent.never && agent.never.length > 0) {
      fullPrompt += `## PROHIBITED ACTIONS (NEVER)\n` + agent.never.map((n: string) => `- ${n}`).join('\n') + `\n\n`;
    }

    // Auto-injeta referências curadas (stack, ui, scrollytelling)
    const refDir = path.join(baseDir, 'references');
    const refFiles = ['stack-2026.md', 'ui-design-systems.md', 'scrollytelling.md'];
    for (const refFile of refFiles) {
      const refPath = path.join(refDir, refFile);
      if (fs.existsSync(refPath)) {
        fullPrompt += `## CURATED REFERENCE: ${refFile}\n` + summarizeSkill(refPath, 80) + `\n\n`;
      }
    }

    fullPrompt += `## COMPUTED SKILL CHAIN (${compactSkillChain.join(' -> ')})\n\n`;
    for (const skill of compactSkillChain) {
      const sPath = resolveSkillPath(cwd, baseDir, skill);
      if (sPath && fs.existsSync(sPath)) {
        // Progressive disclosure: prefere a contraparte v2 (.skills/<name>/SKILL.md)
        // quando existe; sem v2, o truncamento legado preserva compatibilidade.
        const source = findV2Counterpart(cwd, baseDir, sPath) ?? sPath;
        fullPrompt += `### SKILL: ${skill}\n` + layeredSkillSummary(source, compact ? 60 : 160) + `\n\n`;
      }
    }

    if (systemContent && fs.existsSync(systemContent)) {
      fullPrompt += `## SYSTEM FOUNDATION\n` + summarizeSkill(systemContent, compact ? 80 : 400) + `\n\n`;
    }
    if (rulesContent && fs.existsSync(rulesContent)) {
      fullPrompt += `## OPERATIONAL RULES\n` + summarizeSkill(rulesContent, compact ? 60 : 400) + `\n\n`;
    }

    const promptPath = path.resolve(cwd, 'izanagi-prompt.md');
    fs.writeFileSync(promptPath, fullPrompt, 'utf-8');
    console.log(`\x1b[32m✔ Ready-to-use AI prompt generated successfully!\x1b[0m`);
    console.log(`  Saved to: \x1b[36m${promptPath}\x1b[0m (copy and paste directly to your AI tool)\n`);

    console.log('\x1b[90mTips:');
    console.log(`  \x1b[36mizanagi run "${task}"\x1b[90m — Adaptive Runtime (execution graph + evaluation + trace + recovery + memory).`);
    if (agentId && agentFile) {
      console.log(`  \x1b[36mizanagi compile ${agentId}\x1b[90m — compile the full system prompt for this agent.`);
    }
    console.log(`  \x1b[36mizanagi run <your-agent> --task "<task>"\x1b[90m — run a custom agent from ./agents.\x1b[0m`);
    console.log(`  \x1b[36mizanagi run "${task}"\x1b[90m — auto-classify with default agent (${defaultAgent}).\x1b[0m\n`);
    return;
  }

  // Adaptive Runtime — único caminho de execução real: planner + graph + adaptive
  // routing + evaluation + tracing + self-healing + memory. Sem modo estático paralelo.
  const resultado = await runRuntime(baseDir, {
    task,
    category,
    agentId: agentId ?? classifyTask(task).agent,
    skillChain: compactSkillChain,
    agent,
    verbose,
    noCacheFoundation,
    ...(parsed.mode ? { mode: parsed.mode } : {}),
    ...(parsed.budget !== undefined ? { budget: parsed.budget } : {}),
    ...(parsed.maxCost !== undefined ? { maxCost: parsed.maxCost } : {}),
    ...(parsed.model ? { model: parsed.model } : {}),
    ...(parsed.maxConcurrency !== undefined ? { maxConcurrency: parsed.maxConcurrency } : {}),
    local: parsed.local,
    cache: parsed.cache,
    noCommander: parsed.noCommander,
    noJudge: parsed.noJudge,
    json: parsed.json,
    ...(outputDir ? { output: outputDir } : {}),
    // Grounding LIGADO por default quando o diretório tem cara de projeto de
    // código: rodar `izanagi run` dentro de um repositório e o runtime NÃO
    // olhar para ele é o comportamento surpreendente, não o contrário. Fora de
    // um projeto (sem manifesto reconhecido) não há o que levantar, então não
    // se paga o nó. `--survey` força, `--no-survey` desliga.
    survey: parsed.noSurvey ? false : parsed.survey || looksLikeProject(cwd),
    ...(parsed.acceptance ? { acceptance: parsed.acceptance } : {}),
    ...(parsed.allowedTools ? { allowedTools: parsed.allowedTools } : {}),
    ...(parsed.verifyTests ? { verifyTests: true } : {}),
    stateDir,
    explicitAgent: Boolean(agentId),
  });

  // O que o run gravou, em caminhos relativos: é o que um agendador precisa
  // para saber se há trabalho novo no disco. Caminho absoluto ficaria de fora
  // mesmo que fosse conveniente — ele carrega o diretório do usuário para um
  // endpoint que costuma ser canal de equipe.
  await finishForScheduler(resultado, parsed, produzido(resultado, outputDir, task));
}

/**
 * Fecho do run para quem NÃO está lendo o terminal.
 *
 * O Izanagi continua local-first: nenhum processo fica de pé, nenhuma porta
 * escuta, nenhuma credencial fica em repouso. Quem agenda é o cron ou o Task
 * Scheduler do sistema; o que faltava era o Izanagi ser consumível por eles —
 * uma saída estruturada e um código de saída que signifique alguma coisa.
 */
async function finishForScheduler(
  result: OrchestrationResult | undefined,
  parsed: RunArgs,
  produced?: { delivered?: string; materialized?: string[] },
): Promise<void> {
  if (!result) return;

  const payload = buildNotification({ ...result, ...(produced ? { produced } : {}) });

  if (parsed.notifyWebhook) {
    const outcome = await notifyWebhook(parsed.notifyWebhook, payload);
    // Falha de notificação não muda o veredito: o trabalho já foi feito e
    // verificado. Vai para stderr, que é onde o agendador procura problema
    // sem contaminar o stdout que ele parseia.
    if (!outcome.ok) {
      console.error(`izanagi: webhook não notificado (${outcome.attempts} tentativa(s)): ${outcome.error}`);
    }
  }

  if (parsed.json) {
    // Restaura a saída para emitir o ÚNICO objeto que o agendador lê.
    restoreConsole();
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }

  // Código de saída é a interface mais barata com um agendador: 0 concluiu,
  // 1 falhou, 2 aguarda decisão humana. Sem isso, o cron não sabe alertar.
  const code = exitCodeFor(result);
  if (code !== 0) process.exitCode = code;
}

/**
 * Caminhos relativos do que o run gravou no projeto. `undefined` quando não
 * houve `--output` — sem destino declarado, nada foi gravado.
 */
function produzido(
  result: OrchestrationResult | undefined,
  outputDir: string | undefined,
  task: string,
): { delivered?: string; materialized?: string[] } | undefined {
  if (!result || !outputDir) return undefined;
  const delivered =
    result.graph.nodes.find((n) => n.id === DELIVER_NODE_ID)?.status === 'succeeded'
      ? deliverableRelPath(outputDir, task)
      : undefined;
  const receipt = lastReceipt;
  const materialized =
    receipt?.written && receipt.written.length > 0 && receipt.dir
      ? receipt.written.map((f) => `${receipt.dir}/${f}`)
      : undefined;
  if (!delivered && !materialized) return undefined;
  return { ...(delivered ? { delivered } : {}), ...(materialized ? { materialized } : {}) };
}

/**
 * Comprovante do último `project.materialize` deste processo.
 *
 * Módulo-nível porque `runRuntime` (que observa os artefatos) e `runCommand`
 * (que monta a notificação) são funções separadas, e a CLI roda um comando por
 * processo. O SDK não passa por aqui: quem usa `izanagi.run()` lê o artefato
 * `materialization` direto do resultado.
 */
let lastReceipt: MaterializationReceipt | undefined;

/** Comprovante devolvido por `project.materialize`: o que o run gravou, e onde. */
interface MaterializationReceipt {
  dir?: string;
  candidates?: number;
  written?: string[];
}

/** Restaurador do console silenciado por `--json` (no-op quando não houve). */
let restoreConsole: () => void = () => {};

/**
 * Superfície mínima do LLMClient consumida pelo run — permite injetar um
 * client de teste (structural typing) sem tocar no Orchestrator.
 */
export interface RuntimeLLMClient {
  configuredProviders(): string[];
  complete(provider: string, opts: CompletionOptions): Promise<CompletionResult>;
}

/**
 * Modo runtime: usa o Orchestrator do framework para construir o execution
 * graph, avaliar, curar falhas e persistir trace + aprendizados.
 *
 * Quando há API key configurada (IZANAGI_OPENAI_API_KEY, IZANAGI_ANTHROPIC_API_KEY,
 * IZANAGI_GOOGLE_API_KEY), cada nó do grafo é executado por um LLM real via
 * ModelRouter; sem chave, roda em modo headless (simulação) com aviso.
 */
export async function runRuntime(
  baseDir: string,
  opts: {
    task: string;
    category: string;
    agentId: string;
    skillChain: string[];
    agent: any;
    verbose: boolean;
    /** Retoma um run interrompido/pausado em vez de planejar do zero (izanagi resume/approve/reject). */
    resumeRunId?: string;
    /** Desliga fundação RULES.md estática + marker CAPC (prompt pré-wave). */
    noCacheFoundation?: boolean;
    /** Client LLM injetável (testes). Default: LLMClient real lido do ambiente. */
    client?: RuntimeLLMClient;
    /** Modo forçado (`--mode`). Ausente = Commander decide pela complexidade. */
    mode?: ExecutionMode;
    /** Teto global de tokens (`--budget`). */
    budget?: number;
    /** Teto global de custo em USD (`--max-cost`). */
    maxCost?: number;
    /** Modelo fixo para todos os papéis (`--model`). */
    model?: string;
    /** Teto de tarefas em voo (`--max-concurrency`). */
    maxConcurrency?: number;
    /** Só providers locais (`--local`). */
    local?: boolean;
    /** Cache local de respostas (`--cache`). */
    cache?: boolean;
    /** Volta ao planejamento por categoria (`--no-commander`). */
    noCommander?: boolean;
    /** Desliga o juiz semântico (`--no-judge`). Sem juiz, critério semântico fica UNVERIFIED. */
    noJudge?: boolean;
    /** Silencia a saída humana: quem consome é um agendador, não uma pessoa. */
    json?: boolean;
    /** O usuário nomeou o agente explicitamente (`izanagi run architect ...`). */
    explicitAgent?: boolean;
    /** Diretório de entrega já validado contra a raiz do projeto (`--output`). */
    output?: string;
    /** Levanta a forma do projeto antes de decidir (nó de tool na cabeça do grafo). */
    survey?: boolean;
    /** Critérios de aceite do usuário, em texto (`--acceptance`). */
    acceptance?: string[];
    /** Roda o comando de teste do projeto no fim do grafo (`--verify-tests`). */
    verifyTests?: boolean;
    /** Allowlist de tools do run (`--allow-tool`). */
    allowedTools?: string[];
    /** Raiz do estado (`.izanagi/state`). Default: `baseDir`. */
    stateDir?: string;
  },
): Promise<OrchestrationResult | undefined> {
  console.log('\n\x1b[36m=== Izanagi Adaptive Runtime ===\x1b[0m\n');

  const client: RuntimeLLMClient = opts.client ?? new LLMClient();
  const allProviders = client.configuredProviders();
  const llmProviders = opts.local ? allProviders.filter((p) => LOCAL_PROVIDERS.includes(p)) : allProviders;
  if (opts.local && allProviders.length > 0 && llmProviders.length === 0) {
    console.log('  \x1b[33m⚠ --local:\x1b[0m nenhum provider local configurado (IZANAGI_OLLAMA_ENABLED=1 / IZANAGI_LMSTUDIO_ENABLED=1 / IZANAGI_CUSTOM_BASE_URL).');
    console.log('    Providers remotos configurados foram ignorados de propósito — execução seguirá em modo headless.\n');
  }
  if (llmProviders.length === 0) {
    console.log('  \x1b[33m⚠ Modo headless:\x1b[0m nenhuma API key encontrada (IZANAGI_OPENAI_API_KEY /');
    console.log('    IZANAGI_ANTHROPIC_API_KEY / IZANAGI_GOOGLE_API_KEY / IZANAGI_OPENROUTER_API_KEY).');
    console.log('    Modelo local? IZANAGI_OLLAMA_ENABLED=1 ou IZANAGI_LMSTUDIO_ENABLED=1 (sem API key).');
    console.log('    Os nós do grafo serão simulados — defina uma chave/flag para execução real via LLM.\n');
  } else {
    console.log(`  \x1b[32m✔ Execução real via LLM:\x1b[0m providers configurados: ${llmProviders.join(', ')}\n`);
  }

  // Telemetria de tokens/cache (só faz sentido com provider real — headless não
  // consome tokens de verdade e nunca imprime esta linha).
  const tokenStats = { input: 0, cached: 0, nodes: 0 };

  /* ---------- Commander + roteamento por papel (wiring compartilhado com o SDK) ---------- */

  const planning = buildExecutionPlan(baseDir, {
    objective: opts.task,
    ...(opts.mode ? { mode: opts.mode } : {}),
    ...(opts.agentId ? { agent: opts.agentId } : {}),
    ...(opts.explicitAgent ? { explicitAgent: true } : {}),
    skillChain: opts.skillChain,
    ...(opts.budget !== undefined ? { maxTokens: opts.budget } : {}),
    ...(opts.maxCost !== undefined ? { maxCostUsd: opts.maxCost } : {}),
    ...(opts.model ? { model: opts.model } : {}),
    availableProviders: llmProviders,
    ...(opts.output ? { output: opts.output } : {}),
    ...(opts.survey ? { survey: true } : {}),
    ...(opts.acceptance ? { acceptance: opts.acceptance } : {}),
    ...(opts.verifyTests ? { verifyTests: true } : {}),
    ...(opts.stateDir ? { stateDir: opts.stateDir } : {}),
    // Resume reusa o grafo do checkpoint: replanejar aqui desfaria a retomada.
    noCommander: Boolean(opts.noCommander || opts.resumeRunId),
  });
  const plan = planning.plan;

  // Critério recusado é dito em voz alta. Descartar em silêncio faria o run
  // terminar VERIFIED sem ter medido o que a pessoa pediu para medir, que é
  // exatamente a confusão que os critérios de aceite existem para evitar.
  if (planning.acceptanceIssues) {
    console.log('  \x1b[33m⚠ Critério de aceite recusado (NÃO será cobrado):\x1b[0m');
    for (const issue of planning.acceptanceIssues) console.log(`    \x1b[90m•\x1b[0m ${issue}`);
    console.log('    \x1b[90mformas aceitas: prosa (vira critério semântico, exige juiz) ou');
    console.log('    contains: / not-contains: / matches: / min-size: / file-exists: / json-field: / references-exist\x1b[0m');
  }
  if (opts.acceptance && opts.acceptance.length > 0 && plan) {
    const cobrados = plan.contracts.filter((c) => c.acceptance.some((a) => a.id.startsWith('user:')));
    console.log(`  \x1b[35m▸ Aceite do usuário:\x1b[0m ${opts.acceptance.length} critério(s) em ${cobrados.length} tarefa(s) terminal(is): ${cobrados.map((c) => c.id).join(', ') || 'nenhuma'}`);
  }

  if (plan) {
    const estimate = plan.estimate;
    console.log(`  \x1b[35m▸ Commander:\x1b[0m modo \x1b[1m${plan.mode}\x1b[0m — ${plan.modeReason}`);
    console.log(`    \x1b[90mcomplexidade ${plan.classification.complexity}/5 · domínios: ${plan.classification.domains.join(', ') || 'nenhum'} · ${estimate.nodes} tarefa(s)\x1b[0m`);
    console.log(`    \x1b[90mteto: ${estimate.maxTokens} tokens${estimate.maxCostUsd !== undefined ? ` · $${estimate.maxCostUsd.toFixed(4)}` : ''} (commander ${estimate.byRole.commander.tasks} · specialist ${estimate.byRole.specialist.tasks} · worker ${estimate.byRole.worker.tasks})\x1b[0m`);
    if (plan.issues.length > 0) {
      console.log(`    \x1b[33m⚠ contratos com pendência:\x1b[0m ${plan.issues.slice(0, 3).join('; ')}`);
    }
    console.log('');
  }

  // O cache de resposta vive em `.izanagi/state/cache`, então segue a raiz de
  // ESTADO como todo o resto do estado. Deixá-lo no `baseDir` faria as
  // respostas de todo projeto não inicializado se acumularem dentro da
  // instalação do pacote — o mesmo vazamento que o `stateDir` corrigiu para
  // trace, artefato e memória, sobrando num diretório só.
  const cache = new ResponseCache({
    baseDir: opts.stateDir ?? baseDir,
    enabled: Boolean(opts.cache) || ResponseCache.enabledFromEnv(),
  });
  // Memória do projeto no contexto MÍNIMO de cada tarefa. A busca existia e,
  // dentro de um run, ninguém a chamava: só a CLI e o benchmark. A única
  // recuperação durante a execução era padrão de falha, então o agente
  // trabalhava sem nada do que o projeto já tinha aprendido. Entra por tarefa,
  // com teto próprio, e o `stateDir` é o mesmo do resto do estado.
  // Um store por RUN, não por nó: `MemoryStore` carrega o estado do disco no
  // construtor, e instanciá-lo dentro do callback pagaria essa leitura em cada
  // tarefa do grafo para responder a mesma pergunta.
  const knowledgeStore = new MemoryStore({ baseDir: opts.stateDir ?? baseDir });
  const contextResolver = new ContextResolver({
    knowledge: (query, limit) => knowledgeStore.search(query, limit).map((e) => ({ title: e.title, content: e.content })),
  });

  const llmProducer = createLLMProducer({
    objective: opts.task,
    client: client as unknown as Parameters<typeof createLLMProducer>[0]['client'],
    cache,
    contextResolver,
    buildSystemPrompt: (node, _ctx, minimalContext) =>
      buildNodePrompt(node, { task: opts.task, agent: opts.agent, skillChain: opts.skillChain }, baseDir, {
        noCacheFoundation: opts.noCacheFoundation,
        ...(minimalContext ? { context: minimalContext } : {}),
      }),
    onNode: (info) => {
      if (info.fromCache) {
        if (opts.verbose) console.log(`  \x1b[90m[cache]\x1b[0m nó "${info.nodeId}": resposta reaproveitada (0 token gasto)`);
        return;
      }
      tokenStats.input += info.tokens;
      tokenStats.cached += info.cachedTokens;
      tokenStats.nodes++;
      if (opts.verbose) {
        console.log(`  \x1b[90m[tokens]\x1b[0m nó "${info.nodeId}" (${info.role ?? 'specialist'}/${info.model}): entrada ${info.tokens} · cache-hit ${info.cachedTokens}`);
      }
    },
  });
  const headlessProducer = createHeadlessProducer(opts.task);

  // Juiz semântico: sem provider (headless) ou com --no-judge, fica de fora e a
  // Verification Engine devolve UNVERIFIED nos critérios semânticos, que é o
  // conservador correto — nunca aprovação por omissão.
  const judge = opts.noJudge || llmProviders.length === 0
    ? undefined
    : createSemanticJudge({
        client: client as unknown as Parameters<typeof createSemanticJudge>[0]['client'],
        routeRole: planning.routeRole,
      });
  if (opts.verbose && !judge) {
    console.log(`  Juiz semântico: desligado (${opts.noJudge ? '--no-judge' : 'sem provider configurado'}) — critérios semânticos ficarão sem evidência conclusiva.`);
  }

  // Ctrl-C cancela o run em vez de matar o processo no meio de um batch.
  //
  // A combinação é o que dá valor: o checkpoint é gravado ao fim de cada batch,
  // e o cancelamento para no INÍCIO do próximo. O que já foi concluído e pago
  // fica em disco, e `izanagi resume <run-id>` retoma dali em vez de recomeçar
  // a tentativa inteira. Um segundo Ctrl-C força a saída, para o caso de o
  // cancelamento cooperativo não bastar (provider que ignora o abort, por
  // exemplo). Exit code 130 é a convenção de POSIX para término por SIGINT.
  const controller = new AbortController();
  let cancelling = false;
  const onSigint = () => {
    if (cancelling) {
      console.error('Segundo Ctrl-C: encerrando o processo sem gravar o restante.');
      process.exit(130);
    }
    cancelling = true;
    controller.abort('interrompido pelo usuário (Ctrl-C)');
    if (!opts.json) {
      console.error('');
      console.error('Cancelando o run: o batch em voo é abortado e o progresso já gravado fica no checkpoint.');
      console.error('Retome com: izanagi resume <run-id> (o id sai no relatório final, ou em izanagi trace).');
    }
  };

  let receipt: MaterializationReceipt | undefined;
  const producedArtifacts: Record<string, { kind: string; content: unknown }> = {};

  const orchestrator = new Orchestrator({
    baseDir,
    // Raiz do projeto do usuário: é contra ela que a sandbox de tool e o check
    // `file-exists` resolvem. `baseDir` continua sendo a raiz do framework.
    workspaceDir: process.cwd(),
    ...(opts.stateDir ? { stateDir: opts.stateDir } : {}),
    // Allowlist do run: a tool fora da lista é recusada ANTES de a política
    // opinar. Existia no Orchestrator desde a v3.19.0 e não tinha flag.
    ...(opts.allowedTools ? { allowedTools: opts.allowedTools } : {}),
    command: 'run',
    task: opts.task,
    category: opts.category,
    primaryAgent: opts.agentId,
    skillChain: opts.skillChain,
    verbose: opts.verbose,
    // Restringe o roteamento aos providers realmente configurados — o Orchestrator
    // já devolve ctx.model/ctx.provider prontos para uso, sem round-trip de roteamento
    // duplicado aqui (antes: run.ts roteava de novo e aplicava fallback manual).
    availableProviders: llmProviders,
    resumeRunId: opts.resumeRunId,
    ...(plan ? { plan } : {}),
    budgetLimits: {
      ...(opts.maxCost !== undefined ? { maxCostUsd: opts.maxCost } : {}),
      // `--local` serializa o pool. `LOCAL_MAX_CONCURRENCY` existia desde a
      // v3.13.0 com o motivo escrito no arquivo ("GPU única não ganha nada com
      // paralelismo") e nenhuma referência: com `--local` o pool continuava em
      // 3, disparando três requisições simultâneas contra a mesma GPU — que
      // não é só inútil, é o caminho para estourar a memória do modelo local.
      // Teto explícito do usuário vence, porque é ordem e não heurística.
      ...(opts.local && opts.maxConcurrency === undefined
        ? { maxConcurrency: LOCAL_MAX_CONCURRENCY }
        : {}),
      ...(opts.maxConcurrency !== undefined ? { maxConcurrency: opts.maxConcurrency } : {}),
    },
    ...(judge ? { judge } : {}),
    // Ctrl-C para no início do próximo batch e aborta a requisição em voo.
    signal: controller.signal,
    // Inteligência assimétrica: cada tarefa paga o preço do seu papel.
    routeRole: planning.routeRole,
    costOf: planning.costOf,
    // Replanejamento passa pelo Commander: falha reincidente produz um grafo
    // diferente, nao o mesmo grafo com um no reaberto.
    replan: planning.replan,
    // No de tool passa por ToolRegistry + PolicyEngine: o trust tier vem da
    // origem do arquivo do agente, nunca do que ele declara sobre si.
    trustTierOf: planning.trustTierOf,
    produce: (node: GraphNode, ctx: ExecuteCtx) =>
      (llmProviders.length === 0 ? headlessProducer : llmProducer)(node, ctx),
    consume: (node: GraphNode, artifact: { kind: string; content?: unknown; valid: boolean }) => {
      // O comprovante de materialização é o único artefato que a CLI guarda:
      // é o que diz ao usuário QUAIS arquivos o run escreveu, e sem isso ele
      // teria que ir procurar no diretório de saída para descobrir.
      if (artifact.kind === 'materialization') {
        receipt = artifact.content as MaterializationReceipt;
        lastReceipt = receipt;
      }
      producedArtifacts[node.id] = { kind: artifact.kind, content: artifact.content };
      if (!artifact.valid) {
        console.log(`  \x1b[33m⚠\x1b[0m Nó "${node.id}": artefato inválido (${artifact.kind})`);
      }
    },
  });

  process.once('SIGINT', onSigint);

  let result: OrchestrationResult;
  try {
    result = await orchestrator.run();
  } finally {
    process.off('SIGINT', onSigint);
  }

  if (llmProviders.length > 0 && tokenStats.nodes > 0) {
    const pct = tokenStats.input > 0 ? Math.round((tokenStats.cached / tokenStats.input) * 100) : 0;
    console.log(`[tokens] entrada ${tokenStats.input} · cache-hit ${tokenStats.cached} (${pct}% do input)`);
  }
  if (result.telemetry) {
    console.log(`\x1b[90m[economia]\x1b[0m ${ExecutionBudget.formatTelemetry(result.telemetry)}`);
  }

  if (result.pendingApproval) {
    console.log(`\n\x1b[1m\x1b[33m⏸ Execução pausada — aguardando aprovação humana\x1b[0m`);
    console.log(`  \x1b[90mNó:\x1b[0m ${result.pendingApproval.nodeId}${result.pendingApproval.context ? ` — ${result.pendingApproval.context}` : ''}`);
    console.log(`  \x1b[36mizanagi approve ${result.trace.runId}\x1b[90m — aprova e retoma a execução.`);
    console.log(`  \x1b[36mizanagi reject ${result.trace.runId} --reason="..."\x1b[90m — rejeita (execução prossegue para falha/self-healing).\x1b[0m\n`);
    return result;
  }

  // Relatório final
  const verdict = result.evaluation;
  // `HUMAN_REQUIRED` sai em amarelo, não vermelho: o run não quebrou, ele
  // chegou ao teto que alguém declarou. Pintar de vermelho faria "gastou o que
  // eu autorizei" parecer o mesmo que "falhou por bug".
  const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'PASS_WITH_WARNINGS' || result.status === 'HUMAN_REQUIRED' ? '\x1b[33m' : result.status === 'FAIL' || result.status === 'BLOCKED' ? '\x1b[31m' : '\x1b[90m';
  console.log(`\n\x1b[1mRuntime result:\x1b[0m ${color}${result.status}\x1b[0m (score ${verdict?.score ?? '—'})`);
  const esgotado = result.healing.find((h) => h.exhausted);
  if (esgotado) {
    const rotulo = { attempts: 'tentativas', time: 'tempo', tokens: 'tokens', cost: 'custo' }[esgotado.exhausted!];
    console.log(`  \x1b[33m⏹\x1b[0m Teto de \x1b[1m${rotulo}\x1b[0m esgotado: ${esgotado.message}`);
    console.log(`    \x1b[90mO run parou onde foi autorizado a parar. A decisão seguinte é sua: subir o teto`);
    console.log(`    (--budget / --max-cost) e rodar de novo, reduzir o objetivo, ou investigar a causa.\x1b[0m`);
  }
  console.log(`  \x1b[90mGraph:\x1b[0m ${result.graph.nodes.length} nós, ${result.graph.parallelBatches.length} etapas (${result.graph.parallelBatches.map((b) => `[${b.join(', ')}]`).join(' → ')})`);
  console.log(`  \x1b[90mHealing:\x1b[0m ${result.healing.length === 0 ? 'nenhuma ação necessária' : result.healing.map((h) => h.kind).join(', ')}`);
  if (result.verification && result.verification.length > 0) {
    const verified = result.verification.filter((v) => v.result.status === 'VERIFIED').length;
    const failed = result.verification.filter((v) => v.result.status === 'FAILED');
    const unverified = result.verification.filter((v) => v.result.status === 'UNVERIFIED');
    console.log(`  \x1b[90mVerificação:\x1b[0m ${verified}/${result.verification.length} VERIFIED${failed.length > 0 ? `, ${failed.length} FAILED` : ''}${unverified.length > 0 ? `, ${unverified.length} sem evidência conclusiva` : ''}`);
    for (const v of [...failed, ...unverified].slice(0, 3)) {
      console.log(`    \x1b[33m•\x1b[0m ${v.nodeId}: ${v.result.reason}${v.result.unmet.length > 0 ? ` (${v.result.unmet.slice(0, 2).join('; ')})` : ''}`);
    }
  }
  // Fundamentação: dos caminhos que os artefatos citaram, quantos existem no
  // projeto. Só faz sentido aqui — o objetivo de um `izanagi run` É sobre o
  // projeto onde ele roda, ao contrário de um caso sintético de benchmark.
  const grounding = measureGroundedness(producedArtifacts, process.cwd());
  if (grounding.references > 0) {
    const pct = Math.round((grounding.rate ?? 0) * 100);
    const color = pct >= 80 ? '\x1b[32m' : pct >= 50 ? '\x1b[33m' : '\x1b[31m';
    console.log(
      `  \x1b[90mFundamentação:\x1b[0m ${color}${pct}%\x1b[0m ${grounding.grounded}/${grounding.references} caminho(s) citado(s) existem no projeto`,
    );
  }
  if (result.conversation && result.conversation.length > 0) {
    const critiques = result.conversation.filter((m) => m.type === 'critique');
    const corrections = result.conversation.filter((m) => m.type === 'correction');
    console.log(`  \x1b[90mProtocolo A2A:\x1b[0m ${result.conversation.length} mensagem(ns)${critiques.length > 0 ? `, ${critiques.length} crítica(s)` : ''}${corrections.length > 0 ? `, ${corrections.length} correção(ões) dirigida(s)` : ''}`);
    for (const c of corrections.slice(0, 2)) {
      console.log(`    \x1b[33m•\x1b[0m ${c.from} -> ${c.to}: ${c.summary}`);
    }
  }
  if (opts.output) {
    // Arquivos materializados: o run escreveu código de verdade, e o usuário
    // precisa saber ONDE antes de procurar. Zero declarado é informação, não
    // silêncio — o run pode ter produzido só documento.
    if (receipt && typeof receipt.candidates === 'number') {
      const written = receipt.written?.length ?? 0;
      console.log(
        written > 0
          ? `  \x1b[90mArquivos:\x1b[0m \x1b[32m✔\x1b[0m ${written} materializado(s) em ${receipt.dir}/`
          : `  \x1b[90mArquivos:\x1b[0m nenhum arquivo declarado pelos agentes (o run entregou documento, não código)`,
      );
    }
    // Onde a entrega foi parar. Sem esta linha o usuário precisa adivinhar a
    // raiz que o runtime resolveu — que nem sempre é o cwd de onde ele chamou.
    const rel = deliverableRelPath(opts.output, opts.task);
    const delivered = result.graph.nodes.find((n) => n.id === DELIVER_NODE_ID);
    const ok = delivered?.status === 'succeeded';
    console.log(
      `  \x1b[90mEntrega:\x1b[0m ${ok ? '\x1b[32m✔\x1b[0m ' : '\x1b[33m✗ não gravada — \x1b[0m'}${path.resolve(process.cwd(), rel)}`,
    );
  }
  console.log(`  \x1b[90mDuration:\x1b[0m ${result.trace.durationMs}ms | tokens ${result.trace.tokens?.total ?? 0}`);

  // Imprime o trace detalhado
  printTrace(result.trace);

  // Sem `--output`, o trabalho fica no content store e o usuário precisa saber
  // que existe uma forma de trazê-lo para o projeto. Só aparece quando houve
  // artefato de produto: num run que não produziu nada, a dica seria ruído.
  if (!opts.output && Object.values(producedArtifacts).some((a) => a.kind !== 'evaluation' && a.kind !== 'critique')) {
    console.log(`\n\x1b[90mPara receber o resultado como arquivo no projeto:\x1b[0m \x1b[36mizanagi run "..." --output <dir>\x1b[0m`);
  }
  console.log(`\n\x1b[90mVer o trace completo:\x1b[0m \x1b[36mizanagi trace ${result.trace.runId}\x1b[0m`);
  console.log(`\x1b[90mAvaliação isolada:\x1b[0m \x1b[36mizanagi eval --report ${result.trace.runId}\x1b[0m`);
  console.log(`\x1b[90mExplicação da execução:\x1b[0m \x1b[36mizanagi explain ${result.trace.runId}\x1b[0m\n`);
  return result;
}

/* ==================== CAPC — fundação estática do prompt de nó ==================== */

/**
 * Budget máximo (em chars) da fundação RULES.md embutida no prefixo estático.
 * 6000 chars ≈ 1500 tokens estimados (~4 chars/token) — folga sobre o piso
 * MIN_CACHEABLE_TOKENS (1024) mesmo após o corte determinístico.
 */
export const RULES_FOUNDATION_MAX_CHARS = 6000;

/** Header genérico do prefixo estático: SEM dados do nó (id/outputs), senão o bloco cacheável divergiria entre nós. */
const STATIC_PROMPT_HEADER = '# IZANAGI AI — Adaptive Runtime\n';
const SUPREME_RULE_LINE = '- Regra suprema: NUNCA entregar checklists, resumos ou stubs — gerar conteúdo real, completo e pronto para produção.\n';
const FOUNDATION_TITLE = '## FUNDAÇÃO OPERACIONAL (RULES.md · seções 1–2)\n';

/**
 * Localiza RULES.md na ordem canônica do framework: instalação distribuída
 * (`<cwd>/.agents/RULES.md`) primeiro, repo-fonte (`<baseDir>/RULES.md`)
 * depois. null = ausente nos dois roots (guard retrocompatível).
 */
function findRulesDoc(baseDir: string): string | null {
  for (const candidate of [path.join(process.cwd(), '.agents', 'RULES.md'), path.join(baseDir, 'RULES.md')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Header que abre a seção 3 no RULES.md canônico (`## 3. Skills`) — "ou equivalente" aceita `#`–`######`, `:` e espaço. */
const SECTION_3_HEADER = /^#{1,6}\s*3(\.|:|\s)/;

/**
 * Corte DETERMINÍSTICO da fundação: linhas 1 até (exclusive) o header `## 3.`
 * — as Golden Rules + Communication Rules (seções 1–2) são invariantes entre
 * runs; o resto é específico demais para valer cache. Sem header `## 3.`,
 * usa o arquivo inteiro. Acima do budget, trunca por linha inteira (nunca no
 * meio) e declara o corte em comentário determinístico (sem timestamps).
 */
function extractRulesFoundation(content: string, sourcePath: string): string {
  const lines = content.split('\n');
  const cutIdx = lines.findIndex((line) => SECTION_3_HEADER.test(line));
  const selected = cutIdx === -1 ? [...lines] : lines.slice(0, cutIdx);
  while (selected.length > 0 && selected[selected.length - 1].trim() === '') selected.pop();

  const total = selected.join('\n');
  if (total.length <= RULES_FOUNDATION_MAX_CHARS) {
    return `${total}\n\n<!-- fundação RULES.md: linhas 1–${selected.length} até o header "## 3." (corte determinístico) · conteúdo completo em ${sourcePath} -->`;
  }

  const kept: string[] = [];
  let used = 0;
  for (const line of selected) {
    const cost = line.length + 1;
    if (used + cost > RULES_FOUNDATION_MAX_CHARS) break;
    kept.push(line);
    used += cost;
  }
  return `${kept.join('\n')}\n\n<!-- fundação RULES.md truncada em ${used - 1} chars (budget ${RULES_FOUNDATION_MAX_CHARS}) até o header "## 3." (corte determinístico) · conteúdo completo em ${sourcePath} -->`;
}

/**
 * Compila o system prompt de um nó do grafo: identidade do agente do nó,
 * regras obrigatórias, skills resolvidas (resumidas) e contrato do artefato.
 *
 * Cache-Aware Prompt Compression (CAPC): quando existe RULES.md e o prefixo
 * estático atinge MIN_CACHEABLE_TOKENS tokens estimados, o prompt vira
 * `[ESTÁTICO] + <!-- IZANAGI:DYNAMIC --> + [VOLÁTIL]`:
 *   ESTÁTICO = header genérico + regra suprema + fundação RULES.md (seções 1–2)
 *   VOLÁTIL  = nó em execução + artefato esperado + identidade + always/never
 *              + TAREFA + skills — tudo na ordem pré-wave.
 * O bloco estático fica BYTE-IDÊNTICO entre nós do mesmo run (condição para
 * o provider cachear: Anthropic via cache_control automático no client;
 * OpenAI-compatible via prefix caching). Guardas retrocompatíveis: sem
 * RULES.md OU estático abaixo do piso → formato pré-wave SEM marker.
 * flags.noCacheFoundation desliga a fundação/marker incondicionalmente.
 */
export function buildNodePrompt(
  node: GraphNode,
  opts: { task: string; agent: any; skillChain: string[] },
  baseDir: string,
  flags?: { noCacheFoundation?: boolean; context?: string },
): string {
  const agent = node.agent ? findAgentJson(node.agent, baseDir) : undefined;
  const identity = agent?.identity || agent?.role || opts.agent.identity || opts.agent.role || `Agente especialista (${node.agent ?? node.id})`;
  const skills = (node.skills ?? opts.skillChain).slice(0, 4);

  // Corpo volátil compartilhado pelas duas formas do prompt (ordem pré-wave preservada).
  const artifactLine = `- Artefato esperado deste nó: \`${node.outputs?.[0] ?? 'raw'}\` (conteúdo estruturado, sem markdown desnecessário).\n\n`;
  let body = `## IDENTIDADE & PAPEL\n${identity}\n\n`;
  if (agent?.always?.length) body += `## REGRAS OBRIGATÓRIAS\n- ${agent.always.join('\n- ')}\n\n`;
  if (agent?.never?.length) body += `## PROIBIDO\n- ${agent.never.join('\n- ')}\n\n`;
  // Contexto mínimo do Context Resolver (objetivo do nó, critérios de aceite e
  // insumos resumidos). Sem ele, o nó recebia só a tarefa original do run e
  // nunca via a saída dos predecessores.
  body += flags?.context ? `${flags.context}\n` : `## TAREFA\n${opts.task}\n`;
  if (skills.length > 0) {
    body += `\n## SKILLS APLICÁVEIS\n`;
    for (const skill of skills) {
      const sPath = resolveSkillPath(process.cwd(), baseDir, skill);
      if (sPath && fs.existsSync(sPath)) {
        const source = findV2Counterpart(process.cwd(), baseDir, sPath) ?? sPath;
        body += `\n### Skill: ${skill}\n${layeredSkillSummary(source, 80)}\n`;
      }
    }
  }

  if (!flags?.noCacheFoundation) {
    const rulesPath = findRulesDoc(baseDir);
    if (rulesPath) {
      const foundation = extractRulesFoundation(fs.readFileSync(rulesPath, 'utf-8'), rulesPath);
      const staticText = `${STATIC_PROMPT_HEADER}${SUPREME_RULE_LINE}${FOUNDATION_TITLE}${foundation}\n`;
      // Guard do piso: abaixo de 1024 tokens estimados o provider ignora o
      // cache_control — não vale mudar a forma do prompt; cai no formato pré-wave.
      if (estimateStaticTokens(staticText) >= MIN_CACHEABLE_TOKENS) {
        return `${staticText}${DYNAMIC_MARKER}\n- Nó em execução: "${node.id}"\n${artifactLine}${body}`;
      }
    }
  }

  // Formato pré-wave (retrocompatível byte-a-byte): sem fundação, sem marker.
  let prompt = `# IZANAGI AI — Adaptive Runtime · Nó "${node.id}"\n`;
  prompt += SUPREME_RULE_LINE;
  prompt += artifactLine;
  prompt += body;
  return prompt;
}

export function findAgentJson(agentId: string, baseDir: string): any {
  for (const root of [process.cwd(), baseDir]) {
    const file = path.join(root, 'agents', `${agentId}-agent.json`);
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
