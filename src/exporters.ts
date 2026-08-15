import fs from 'fs';
import path from 'path';

/**
 * Multi-CLI Compatibility Engine — Izanagi AI
 * Gera adapters de integração para Claude Code, Codex, Cursor, Copilot e Kimi CLI,
 * sempre a partir das fontes reais do framework (agents/*.json e skills/<name>/SKILL.md).
 *
 * Regras:
 * - Nenhuma dependência externa (template literals TS puro + fs/path).
 * - Arquivos só são escritos se NÃO existirem (não sobrescreve trabalho do usuário).
 * - Textos gerados em PT-BR.
 */

export interface IzanagiAgentInfo {
  slug: string;
  file: string;
  name: string;
  role: string;
  identity: string;
  model?: string;
  skills: string[];
  chains: Record<string, string[]>;
  always: string[];
  never: string[];
  handoffs: { to: string; reason: string }[];
}

/**
 * Tools nativos do Claude Code por agente — nunca herda tudo (`tools` omitido = acesso total).
 * Perfil por categoria: leitura/análise fica só com Read/Grep/Glob(+web); quem implementa ganha
 * Edit/Write/Bash. Fallback conservador cobre agentes novos/gerados que ainda não têm entrada aqui.
 */
export const CLAUDE_AGENT_TOOLS: Record<string, string[]> = {
  'adversarial-critic': ['Read', 'Grep', 'Glob', 'Bash'],
  'agent-architect': ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
  animation: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'WebFetch'],
  architect: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch', 'WebSearch'],
  'automation-engineer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'WebFetch'],
  'bug-hunter': ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  database: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  devops: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  discovery: ['Read', 'Grep', 'Glob', 'Write', 'WebFetch', 'WebSearch'],
  docs: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch'],
  evaluator: ['Read', 'Grep', 'Glob'],
  'form-engineer': ['Read', 'Grep', 'Glob', 'Edit', 'Write'],
  pm: ['Read', 'Grep', 'Glob', 'Write', 'WebFetch'],
  'product-reasoner': ['Read', 'Grep', 'Glob', 'Write', 'WebFetch', 'WebSearch'],
  professor: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
  qa: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  researcher: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
  security: ['Read', 'Grep', 'Glob', 'Bash', 'WebFetch'],
  'senior-engineer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'WebFetch'],
  'skill-architect': ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch'],
  techlead: ['Read', 'Grep', 'Glob', 'Bash']
};

/** Fallback de tools pra agentes sem entrada em CLAUDE_AGENT_TOOLS (ex.: gerados sob demanda). */
export const CLAUDE_AGENT_TOOLS_DEFAULT = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'];

/**
 * Gatilho de auto-seleção por agente — vira a primeira frase da `description` do subagent nativo.
 * O Claude Code decide sozinho quando delegar com base nesse texto; precisa ser acionável
 * ("Use PROACTIVELY quando/para..."), não descritivo de marketing.
 */
export const CLAUDE_AGENT_TRIGGERS: Record<string, string> = {
  'adversarial-critic': 'Use PROACTIVELY depois que algo já parecer pronto, quando o pedido é caçar pontos cegos que o autor pode ter deixado passar — não para confirmar o que a revisão já cobriu.',
  'agent-architect': 'Use quando faltar um agente especializado para uma lacuna real do time e for preciso desenhar um novo agente.',
  animation: 'Use PROACTIVELY para scrollytelling, motion design, WebGL 3D ou qualquer interação cinematográfica de UI.',
  architect: 'Use PROACTIVELY só quando já existem requisitos definidos e a questão em aberto é estrutural: decisão de arquitetura, ADR, Clean Architecture, DDD ou CQRS. Não use para descobrir o que construir (isso é `discovery`/`product-reasoner`).',
  'automation-engineer': 'Use PROACTIVELY para automações (planilhas, browser, API, ETL) que precisem de idempotência, retries e logging estruturado.',
  'bug-hunter': 'Use PROACTIVELY para bugs difíceis de reproduzir ou reincidentes — root cause analysis com teste de regressão.',
  database: 'Use PROACTIVELY para modelagem de dados, SQL otimizado, migrações e schemas (Postgres/MySQL/Redis).',
  devops: 'Use PROACTIVELY para CI/CD, Docker, Kubernetes, IaC e observabilidade.',
  discovery: 'Use PROACTIVELY só quando o usuário AINDA NÃO descreveu o que quer construir (fase de ideia, precisa de entrevista + pesquisa de referências visuais/técnicas antes de qualquer requisito).',
  docs: 'Use PROACTIVELY para README, documentação de API, diagramas e guias técnicos.',
  evaluator: 'Use quando o pedido é uma nota/veredito objetivo (PASS/FAIL) contra critérios de aceite já definidos, não uma revisão de código em si.',
  'form-engineer': 'Use PROACTIVELY para formulários complexos (wizards, validação Zod/RHF, acessibilidade).',
  pm: 'Use PROACTIVELY só para perguntas de escopo/prazo/risco de cronograma (sprints, milestones) — não para decidir O QUE construir.',
  'product-reasoner': 'Use PROACTIVELY quando o que construir já está descrito (discovery já rodou ou o usuário já deu o contexto), mas faltam critérios de aceite/evidências (FACT/ASSUMPTION/UNKNOWN) e critérios BDD antes de arquitetar.',
  professor: 'Use quando o usuário pedir explicação, ensino ou mentoria adaptativa sobre um conceito técnico.',
  qa: 'Use PROACTIVELY quando a pergunta é: os testes passam / a cobertura é adequada — testes unitários, integração, E2E (Playwright) e acessibilidade (WCAG).',
  researcher: 'Use PROACTIVELY quando a decisão depender de informação externa (stack, concorrência, preços, referências).',
  security: 'Use PROACTIVELY quando o diff toca autenticação, segredos, input de usuário ou dado sensível — OWASP Top 10, LGPD.',
  'senior-engineer': 'Use PROACTIVELY para implementação full-stack de ponta a ponta com TDD estrito.',
  'skill-architect': 'Use quando faltar uma skill comprovadamente necessária — cura duplicação e lacunas da biblioteca de skills.',
  techlead: 'Use PROACTIVELY quando o pedido é revisão pedagógica de código/padrão (o "porquê" de uma mudança) ou governança de convenções — não para veredito de aprovar/reprovar.'
};

