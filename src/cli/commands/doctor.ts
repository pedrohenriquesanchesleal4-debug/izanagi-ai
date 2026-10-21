import fs from 'fs';
import path from 'path';
import { checkMemory, checkTraces, checkBenchmarkSuite, checkSkillSecurityScan, checkSkillManifest, checkSkillLifecycle, checkNestedDuplicate } from '../checks.js';
import { LLMClient, agentCLIStatus, AGENT_CLI_PROVIDERS } from '../../runtime/llm/client.js';
import { DEFAULT_STRATEGY_LIMITS } from '../../runtime/orchestration/execution-controller.js';

/**
 * Decide a raiz do framework para auditoria.
 *
 * Instalação completa = `.agents/agents/` contendo definições de agente em JSON
 * (formato distribuído). A presença isolada de `.agents/memoria/` não conta — é
 * memória local gitignored e um repo raiz-based cairia por engano no modo
 * "projeto instalado".
 *
 * Topologia v2 (ADR-005): o repo-fonte mantém `.agents/agents/*.yaml` DERIVADOS
 * (nunca .json) apenas como interface de leitura; nesse caso a raiz segue sendo
 * `baseDir` (o pacote instalado), senão o doctor procuraria SYSTEM.md/RULES.md
 * dentro de `.agents/` e falharia.
 */
export function resolveProjectRoot(cwd: string, baseDir: string): string {
  const agentsDotDir = path.join(cwd, '.agents', 'agents');
  if (!fs.existsSync(agentsDotDir)) return baseDir;
  const hasJsonAgents = fs.readdirSync(agentsDotDir).some((f: string) => f.endsWith('.json'));
  return hasJsonAgents ? path.join(cwd, '.agents') : baseDir;
}

/**
 * @param baseDir  Raiz dos ASSETS do framework (agentes, skills, casos de benchmark).
 * @param stateDir Raiz do ESTADO deste projeto (memória, traces, relatórios).
 *                 Default: `baseDir`. Ver `resolveStateRoot` no installer.
 */
