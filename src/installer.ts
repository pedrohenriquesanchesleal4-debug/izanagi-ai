import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportToClaude, exportToCodex, exportToCursor, exportToCopilot, exportToKimi, exportToOpencode } from './exporters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Packs de skills selecionáveis durante o `izanagi init`.
 * `core` é obrigatório e nunca pode ser desmarcado.
 */
export interface PackDefinition {
  id: string;
  label: string;
  description: string;
  files: string[];
  default?: boolean;
}

export const PACKS: PackDefinition[] = [
  {
    id: 'core',
    label: 'Core',
    description: 'Engines (Decision, Context, Reflection...) + SYSTEM.md / RULES.md / AGENTS.md',
    files: ['core', 'SYSTEM.md', 'RULES.md', 'AGENTS.md', 'CHANGELOG.md', 'ROADMAP.md'],
    default: true
  },
  {
    id: 'agents',
    label: 'Agents',
    description: '22 agentes pré-definidos em JSON (architect, security, senior-engineer...)',
    files: ['agents'],
    default: true
  },
  {
    id: 'skills',
    label: 'Skill Library',
    description: '103 skills especializadas (quality, debugging, cloud, devops...)',
    files: ['skills'],
    default: true
  },
  {
    id: 'architecture',
    label: 'Architecture',
    description: 'Padrões arquiteturais: Clean Arch, Hexagonal, DDD, CQRS, ADRs',
    files: ['architecture']
  },
  {
    id: 'coding',
    label: 'Coding',
    description: 'Engenharia de software: backend, frontend, React, Laravel, Node',
    files: ['coding', 'backend', 'frontend']
  },
  {
    id: 'database',
    label: 'Database',
    description: 'SQL, PostgreSQL, MySQL, Redis, modelagem ER',
    files: ['database']
  },
  {
    id: 'devops',
    label: 'DevOps',
    description: 'Docker, Kubernetes, CI/CD, Linux, infraestrutura',
    files: ['devops']
  },
  {
    id: 'security',
    label: 'Security',
    description: 'OWASP Top 10, pentest, LGPD/GDPR, autenticação, secrets',
    files: ['security']
  },
  {
    id: 'testing',
    label: 'Testing',
    description: 'Testes unitários, integração, E2E, mocking',
    files: ['testing']
  },
  {
    id: 'memory',
    label: 'Memory',
    description: 'Memória de sessão/projeto, compressão, knowledge graph',
    files: ['memory']
  },
  {
    id: 'optimization',
    label: 'Optimization',
    description: 'Redução de tokens, otimização de prompts, custo',
    files: ['optimization']
  },
  {
    id: 'teaching',
    label: 'Teaching',
    description: 'Modo professor e ensino adaptativo',
    files: ['teaching']
  }
];

export const CORE_PACK_ID = 'core';

/**
 * Copia recursivamente um diretório ou arquivo de origem para destino.
 */
function copyRecursiveSync(src: string, dest: string): void {
  const exists = fs.existsSync(src);
  if (!exists) return;

  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName: string) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

/**
 * Pasta raiz do pacote instalado (node_modules/izanagi-ai ou raiz do repo).
 */
export function getPackageDir(): string {
  return path.resolve(__dirname, '..');
}

/**
 * Resolve o framework root do projeto do usuário:
 * - Se o projeto foi inicializado de fato (`.agents/core` existe: o pack `core` é
 *   sempre copiado por `izanagi init`), usa `.agents/` (permite edição local).
 * - Caso contrário, usa a raiz do pacote instalado.
 *
 * Checar só `fs.existsSync(cwd/.agents)` (sem o `/core`) é um falso positivo real:
 * `.agents/memoria/` é criado pelo próprio runtime (`izanagi run`) para persistir
 * memória, mesmo sem `izanagi init` nunca ter sido executado. Nesse caso `.agents/`
 * existe mas não tem `agents/`, `core/`, `skills/` — todo comando (`doctor`, `run`,
 * `agent list`...) então procurava RULES.md/skill-resolver.json ali dentro e falhava
 * silenciosamente, mesmo dentro do próprio checkout do framework (rodar `izanagi doctor`
 * na raiz deste repo depois de qualquer `izanagi run` de teste local reproduz o bug).
 */
export function resolveFrameworkRoot(cwd: string): string {
  const projectAgents = path.join(cwd, '.agents');
  if (fs.existsSync(path.join(projectAgents, 'core'))) {
    return projectAgents;
  }
  return getPackageDir();
}

/**
 * Instala os packs selecionados do Izanagi AI na pasta `.agents` do projeto do usuário.
 */