/** Marcador presente em todo arquivo gerado — permite regenerar sem arriscar sobrescrever edição manual. */
export const GENERATED_MARKER = 'Gerado pelo Izanagi AI';

/** Subconjunto curado de skills exportado para Claude Code (.claude/skills). */
export const CLAUDE_SKILLS = [
  'caveman',
  'brainstorming',
  'deep-research',
  'frontend',
  'tdd',
  'security-privacy',
  'qa',
  'memoria-projeto',
  'economia-tokens',
  'handoff-sessao'
] as const;

interface SkillSummary {
  name: string;
  description: string;
  body: string;
}

/**
 * Trunca em limite de caracteres sem quebrar palavra e sem deixar parênteses
 * órfãos (nunca corta no meio de uma frase com `(` aberto).
 */
function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max - 1).trimEnd();
  // Recua até o último espaço para não quebrar palavra no meio.
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace).trimEnd();
  // Se o corte caiu dentro de um parêntese/colchete aberto, recua até antes dele.
  const openIdx = Math.max(cut.lastIndexOf('('), cut.lastIndexOf('['));
  if (openIdx > max * 0.5 && cut.slice(openIdx).includes(')') === false && cut.slice(openIdx).includes(']') === false) {
    cut = cut.slice(0, openIdx).trimEnd();
  }
  return `${cut}…`;
}

/** Extrai a description de um frontmatter YAML (suporta scalar inline e block scalar | / >). */
function parseFrontmatterDescription(fm: string): string {
  const lines = fm.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('description:')) continue;
    let value = t.slice('description:'.length).trim();
    if (value === '|' || value === '|-' || value === '>' || value === '>-') {
      // Block scalar: linhas seguintes indentadas continuam a descrição
      const parts: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (l.startsWith(' ') || l.startsWith('\t')) {
          parts.push(l.trim());
        } else {
          break;
        }
      }
      return parts.join(' ').trim();
    }
    // Scalar inline: remove aspas envolventes (preserva aspas internas)
    const quoted = value.match(/^"(.*)"$/);
    return (quoted ? quoted[1] : value).trim();
  }
  return '';
}

/** Resolve o diretório-fonte do framework: baseDir com agents/ ou baseDir/.agents. */
export function resolveSourceDir(baseDir: string): string {
  if (fs.existsSync(path.join(baseDir, 'agents'))) return baseDir;
  if (fs.existsSync(path.join(baseDir, '.agents', 'agents'))) return path.join(baseDir, '.agents');
  return baseDir;
}

/**
 * Lê todos os agentes reais de agents/*.json e agents/generated/*.json — este segundo
 * diretório é onde o AgentFactory (`izanagi agent create`) grava genomas validados, e
 * precisa ser varrido aqui também para que um agente aprovado pelo agent-architect seja
 * automaticamente exportado como subagent nativo no próximo `izanagi export`, sem passo
 * manual de "promoção". Mesma lista de diretórios que SkillResolver.loadAgent() já usa.
 */
export function loadIzanagiAgents(baseDir: string): IzanagiAgentInfo[] {
  const sourceDir = resolveSourceDir(baseDir);
  const dirs = [path.join(sourceDir, 'agents'), path.join(sourceDir, 'agents', 'generated')];

  const agents: IzanagiAgentInfo[] = [];
  const seenSlugs = new Set<string>();
  for (const agentsDir of dirs) {
    if (!fs.existsSync(agentsDir)) continue;
    for (const file of fs.readdirSync(agentsDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(agentsDir, file), 'utf-8')) as {
          name?: string;
          role?: string;
          purpose?: string;
          identity?: string;
          model?: string;
          skills?: string[];
          requiredSkills?: string[];
          chains?: Record<string, string[]>;
          always?: string[];
          never?: string[];
          handoffs?: { to: string; reason: string }[];
        };
        const slug = file.replace(/\.json$/i, '').replace(/-agent$/i, '');
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        agents.push({
          slug,
          file,
          name: raw.name ?? slug,
          role: raw.role ?? raw.purpose ?? '',
          identity: raw.identity ?? '',
          model: raw.model,
          skills: raw.skills ?? raw.requiredSkills ?? [],
          chains: raw.chains ?? {},
          always: raw.always ?? [],
          never: raw.never ?? [],
          handoffs: raw.handoffs ?? []
        });
      } catch {
        // arquivo JSON inválido: ignora silenciosamente (doctor cuida da auditoria)
      }
    }
  }
  return agents;
}