export function doctorCommand(baseDir: string, args: string[] = [], stateDir = baseDir): boolean {
  const deep = args.includes('--deep') || args.includes('-d');
  let target: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--target' || a === '-t') {
      target = args[i + 1]?.toLowerCase() || null;
      i++;
    } else if (a.startsWith('--target=')) {
      target = a.slice(9).toLowerCase();
    }
  }

  console.log('\n\x1b[36m=== Izanagi AI Doctor & Integrity Check ===\x1b[0m\n');
  if (target) {
    console.log(`  \x1b[90mTarget environment:\x1b[0m \x1b[1m\x1b[33m${target}\x1b[0m\n`);
  }

  const cwd = process.cwd();

  const projectRoot = resolveProjectRoot(cwd, baseDir);

  let errors = 0;
  let warnings = 0;

  if (target) {
    const targetResult = checkTargetEnvironment(target, baseDir, projectRoot, baseDir);
    errors += targetResult.errors;
    warnings += targetResult.warnings;
  }

  // 0. Verify there's no `<nome>/<nome>` nested duplicate (root cause of "agents/skills não aparecem").
  const nestedDuplicate = checkNestedDuplicate(baseDir);
  if (nestedDuplicate) {
    console.log(` \x1b[33m⚠\x1b[0m ${nestedDuplicate.name}: ${nestedDuplicate.detail}`);
    warnings++;
  }

  // 1. Verify SYSTEM.md & RULES.md
  const systemPath = path.join(projectRoot, 'SYSTEM.md');
  const rulesPath = path.join(projectRoot, 'RULES.md');

  if (fs.existsSync(systemPath)) {
    console.log(' \x1b[32m✔\x1b[0m SYSTEM.md found');
  } else {
    console.log(' \x1b[31m✖\x1b[0m SYSTEM.md missing!');
    errors++;
  }

  if (fs.existsSync(rulesPath)) {
    console.log(' \x1b[32m✔\x1b[0m RULES.md found');
  } else {
    console.log(' \x1b[31m✖\x1b[0m RULES.md missing!');
    errors++;
  }

  // 2. Verify Agents
  const agentsDirs = [
    path.join(cwd, '.agents', 'agents'),
    path.join(cwd, 'agents'),
    path.join(baseDir, 'agents')
  ];

  const seen = new Set<string>();
  let agentCount = 0;

  for (const agentsDir of agentsDirs) {
    if (!fs.existsSync(agentsDir)) continue;
    const agentFiles = fs.readdirSync(agentsDir).filter((f: string) => f.endsWith('.json'));
    for (const f of agentFiles) {
      if (seen.has(f)) continue;
      seen.add(f);
      agentCount++;
      try {
        const content = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
        if (!content.name || !content.skills) {
          console.log(`   \x1b[33m⚠\x1b[0m Agent ${f} missing required fields (name, skills)`);
          warnings++;
        }
      } catch {
        console.log(`   \x1b[31m✖\x1b[0m Invalid JSON in agent file ${f}`);
        errors++;
      }
    }
  }

  if (agentCount > 0) {
    console.log(` \x1b[32m✔\x1b[0m Found ${agentCount} agent JSON definitions`);
  } else {
    console.log(' \x1b[31m✖\x1b[0m agents directory missing!');
    errors++;
  }

  // 3. Verify Skill Resolver
  const resolverPath = path.join(projectRoot, 'core', 'skill-resolver.json');
  if (!fs.existsSync(resolverPath)) {
    console.log(' \x1b[31m✖\x1b[0m skill-resolver.json missing!');
    errors++;
  } else {
    try {
      const resolverData = JSON.parse(fs.readFileSync(resolverPath, 'utf-8'));
      const aliases = resolverData.aliases || {};
      let resolvedCount = 0;
      let unresolvedCount = 0;

      for (const [alias, relPath] of Object.entries(aliases)) {
        const roots = [projectRoot, baseDir];
        let found = false;

        for (const root of roots) {
          const fullPath = path.join(root, relPath as string);
          if (
            fs.existsSync(fullPath) ||
            fs.existsSync(fullPath + '.md') ||
            fs.existsSync(path.join(fullPath, 'SKILL.md'))
          ) {
            found = true;
            break;
          }
        }

        if (found) {
          resolvedCount++;
        } else {
          console.log(`   \x1b[33m⚠\x1b[0m Alias "${alias}" points to non-existent target: ${relPath}`);
          unresolvedCount++;
          warnings++;
        }
      }

      console.log(` \x1b[32m✔\x1b[0m Skill Resolver: ${resolvedCount} aliases valid, ${unresolvedCount} unmapped.`);
    } catch (err: any) {
      console.log(` \x1b[31m✖\x1b[0m Invalid JSON in skill-resolver.json: ${err.message}`);
      errors++;
    }
  }

  // Executor: a pergunta que decide se `izanagi run` faz trabalho de verdade
  // ou simula. Vem antes do resumo de propósito — é o diagnóstico que o
  // usuário mais precisa e o que antes ele só descobria vendo o run simular.
  warnings += reportExecutors();

  if (deep) {
    const deepErrors = runDeepChecks(baseDir, stateDir);
    errors += deepErrors;
  }

  console.log(`\n\x1b[1mSummary:\x1b[0m ${errors === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'} (${errors} errors, ${warnings} warnings)\n`);
  return errors === 0;
}

/**
 * Quem vai executar os nós do grafo. Três camadas, na ordem em que o runtime
 * as prefere: API key configurada, modelo local em opt-in, CLI de agente já
 * autenticado na máquina. Nenhuma das três, e o run simula (headless).
 *
 * Devolve o número de avisos (0 quando existe algum executor real).
 */