export function installToProject(targetDir: string, selectedPackIds: string[], cliTarget?: string): void {
  const destinationRoot = path.resolve(targetDir);
  const packageDir = getPackageDir();

  // Garante que `core` esteja sempre presente
  const packIds = Array.from(new Set([CORE_PACK_ID, ...selectedPackIds]));
  const packs = PACKS.filter((p) => packIds.includes(p.id));

  if (!fs.existsSync(destinationRoot)) {
    fs.mkdirSync(destinationRoot, { recursive: true });
  }

  const targetAgentsFolder = path.join(destinationRoot, '.agents');
  fs.mkdirSync(targetAgentsFolder, { recursive: true });

  console.log(`\n\x1b[36m[Izanagi AI]\x1b[0m Initializing framework in: \x1b[1m${destinationRoot}\x1b[0m\n`);

  let copiedItems = 0;

  for (const pack of packs) {
    const copied = pack.files.filter((item) => fs.existsSync(path.join(packageDir, item))).length;
    if (copied === 0) continue;

    for (const item of pack.files) {
      const srcPath = path.join(packageDir, item);
      const destPath = path.join(targetAgentsFolder, item);
      if (fs.existsSync(srcPath)) {
        copyRecursiveSync(srcPath, destPath);
        // Se for arquivo raiz core, copia também para a raiz do projeto para o opencode ler nativamente
        if (['AGENTS.md', 'SYSTEM.md', 'RULES.md'].includes(item)) {
          copyRecursiveSync(srcPath, path.join(destinationRoot, item));
        }
        copiedItems++;
      }
    }

    console.log(`  \x1b[32m✔\x1b[0m Pack \x1b[1m${pack.label}\x1b[0m (${copied} items) — ${pack.description}`);
  }

  // Configuração local (.izanagi/izanagi.config.json)
  const izanagiFolder = path.join(destinationRoot, '.izanagi');
  fs.mkdirSync(izanagiFolder, { recursive: true });

  const config = {
    framework: 'Izanagi AI',
    version: '2.1.0',
    defaultAgent: 'senior-engineer',
    skillsDir: '.agents/skills',
    autoCompression: true,
    qualityGates: true,
    packs: packIds
  };

  fs.writeFileSync(path.join(izanagiFolder, 'izanagi.config.json'), JSON.stringify(config, null, 2));
  console.log('  \x1b[32m✔\x1b[0m Config created (.izanagi/izanagi.config.json)');

  // opencode.json para auto-carregar o framework ao abrir o opencode no projeto
  const opencodePath = path.join(destinationRoot, 'opencode.json');
  if (!fs.existsSync(opencodePath)) {
    const opencodeConfig = {
      $schema: 'https://opencode.ai/config.json',
      instructions: ['AGENTS.md', 'SYSTEM.md']
    };
    fs.writeFileSync(opencodePath, JSON.stringify(opencodeConfig, null, 2));
    console.log('  \x1b[32m✔\x1b[0m opencode.json created (auto-loads framework on opencode)');
  } else {
    console.log('  \x1b[33m•\x1b[0m opencode.json already exists — kept as is');
  }

  // Determina qual CLI/adaptador gerar para não poluir o projeto com arquivos desnecessários
  let targetCli = (cliTarget || '').toLowerCase().trim();
  if (!targetCli) {
    // Auto-detecção primária: a própria CLI expõe uma env var quando está
    // rodando o comando (isso é o que realmente importa — rodar `izanagi
    // init` de dentro do Claude Code deve gerar `.claude/` mesmo num projeto
    // 100% vazio, sem depender de uma pasta `.claude` já existir de antes).
    if (process.env.CLAUDECODE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT) targetCli = 'claude';
    else if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_AGENT) targetCli = 'cursor';
    else if (process.env.CODEX_SANDBOX || process.env.CODEX_HOME) targetCli = 'codex';
    else if (process.env.GITHUB_COPILOT_CLI || process.env.COPILOT_AGENT) targetCli = 'copilot';
    // Fallback: pastas de adaptador já existentes no projeto (segunda melhor
    // pista — cobre reinstalar/atualizar packs num projeto que já rodou
    // `izanagi export --cli X` antes e não está mais rodando dentro da CLI).
    else if (fs.existsSync(path.join(destinationRoot, '.cursor'))) targetCli = 'cursor';
    else if (fs.existsSync(path.join(destinationRoot, '.claude'))) targetCli = 'claude';
    else if (fs.existsSync(path.join(destinationRoot, '.github'))) targetCli = 'copilot';
    else if (fs.existsSync(path.join(destinationRoot, '.codex'))) targetCli = 'codex';
    else if (fs.existsSync(path.join(destinationRoot, '.kimi'))) targetCli = 'kimi';
    else targetCli = 'opencode'; // Padrão limpo sem poluir outras CLIs
  }

  const adapterMap: Record<string, () => string[]> = {
    claude: () => exportToClaude(destinationRoot),
    cursor: () => exportToCursor(destinationRoot),
    codex: () => exportToCodex(destinationRoot),
    copilot: () => exportToCopilot(destinationRoot),
    kimi: () => exportToKimi(destinationRoot),
    opencode: () => exportToOpencode(destinationRoot)
  };

  if (targetCli === 'all') {
    console.log('\n  \x1b[1mGenerating all Multi-CLI adapters:\x1b[0m');
    for (const [name, fn] of Object.entries(adapterMap)) {
      try {
        const created = fn();
        console.log(`  \x1b[32m✔\x1b[0m ${name} adapter: ${created.length} file(s) created`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  \x1b[33m⚠\x1b[0m ${name} skipped: ${msg}`);
      }
    }
  } else if (adapterMap[targetCli]) {
    try {
      const created = adapterMap[targetCli]();
      console.log(`  \x1b[32m✔\x1b[0m Generated adapter for CLI: \x1b[1m${targetCli}\x1b[0m (${created.length} files)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  \x1b[33m⚠\x1b[0m Adapter ${targetCli} skipped: ${msg}`);
    }
  }

  console.log(`\n\x1b[32m[Izanagi AI] Success! ${copiedItems} files copied to .agents (${packs.length} packs).\x1b[0m`);
  console.log('Next steps:');
  console.log('  \x1b[36mizanagi run "your task"\x1b[0m              — classify & plan any task');
  console.log('  \x1b[36mizanagi run <agent> --task "..."\x1b[0m     — run a specific agent');
  console.log('  \x1b[36mizanagi list skills\x1b[0m                  — see available skills');
  console.log('  \x1b[36mizanagi doctor\x1b[0m                      — validate the installation\n');
}