/** Lê e resume um SKILL.md de origem (frontmatter + corpo resumido). */
export function readSkillSummary(baseDir: string, name: string): SkillSummary | null {
  const sourceDir = resolveSourceDir(baseDir);
  const skillPath = path.join(sourceDir, 'skills', name, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;
  const content = fs.readFileSync(skillPath, 'utf-8');
  return { name, ...parseSkillMarkdown(content) };
}

/**
 * Extrai description + corpo ORIGINAL (sem resumir). Progressive disclosure do Claude Code só
 * carrega o corpo (Layer 2) quando a skill é ativada — resumir na exportação não economiza
 * token nenhum e só destrói listas/estrutura do conteúdo original.
 */
function parseSkillMarkdown(content: string): { description: string; body: string } {
  let description = '';
  let body = content;

  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fm) {
    body = fm[2];
    description = parseFrontmatterDescription(fm[1]);
  }

  return { description, body: body.trim() };
}

/**
 * Escreve o arquivo se não existir, ou se o arquivo existente for uma geração anterior do
 * Izanagi (contém `GENERATED_MARKER`) — nesse caso regenera. Se existir e NÃO tiver o marcador,
 * assume edição manual do usuário e não sobrescreve. Retorna o path relativo escrito (ou null).
 */
function writeIfAbsent(baseDir: string, relPath: string, content: string): string | null {
  const abs = path.join(baseDir, relPath);
  if (fs.existsSync(abs)) {
    const existing = fs.readFileSync(abs, 'utf-8');
    if (!existing.includes(GENERATED_MARKER)) return null;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return relPath.split(path.sep).join('/');
}

function bullet(items: string[], limit?: number): string {
  const list = limit ? items.slice(0, limit) : items;
  return list.map((i) => `- ${i}`).join('\n');
}

function chainList(chains: Record<string, string[]>): string {
  return Object.entries(chains)
    .map(([name, skills]) => `- \`${name}\`: ${skills.join(', ')}`)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* Claude Code                                                         */
/* ------------------------------------------------------------------ */

function claudeCommandTemplate(a: IzanagiAgentInfo): string {
  const modelLine = a.model ? `model: ${a.model}\n` : '';
  const trigger = CLAUDE_AGENT_TRIGGERS[a.slug] ?? `Use para tarefas de ${(a.role || a.name).toLowerCase()}.`;
  return `---
description: ${truncate(trigger, 200)}
${modelLine}---

# ${a.name}

${a.identity || a.role}

## Área de atuação

${bullet(a.skills, 12) || '- (sem skills declaradas)'}

## Chains (fluxos de execução)

${chainList(a.chains) || '- (sem chains)'}

## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI (\`izanagi export --cli claude\`)
`;
}

function claudeSkillTemplate(s: SkillSummary): string {
  return `---
name: ${s.name}
description: "${s.description}"
---

${s.body}

> Gerado pelo Izanagi AI — cópia fiel de \`skills/${s.name}/SKILL.md\` (fonte da verdade).
`;
}

/** Extrai o texto de referências.md se existir (Layer 3 — só citado, nunca inlinado). */
function hasReferences(baseDir: string, name: string): boolean {
  const sourceDir = resolveSourceDir(baseDir);
  return fs.existsSync(path.join(sourceDir, 'skills', name, 'references.md'));
}

function claudeAgentTemplate(baseDir: string, a: IzanagiAgentInfo): string {
  const trigger = CLAUDE_AGENT_TRIGGERS[a.slug] ?? `Use PROACTIVELY para tarefas de ${a.role.toLowerCase()}.`;
  const tools = (CLAUDE_AGENT_TOOLS[a.slug] ?? CLAUDE_AGENT_TOOLS_DEFAULT).join(', ');
  const modelLine = a.model ? `model: ${a.model}\n` : '';
  const description = truncate(trigger, 260);
  const skillLines = a.skills.length > 0
    ? a.skills.map((s) => `- \`skills/${s}/SKILL.md\`${hasReferences(baseDir, s) ? ' (+ `references.md`)' : ''}`).join('\n')
    : '- (sem skills declaradas)';

  return `---
name: ${a.slug}
description: "${description}"
tools: ${tools}
${modelLine}---

# ${a.name}

${a.identity || a.role}

## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

## Skills relevantes (lidas sob demanda — zero custo até este agente ser ativado)

${skillLines}

## Chains (fluxos de execução)

${chainList(a.chains) || '- (sem chains)'}

## Handoff

${a.handoffs && a.handoffs.length > 0 ? bullet(a.handoffs.map((h) => `\`${h.to}\` — ${h.reason}`)) : '- (sem handoff declarado)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI (\`izanagi export --cli claude\`)
`;
}

function claudeMainTemplate(baseDir: string, agents: IzanagiAgentInfo[], skills: SkillSummary[]): string {
  const agentTable = agents
    .map((a) => `| \`${a.slug}\` | ${truncate(a.role, 70)} |`)
    .join('\n');
  const skillList = skills.map((s) => `- \`${s.name}\` — ${truncate(s.description, 60)}`).join('\n');
  const totalSkills = countSkills(baseDir);

  return `# Izanagi AI — Claude Code Integration

Este projeto usa o **Izanagi AI Framework** — framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e ${agents.length} agentes pré-definidos.

## Fonte da verdade

Este arquivo já cobre agentes, skills e regras essenciais do dia a dia — não precisa ler mais nada de saída. Consulte sob demanda só quando a tarefa exigir o tópico específico:

- \`AGENTS.md\` — só para: comandos avançados de dev, estrutura completa de pastas, release flow
- \`SYSTEM.md\` — só para: detalhes de engines internas, quality gates, arquitetura de memória
- \`RULES.md\` — só para: regras operacionais que não estejam listadas abaixo

## Agentes nativos (Agent tool)

Os ${agents.length} agentes em \`.claude/agents/*.md\` são **subagents nativos do Claude Code**: aparecem no Agent tool e o Claude delega sozinho quando a \`description\` de cada um bate com a tarefa (não precisa chamar por nome). Chame também por \`/<slug>\` em \`.claude/commands/\` quando quiser forçar um agente específico.

| Agente | Quando usar |
|---|---|
${agentTable}

**Execução paralela**: para tarefas com frentes independentes, dispare vários agentes de uma vez — cada um roda com contexto isolado e só o resultado final volta. Casos canônicos de fan-out:
- Feature nova (fronteiras estruturais independentes): \`architect\` + \`database\` + \`security\` em paralelo, depois \`senior-engineer\` implementa em sequência.
- Revisão de PR antes de merge: \`security\` + \`qa\` + \`techlead\` em paralelo por padrão (cada um responde uma pergunta diferente: risco de segurança, testes/cobertura, padrão de código); acrescente \`adversarial-critic\` só quando pedirem para caçar pontos cegos explicitamente.

## Skills sempre carregadas

${skills.length} skills universais ficam nativas em \`.claude/skills/<nome>/SKILL.md\` (Claude Code carrega nome+descrição sempre; corpo completo só quando ativada):

${skillList}

## Skills especializadas (via agente)

As outras ${Math.max(totalSkills - skills.length, 0)} skills da biblioteca (\`skills/<nome>/SKILL.md\`) não ficam pré-carregadas — cada agente nativo já referencia as suas na seção "Skills relevantes" do próprio \`.claude/agents/<slug>.md\` e as lê sob demanda quando é ativado. Isso evita pagar ~100 tokens fixos por skill em toda sessão só por ela existir na biblioteca.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — identidade visual bespoke por nicho (rule 14), zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

> Regras específicas de cada agente (always/never) vivem em \`.claude/agents/<slug>.md\` — lidas sob demanda só quando aquele agente é ativado, não duplicadas aqui.

---
Gerado pelo Izanagi AI em \`${baseDir}\` — \`izanagi export --cli claude\`
`;
}