function reportExecutors(): number {
  const client = new LLMClient();
  const providers = client.configuredProviders();
  const agentCli = agentCLIStatus();
  const keyed = providers.filter((p) => !AGENT_CLI_PROVIDERS.includes(p));

  console.log('\n\x1b[1m\x1b[36m-- Executor --\x1b[0m\n');

  for (const status of agentCli) {
    if (status.available) {
      console.log(` \x1b[32m✔\x1b[0m ${status.label} (${status.provider}): ${status.path} \x1b[90m(sem API key)\x1b[0m`);
    } else {
      console.log(` \x1b[90m-\x1b[0m ${status.label} (${status.provider}): ${status.reason}`);
    }
  }

  if (keyed.length > 0) {
    console.log(` \x1b[32m✔\x1b[0m Providers por chave/opt-in: ${keyed.join(', ')}`);
  }

  if (providers.length === 0) {
    console.log(' \x1b[33m⚠\x1b[0m Nenhum executor: `izanagi run` vai SIMULAR os nós (modo headless).');
    console.log('   Saída mais curta: instale e autentique o Claude Code CLI (nenhuma API key necessária).');
    return 1;
  }

  console.log(` \x1b[90mexecução real habilitada — providers utilizáveis: ${providers.join(', ')}\x1b[0m`);
  return 0;
}

function runDeepChecks(baseDir: string, stateDir: string): number {
  let errors = 0;
  console.log('\n\x1b[1m\x1b[36m-- Deep checks (runtime) --\x1b[0m\n');

  const memory = checkMemory(stateDir);
  console.log(` \x1b[32m✔\x1b[0m Memory: ${memory.detail}`);

  const traces = checkTraces(stateDir, 10);
  console.log(` \x1b[32m✔\x1b[0m Traces: ${traces.detail}`);

  const benchmarks = checkBenchmarkSuite(baseDir);
  console.log(` \x1b[32m✔\x1b[0m Benchmarks: ${benchmarks.detail}`);

  const scan = checkSkillSecurityScan(baseDir);
  if (!scan.ok) {
    console.log(` \x1b[31m✖\x1b[0m Skill scan: ${scan.detail}`);
    const offenders = scan.results.filter((s) => s.level === 'CRITICAL' || s.level === 'HIGH').slice(0, 3);
    for (const s of offenders) {
      console.log(`   \x1b[31m- ${s.skill}: ${s.level}\x1b[0m`);
    }
    errors++;
  } else {
    console.log(` \x1b[32m✔\x1b[0m Skill security scan: ${scan.detail}`);
  }

  const manifest = checkSkillManifest(baseDir);
  if (!manifest.ok) {
    console.log(` \x1b[33m⚠\x1b[0m Skill manifest: ${manifest.detail}`);
  } else {
    console.log(` \x1b[32m✔\x1b[0m Skill manifest: ${manifest.detail}`);
  }

  const lifecycle = checkSkillLifecycle(manifest.skills);
  console.log(` \x1b[32m✔\x1b[0m Skill lifecycle: ${lifecycle.detail}`);

  const limitsSummary = Object.entries(DEFAULT_STRATEGY_LIMITS)
    .map(([s, l]) => `${s}(iter=${l.maxIterations}, tools=${l.maxToolCalls}, retries=${l.maxRetriesPerStage}, timeout=${Math.round(l.maxTimeMs / 1000)}s)`)
    .join(' · ');
  console.log(` \x1b[32m✔\x1b[0m Execution Controller & Loop Guard: ${limitsSummary}`);

  return errors;
}

/**
 * Verificação de conformidade e prontidão para ambientes específicos (Target Doctor).
 */
