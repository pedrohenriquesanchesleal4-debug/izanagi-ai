import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportToClaude, exportToCodex, exportToCursor, exportToCopilot, exportToKimi, exportToOpencode, GENERATED_MARKER } from './exporters.js';

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
    // `references` entra aqui porque o runtime as LÊ de `<baseDir>/references/`
    // (`cli/commands/run.ts` injeta as curadas no prompt, `cli/blueprint.ts`
    // também). Sem elas no pack, `baseDir` de projeto inicializado é `.agents/`
    // e a injeção nunca encontrava arquivo nenhum: o diretório viajava no
    // tarball e não era instalado em lugar nenhum.
    files: ['core', 'SYSTEM.md', 'RULES.md', 'AGENTS.md', 'CHANGELOG.md', 'ROADMAP.md', 'references'],
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
 * Onde vive o ESTADO deste projeto (`.izanagi/state`: traces, artefatos,
 * memória, checkpoints, aprovações, decisões).
 *
 * Não é a mesma pergunta que `resolveFrameworkRoot`, e confundir as duas era
 * um bug real: aquela função responde "de onde leio agentes e skills?", e o
 * fallback dela para a instalação do pacote está certo — é lá que os agentes
 * embutidos moram. Usar a MESMA raiz para o estado fazia todo projeto sem
 * `izanagi init` gravar trace, artefato (com conteúdo) e memória dentro de
 * `node_modules/izanagi-ai/`, compartilhados entre todos esses projetos. Na
 * prática: `izanagi trace` listava execução de outro projeto, e um
 * `npm update` apagava o histórico.
 *
 * Projeto inicializado continua com o estado em `<projeto>/.agents/`, exatamente
 * onde sempre esteve — mover isso apagaria o histórico de quem já usa. O que
 * muda é só o caso quebrado: sem `.agents/`, o estado fica no próprio
 * diretório do projeto, e não na instalação do framework.
 */
export function resolveStateRoot(cwd: string): string {
  const projectAgents = path.join(cwd, '.agents');
  if (fs.existsSync(path.join(projectAgents, 'core'))) {
    return projectAgents;
  }
  return path.resolve(cwd);
}

/**
 * Documentos que várias CLIs leem NATIVAMENTE da raiz do projeto: o opencode via
 * `opencode.json`, o Codex e o Copilot via `AGENTS.md`. É por isso que o init os
 * espelha para fora de `.agents/`, e é por isso que o conteúdo importa.
 */
const ROOT_DOCS = ['AGENTS.md', 'SYSTEM.md', 'RULES.md'] as const;

/**
 * Seções do `AGENTS.md` da fonte que valem em QUALQUER projeto.
 *
 * As omitidas (3 Arquitetura Poliglota, 4 Comandos de Desenvolvimento, 5 Estrutura
 * do Framework, 9 Release Flow) descrevem o repositório do framework: `src/`,
 * `crates/`, `packages/`, `cargo test --workspace`, `npm run build`. Num projeto
 * que só consome o pacote, nenhuma delas tem referente.
 */
const CONSUMER_SECTIONS = [1, 2, 6, 7, 8];