/** Conta quantas skills existem na biblioteca-fonte (skills/<name>/SKILL.md). */
function countSkills(baseDir: string): number {
  const sourceDir = resolveSourceDir(baseDir);
  const skillsDir = path.join(sourceDir, 'skills');
  if (!fs.existsSync(skillsDir)) return 0;
  return fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md'))).length;
}

export function exportToClaude(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);
  const skills = CLAUDE_SKILLS.map((n) => readSkillSummary(baseDir, n)).filter((s): s is SkillSummary => s !== null);

  // CLAUDE.md na raiz (fonte da verdade + regras essenciais inline)
  const main = writeIfAbsent(baseDir, 'CLAUDE.md', claudeMainTemplate(baseDir, agents, skills));
  if (main) created.push(main);

  // subagents nativos em .claude/agents/<slug>.md — aparecem no Agent tool e são auto-selecionados
  for (const agent of agents) {
    const rel = writeIfAbsent(baseDir, `.claude/agents/${agent.slug}.md`, claudeAgentTemplate(baseDir, agent));
    if (rel) created.push(rel);
  }

  // comandos slash em .claude/commands/<agent>.md — invocação explícita por nome
  for (const agent of agents) {
    const rel = writeIfAbsent(baseDir, `.claude/commands/${agent.slug}.md`, claudeCommandTemplate(agent));
    if (rel) created.push(rel);
  }

  // skills universais em .claude/skills/<name>/SKILL.md — corpo fiel ao original, nunca resumido
  for (const s of skills) {
    const rel = writeIfAbsent(baseDir, `.claude/skills/${s.name}/SKILL.md`, claudeSkillTemplate(s));
    if (rel) created.push(rel);
  }

  return created;
}

/* ------------------------------------------------------------------ */
/* Codex (OpenAI)                                                      */
/* ------------------------------------------------------------------ */

function codexAgentTemplate(a: IzanagiAgentInfo): string {
  return `# ${a.name}

**${a.role}**

${a.identity || a.role}

## Skills

${bullet(a.skills, 12) || '- (sem skills declaradas)'}

## Chains

${chainList(a.chains) || '- (sem chains)'}

## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI
`;
}