export function checkTargetEnvironment(
  target: string,
  cwd: string,
  projectRoot: string,
  baseDir: string
): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  console.log(`\x1b[1m\x1b[36m-- Target Verification: ${target} --\x1b[0m\n`);

  switch (target) {
    case 'antigravity': {
      // 1. Descoberta de skills (.agents/skills.json ou .agents/skills/)
      const skillsJsonPath = path.join(cwd, '.agents', 'skills.json');
      const agentsSkillsDir = path.join(cwd, '.agents', 'skills');
      let skillsDiscovered = false;

      if (fs.existsSync(skillsJsonPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(skillsJsonPath, 'utf-8'));
          if (Array.isArray(cfg.entries) && cfg.entries.length > 0) {
            console.log(` \x1b[32m✔\x1b[0m Antigravity skills.json configurado (${cfg.entries.length} caminhos registrados)`);
            skillsDiscovered = true;
          } else {
            console.log(` \x1b[33m⚠\x1b[0m .agents/skills.json existe mas não possui entradas válidas no array 'entries'.`);
            warnings++;
          }
        } catch (err: any) {
          console.log(` \x1b[31m✖\x1b[0m .agents/skills.json com JSON inválido: ${err.message}`);
          errors++;
        }
      } else if (fs.existsSync(agentsSkillsDir)) {
        const count = fs.readdirSync(agentsSkillsDir).filter((d) => fs.existsSync(path.join(agentsSkillsDir, d, 'SKILL.md'))).length;
        if (count > 0) {
          console.log(` \x1b[32m✔\x1b[0m Antigravity pasta .agents/skills detectada (${count} skills presentes)`);
          skillsDiscovered = true;
        }
      }

      if (!skillsDiscovered) {
        console.log(` \x1b[31m✖\x1b[0m Antigravity não descobre as skills do Izanagi no projeto.`);
        console.log(`   \x1b[33mRemediação:\x1b[0m Execute \`npx izanagi export --cli antigravity\` para gerar .agents/skills.json`);
        errors++;
      }

      // 2. Rules / Instruções
      const agentsMd = path.join(cwd, 'AGENTS.md');
      const geminiMd = path.join(cwd, 'GEMINI.md');
      const coreRule = path.join(cwd, '.agents', 'rules', 'izanagi-core.md');

      if (fs.existsSync(agentsMd) || fs.existsSync(geminiMd)) {
        console.log(` \x1b[32m✔\x1b[0m Documento de regras raiz presente (${fs.existsSync(agentsMd) ? 'AGENTS.md' : 'GEMINI.md'})`);
      } else {
        console.log(` \x1b[31m✖\x1b[0m AGENTS.md e GEMINI.md ausentes na raiz.`);
        errors++;
      }

      if (fs.existsSync(coreRule)) {
        console.log(` \x1b[32m✔\x1b[0m Regras operacionais em .agents/rules/izanagi-core.md encontradas`);
      } else {
        console.log(` \x1b[33m⚠\x1b[0m .agents/rules/izanagi-core.md não encontrado.`);
        warnings++;
      }

      // 3. Agentes Especializados para Antigravity
      let agentSkillsFound = 0;
      if (fs.existsSync(agentsSkillsDir)) {
        agentSkillsFound = fs.readdirSync(agentsSkillsDir).filter((d) => d.startsWith('izanagi-')).length;
      }
      if (agentSkillsFound > 0) {
        console.log(` \x1b[32m✔\x1b[0m ${agentSkillsFound} agentes disponíveis como skills invocáveis no Antigravity (ex: izanagi-architect)`);
      } else {
        console.log(` \x1b[33m⚠\x1b[0m Agentes não exportados como skills para o Antigravity.`);
        console.log(`   \x1b[33mRemediação:\x1b[0m Execute \`npx izanagi export --cli antigravity\` para expor os 23 especialistas.`);
        warnings++;
      }

      // 4. Detecção de ambiente em tempo de execução
      if (process.env.ANTIGRAVITY_AGENT === '1' || process.env.ANTIGRAVITY_LS_VERSION) {
        console.log(` \x1b[32m✔\x1b[0m Sessão ativa dentro do Antigravity IDE (Language Server ${process.env.ANTIGRAVITY_LS_VERSION ?? 'conectado'})`);
      } else {
        console.log(` \x1b[90mℹ\x1b[0m Comando executado fora do processo do Antigravity (ambiente standalone/CLI)`);
      }
      break;
    }

    case 'opencode': {
      // 1. Configuração do OpenCode
      const opencodeJsonPath = path.join(cwd, 'opencode.json');
      if (fs.existsSync(opencodeJsonPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(opencodeJsonPath, 'utf-8'));
          console.log(` \x1b[32m✔\x1b[0m opencode.json encontrado e válido`);
          // 2. Token economy check
          if (Array.isArray(cfg.instructions) && (cfg.instructions.includes('SYSTEM.md') || cfg.instructions.includes('RULES.md'))) {
            console.log(` \x1b[33m⚠\x1b[0m [Token Diet] opencode.json inclui SYSTEM.md/RULES.md nas instruções sempre ativas (~17k tokens/turno).`);
            console.log(`   \x1b[33mRecomendação:\x1b[0m Mantenha apenas 'AGENTS.md' em opencode.json. instructions para economizar tokens.`);
            warnings++;
          } else {
            console.log(` \x1b[32m✔\x1b[0m [Token Diet] opencode.json otimizado (instruções compactas)`);
          }
        } catch (err: any) {
          console.log(` \x1b[31m✖\x1b[0m opencode.json contém JSON inválido: ${err.message}`);
          errors++;
        }
      } else {
        console.log(` \x1b[33m⚠\x1b[0m opencode.json não encontrado na raiz.`);
        warnings++;
      }

      // 3. Comandos / Agentes
      const agentDir = path.join(cwd, '.opencode', 'agent');
      const agentsDir = path.join(cwd, '.opencode', 'agents');
      const targetDir = fs.existsSync(agentsDir) ? agentsDir : agentDir;
      if (fs.existsSync(targetDir)) {
        const count = fs.readdirSync(targetDir).filter((f) => f.endsWith('.md')).length;
        console.log(` \x1b[32m✔\x1b[0m Comandos/agentes do OpenCode encontrados em ${path.relative(cwd, targetDir)}: ${count} agentes`);
      } else {
        console.log(` \x1b[31m✖\x1b[0m Nenhum diretório de agentes OpenCode (.opencode/agent ou .opencode/agents) encontrado.`);
        console.log(`   \x1b[33mRemediação:\x1b[0m Execute \`npx izanagi export --cli opencode\``);
        errors++;
      }
      break;
    }

    case 'claude': {
      const claudeDir = path.join(cwd, '.claude');
      const claudeMd = path.join(cwd, 'CLAUDE.md');
      if (fs.existsSync(claudeMd)) {
        console.log(` \x1b[32m✔\x1b[0m CLAUDE.md encontrado na raiz`);
      } else {
        console.log(` \x1b[33m⚠\x1b[0m CLAUDE.md ausente`);
        warnings++;
      }
      if (fs.existsSync(claudeDir)) {
        const agents = fs.existsSync(path.join(claudeDir, 'agents')) ? fs.readdirSync(path.join(claudeDir, 'agents')).length : 0;
        const skills = fs.existsSync(path.join(claudeDir, 'skills')) ? fs.readdirSync(path.join(claudeDir, 'skills')).length : 0;
        console.log(` \x1b[32m✔\x1b[0m .claude adapter: ${agents} subagentes e ${skills} skills`);
      } else {
        console.log(` \x1b[31m✖\x1b[0m Pasta .claude não encontrada. Execute \`npx izanagi export --cli claude\``);
        errors++;
      }
      break;
    }

    case 'cursor': {
      const cursorDir = path.join(cwd, '.cursor', 'rules');
      if (fs.existsSync(cursorDir)) {
        const count = fs.readdirSync(cursorDir).filter((f) => f.endsWith('.mdc')).length;
        console.log(` \x1b[32m✔\x1b[0m .cursor/rules presente (${count} arquivos .mdc)`);
      } else {
        console.log(` \x1b[31m✖\x1b[0m .cursor/rules ausente. Execute \`npx izanagi export --cli cursor\``);
        errors++;
      }
      break;
    }

    default: {
      console.log(` \x1b[33m⚠\x1b[0m Alvo '${target}' não possui verificação especializada dedicada.`);
      break;
    }
  }

  console.log('');
  return { errors, warnings };
}