/** Versão real do pacote instalado. */
function packageVersion(packageDir: string): string {
  try {
    return (JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * O diretório é o checkout do repositório-fonte do Izanagi?
 *
 * Existe para um caso em que a correção seria pior que o bug: rodar `izanagi init`
 * dentro do próprio checkout. Ali a cópia literal dos documentos de raiz está
 * CERTA (eles descrevem esse projeto), e escrever a versão de consumidor apagaria
 * as seções 3/4/5/9, que são justamente a documentação de desenvolvimento do repo.
 */
export function isFrameworkRepo(root: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as { name?: string };
    return pkg.name === 'izanagi-ai';
  } catch {
    return false;
  }
}

/**
 * O `AGENTS.md` com a forma do projeto CONSUMIDOR.
 *
 * Deriva da fonte por SELEÇÃO de seções, nunca por prosa reescrita: uma segunda
 * cópia do mesmo texto é uma cópia para divergir da primeira, que é exatamente o
 * defeito que esta função conserta. O que se acrescenta é só o que a fonte não
 * pode saber: que este projeto consome o framework em vez de desenvolvê-lo, e
 * quais comandos existem aqui.
 */
export function buildConsumerAgentsDoc(packageDir: string): string {
  const source = fs.readFileSync(path.join(packageDir, 'AGENTS.md'), 'utf-8');

  // Corta em cada `## <n>. ` de primeiro nível. O `## ` com dois hashes é o que
  // separa as seções; os `# ` de uma linha só dentro dos blocos de código (`#
  // Legado npm (raiz)`) não casam e continuam onde estão.
  const parts = stripSourceOnly(source).split(/^(?=## \d+\. )/m);
  const head = (parts[0] ?? '').trimEnd();
  const kept = parts
    .slice(1)
    .filter((s) => CONSUMER_SECTIONS.includes(Number(/^## (\d+)\./.exec(s)?.[1])))
    // A seção da fonte termina com o `---` que a separa da seguinte. Aqui ela é
    // a última: manter o traço deixaria dois seguidos antes do rodapé.
    .map((s) => s.trimEnd().replace(/\n+---$/, ''));

  return [
    head,
    consumerShapeSection(packageVersion(packageDir)),
    ...kept,
    '---',
    `> ${GENERATED_MARKER}: \`izanagi init\`. Seções 3, 4, 5 e 9 da fonte foram omitidas de propósito: descrevem o repositório do framework, não este projeto. A referência canônica completa está em \`.agents/AGENTS.md\`.`,
    '',
  ].join('\n\n');
}

/**
 * Remove os trechos que a fonte declara como válidos SÓ no repositório dela.
 *
 * Existe porque seção universal pode conter frase que não é: a seção 1 afirmava
 * "Este repositório É o framework (não um app que o usa)" e apontava para a
 * seção 3, que a versão de consumidor não tem. Uma afirmação falsa dentro de uma
 * seção correta é pior que a seção inteira ausente, porque contradiz o que o
 * documento diz três parágrafos acima.
 *
 * O mecanismo é declarativo de propósito: quem escreve a fonte marca o trecho, e
 * o builder obedece. Adivinhar por heurística de frase ("contém 'repositório'")
 * removeria prosa correta e deixaria passar a errada.
 */
function stripSourceOnly(markdown: string): string {
  return markdown.replace(/<!--\s*izanagi:source-only\s*-->[\s\S]*?<!--\s*\/izanagi:source-only\s*-->/g, '');
}

/** O que a fonte não pode saber sobre o projeto de destino. */
function consumerShapeSection(version: string): string {
  return `## 0. A forma deste projeto

Este projeto **consome** o Izanagi AI (\`izanagi-ai@${version}\`) como dependência npm: ele não é o repositório do framework. Build, lint e testes, se existirem, são deste projeto: o Izanagi não define nenhum deles.

Comandos do framework que funcionam aqui:

\`\`\`bash
npx izanagi doctor                 # valida a instalação do framework neste projeto
npx izanagi list                   # agentes e skills disponíveis
npx izanagi skill search <termo>   # busca na biblioteca de skills
npx izanagi agent inspect <slug>   # contrato de um agente
npx izanagi export --cli <claude|codex|cursor|copilot|kimi|opencode>
npx izanagi run "<objetivo>"       # executa o runtime sobre um objetivo
\`\`\`

Os assets do framework (agentes, skills, engines) vivem em \`.agents/\`, e é de lá que todo comando os lê. Regra que precisa valer para todas as CLIs muda em \`.agents/\` e depois num \`izanagi export\`, nunca direto num adapter gerado.`;
}

/**
 * Espelha os documentos de raiz, sem afirmar sobre o projeto o que é do framework.
 *
 * Duas regras, e as duas vieram de defeito medido:
 *
 * 1. `AGENTS.md` da raiz é a versão de consumidor. A cópia literal mandava rodar
 *    `cargo test --workspace` num projeto sem Rust, e o caminho era automático
 *    (`postinstall` chama `installToProject` em todo `npm install`).
 * 2. Arquivo já existente SEM o marcador é de quem o escreveu, e não é tocado. O
 *    `copyFileSync` anterior destruía um `AGENTS.md` autoral sem uma linha de aviso.
 */
function writeRootDocs(destinationRoot: string, packageDir: string): { written: string[]; kept: string[] } {
  if (isFrameworkRepo(destinationRoot)) return { written: [], kept: [] };

  const written: string[] = [];
  const kept: string[] = [];

  for (const doc of ROOT_DOCS) {
    const srcPath = path.join(packageDir, doc);
    if (!fs.existsSync(srcPath)) continue;

    const dest = path.join(destinationRoot, doc);
    if (fs.existsSync(dest) && !fs.readFileSync(dest, 'utf-8').includes(GENERATED_MARKER)) {
      kept.push(doc);
      continue;
    }

    const body =
      doc === 'AGENTS.md'
        ? buildConsumerAgentsDoc(packageDir)
        : `${fs.readFileSync(srcPath, 'utf-8').trimEnd()}\n\n---\n\n> ${GENERATED_MARKER}: \`izanagi init\`. Cópia fiel de \`${doc}\` do framework, que descreve o RUNTIME e vale em qualquer projeto.\n`;

    fs.writeFileSync(dest, body, 'utf-8');
    written.push(doc);
  }

  return { written, kept };
}

/**
 * Instala os packs selecionados do Izanagi AI na pasta `.agents` do projeto do usuário.
 */
const ESCAPE_CYAN = '\x1b[36m';
const ESCAPE_RESET = '\x1b[0m';

export function installToProject(targetDir: string, selectedPackIds: string[], cliTarget?: string): void {
  const destinationRoot = path.resolve(targetDir);
  const packageDir = getPackageDir();

  // Garante que `core` esteja sempre presente
  const packIds = Array.from(new Set([CORE_PACK_ID, ...selectedPackIds]));
  const packs = PACKS.filter((p) => packIds.includes(p.id));

  if (!fs.existsSync(destinationRoot)) {
    fs.mkdirSync(destinationRoot, { recursive: true });
  }

  // Espelhar os assets DENTRO do próprio repo-fonte não tem referente: o
  // framework já É os arquivos que seriam copiados, e a cópia nasce condenada a
  // divergir (é de onde vinham as ~700 entradas de `.agents/` sem rastro no git,
  // e o "por que existem duas pastas de agentes?" que ninguém conseguia
  // responder). `writeRootDocs` já tinha essa guarda desde a v3.21.0; o espelho
  // de assets ficou sem, e é o espelho que tem 700 arquivos.
  //
  // O que é tracked em `.agents/` no repo-fonte (os `*.yaml` derivados do
  // ADR-005) continua vivo: esta função nunca os produziu.
  if (isFrameworkRepo(destinationRoot)) {
    console.log(`${ESCAPE_CYAN}[Izanagi AI]${ESCAPE_RESET} Repositório-fonte detectado em ${destinationRoot}: o espelho de assets em .agents/ não é criado (o framework já é esses arquivos).
`);
    return;
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
        copiedItems++;
      }
    }

    console.log(`  \x1b[32m✔\x1b[0m Pack \x1b[1m${pack.label}\x1b[0m (${copied} items) — ${pack.description}`);
  }

  // O espelho de `.agents/` é cópia fiel; o da RAIZ descreve o projeto de
  // destino. Separado do loop acima porque é outra pergunta, e confundir as
  // duas é o que fazia o consumidor receber a autodescrição do framework.
  const rootDocs = writeRootDocs(destinationRoot, packageDir);
  for (const doc of rootDocs.written) {
    console.log(`  \x1b[32m✔\x1b[0m ${doc} na raiz${doc === 'AGENTS.md' ? ' (forma deste projeto; a referência completa fica em .agents/)' : ''}`);
  }
  for (const doc of rootDocs.kept) {
    console.log(`  \x1b[33m•\x1b[0m ${doc} já existe e não foi gerado pelo Izanagi — mantido como está`);
  }

  // Configuração local (.izanagi/izanagi.config.json)
  const izanagiFolder = path.join(destinationRoot, '.izanagi');
  fs.mkdirSync(izanagiFolder, { recursive: true });

  const config = {
    framework: 'Izanagi AI',
    // Estava `'2.1.0'` fixo, com o framework em 3.20.x: o arquivo de
    // configuração de todo projeto afirmava dezoito minors de diferença.
    version: packageVersion(packageDir),
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