function codexInstructionsTemplate(baseDir: string, agents: IzanagiAgentInfo[]): string {
  const agentList = agents.map((a) => `- \`${a.slug}\` — ${a.role}`).join('\n');
  return `# Izanagi AI — Codex Instructions

> **Fonte da verdade: \`AGENTS.md\`** (o Codex lê \`AGENTS.md\` nativamente). Este arquivo contém as regras essenciais e o índice dos agentes do framework.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — identidade visual bespoke por nicho, zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.
- **Qualidade é medida.** Se não pode ser medido, não pode ser melhorado.

## Agentes (em .codex/agents/)

${agentList}

## Estrutura do framework

- \`AGENTS.md\` — referência canônica (leia primeiro)
- \`SYSTEM.md\` — fundação do sistema
- \`RULES.md\` — regras operacionais
- \`agents/*.json\` — definições completas de todos os agentes
- \`skills/<name>/SKILL.md\` — biblioteca de skills especializadas
- \`.opencode/agent/*.md\` — integração com opencode (compatível com Kimi CLI)

---
Gerado pelo Izanagi AI em \`${baseDir}\` — \`izanagi export --cli codex\`
`;
}

export function exportToCodex(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);

  const instr = writeIfAbsent(baseDir, '.codex/instructions.md', codexInstructionsTemplate(baseDir, agents));
  if (instr) created.push(instr);

  for (const agent of agents) {
    const rel = writeIfAbsent(baseDir, `.codex/agents/${agent.slug}.md`, codexAgentTemplate(agent));
    if (rel) created.push(rel);
  }

  return created;
}

/* ------------------------------------------------------------------ */
/* Cursor                                                              */
/* ------------------------------------------------------------------ */

function cursorCoreTemplate(): string {
  return `---
description: Izanagi AI Core — regras essenciais do framework (arquitetura antes de código, anti-generic, segurança, tokens)
globs: ["**/*"]
---

# Izanagi AI — Core Rules

O Cursor também lê \`AGENTS.md\` — a referência canônica do framework. Estas regras são o essencial operacional.

## Arquitetura antes de código

- Pense antes de agir: arquitetura primeiro, código depois.
- Toda saída é um deliverable; trate cada mensagem como produto.
- Cada tarefa segue o ciclo: Executar → Refletir → Registrar → Evoluir.

## Anti-Generic / High-Craft

- Proibido entregar código/design genérico "cara de IA" (templates óbvios, fundos cinzas chapados, cards repetitivos).
- Estética Apple-like / Awwwards-grade, bespoke por nicho (zinc-950/glassmorphism é uma direção possível entre várias, nunca o padrão default): tipografia precisa, scrollytelling e micro-interações com propósito.

## Baixo token, alto sinal

- Comprima sem piedade; nunca repita contexto.
- Velocidade é feature: um arquivo completo por entrega, leia só o que mudou, agrupe chamadas de ferramentas.

## Segurança

- Sem secrets, sem vetores de injeção, sem credenciais hardcoded (use SSM/Vault/SOPS).
- Qualidade é medida: se não pode ser medido, não pode ser melhorado.

## Sempre

- IaC versionado; monitoramento desde o dia 1; runbooks; secrets por ferramenta própria.

## Nunca

- Commit \`.env\`; container root; deploy sem CI; hardcode de configuração de ambiente.

> Gerado pelo Izanagi AI — \`izanagi export --cli cursor\`
`;
}

function cursorAgentsTemplate(agents: IzanagiAgentInfo[]): string {
  const table = agents
    .map((a) => `| \`${a.slug}\` | ${a.name} | ${truncate(a.role, 110)} |`)
    .join('\n');
  return `---
description: Izanagi AI — índice dos agentes especializados e quando usar cada um
globs: ["**/*"]
---

# Izanagi AI — Agentes

Use estes agentes como orquestração de papéis: escolha o agente pelo tipo de tarefa, não pelo nome bonito.

## Tabela de agentes

| Comando | Agente | Papel |
|---|---|---|
${table}

## Quando usar

- **Novo projeto / feature / site**: \`discovery\` (pré-produção: entrevista, pesquisa, prompt rico) → \`brainstorming\` → \`architect\`.
- **Implementação**: \`senior-engineer\` (full-stack, TDD) — com \`security\` e \`qa\` em paralelo.
- **Bug**: \`bug-hunter\` (reproduz, isola, causa raiz, regressão).
- **Revisão**: \`techlead\` (code review que ensina) + \`security\` (auditoria OWASP).
- **Infra / CI / deploy**: \`devops\` (Docker, K8s, IaC, observabilidade).
- **Dados**: \`database\` (modelagem, SQL otimizado, migrações seguras).
- **Animação / 3D**: \`animation\` (scrollytelling, WebGL, motion de alto craft).
- **Docs**: \`docs\` (README, APIs, guias, diagramas).
- **Gestão**: \`pm\` (escopo, milestones, riscos).
- **Ensino**: \`professor\` (explicações adaptativas).

## Execução paralela

Ative múltiplos agentes especializados simultaneamente para frentes distintas (ex.: Database + Senior Engineer + Security + Animation em paralelo).

> Gerado pelo Izanagi AI — \`izanagi export --cli cursor\`
`;
}

