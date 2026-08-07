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
}

/** Subconjunto curado de skills exportado para Claude Code (.claude/skills). */
export const CLAUDE_SKILLS = [
  'brainstorming',
  'deep-research',
  'ui-ux-pro-max',
  'motion-design',
  'animation-web',
  'webgl-3d',
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

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
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

/** Lê os 12 agentes reais de agents/*.json. */
export function loadIzanagiAgents(baseDir: string): IzanagiAgentInfo[] {
  const sourceDir = resolveSourceDir(baseDir);
  const agentsDir = path.join(sourceDir, 'agents');
  if (!fs.existsSync(agentsDir)) return [];

  const agents: IzanagiAgentInfo[] = [];
  for (const file of fs.readdirSync(agentsDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(agentsDir, file), 'utf-8')) as {
        name?: string;
        role?: string;
        identity?: string;
        model?: string;
        skills?: string[];
        chains?: Record<string, string[]>;
        always?: string[];
        never?: string[];
      };
      const slug = file.replace(/\.json$/i, '').replace(/-agent$/i, '');
      agents.push({
        slug,
        file,
        name: raw.name ?? slug,
        role: raw.role ?? '',
        identity: raw.identity ?? '',
        model: raw.model,
        skills: raw.skills ?? [],
        chains: raw.chains ?? {},
        always: raw.always ?? [],
        never: raw.never ?? []
      });
    } catch {
      // arquivo JSON inválido: ignora silenciosamente (doctor cuida da auditoria)
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

function parseSkillMarkdown(content: string): { description: string; body: string } {
  let description = '';
  let body = content;

  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fm) {
    body = fm[2];
    description = parseFrontmatterDescription(fm[1]);
  }

  // Resumo do corpo: títulos de seção (##) + primeira frase de cada parágrafo
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let pending: string[] = [];

  const flush = (): void => {
    if (pending.length === 0) return;
    const para = truncate(pending.join(' '), 240);
    if (para) out.push(para);
    pending = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (t.startsWith('###')) continue;
    if (t.startsWith('##')) {
      flush();
      out.push(t);
      continue;
    }
    if (t.startsWith('#') || t === '') {
      flush();
      continue;
    }
    pending.push(t);
    if (pending.join(' ').length > 320) flush();
  }
  flush();

  let result = out.join('\n').trim();
  if (result.length > 1400) result = result.slice(0, 1400).trimEnd() + '\n\n… (resumo gerado automaticamente)';
  return { description, body: result };
}

/** Escreve o arquivo apenas se não existir; retorna o path relativo criado (ou null). */
function writeIfAbsent(baseDir: string, relPath: string, content: string): string | null {
  const abs = path.join(baseDir, relPath);
  if (fs.existsSync(abs)) return null;
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
  return `---
description: ${a.role || a.name}
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
  const title = s.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `---
name: ${s.name}
description: "${s.description}"
---

# ${title}

${s.body}

> Gerado pelo Izanagi AI — resumo da skill original \`skills/${s.name}/SKILL.md\`.
`;
}

function claudeMainTemplate(baseDir: string, agents: IzanagiAgentInfo[], skills: SkillSummary[]): string {
  const agentList = agents.map((a) => `- \`/${a.slug}\` — ${a.role}`).join('\n');
  const skillList = skills.map((s) => `- \`${s.name}\` — ${truncate(s.description, 120)}`).join('\n');
  const always = agents.flatMap((a) => a.always).filter((x) => x.length > 0);
  const never = agents.flatMap((a) => a.never).filter((x) => x.length > 0);

  return `# Izanagi AI — Claude Code Integration

Este projeto usa o **Izanagi AI Framework** — framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e 12 agentes pré-definidos.

## Fonte da verdade

> **Leia \`AGENTS.md\` antes de qualquer tarefa.** Ele é a referência completa do framework (agentes, comandos, estrutura, release flow). Este arquivo é apenas um resumo operacional.

- \`AGENTS.md\` — referência canônica do framework
- \`SYSTEM.md\` — fundação do sistema (engines, quality gates, memória)
- \`RULES.md\` — regras operacionais

## Agentes (comandos slash)

Ative com \`/\` no Claude Code — os 12 comandos estão em \`.claude/commands/\`:

${agentList}

## Skills curadas

13 skills disponíveis em \`.claude/skills/<nome>/SKILL.md\` (carregadas automaticamente quando relevantes):

${skillList}

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — estética Apple-like/Awwwards (\`bg-zinc-950\`, glassmorphism, bento grids, micro-interações).
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

## Sempre (consolidado dos 12 agentes)

${always.length > 0 ? bullet([...new Set(always)].slice(0, 12)) : '- n/a'}

## Nunca (consolidado dos 12 agentes)

${never.length > 0 ? bullet([...new Set(never)].slice(0, 12)) : '- n/a'}

---
Gerado pelo Izanagi AI em \`${baseDir}\` — \`izanagi export --cli claude\`
`;
}

export function exportToClaude(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);
  const skills = CLAUDE_SKILLS.map((n) => readSkillSummary(baseDir, n)).filter((s): s is SkillSummary => s !== null);

  // CLAUDE.md na raiz (fonte da verdade + regras essenciais inline)
  const main = writeIfAbsent(baseDir, 'CLAUDE.md', claudeMainTemplate(baseDir, agents, skills));
  if (main) created.push(main);

  // 12 comandos slash em .claude/commands/<agent>.md
  for (const agent of agents) {
    const rel = writeIfAbsent(baseDir, `.claude/commands/${agent.slug}.md`, claudeCommandTemplate(agent));
    if (rel) created.push(rel);
  }

  // skills curadas em .claude/skills/<name>/SKILL.md
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

> **Fonte da verdade: \`AGENTS.md\`** (o Codex lê \`AGENTS.md\` nativamente). Este arquivo contém as regras essenciais e o índice dos 12 agentes do framework.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — estética Apple-like/Awwwards (\`bg-zinc-950\`, glassmorphism, bento grids, micro-interações, scrollytelling).
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
- \`agents/*.json\` — definições completas dos 12 agentes
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
- Estética Apple-like / Awwwards-grade: \`bg-zinc-950\`, glassmorphism, bento grids, tipografia precisa, scrollytelling e micro-interações.

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
description: Izanagi AI — índice dos 12 agentes especializados e quando usar cada um
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
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — estética Apple-like/Awwwards (\`bg-zinc-950\`, glassmorphism, bento grids, micro-interações, scrollytelling).
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
/* All                                                                */
/* ------------------------------------------------------------------ */

export function exportAll(baseDir: string): string[] {
  const created: string[] = [];
  created.push(...exportToClaude(baseDir));
  created.push(...exportToCodex(baseDir));
  created.push(...exportToCursor(baseDir));
  created.push(...exportToCopilot(baseDir));
  created.push(...exportToKimi(baseDir));
  return created;
}
