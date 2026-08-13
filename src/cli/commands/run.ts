import fs from 'fs';
import path from 'path';
import { findAgentFile, loadSkillResolver, resolveSkillPath, loadProjectConfig } from '../framework.js';
import { buildBlueprintCtx } from '../blueprint.js';
import { Orchestrator, type ExecuteCtx } from '../../runtime/orchestrator.js';
import { LLMClient } from '../../runtime/llm/client.js';
import type { GraphNode } from '../../runtime/types.js';
import { printTrace } from './trace.js';

interface RunArgs {
  agentId?: string;
  task?: string;
  /** Só compila e salva izanagi-prompt.md — não executa (sem graph/eval/trace). */
  promptOnly: boolean;
  verbose: boolean;
}

function parseRunArgs(args: string[]): RunArgs {
  let agentId: string | undefined;
  let task: string | undefined;
  let promptOnly = false;
  let verbose = false;
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--task' || arg === '-t') {
      task = args[i + 1];
      i++;
    } else if (arg.startsWith('--task=')) {
      task = arg.slice(7);
    } else if (arg === '--prompt-only' || arg === '-p') {
      promptOnly = true;
    } else if (arg === '--runtime' || arg === '-r') {
      // Compatibilidade: execução via runtime é o comportamento default desde a
      // unificação dos caminhos de 'run' — a flag é aceita e ignorada (no-op).
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
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

  return { agentId, task, promptOnly, verbose };
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
 * Compacta o conteúdo de uma skill para o prompt: mantém apenas a parte de
 * alto sinal (descrição + primeiras seções até o limite de linhas).
 * Evita despejar arquivos inteiros de skill (200+ linhas) no prompt gerado.
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

export async function runCommand(baseDir: string, args: string[]): Promise<void> {
  const { agentId, task, promptOnly, verbose } = parseRunArgs(args);

  if (!task) {
    console.error('\x1b[31mError:\x1b[0m Please provide a task description.');
    console.error('Usage: \x1b[1mizanagi run [agent] --task "<description>"\x1b[0m');
    console.error('Examples:');
    console.error('  izanagi run "Create a login page"   (Adaptive Runtime: graph + eval + trace + recovery + memory)');
    console.error('  izanagi run architect --task "Design a microservices architecture"');
    console.error('  izanagi run "..." --prompt-only   (só compila izanagi-prompt.md, sem executar)');
    process.exit(1);
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
      console.log(`  \x1b[32m✔\x1b[0m \x1b[1m${skill}\x1b[0m -> ${path.relative(cwd, skillPath)}`);
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
        fullPrompt += `### SKILL: ${skill}\n` + summarizeSkill(sPath, compact ? 60 : 160) + `\n\n`;
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
  await runRuntime(baseDir, {
    task,
    category,
    agentId: agentId ?? classifyTask(task).agent,
    skillChain: compactSkillChain,
    agent,
    verbose,
  });
}

/**
 * Modo runtime: usa o Orchestrator do framework para construir o execution
 * graph, avaliar, curar falhas e persistir trace + aprendizados.
 *
 * Quando há API key configurada (IZANAGI_OPENAI_API_KEY, IZANAGI_ANTHROPIC_API_KEY,
 * IZANAGI_GOOGLE_API_KEY), cada nó do grafo é executado por um LLM real via
 * ModelRouter; sem chave, roda em modo headless (simulação) com aviso.
 */
async function runRuntime(
  baseDir: string,
  opts: {
    task: string;
    category: string;
    agentId: string;
    skillChain: string[];
    agent: any;
    verbose: boolean;
  },
): Promise<void> {
  console.log('\n\x1b[36m=== Izanagi Adaptive Runtime ===\x1b[0m\n');

  const client = new LLMClient();
  const llmProviders = client.configuredProviders();
  if (llmProviders.length === 0) {
    console.log('  \x1b[33m⚠ Modo headless:\x1b[0m nenhuma API key encontrada (IZANAGI_OPENAI_API_KEY /');
    console.log('    IZANAGI_ANTHROPIC_API_KEY / IZANAGI_GOOGLE_API_KEY).');
    console.log('    Os nós do grafo serão simulados — defina uma chave para execução real via LLM.\n');
  } else {
    console.log(`  \x1b[32m✔ Execução real via LLM:\x1b[0m providers configurados: ${llmProviders.join(', ')}\n`);
  }

  const orchestrator = new Orchestrator({
    baseDir,
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
    produce: async (node: GraphNode, ctx: ExecuteCtx) => {
      if (llmProviders.length === 0) {
        // Producer headless: simula artefato (sem LLM configurado)
        const label = node.agent ?? node.skills?.join('+') ?? node.id;
        return {
          content: {
            node: node.id,
            label,
            task: opts.task,
            producedAt: new Date().toISOString(),
            summary: `Artefato produzido pelo nó "${node.id}" (${label}).`,
          },
          kind: node.outputs?.[0] ?? 'raw',
          tokens: 300,
          model: 'cli-headless',
        };
      }

      // Execução real: compila o prompt do nó e chama o LLM com o modelo/provider
      // já roteados pelo Orchestrator (mesma fonte de verdade, sem recomputar aqui).
      const system = buildNodePrompt(node, opts, baseDir);
      const result = await client.complete(ctx.provider, {
        model: ctx.model,
        system,
        messages: [{ role: 'user', content: opts.task }],
        maxTokens: node.tokenBudget ?? 4000,
      });
      return {
        content: result.text,
        kind: node.outputs?.[0] ?? 'raw',
        tokens: result.tokens,
        model: result.model,
      };
    },
    consume: (node: GraphNode, artifact: { kind: string; valid: boolean }) => {
      if (!artifact.valid) {
        console.log(`  \x1b[33m⚠\x1b[0m Nó "${node.id}": artefato inválido (${artifact.kind})`);
      }
    },
  });

  const result = await orchestrator.run();

  // Relatório final
  const verdict = result.evaluation;
  const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'PASS_WITH_WARNINGS' ? '\x1b[33m' : result.status === 'FAIL' || result.status === 'BLOCKED' ? '\x1b[31m' : '\x1b[90m';
  console.log(`\n\x1b[1mRuntime result:\x1b[0m ${color}${result.status}\x1b[0m (score ${verdict?.score ?? '—'})`);
  console.log(`  \x1b[90mGraph:\x1b[0m ${result.graph.nodes.length} nós, ${result.graph.parallelBatches.length} etapas (${result.graph.parallelBatches.map((b) => `[${b.join(', ')}]`).join(' → ')})`);
  console.log(`  \x1b[90mHealing:\x1b[0m ${result.healing.length === 0 ? 'nenhuma ação necessária' : result.healing.map((h) => h.kind).join(', ')}`);
  console.log(`  \x1b[90mDuration:\x1b[0m ${result.trace.durationMs}ms | tokens ${result.trace.tokens?.total ?? 0}`);

  // Imprime o trace detalhado
  printTrace(result.trace);

  console.log(`\n\x1b[90mVer o trace completo:\x1b[0m \x1b[36mizanagi trace ${result.trace.runId}\x1b[0m`);
  console.log(`\x1b[90mAvaliação isolada:\x1b[0m \x1b[36mizanagi eval --report ${result.trace.runId}\x1b[0m\n`);
}

/**
 * Compila o system prompt de um nó do grafo: identidade do agente do nó,
 * regras obrigatórias, skills resolvidas (resumidas) e contrato do artefato.
 */
function buildNodePrompt(node: GraphNode, opts: { task: string; agent: any; skillChain: string[] }, baseDir: string): string {
  const agent = node.agent ? findAgentJson(node.agent, baseDir) : undefined;
  const identity = agent?.identity || agent?.role || opts.agent.identity || opts.agent.role || `Agente especialista (${node.agent ?? node.id})`;
  const skills = (node.skills ?? opts.skillChain).slice(0, 4);

  let prompt = `# IZANAGI AI — Adaptive Runtime · Nó "${node.id}"\n`;
  prompt += `- Regra suprema: NUNCA entregar checklists, resumos ou stubs — gerar conteúdo real, completo e pronto para produção.\n`;
  prompt += `- Artefato esperado deste nó: \`${node.outputs?.[0] ?? 'raw'}\` (conteúdo estruturado, sem markdown desnecessário).\n\n`;
  prompt += `## IDENTIDADE & PAPEL\n${identity}\n\n`;
  if (agent?.always?.length) prompt += `## REGRAS OBRIGATÓRIAS\n- ${agent.always.join('\n- ')}\n\n`;
  if (agent?.never?.length) prompt += `## PROIBIDO\n- ${agent.never.join('\n- ')}\n\n`;
  prompt += `## TAREFA\n${opts.task}\n`;
  if (skills.length > 0) {
    prompt += `\n## SKILLS APLICÁVEIS\n`;
    for (const skill of skills) {
      const sPath = resolveSkillPath(process.cwd(), baseDir, skill);
      if (sPath && fs.existsSync(sPath)) {
        prompt += `\n### Skill: ${skill}\n${summarizeSkill(sPath, 80)}\n`;
      }
    }
  }
  return prompt;
}

function findAgentJson(agentId: string, baseDir: string): any {
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