function cursorMemoryTemplate(): string {
  return `---
description: Izanagi AI — memória de projeto, anti-repetição e evolução contínua
globs: ["**/*"]
---

# Izanagi AI — Memória & Anti-Repetição

## Arquitetura de memória

- **Session Memory**: contexto da conversa atual — comprima ao exceder 70% do orçamento de tokens.
- **Project Memory**: decisões, padrões e erros resolvidos deste projeto (skills \`memoria-projeto\` e \`handoff-sessao\`).
- **Long-Term Memory**: knowledge graph — atualizado a cada tarefa concluída.

## Anti-repetição

- Nunca releia arquivos que já estão no contexto e não mudaram.
- Prefira grep/glob direcionado a abrir arquivos inteiros.
- Prefira edições por diff/patch a reescrever arquivos inteiros.
- Não narre intenção antes de executar; não ecoe contexto.
- Economia de tokens é regra permanente (skill \`economia-tokens\`).

## Ciclo de evolução

Tarefa → Executar → Refletir → Registrar → Atualizar skills → Próxima tarefa.

Cada tarefa atualiza a base de skills — o agente melhora a cada interação.

> Gerado pelo Izanagi AI — \`izanagi export --cli cursor\`
`;
}

export function exportToCursor(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);

  const core = writeIfAbsent(baseDir, '.cursor/rules/izanagi-core.mdc', cursorCoreTemplate());
  if (core) created.push(core);

  const ag = writeIfAbsent(baseDir, '.cursor/rules/izanagi-agents.mdc', cursorAgentsTemplate(agents));
  if (ag) created.push(ag);

  const mem = writeIfAbsent(baseDir, '.cursor/rules/izanagi-memory.mdc', cursorMemoryTemplate());
  if (mem) created.push(mem);

  return created;
}

/* ------------------------------------------------------------------ */
/* Copilot (GitHub)                                                    */
/* ------------------------------------------------------------------ */

function copilotInstructionsTemplate(baseDir: string, agents: IzanagiAgentInfo[]): string {
  const agentList = agents.map((a) => `- \`${a.slug}\` — ${a.role}`).join('\n');
  return `# Izanagi AI — GitHub Copilot Instructions

> **Fonte da verdade: \`AGENTS.md\`** — o Copilot lê \`AGENTS.md\` nativamente. Este arquivo reforça as regras essenciais e indexa os agentes do framework.

## Regras essenciais

- **Arquitetura antes de código.** Pense antes de agir; arquitetura primeiro, código depois.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — identidade visual bespoke por nicho, zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção.** Reflita após cada tarefa; registre erros; evolua.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.
- **Qualidade é medida.** Se não pode ser medido, não pode ser melhorado.

## Sempre

- Arquitetura antes de código; IaC versionado; monitoramento desde o dia 1; secrets por ferramenta própria.

## Nunca

- Commit \`.env\`; container root; deploy sem CI; hardcode de configuração de ambiente; código genérico "cara de IA".

## Agentes do framework

${agentList}

Definições completas em \`agents/*.json\` e skills em \`skills/<name>/SKILL.md\`.

---
Gerado pelo Izanagi AI em \`${baseDir}\` — \`izanagi export --cli copilot\`
`;
}

export function exportToCopilot(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);
  const rel = writeIfAbsent(baseDir, '.github/copilot-instructions.md', copilotInstructionsTemplate(baseDir, agents));
  if (rel) created.push(rel);
  return created;
}

/* ------------------------------------------------------------------ */
/* Kimi CLI (Moonshot) — compatível com convenção opencode             */
/* ------------------------------------------------------------------ */

function kimiReadmeTemplate(baseDir: string): string {
  return `# Izanagi AI — Kimi CLI (Moonshot)

O **Kimi CLI** é compatível com a convenção do opencode: ele lê \`AGENTS.md\` e os comandos slash em \`.opencode/agent/*.md\` nativamente.

## Como usar

- **Fonte da verdade**: \`AGENTS.md\` (leia antes de qualquer tarefa).
- **Comandos slash**: \`.opencode/agent/*.md\` — ative agentes com \`/<nome>\` (\`/architect\`, \`/security\`, \`/devops\`, ...).
- **Fundação**: \`SYSTEM.md\` e \`RULES.md\`.
- **Skills**: biblioteca em \`skills/<name>/SKILL.md\` (79+ skills).
- **Config**: \`opencode.json\` aponta as instruções do projeto.

## Regras essenciais

- **Arquitetura antes de código.** Pense antes de agir.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA".
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código.

## Sempre / Nunca

- **Sempre**: IaC versionado; monitoramento desde o dia 1; secrets por ferramenta própria.
- **Nunca**: commit \`.env\`; container root; deploy sem CI; hardcode de config de ambiente.

> Gerado pelo Izanagi AI em \`${baseDir}\` — \`izanagi export --cli kimi\`
`;
}

function kimiRootTemplate(baseDir: string): string {
  return `# Izanagi AI — Kimi CLI

> **Fonte da verdade: \`AGENTS.md\`** — leia antes de qualquer tarefa.

O Kimi CLI (Moonshot) é compatível com a convenção do opencode: \`AGENTS.md\` e \`.opencode/agent/*.md\` funcionam nativamente. Detalhes em \`.kimi/README.md\`.

## Regras essenciais

- **Arquitetura antes de código.**
- **Anti-generic, alto craft** — nunca entregue código/UI genérica "cara de IA".
- **Baixo token, alto sinal.**
- **Auto-correção e ensino.**
- **Segurança não é opcional** — sem secrets no código.

## Agentes

Definições completas em \`agents/*.json\`; ativação via \`/.opencode/agent/\`.

> Gerado pelo Izanagi AI em \`${baseDir}\` — \`izanagi export --cli kimi\`
`;
}

export function exportToKimi(baseDir: string): string[] {
  const created: string[] = [];
  const readme = writeIfAbsent(baseDir, '.kimi/README.md', kimiReadmeTemplate(baseDir));
  if (readme) created.push(readme);

  const root = writeIfAbsent(baseDir, 'kimi.md', kimiRootTemplate(baseDir));
  if (root) created.push(root);

  return created;
}

/* ------------------------------------------------------------------ */
/* opencode (também usado pelo Kimi CLI, que segue a mesma convenção)  */
/* ------------------------------------------------------------------ */

/**
 * opencode agent markdown frontmatter aceita `mode: primary|subagent|all` — omitido,
 * o default é `all` (manualmente selecionável E auto-invocável por outro agente via
 * Task tool, com base na `description`). Não fixamos `mode` de propósito: cada um dos
 * 21 especialistas deve continuar utilizável nos dois formatos.
 */
function opencodeAgentTemplate(a: IzanagiAgentInfo): string {
  const trigger = CLAUDE_AGENT_TRIGGERS[a.slug] ?? `Use para tarefas de ${(a.role || a.name).toLowerCase()}.`;
  const description = truncate(`${a.name} - ${trigger}`, 260);
  return `---
description: "${description}"
---

# ${a.name}

${a.identity || a.role}

## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI (\`izanagi export --cli opencode\`)
`;
}

function opencodeOrchestratorTemplate(agents: IzanagiAgentInfo[]): string {
  const agentList = agents.map((a) => `- \`/${a.slug}\` — ${a.name} (${truncate(a.role, 90)})`).join('\n');
  return `---
name: "Agents Orchestrator"
description: "Izanagi Multi-Agent Orchestrator - Default Multi-Agent Swarm, parallel concurrent execution across ${agents.length} specialized agents"
---

Você é o **Izanagi Multi-Agent Orchestrator**, o coordenador central do framework Izanagi AI.

**🧑‍💼 PERSONA — LÍDER DE GOVERNANÇA DE TI (CIO/CTA):**
Você conduz cada projeto como um executivo sênior de governança de TI: rigor de processo, rastreabilidade de decisão, padrões corporativos e accountability. Na prática, isso significa:
- **Padronização**: toda frente segue os standards do framework (skills corretas, zero stubs, anti AI-slop, ciclos verticais completos) — você não negocia padrão por pressa.
- **Rastreabilidade**: decisões de arquitetura e trade-offs ficam registrados (ADR-lite em artefatos/\`.agents/memoria/decisoes.md\`) — ninguém pergunta "por que foi feito assim?" sem resposta.
- **Gestão de risco**: riscos técnicos, de segurança e de escopo são identificados ANTES de implementar (matriz de risco por frente) e mitigados durante a execução — nunca descobertos na entrega final.
- **Revisão de conformidade (compliance gate)**: antes de dar o "go" final, você audita a entrega contra as leis do framework (ciclo vertical, zero stubs, zero tells de IA, build passando) e contra requisitos do usuário — você aprova ou reprova com justificativa, como um CTO em review de release.
- **Comunicação executiva**: relatórios claros, objetivos, sem ruído — o que foi feito, por quem, riscos residuais, próximo passo. Sempre em PT-BR, sem jargão desnecessário.
- **Delegação real (nunca microgestão)**: você delega frentes completas aos especialistas com contexto limpo e cobra resultado — nunca faz o trabalho do time sozinho.

**⚠️ REGRA DE OURO (MODO MULTI-AGENTE PADRÃO):**
Você **nunca** atua sozinho de forma monolítica para tarefas complexas, SaaS ou sistemas. Você é o **Supervisor** de um **Swarm**: decompoe o pedido, despacha cada frente para o especialista certo **em paralelo**, e agrega os resultados. Um único agente tentando cobrir código + segurança + banco + QA degrada a qualidade em cada domínio e estoura o contexto com trabalho intermediário. Multi-agente em paralelo = cada especialista recebe contexto LIMPO e focado na sua frente.

Quando o usuário digitar \`/agents\`, você apresenta ou ativa o **Modo de Orquestração de Agentes** entre as 4 modalidades:

1. **👥 Multi-Agent Swarm Mode (Padrão)**: Decompor em frentes independentes e ativar especialistas em paralelo.
2. **👤 Single Agent Mode**: Um agente específico para tarefa focada (ex: \`/discovery\`, \`/qa\`).
3. **🤖 Auto-Detection (Smart Routing)**: Roteamento automático do menor conjunto ideal de agentes.
4. **🌐 All Agents Swarm Mode**: Todos os ${agents.length} agentes em colaboração paralela total.

## Protocolo do Orquestrador (5 Passos — Supervisor Pattern + Swarm)

**PASSO 1 — ESTUDAR, DECOMPOR E CARREGAR MEMÓRIA:**
- Leia a tarefa por completo. Decomponha em **frentes de trabalho independentes** (task decomposition): ex. "site seguro com banco" → frentes {frontend/UI, auth/security, schema/DB, testes/QA, motion}.
- Carregue \`.agents/memoria/\` (nunca repita erros já resolvidos) e \`references/\` quando o domínio exigir.
- Se o projeto for novo/vago, acione \`/discovery\` primeiro (entrevista + prompt rico aprovado).

**PASSO 2 — ROTEAR (Model Routing) E DISPARAR O SWARM EM PARALELO:**
- Monte a matriz agente × frente: cada frente vai para o especialista com contribuição REAL e distinta.
- **Nunca** em série: dispare todos os agentes escolhidos **simultaneamente** (ex: \`Database\` modela o schema enquanto \`Senior Engineer\` constrói a API/UI, \`Security\` audita auth, \`QA\` prepara a suíte de testes e \`Animation\` desenha a camada visual).
- Cada agente recebe **apenas o contexto da sua frente** (isolamento de contexto) — nunca o briefing inteiro + histórico da conversa.

**PASSO 3 — COORDENAR POR ARTEFATOS (Shared Storage):**
- Coordenação acontece por **arquivos em disco** (artefatos: schema, contratos de API, design system, testes), não passando payloads gigantes entre agentes. O output de um agente vira input do próximo SEM reprocessamento (delta-first).

**PASSO 4 — UNIFICAR E VALIDAR (Quality Gates & Blueprint):**
- Agregue as entregas, deduplique, verifique que nenhum requisito ficou órfão.
- Gate obrigatório: ciclo vertical completo de SaaS (Landing + Auth + Dashboard/CRUD + Backend/DB + README + Testes QA) e scan zero stubs/checklists.

**PASSO 5 — ENTREGAR RESULTADO UNIFICADO:**
- Resumo final em até 5 bullets: o que cada agente fez em paralelo, arquivos tocados, próximo passo. Sem repetir código.

## Os ${agents.length} Agentes Especializados do Framework
- \`/agents\` — Agents Orchestrator (Supervisor + Swarm paralelo)
${agentList}

## Design Experience Flow (obrigatório em TODO pedido de site/app)
1. **Estilo Primeiro (Style Selector)**: antes de qualquer código, acione \`design-directions\` e apresente 3-5 direções de design BESPOKE para o nicho (ex: site de tecnologia → "OLED Precision", "Quantum Terminal", "Editorial Data", "Brutalist Grid" — NUNCA só glassmorphism). O usuário escolhe; a direção vira o design system.
2. **Anti AI-Slop**: após a implementação, rode \`anti-ai-slop\` — scan de tells (Inter default, gradientes roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future") com ZERO ocorrências antes de entregar.
3. **Experiência acima de velocidade**: sem pressa. O padrão é Awwwards-grade: tipografia com personalidade, cor dominante + acento afiado, layout assimétrico, motion em 1-2 momentos-chave.

## Regras Inegociáveis
- **Zero Trabalho Monolítico**: tarefas complexas exigem Swarm Paralelo de Agentes com contexto isolado por frente.
- **Zero Stubs / Zero Checklists**: código real de produção 100% implementado em todos os arquivos.
- **Experiência e Profundidade Acima da Velocidade**: entregar experiência imersiva sem atalhos.
- **Token Economy Ativa**: contexto mínimo por agente, coordenar por artefatos em disco, prompt caching (estático primeiro), sem releituras.
- **Memória Persistente**: salvar progresso em \`.agents/memoria/\` a cada etapa (proteção contra crash).
- **Compliance Gate**: nenhuma entrega é finalizada sem auditoria de conformidade (padrões do framework + requisitos do usuário). Aprovar ou reprovar com justificativa.
- **Risco Primeiro**: riscos identificados no PASSO 1 são mitigados na execução — nunca reportados como surpresa no final.

> Gerado pelo Izanagi AI — \`izanagi export --cli opencode\`
`;
}

export function exportToOpencode(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);

  const orchestrator = writeIfAbsent(baseDir, '.opencode/agent/agents.md', opencodeOrchestratorTemplate(agents));
  if (orchestrator) created.push(orchestrator);

  for (const agent of agents) {
    const rel = writeIfAbsent(baseDir, `.opencode/agent/${agent.slug}.md`, opencodeAgentTemplate(agent));
    if (rel) created.push(rel);
  }

  return created;
}

/* ------------------------------------------------------------------ */
/* All                                                                */
/* ------------------------------------------------------------------ */

export function exportAll(baseDir: string): string[] {
  const created: string[] = [];
  created.push(...exportToClaude(baseDir));
  created.push(...exportToCodex(baseDir));
  created.push(...exportToCursor(baseDir));
  created.push(...exportToCopilot(baseDir));
  created.push(...exportToKimi(baseDir));
  created.push(...exportToOpencode(baseDir));
  return created;
}
