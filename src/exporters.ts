import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

/**
 * Multi-CLI Compatibility Engine: Izanagi AI
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
 * Tools nativos do Claude Code por agente: nunca herda tudo (`tools` omitido = acesso total).
 * Perfil por categoria: leitura/análise fica só com Read/Grep/Glob(+web); quem implementa ganha
 * Edit/Write/Bash. Fallback conservador cobre agentes novos/gerados que ainda não têm entrada aqui.
 */
export const CLAUDE_AGENT_TOOLS: Record<string, string[]> = {
  orchestrator: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Agent'],
  'adversarial-critic': ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  'agent-architect': ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
  animation: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'WebFetch'],
  architect: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash', 'WebFetch', 'WebSearch'],
  'automation-engineer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'WebFetch'],
  'bug-hunter': ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  database: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  devops: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  discovery: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch', 'WebSearch'],
  docs: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch'],
  evaluator: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  'form-engineer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  pm: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch'],
  'product-reasoner': ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch', 'WebSearch'],
  professor: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'WebFetch', 'WebSearch'],
  qa: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  researcher: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
  security: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'WebFetch'],
  'ai-engineer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'WebFetch'],
  'senior-engineer': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'WebFetch'],
  'skill-architect': ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebFetch'],
  techlead: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write']
};

/** Fallback de tools pra agentes sem entrada em CLAUDE_AGENT_TOOLS (ex.: gerados sob demanda). */
export const CLAUDE_AGENT_TOOLS_DEFAULT = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'];

/**
 * Gatilho de auto-seleção por agente: vira a primeira frase da `description` do subagent nativo.
 * O Claude Code decide sozinho quando delegar com base nesse texto; precisa ser acionável
 * ("Use PROACTIVELY quando/para..."), não descritivo de marketing.
 */
export const CLAUDE_AGENT_TRIGGERS: Record<string, string> = {
  orchestrator: 'Use PROACTIVELY como orquestrador central para planejar, delegar para especialistas em paralelo e executar implementação e escrita direta no repositório.',
  'adversarial-critic': 'Use PROACTIVELY depois que algo já parecer pronto, quando o pedido é caçar pontos cegos que o autor pode ter deixado passar: não para confirmar o que a revisão já cobriu.',
  'agent-architect': 'Use quando faltar um agente especializado para uma lacuna real do time e for preciso desenhar um novo agente.',
  'ai-engineer': 'Use PROACTIVELY para features que chamam, orquestram ou avaliam um LLM: RAG, embeddings/vector DB, agentes com tool-calling/MCP, prompt engineering, guardrails de saída. Não use para UI ou backend genérico sem IA (isso é `senior-engineer`).',
  animation: 'Use PROACTIVELY para scrollytelling, motion design, WebGL 3D ou qualquer interação cinematográfica de UI.',
  architect: 'Use PROACTIVELY só quando já existem requisitos definidos e a questão em aberto é estrutural: decisão de arquitetura, ADR, Clean Architecture, DDD ou CQRS. Não use para descobrir o que construir (isso é `discovery`/`product-reasoner`).',
  'automation-engineer': 'Use PROACTIVELY para automações (planilhas, browser, API, ETL) que precisem de idempotência, retries e logging estruturado.',
  'bug-hunter': 'Use PROACTIVELY para bugs difíceis de reproduzir ou reincidentes: root cause analysis com teste de regressão.',
  database: 'Use PROACTIVELY para modelagem de dados, SQL otimizado, migrações e schemas (Postgres/MySQL/Redis).',
  devops: 'Use PROACTIVELY para CI/CD, Docker, Kubernetes, IaC e observabilidade.',
  discovery: 'Use PROACTIVELY só quando o usuário AINDA NÃO descreveu o que quer construir (fase de ideia, precisa de entrevista + pesquisa de referências visuais/técnicas antes de qualquer requisito).',
  docs: 'Use PROACTIVELY para README, documentação de API, diagramas e guias técnicos.',
  evaluator: 'Use quando o pedido é uma nota/veredito objetivo (PASS/FAIL) contra critérios de aceite já definidos, não uma revisão de código em si.',
  'form-engineer': 'Use PROACTIVELY para formulários complexos (wizards, validação Zod/RHF, acessibilidade).',
  pm: 'Use PROACTIVELY só para perguntas de escopo/prazo/risco de cronograma (sprints, milestones): não para decidir O QUE construir.',
  'product-reasoner': 'Use PROACTIVELY quando o que construir já está descrito (discovery já rodou ou o usuário já deu o contexto), mas faltam critérios de aceite/evidências (FACT/ASSUMPTION/UNKNOWN) e critérios BDD antes de arquitetar.',
  professor: 'Use quando o usuário pedir explicação, ensino ou mentoria adaptativa sobre um conceito técnico.',
  qa: 'Use PROACTIVELY quando a pergunta é: os testes passam / a cobertura é adequada: testes unitários, integração, E2E (Playwright) e acessibilidade (WCAG).',
  researcher: 'Use PROACTIVELY quando a decisão depender de informação externa (stack, concorrência, preços, referências).',
  security: 'Use PROACTIVELY quando o diff toca autenticação, segredos, input de usuário ou dado sensível: OWASP Top 10, LGPD.',
  'senior-engineer': 'Use PROACTIVELY para implementação full-stack de ponta a ponta com TDD estrito.',
  'skill-architect': 'Use quando faltar uma skill comprovadamente necessária: cura duplicação e lacunas da biblioteca de skills.',
  techlead: 'Use PROACTIVELY quando o pedido é revisão pedagógica de código/padrão (o "porquê" de uma mudança) ou governança de convenções: não para veredito de aprovar/reprovar.'
};

/** Marcador presente em todo arquivo gerado: permite regenerar sem arriscar sobrescrever edição manual. */
export const GENERATED_MARKER = 'Gerado pelo Izanagi AI';

/**
 * Rodapé de proveniência DETERMINÍSTICO: nunca embute caminho absoluto da máquina geradora.
 *
 * Histórico (Wave 5): o formato antigo era `Gerado pelo Izanagi AI em \`${baseDir}\``, o que
 * quebrava a idempotência byte-a-byte cross-machine — regenerar os adapters em outra máquina
 * mudava essa linha, e o repositório chegou a congelar o cwd de uma geração Windows antiga
 * (`C:\Users\pedro.leal\Documents\NexusAI`) nos arquivos commitados. O comando real de
 * reprodução (`izanagi export --cli <cli>`) continua registrado; a máquina de origem, não.
 */
export function provenanceFooter(cli: string): string {
  return `${GENERATED_MARKER}: \`izanagi export --cli ${cli}\``;
}

/**
 * Subconjunto curado histórico: mantido só para não quebrar imports externos.
 * `exportToClaude` não usa mais isto: exporta a biblioteca inteira (ver
 * `listAllSkillNames`) para que os agentes nativos encontrem sob demanda
 * qualquer skill que precisem, não apenas estas 10.
 */
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

/**
 * Lista todos os nomes de skill da biblioteca-fonte (skills/<name>/SKILL.md),
 * ordenados. Claude Code só paga o custo de nome+descrição (frontmatter) por
 * skill listada em `.claude/skills/`: o corpo completo só é lido quando a
 * skill é de fato ativada: então exportar a biblioteca inteira aqui é
 * barato e é o que faz os 22 agentes nativos encontrarem qualquer skill que
 * referenciem, em vez de só as ~10 que estavam hardcoded antes.
 */
export function listAllSkillNames(baseDir: string): string[] {
  const sourceDir = resolveSourceDir(baseDir);
  const skillsDir = path.join(sourceDir, 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir)
    .filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')))
    .sort();
}

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
 * Lê todos os agentes reais de agents/*.json e agents/generated/*.json: este segundo
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
 * carrega o corpo (Layer 2) quando a skill é ativada: resumir na exportação não economiza
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
 * Izanagi (contém `GENERATED_MARKER`): nesse caso regenera. Se existir e NÃO tiver o marcador,
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

/**
 * Contrato compartilhado do coordenador. Ele é injetado nos adapters gerados em
 * vez de manter regras divergentes entre Opencode e Claude Code.
 */
const ORCHESTRATOR_HARD_GATES = `
## Contrato do Orquestrador: Análise, Delegação e Escrita

- **Autorização Total de Modificação**: Você possui autorização plena para analisar, ler, criar, alterar e escrever código, testes, configurações e documentação no repositório.
- **Delegação Especializada**: Para tarefas multi-domínio ou complexas, decomponha o trabalho e delegue frentes aos subagentes especializados, coordenando os resultados.
- **Pragmatismo & Resolução de Problemas**: Quando uma frente precisar de ajuste, refatoração, criação ou correção direta, execute a escrita e modificação de arquivos sem hesitar. Nunca recuse trabalho alegando "falta de autorização" ou "ser apenas orquestrador".
- **Qualidade & Zero Stubs**: Todo código gerado deve ser completo, tipado, testado e funcional. Proibido TODOs ou stubs vazios.
- **Capabilities honestas**: detecte browser portal, MCP, Playwright e CLIs antes de usá-los. Marque available/unavailable/unknown e use fallback explícito; nunca alegue uma inspeção, tool call ou CLI que não ocorreu.
- **Grounding antes de código**: para API, SDK, MCP ou biblioteca, recupere primeiro exemplos locais, resources/tools MCP ou documentação oficial. Se o contrato não for verificável, marque UNKNOWN e não invente imports, endpoints, flags ou seletores.
- **Web UI high-craft**: exija design-directions escolhida e composição intencional antes de implementar. GSAP/ScrollTrigger ou motion só entram com propósito; preserve prefers-reduced-motion, fallback sem JS, degradação mobile e orçamento LCP/INP/CLS.
- **Gate final**: security, QA e evaluator precisam emitir evidência independente. Falha crítica ou requisito órfão bloqueia a entrega.
`;

/**
 * Modo padrão em qualquer CLI: o usuário não precisa escolher agente nem digitar
 * /agents. Claude Code e OpenCode também recebem isso por configuração
 * (\`.claude/settings.json\` \`agent\`, \`opencode.json\` \`default_agent\`); nas CLIs sem
 * configuração de agente padrão (Antigravity, Codex, Cursor, Copilot, Kimi) este
 * texto, sempre carregado, é o que liga o comportamento.
 */
export const DEFAULT_ORCHESTRATOR_MODE = `## Modo padrão: Orquestrador do Izanagi

Todo pedido neste projeto é atendido pelo **Orquestrador do Izanagi**, em qualquer CLI, sem o usuário precisar escolher agente:

1. **Classifique o pedido.** Pequeno e claro (1 ou 2 arquivos): faça direto. Especializado (segurança, banco, design/landing, animação, infra, debug difícil) ou com frentes paralelas: **delegue ao especialista** do Izanagi (subagente nativo da CLI: \`.claude/agents/\`, \`.agents/agents/\`, \`.opencode/agent/\`, \`.codex/agents/\`). Vago ou grande: \`grilling\` antes de codar.
2. **Skills de verdade.** Escolha 1 a 3 skills com \`find-skills\` e leia cada \`SKILL.md\`. **Se a pasta da skill tiver \`references.md\` (ou \`references/references.md\`), leia também quando a skill citar ou quando precisar de exemplo, receita ou direção visual** (para landing/site, o \`references.md\` de \`signature-experience\` é obrigatório).
3. **Entrega verificada.** Arquivos alterados, verificação rodada (teste, build, screenshot para UI) e pendências. Nunca encerre com subagente ainda rodando.
4. **Commit limpo.** Antes de todo \`git commit\`: crie ou complete o \`.gitignore\` com segredos (\`.env\`, \`.env.*\` menos \`.env.example\`, \`*.pem\`, \`*.key\`, \`credentials.json\`, \`.claude/settings.local.json\`) e com os artefatos do Izanagi e das CLIs de agente (\`.agents/\`, \`.izanagi/\`, \`.claude/agents/\`, \`.claude/skills/\`, \`.claude/commands/\`, \`.opencode/\`, \`.codex/\`, \`.kimi/\`, \`.cursor/rules/izanagi-*\` e os \`AGENTS.md\`/\`CLAUDE.md\`/\`GEMINI.md\`/\`SYSTEM.md\`/\`RULES.md\` que trazem o rodapé de proveniência do Izanagi). Depois \`git status\`: o que desses já estiver rastreado sai com \`git rm --cached\`. Adicione arquivos pelo nome, nunca \`git add -A\` ou \`git add .\` às cegas, e confira \`git diff --cached --name-only\` antes de commitar. Só não vale no repositório-fonte do próprio Izanagi.`;

/**
 * Formato de briefing ao delegar (pirâmide objetivo → pesquisa → perguntas → exemplo).
 * Subagente começa sem contexto: briefing ruim vira releitura do projeto inteiro (token)
 * ou entrega fora do alvo (retrabalho). Compartilhado entre Claude Code e Antigravity.
 */
const SUBAGENT_BRIEF_FORMAT = `### Briefing ao delegar (o subagente começa sem contexto)

\`\`\`
Objetivo: <resultado em 1 a 2 frases> · Pronto quando: <teste/comando/critério verificável>
Onde olhar: <arquivos e pastas exatos; o que já se sabe para ele não reinvestigar>
Decidido: <respostas que o usuário já deu; o que NÃO mudar>
Exemplo do padrão: <arquivo ou trecho que mostra como é bom>
Skills: <1 a 3 nomes para ler antes de codar>
Devolva: arquivos alterados, verificação rodada com resultado, pendências
\`\`\`
`;

const CLAUDE_ORCHESTRATOR_DISPATCH_POLICY = `
## Política de execução do Orquestrador

O Orchestrator é o coordenador central e possui acesso total a ferramentas de leitura, escrita, edição e execução (\`Read\`, \`Grep\`, \`Glob\`, \`Edit\`, \`Write\`, \`Bash\`, \`Agent\`). Ele analisa o contexto, delega frentes especializadas via Agent tool quando apropriado e implementa ou refatora código diretamente para garantir que a demanda seja atendida por completo.

**Nunca encerre a resposta com subagente ainda rodando.** Se despachou em segundo plano, espere o resultado (Yield/notificação) antes de responder; em sessão não interativa (\`claude -p\`) o turno termina e a entrega se perde. Ao receber o resultado, confira os arquivos alterados e rode a verificação antes de reportar.

${SUBAGENT_BRIEF_FORMAT}`;

const CODEX_ORCHESTRATOR_LIMITATION = `
## Execução no Codex

O Orchestrator conduz a análise e a implementação completa de código e configurações no repositório, coordenando os especialistas do framework e aplicando alterações diretamente.
`;

/* ------------------------------------------------------------------ */
/* Claude Code                                                         */
/* ------------------------------------------------------------------ */

function claudeCommandTemplate(a: IzanagiAgentInfo): string {
  const modelLine = a.model ? `model: ${a.model}\n` : '';
  const trigger = CLAUDE_AGENT_TRIGGERS[a.slug] ?? `Use para tarefas de ${(a.role || a.name).toLowerCase()}.`;
  const dispatchPolicy = a.slug === 'orchestrator' ? CLAUDE_ORCHESTRATOR_DISPATCH_POLICY : '';
  return `---
description: ${truncate(trigger, 200)}
${modelLine}---

# ${a.name}

${dispatchPolicy}
${a.identity || a.role}

## Skills Obrigatórias (Mandatory Skills - Carregamento Seletivo)

Você possui as seguintes skills especializadas atribuídas à sua especialidade:
${bullet(a.skills) || '- (sem skills declaradas)'}

> **Referências**: se a pasta da skill tiver \`references.md\` (ou \`references/references.md\`), leia-o quando a skill citar ou quando precisar de exemplo, receita de código ou direção visual. Para landing, site ou portfólio, \`signature-experience/references.md\` é leitura obrigatória antes de codar.
>
> ⚠️ **CLÁUSULA DE USO OBRIGATÓRIO DE SKILLS & ECONOMIA DE TOKENS**:
> 1. **Carregamento Cirúrgico**: Para economizar tokens e não sobrecarregar o contexto, NUNCA carregue todas as skills de uma vez.
> 2. **Ativação por Demanda**: Identifique a necessidade imediata e ative **APENAS as skills estritamente relevantes** (1 a 3 por tarefa, escolhidas com \`find-skills\`) necessárias para o trabalho atual.
> 3. **Conformidade Técnica**: Para o domínio ativado, aplique rigorosamente os procedimentos e checklists técnicos da respectiva skill.

## Chains (fluxos de execução)

${chainList(a.chains) || '- (sem chains)'}

## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI (\`izanagi export --cli claude\`)
`;
}

/**
 * Descrição curta para a listagem de skills da CLI. Claude Code e Antigravity
 * colocam nome+descrição de TODA skill no contexto sob um orçamento fixo; acima
 * dele, as últimas skills aparecem só com o nome e o modelo não consegue
 * escolhê-las. 117 descrições de ~205 chars estouravam esse orçamento. Mantém a
 * frase inicial (o quê) e a frase "Use ..." (quando), que é o que roteia.
 */
export function compactSkillDescription(desc: string, max = 170): string {
  const t = desc.replace(/\s+/g, ' ').replace(/\s*Gatilhos de ativa[çc][ãa]o:.*$/i, '').trim();
  if (t.length <= max) return t;
  const useIdx = t.search(/\bUse (ao|quando|em|antes|para|sempre|no|na|após|apos|depois|se|com)\b/);
  if (useIdx > 0) {
    const use = truncate(t.slice(useIdx), Math.floor(max * 0.5));
    const headEnd = t.search(/[.:](\s|$)/);
    const head = t.slice(0, headEnd > 0 && headEnd < useIdx ? headEnd : useIdx).trim();
    const h = truncate(head, max - use.length - 2).replace(/[.,;:]$/, '');
    return `${h}${h.endsWith('…') ? '' : '.'} ${use}`;
  }
  return truncate(t, max);
}

function claudeSkillTemplate(s: SkillSummary): string {
  return `---
name: ${s.name}
description: ${JSON.stringify(compactSkillDescription(s.description))}
---

${s.body}

> Gerado pelo Izanagi AI: cópia fiel de \`skills/${s.name}/SKILL.md\` (fonte da verdade).
`;
}

/** Extrai o texto de referências.md se existir (Layer 3: só citado, nunca inlinado). */
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
    ? a.skills.map((s) => `- \`.claude/skills/${s}/SKILL.md\`${hasReferences(baseDir, s) ? ' (+ `references.md`)' : ''}`).join('\n')
    : '- (sem skills declaradas)';
  const dispatchPolicy = a.slug === 'orchestrator' ? `\n${CLAUDE_ORCHESTRATOR_DISPATCH_POLICY}\n` : '';

  return `---
name: ${a.slug}
description: "${description}"
tools: ${tools}
${modelLine}---

# ${a.name}

${a.identity || a.role}
${dispatchPolicy}
## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

## Skills Obrigatórias (Mandatory Skills - Uso Estrito)

Você possui as seguintes skills especializadas atribuídas (lidas sob demanda). Caminhos relativos ao projeto; na instalação global (\`izanagi setup\`) estão em \`~/.claude/skills/\` e em \`~/.izanagi/skills/\`:
${skillLines}

> **Referências**: se a pasta da skill tiver \`references.md\` (ou \`references/references.md\`), leia-o quando a skill citar ou quando precisar de exemplo, receita de código ou direção visual. Para landing, site ou portfólio, \`signature-experience/references.md\` é leitura obrigatória antes de codar.
>
> ⚠️ **CLÁUSULA DE USO OBRIGATÓRIO DE SKILLS & ECONOMIA DE TOKENS**:
> 1. **Carregamento Cirúrgico Sob Demanda**: Para economizar tokens e manter o contexto enxuto, NUNCA carregue todas as skills de uma vez.
> 2. **Ativação Específica**: Analise o objetivo da tarefa e ative **APENAS as skills necessárias** (1 a 3 por tarefa, escolhidas com \`find-skills\`) para a etapa atual.
> 3. **Rigor Técnico**: Para o domínio ativado, aplique rigorosamente os procedimentos e checklists técnicos da respectiva skill. Proibido atuar sem invocar seus padrões.

## Chains (fluxos de execução)

${chainList(a.chains) || '- (sem chains)'}

## Handoff

${a.handoffs && a.handoffs.length > 0 ? bullet(a.handoffs.map((h) => `\`${h.to}\`: ${h.reason}`)) : '- (sem handoff declarado)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI (\`izanagi export --cli claude\`)
`;
}

function claudeMainTemplate(agents: IzanagiAgentInfo[], skills: SkillSummary[], slim = false): string {
  // slim: o Claude Code já lista nome e descrição de cada agente; repetir a tabela custa ~4 KB em toda sessão.
  const agentTable = slim
    ? '| (todos) | Descobertos pelo Claude Code; use o mapa de tarefa para agente abaixo |'
    : agents.map((a) => `| \`${a.slug}\` | ${truncate(a.role, 140)} |`).join('\n');

  return `# Izanagi AI: Claude Code Integration

Este projeto usa o **Izanagi AI Framework**: framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e ${agents.length} agentes pré-definidos.

## Fonte da verdade

Este arquivo já cobre agentes, skills e regras essenciais do dia a dia: não precisa ler mais nada de saída. Consulte sob demanda só quando a tarefa exigir o tópico específico:

- \`AGENTS.md\` (raiz): catálogo de agentes e regras que valem em qualquer projeto
- \`SYSTEM.md\`: só para: detalhes de engines internas, quality gates, arquitetura de memória
- \`RULES.md\`: só para: regras operacionais que não estejam listadas abaixo
- \`.agents/AGENTS.md\`: a referência COMPLETA do framework, com a topologia poliglota, os comandos de desenvolvimento, a estrutura de pastas e o release flow. Isso descreve o repositório do framework, não necessariamente este projeto: num projeto que só consome o pacote, \`npm run build\` e \`cargo test --workspace\` de lá não têm o que rodar. Os comandos deste projeto estão na seção 0 do \`AGENTS.md\` da raiz.

## Orquestrador (\`/agents\`)

Digite \`/agents\` (\`.claude/commands/agents.md\`) para o protocolo completo de decomposição + swarm paralelo quando o pedido cobrir 2+ domínios ou for um projeto novo. Para o caso comum (uma frente clara), pule direto para a tabela abaixo.

${CLAUDE_ORCHESTRATOR_DISPATCH_POLICY}

## Agentes nativos (Agent tool)

Os ${agents.length} agentes em \`.claude/agents/*.md\` são **subagents nativos do Claude Code** (Agent tool). **Regra de despacho: delegue quando o especialista agrega, faça você mesmo quando é pequeno.** Cada subagente começa com contexto vazio e relê o projeto: isso custa token. Delegue frentes especializadas (segurança, banco, animação, debug difícil), frentes paralelas independentes e trabalho de vários arquivos; edição pequena e clara (1 ou 2 arquivos, intenção óbvia) você faz direto, aplicando a skill certa. Chame também por \`/<slug>\` em \`.claude/commands/\` quando quiser forçar um agente específico.

| Agente | Quando usar |
|---|---|
${agentTable}

**Skills se leem, não se listam, e são poucas por tarefa:** escolha 1 skill primária (o como fazer) e no máximo 2 de verificação (o como provar) com a skill \`find-skills\`, leia o \`SKILL.md\` de cada uma e declare numa linha o que vai aplicar. A seção **Chains** de cada \`.claude/agents/<slug>.md\` é o cardápio do domínio, não uma sequência obrigatória: pegue da chain só o que a tarefa pede. Ler 9 skills para mudar 1 arquivo é desperdício, não rigor.

**Mapa rápido tarefa → agente(s) → chain:**
- Ideia vaga / ainda não sabe o que construir → \`discovery\` (entrevista + pesquisa) → \`product-reasoner\` (requisitos/BDD) → \`architect\`.
- Requisitos definidos, decisão estrutural em aberto → \`architect\` (ADR) → \`senior-engineer\` implementa.
- Implementar feature/CRUD/bugfix/refactor → \`senior-engineer\` (chains \`implement\`/\`bug\`/\`refactor\`/\`fullstack\` conforme o pedido).
- Feature com LLM/RAG/agentes/tool-calling → \`ai-engineer\`, não \`senior-engineer\`.
- Site/landing/dashboard novo → \`discovery\`/\`architect\` primeiro (Style Selector, regra 15), depois \`senior-engineer\` com a chain \`fullstack\` (inclui \`anti-ai-slop\` no fim, obrigatório).
- Cobrança/assinatura/checkout → \`senior-engineer\` com \`payments-billing\` na chain (webhook + idempotência, nunca liberar acesso pelo retorno do navegador).
- Antes de merge/deploy → \`security\` + \`qa\` + \`techlead\` em paralelo (chain \`review\`); \`adversarial-critic\` só se pedirem para caçar pontos cegos.
- Bug difícil/reincidente → \`bug-hunter\` (chain \`systematic-debugging\` → \`tdd\`).
- Nota objetiva PASS/FAIL contra critério já definido → \`evaluator\`; revisão pedagógica do "porquê" → \`techlead\`.

**Execução paralela obrigatória** para frentes independentes: cada agente roda com contexto isolado, só o resultado final volta. Casos canônicos de fan-out (protocolo completo em \`/agents\`):
- Feature nova (fronteiras estruturais independentes): \`architect\` + \`database\` + \`security\` em paralelo, depois \`senior-engineer\` implementa em sequência.
- Revisão de PR antes de merge: \`security\` + \`qa\` + \`techlead\` em paralelo por padrão (cada um responde uma pergunta diferente: risco de segurança, testes/cobertura, padrão de código); acrescente \`adversarial-critic\` só quando pedirem para caçar pontos cegos explicitamente.
- Nunca use um único agente genérico para um pedido que cobre 2+ domínios da tabela acima: divida em frentes e dispare em paralelo.

## Skills (biblioteca inteira, nativa)

Todas as ${skills.length} skills da biblioteca (\`skills/<name>/SKILL.md\`) foram exportadas fielmente para \`.claude/skills/<name>/SKILL.md\`. O Claude Code descobre nome+descrição de cada uma automaticamente ao abrir este projeto (custo fixo pequeno por skill) e só lê o corpo completo quando de fato a ativa: não é preciso listá-las aqui de novo nem chamar \`izanagi export\` para elas aparecerem. Peça por nome ("use a skill X") ou deixe o Claude escolher pela descrição; cada agente nativo também referencia as suas em "Skills relevantes" no próprio \`.claude/agents/<slug>.md\`.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA": identidade visual bespoke por nicho (rule 14), zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Zero travessão "—" e zero "--" duplo.** Ornamento de texto: usar "·", ":" ou ponto final. Hífen simples "-" (compostos, ranges, bullets) continua normal.
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas; use \`/agents\` para o protocolo completo.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

> Regras específicas de cada agente (always/never) vivem em \`.claude/agents/<slug>.md\`: lidas sob demanda só quando aquele agente é ativado, não duplicadas aqui.

---
${provenanceFooter('claude')}
`;
}

function claudeOrchestratorCommandTemplate(agents: IzanagiAgentInfo[]): string {
  const agentList = agents.map((a) => `- \`${a.slug}\`: ${a.name} (${truncate(a.role, 90)})`).join('\n');
  return `---
description: "Izanagi Multi-Agent Orchestrator: coordena, delega para especialistas em paralelo, analisa e implementa tarefas completas."
---

# Izanagi Multi-Agent Orchestrator

Você é o coordenador central e líder técnico de engenharia do framework Izanagi AI.

**🧑‍💼 Liderança Técnica e Execução Completa:**
- **Autorização Total de Escrita e Execução**: Você e todos os agentes do framework possuem autorização total para ler, criar, editar e alterar código, testes e configurações no repositório. Nunca recuse modificar arquivos.
- **Delegação Especializada**: Para tarefas multi-domínio ou complexas, decomponha o pedido em frentes de trabalho e despache especialistas via Agent tool em paralelo com contexto isolado.
- **Implementação Real (Zero Chatbot Passivo)**: Você escreve e refatora código diretamente sempre que necessário, sem desculpas de "não tenho autorização" ou "sou apenas orquestrador".
- **Zero Stubs / Zero Checklists**: Código real de produção 100% implementado em todos os arquivos.

## Protocolo de Execução

1. **Estudar e Decompor**: Leia a tarefa por completo, examine o repositório e decomponha em frentes independentes.
2. **Rotear e Disparar Subagentes em Paralelo**: Despache os agentes certos via Agent tool com contexto limpo e isolado.
3. **Coordenar por Artefatos e Escrita Direta**: Integre os resultados, crie e edite os arquivos necessários no repositório.
4. **Verificar e Testar**: Execute a suíte de testes e comandos de validação para comprovar o funcionamento.
5. **Entregar**: Apresente o resumo objetivo do que foi implementado e os arquivos tocados.

${ORCHESTRATOR_HARD_GATES}

${CLAUDE_ORCHESTRATOR_DISPATCH_POLICY}

## Subagentes Especializados Disponíveis para Delegação
${agentList}

## Design Experience Flow (todo pedido de site/app)

1. **Estilo primeiro**: antes de qualquer código, acione \`design-directions\` e apresente 3-5 direções BESPOKE para o nicho (nunca só glassmorphism). O usuário escolhe.
2. **Anti AI-Slop**: após implementar, rode \`anti-ai-slop\`: zero tells (Inter default, gradiente roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future", travessão "—"/"--" como ornamento).
3. **Experiência acima de velocidade**: tipografia com personalidade, cor dominante + acento afiado, layout assimétrico, motion em 1-2 momentos-chave.

## Regras inegociáveis

- Zero trabalho monolítico: tarefa complexa exige swarm paralelo com contexto isolado por frente.
- Zero stubs / zero checklists: código real de produção, completo, em todo arquivo.
- Token economy ativa: contexto mínimo por agente, coordenação por artefatos em disco, sem releituras.
- Memória persistente: salve progresso em \`.agents/memoria/\` a cada etapa relevante.
- Compliance gate: nenhuma entrega finalizada sem auditoria contra padrões do framework e requisitos do usuário.
- Risco primeiro: riscos identificados no passo 1 são mitigados na execução, nunca reportados como surpresa no final.

> Gerado pelo Izanagi AI (\`izanagi export --cli claude\`)
`;
}

export interface ClaudeExportOptions {
  /**
   * Grava o `CLAUDE.md` na raiz do destino. Default `true`.
   *
   * `false` existe para a instalação de escopo pessoal (`izanagi export
   * --global`, destino `~/`): ali o `CLAUDE.md` é o arquivo de memória do
   * USUÁRIO, que passa a valer em todo projeto que ele abrir. Sobrescrevê-lo
   * com a descrição de um framework seria injetar contexto do Izanagi em
   * repositórios que nada têm a ver com ele. Agentes e skills de escopo
   * pessoal são aditivos e ficam inertes até serem chamados; um documento de
   * memória global, não.
   */
  rootDoc?: boolean;
  /**
   * Home onde procurar a instalação global (`izanagi setup`). Quando o orquestrador
   * e as skills já estão em `<home>/.claude/`, o projeto NÃO recebe cópia deles:
   * o Claude Code lê os dois escopos e a lista de 130 skills + 23 agentes passaria
   * a custar o dobro de contexto em toda sessão, por arquivos que o `.gitignore`
   * do init já deixa fora do commit. Omitido: sempre exporta (comportamento antigo).
   */
  globalHome?: string;
  /**
   * De onde LER os agentes e as skills, quando isso não é o destino.
   *
   * Fonte e destino sempre foram o mesmo `baseDir`, e para o export por
   * projeto isso é correto (o projeto tem `.agents/` ou é o repo-fonte). Para
   * o escopo pessoal não é: o destino é `~/`, que não contém framework nenhum,
   * e ler dali produziria zero agente e zero skill em silêncio, gravando um
   * `.claude/` vazio que parece instalado.
   *
   * Ausente, mantém o comportamento antigo (fonte = destino).
   */
  sourceDir?: string;
}

/** Orquestrador e catálogo de skills do Izanagi já instalados em `<home>/.claude/` por `izanagi setup`. */
export function hasGlobalClaudeInstall(home: string): boolean {
  try {
    const orch = fs.readFileSync(path.join(home, '.claude', 'agents', 'orchestrator.md'), 'utf-8');
    return orch.includes(GENERATED_MARKER) && fs.existsSync(path.join(home, '.claude', 'skills', 'find-skills', 'SKILL.md'));
  } catch {
    return false;
  }
}

export function exportToClaude(baseDir: string, opts: ClaudeExportOptions = {}): string[] {
  const created: string[] = [];
  const source = opts.sourceDir ?? baseDir;
  const agents = loadIzanagiAgents(source);
  const skills = listAllSkillNames(source)
    .map((n) => readSkillSummary(source, n))
    .filter((s): s is SkillSummary => s !== null);

  // CLAUDE.md na raiz (fonte da verdade + regras essenciais inline)
  if (opts.rootDoc !== false) {
    const main = writeIfAbsent(baseDir, 'CLAUDE.md', withDefaultMode(claudeMainTemplate(agents, skills, opts.globalHome ? hasGlobalClaudeInstall(opts.globalHome) : false)));
    if (main) created.push(main);
  }

  const sharedGlobal = opts.globalHome ? hasGlobalClaudeInstall(opts.globalHome) : false;

  // subagents nativos em .claude/agents/<slug>.md: aparecem no Agent tool e são auto-selecionados
  for (const agent of sharedGlobal ? [] : agents) {
    const rel = writeIfAbsent(baseDir, `.claude/agents/${agent.slug}.md`, claudeAgentTemplate(source, agent));
    if (rel) created.push(rel);
  }

  // Limpeza de comandos slash obsoletos: o usuário deve ver apenas /agents e /orchestrator!
  const commandsDir = path.join(baseDir, '.claude', 'commands');
  if (fs.existsSync(commandsDir)) {
    try {
      const files = fs.readdirSync(commandsDir);
      for (const file of files) {
        if (file !== 'agents.md' && file !== 'orchestrator.md' && file.endsWith('.md')) {
          const full = path.join(commandsDir, file);
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes(GENERATED_MARKER)) {
            fs.unlinkSync(full);
          }
        }
      }
    } catch {}
  }

  // orquestrador /agents e /orchestrator: ÚNICOS comandos slash expostos ao usuário!
  // Os especialistas continuam existindo em .claude/agents/ para o orquestrador delegar via Agent tool.
  if (!sharedGlobal) {
    const orchestrator = writeIfAbsent(baseDir, '.claude/commands/agents.md', claudeOrchestratorCommandTemplate(agents));
    if (orchestrator) created.push(orchestrator);
    const orchestratorAlias = writeIfAbsent(baseDir, '.claude/commands/orchestrator.md', claudeOrchestratorCommandTemplate(agents));
    if (orchestratorAlias) created.push(orchestratorAlias);
  }

  // skills universais em .claude/skills/<name>/SKILL.md: corpo fiel ao original, nunca resumido
  for (const s of sharedGlobal ? [] : skills) {
    const rel = writeIfAbsent(baseDir, `.claude/skills/${s.name}/SKILL.md`, claudeSkillTemplate(s));
    if (rel) created.push(rel);
    // O corpo das skills cita "references.md nesta pasta": sem a cópia, o link fica quebrado.
    // Arquivo separado mantém o progressive disclosure (só é lido se a skill mandar).
    if (hasReferences(source, s.name)) {
      const src = path.join(resolveSourceDir(source), 'skills', s.name, 'references.md');
      const refRel = writeIfAbsent(
        baseDir,
        `.claude/skills/${s.name}/references.md`,
        `${fs.readFileSync(src, 'utf-8').trimEnd()}\n\n> ${GENERATED_MARKER}: cópia fiel de \`skills/${s.name}/references.md\` (fonte da verdade).\n`
      );
      if (refRel) created.push(refRel);
    }
  }

  // Orquestrador como agente padrão da sessão: `claude` puro (sem --agent) já entra
  // nele. Conferido no Claude Code com `claude -p` em projeto consumidor. Preserva as
  // demais chaves e não troca um agente que o usuário já escolheu.
  if (agents.some((a) => a.slug === 'orchestrator')) {
    const settings = mergeJsonConfig(baseDir, '.claude/settings.json', (c) => {
      if (c.agent) return false;
      c.agent = 'orchestrator';
      return true;
    });
    if (settings) created.push(settings);
  }

  return created;
}

/* ------------------------------------------------------------------ */
/* Codex (OpenAI)                                                      */
/* ------------------------------------------------------------------ */

function codexAgentTemplate(a: IzanagiAgentInfo): string {
  const orchestratorPolicy = a.slug === 'orchestrator' ? CODEX_ORCHESTRATOR_LIMITATION : '';
  const hardGates = a.slug === 'orchestrator' ? ORCHESTRATOR_HARD_GATES : '';
  return `# ${a.name}

**${a.role}**

${a.identity || a.role}

${orchestratorPolicy}
${hardGates}
## Skills Obrigatórias (Mandatory Skills - Carregamento Seletivo)

Skills da sua especialidade:
${bullet(a.skills) || '- (sem skills declaradas)'}

> **Referências**: se a pasta da skill tiver \`references.md\` (ou \`references/references.md\`), leia-o quando a skill citar ou quando precisar de exemplo, receita de código ou direção visual. Para landing, site ou portfólio, \`signature-experience/references.md\` é leitura obrigatória antes de codar.
>
> ⚠️ **REGRA DE ECONOMIA DE TOKENS & QUALIDADE**:
> Ative apenas as skills estritamente relevantes (1 a 3 por tarefa, escolhidas com \`find-skills\`) para a tarefa atual para poupar tokens. Siga rigorosamente os padrões das skills ativadas na entrega.

## Chains

${chainList(a.chains) || '- (sem chains)'}

## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI
`;
}

function codexInstructionsTemplate(agents: IzanagiAgentInfo[]): string {
  const agentList = agents.map((a) => `- \`${a.slug}\`: ${a.role}`).join('\n');
  return `# Izanagi AI: Codex Instructions

> **Fonte da verdade: \`AGENTS.md\`** (o Codex lê \`AGENTS.md\` nativamente). Este arquivo contém as regras essenciais e o índice dos agentes do framework.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA": identidade visual bespoke por nicho, zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.
- **Qualidade é medida.** Se não pode ser medido, não pode ser melhorado.

${CODEX_ORCHESTRATOR_LIMITATION}

## Agentes (em .codex/agents/)

${agentList}

## Estrutura do framework

- \`AGENTS.md\`: referência canônica (leia primeiro)
- \`SYSTEM.md\`: fundação do sistema
- \`RULES.md\`: regras operacionais
- \`agents/*.json\`: definições completas de todos os agentes
- \`skills/<name>/SKILL.md\`: biblioteca de skills especializadas
- \`.opencode/agent/*.md\`: integração com opencode (compatível com Kimi CLI)

---
${provenanceFooter('codex')}
`;
}

export function exportToCodex(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);

  const instr = writeIfAbsent(baseDir, '.codex/instructions.md', withDefaultMode(codexInstructionsTemplate(agents)));
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
description: Izanagi AI Core: regras essenciais do framework (arquitetura antes de código, anti-generic, segurança, tokens)
globs: ["**/*"]
---

# Izanagi AI: Core Rules

O Cursor também lê \`AGENTS.md\`: a referência canônica do framework. Estas regras são o essencial operacional.

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

> Gerado pelo Izanagi AI: \`izanagi export --cli cursor\`
`;
}

function cursorAgentsTemplate(agents: IzanagiAgentInfo[]): string {
  const table = agents
    .map((a) => `| \`${a.slug}\` | ${a.name} | ${truncate(a.role, 110)} |`)
    .join('\n');
  return `---
description: Izanagi AI: índice dos agentes especializados e quando usar cada um
globs: ["**/*"]
---

# Izanagi AI: Agentes

Use estes agentes como orquestração de papéis: escolha o agente pelo tipo de tarefa, não pelo nome bonito.

## Tabela de agentes

| Comando | Agente | Papel |
|---|---|---|
${table}

## Quando usar

- **Novo projeto / feature / site**: \`discovery\` (pré-produção: entrevista, pesquisa, prompt rico) → \`brainstorming\` → \`architect\`.
- **Implementação**: \`senior-engineer\` (full-stack, TDD): com \`security\` e \`qa\` em paralelo.
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

> Gerado pelo Izanagi AI: \`izanagi export --cli cursor\`
`;
}

function cursorMemoryTemplate(): string {
  return `---
description: Izanagi AI: memória de projeto, anti-repetição e evolução contínua
globs: ["**/*"]
---

# Izanagi AI: Memória & Anti-Repetição

## Arquitetura de memória

- **Session Memory**: contexto da conversa atual: comprima ao exceder 70% do orçamento de tokens.
- **Project Memory**: decisões, padrões e erros resolvidos deste projeto (skills \`memoria-projeto\` e \`handoff-sessao\`).
- **Long-Term Memory**: knowledge graph: atualizado a cada tarefa concluída.

## Anti-repetição

- Nunca releia arquivos que já estão no contexto e não mudaram.
- Prefira grep/glob direcionado a abrir arquivos inteiros.
- Prefira edições por diff/patch a reescrever arquivos inteiros.
- Não narre intenção antes de executar; não ecoe contexto.
- Economia de tokens é regra permanente (skill \`economia-tokens\`).

## Ciclo de evolução

Tarefa → Executar → Refletir → Registrar → Atualizar skills → Próxima tarefa.

Cada tarefa atualiza a base de skills: o agente melhora a cada interação.

> Gerado pelo Izanagi AI: \`izanagi export --cli cursor\`
`;
}

export function exportToCursor(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);

  const core = writeIfAbsent(baseDir, '.cursor/rules/izanagi-core.mdc', withDefaultMode(cursorCoreTemplate()));
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

function copilotInstructionsTemplate(agents: IzanagiAgentInfo[]): string {
  const agentList = agents.map((a) => `- \`${a.slug}\`: ${a.role}`).join('\n');
  return `# Izanagi AI: GitHub Copilot Instructions

> **Fonte da verdade: \`AGENTS.md\`**: o Copilot lê \`AGENTS.md\` nativamente. Este arquivo reforça as regras essenciais e indexa os agentes do framework.

## Regras essenciais

- **Arquitetura antes de código.** Pense antes de agir; arquitetura primeiro, código depois.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA": identidade visual bespoke por nicho, zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
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

## Coordenação orchestration-only

Para tarefas com múltiplos domínios, roteie pelo \`/orchestrator\` antes de qualquer
implementação: discovery/pesquisa → requisitos → arquitetura → especialistas em paralelo
→ implementação delegada → security/QA/evaluation. O coordenador nunca edita arquivos
de implementação. Antes de afirmar pesquisa live, MCP, browser, Playwright ou CLI,
detecte a capability e declare available/unavailable/unknown com fallback honesto.
Integrações exigem retrieval de exemplos oficiais ou existentes antes de codar; APIs
desconhecidas são UNKNOWN, nunca inventadas. Para web UI, exija design-directions,
anti-ai-slop, motion com propósito, reduced motion e orçamento de performance.

---
${provenanceFooter('copilot')}
`;
}

export function exportToCopilot(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);
  const rel = writeIfAbsent(baseDir, '.github/copilot-instructions.md', withDefaultMode(copilotInstructionsTemplate(agents)));
  if (rel) created.push(rel);
  return created;
}

/* ------------------------------------------------------------------ */
/* Kimi CLI (Moonshot): compatível com convenção opencode             */
/* ------------------------------------------------------------------ */

function kimiReadmeTemplate(): string {
  return `# Izanagi AI: Kimi CLI (Moonshot)

O **Kimi CLI** é compatível com a convenção do opencode: ele lê \`AGENTS.md\` e os comandos slash em \`.opencode/agent/*.md\` nativamente.

## Como usar

- **Fonte da verdade**: \`AGENTS.md\` (leia antes de qualquer tarefa).
- **Comandos slash**: \`.opencode/agent/*.md\`: ative agentes com \`/<nome>\` (\`/architect\`, \`/security\`, \`/devops\`, ...).
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

> ${provenanceFooter('kimi')}
`;
}

function kimiRootTemplate(): string {
  return `# Izanagi AI: Kimi CLI

> **Fonte da verdade: \`AGENTS.md\`**: leia antes de qualquer tarefa.

O Kimi CLI (Moonshot) é compatível com a convenção do opencode: \`AGENTS.md\` e \`.opencode/agent/*.md\` funcionam nativamente. Detalhes em \`.kimi/README.md\`.

## Regras essenciais

- **Arquitetura antes de código.**
- **Anti-generic, alto craft**: nunca entregue código/UI genérica "cara de IA".
- **Baixo token, alto sinal.**
- **Auto-correção e ensino.**
- **Segurança não é opcional**: sem secrets no código.

## Agentes

Definições completas em \`agents/*.json\`; ativação via \`/.opencode/agent/\`.

> ${provenanceFooter('kimi')}
`;
}

export function exportToKimi(baseDir: string): string[] {
  const created: string[] = [];
  const readme = writeIfAbsent(baseDir, '.kimi/README.md', kimiReadmeTemplate());
  if (readme) created.push(readme);

  const root = writeIfAbsent(baseDir, 'kimi.md', withDefaultMode(kimiRootTemplate()));
  if (root) created.push(root);

  return created;
}

/* ------------------------------------------------------------------ */
/* opencode (também usado pelo Kimi CLI, que segue a mesma convenção)  */
/* ------------------------------------------------------------------ */

/**
 * opencode agent markdown frontmatter aceita `mode: primary|subagent|all`: omitido,
 * o default é `all` (manualmente selecionável E auto-invocável por outro agente via
 * Task tool, com base na `description`). Só o orquestrador recebe `mode: primary` e
 * uma política explícita de tools read-only; especialistas continuam utilizáveis nos
 * dois formatos.
 */
function opencodeAgentTemplate(a: IzanagiAgentInfo): string {
  const trigger = CLAUDE_AGENT_TRIGGERS[a.slug] ?? `Use para tarefas de ${(a.role || a.name).toLowerCase()}.`;
  const description = truncate(`${a.name} - ${trigger}`, 260);
  const isOrchestrator = a.slug === 'orchestrator';
  const frontmatter = isOrchestrator
    ? `mode: primary
tools:
  read: true
  grep: true
  glob: true
  task: true
  write: true
  edit: true
  bash: true
permission:
  edit: allow
  bash: allow
`
    : `mode: subagent
tools:
  read: true
  grep: true
  glob: true
  write: true
  edit: true
  bash: true
permission:
  edit: allow
  bash: allow
`;
  return `---
description: "${description}"
${frontmatter}---

# ${a.name}

${a.identity || a.role}

## Autorização e Execução
Você possui autorização completa para ler, criar, editar e alterar arquivos no repositório, bem como executar comandos e testes necessários para a sua especialidade. Nunca recuse modificações alegando falta de permissão.

## Sempre

${a.always.length > 0 ? bullet(a.always) : '- (sem regras sempre)'}

## Nunca

${a.never.length > 0 ? bullet(a.never) : '- (sem regras nunca)'}

## Skills Obrigatórias (Mandatory Skills)

Você possui as seguintes skills especializadas atribuídas à sua função:
${bullet(a.skills) || '- (sem skills declaradas)'}

> **Referências**: se a pasta da skill tiver \`references.md\` (ou \`references/references.md\`), leia-o quando a skill citar ou quando precisar de exemplo, receita de código ou direção visual. Para landing, site ou portfólio, \`signature-experience/references.md\` é leitura obrigatória antes de codar.
>
> ⚠️ **CLÁUSULA DE USO OBRIGATÓRIO DE SKILLS & ECONOMIA DE TOKENS**:
> 1. **NUNCA carregue todas as skills de uma vez**: carregar o catálogo inteiro simultaneamente estoura o orçamento de tokens e polui o contexto.
> 2. **Ativação Cirúrgica por Demanda**: Para cada tarefa ou sub-tarefa, ative e consulte **APENAS as skills necessárias** (1 a 3 por tarefa, escolhidas com \`find-skills\`) para o trabalho atual.
> 3. **Conformidade Técnica**: É expressamente proibido atuar de forma genérica sem aplicar os padrões e checklists da skill relevante para o que estiver construindo. Toda entrega deve evidenciar a aplicação dela.

## Chains (Fluxos de Execução)

${chainList(a.chains) || '- (sem chains)'}

> Fonte: \`agents/${a.file}\` · Gerado pelo Izanagi AI (\`izanagi export --cli opencode\`)
`;
}

function opencodeOrchestratorTemplate(agents: IzanagiAgentInfo[]): string {
  const agentList = agents.map((a) => `- \`/${a.slug}\`: ${a.name} (${truncate(a.role, 90)})`).join('\n');
  return `---
name: "Agents Orchestrator"
description: "Izanagi Multi-Agent Orchestrator - Coordena, delega para especialistas em paralelo, analisa e implementa tarefas completas"
mode: primary
tools:
  read: true
  grep: true
  glob: true
  task: true
  write: true
  edit: true
  bash: true
permission:
  edit: allow
  bash: allow
---

Você é o **Izanagi Multi-Agent Orchestrator**, o coordenador central e líder técnico de engenharia do framework Izanagi AI.

**🧑‍💼 LIDERANÇA TÉCNICA E EXECUÇÃO DE PONTA A PONTA:**
- **Autorização Total de Escrita e Execução**: Você e todos os agentes do framework possuem autorização total para inspecionar, ler, criar, editar e alterar código, testes e configurações no repositório. Nunca recuse modificar arquivos.
- **Delegação Ativa em Segundo Plano**: Para tarefas complexas ou multi-domínio, decomponha o pedido em frentes de trabalho e delegue aos especialistas adequados (arquitetura, banco, frontend, segurança, testes) via subagentes com contexto isolado.
- **Implementação Real (Zero Chatbot Passivo)**: Você não é um chatbot consultivo. Você analisa, coordena, escreve e altera arquivos diretamente, integra o trabalho dos subagentes e executa testes até a entrega completa de produção.
- **Zero Stubs / Zero Checklists**: Entregue código real, tipado, completo e funcional em todos os arquivos. Proibido TODOs ou stubs vazios.

Quando o usuário acionar \`/agents\`, assuma imediatamente a condução da tarefa:
1. **Compreensão e Análise**: Inspecione os arquivos e entenda a necessidade real do projeto.
2. **Delegação Especializada**: Acione os subagentes especializados adequados em segundo plano para as frentes necessárias.
3. **Escrita e Refatoração**: Crie e altere os arquivos de código e testes diretamente no repositório.
4. **Verificação**: Execute testes e validações para garantir que a solução funciona.
5. **Entrega**: Apresente o resumo executivo das ações realizadas, arquivos alterados e evidências de sucesso.

${ORCHESTRATOR_HARD_GATES}

## Subagentes Especializados Disponíveis para Delegação Interna
${agentList}

## Design Experience Flow (obrigatório em TODO pedido de site/app)
1. **Estilo Primeiro (Style Selector)**: antes de qualquer código, acione \`design-directions\` e apresente 3-5 direções de design BESPOKE para o nicho (ex: site de tecnologia → "OLED Precision", "Quantum Terminal", "Editorial Data", "Brutalist Grid": NUNCA só glassmorphism). O usuário escolhe; a direção vira o design system.
2. **Anti AI-Slop**: após a implementação, rode \`anti-ai-slop\`: scan de tells (Inter default, gradientes roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future") com ZERO ocorrências antes de entregar.
3. **Experiência acima de velocidade**: sem pressa. O padrão é Awwwards-grade: tipografia com personalidade, cor dominante + acento afiado, layout assimétrico, motion em 1-2 momentos-chave.

## Regras Inegociáveis
- **Execução Real**: Nunca se limite a planejar ou sugerir; implemente as mudanças reais nos arquivos.
- **Zero Stubs / Zero Checklists**: código real de produção 100% implementado em todos os arquivos.
- **Experiência e Profundidade Acima da Velocidade**: entregar experiência imersiva sem atalhos.
- **Token Economy Ativa**: contexto mínimo por subagente, coordenar por artefatos em disco, prompt caching (estático primeiro), sem releituras.
- **Memória Persistente**: salvar progresso em \`.agents/memoria/\` a cada etapa relevante.
- **Compliance Gate**: nenhuma entrega é finalizada sem testes e validação de conformidade.

> Gerado pelo Izanagi AI: \`izanagi export --cli opencode\`
`;
}

export function exportToOpencode(baseDir: string): string[] {
  const created: string[] = [];
  const agents = loadIzanagiAgents(baseDir);

  const orchestrator = writeIfAbsent(baseDir, '.opencode/agent/agents.md', opencodeOrchestratorTemplate(agents));
  if (orchestrator) created.push(orchestrator);

  // Orquestrador como agente padrão: `opencode` puro já entra nele. Só define se o
  // usuário não escolheu outro default.
  if (agents.some((a) => a.slug === 'orchestrator')) {
    const cfg = mergeJsonConfig(baseDir, 'opencode.json', (c) => {
      let changed = false;
      if (!c.$schema) { c.$schema = 'https://opencode.ai/config.json'; changed = true; }
      if (!c.default_agent) { c.default_agent = 'orchestrator'; changed = true; }
      return changed;
    });
    if (cfg) created.push(cfg);
  }

  for (const agent of agents) {
    const rel = writeIfAbsent(baseDir, `.opencode/agent/${agent.slug}.md`, opencodeAgentTemplate(agent));
    if (rel) created.push(rel);
  }

  return created;
}

/* ------------------------------------------------------------------ */
/* Antigravity (Google / AGY)                                         */
/* ------------------------------------------------------------------ */

/**
 * Contrato do Antigravity CLI (`agy`), conferido empiricamente no agy 1.5.12:
 *
 * - Agentes só são descobertos em `.agents/agents/<nome>.md` (workspace), em
 *   `~/.gemini/config/agents/` (global) e em `<plugin>/agents/`. `.gemini/agents/`
 *   e qualquer pasta `subagents/` NÃO são lidas: especialista lá é invisível
 *   para `invoke_subagent`, e o orquestrador acaba fazendo tudo sozinho.
 * - `tools:` é allowlist. Nome inexistente é descartado em silêncio (ou trava o
 *   subagente). Os nomes reais são os de AGY_TOOLS abaixo; `grep_search` e
 *   `find_by_name` não existem no agy (busca é via `run_command`).
 * - `mainAgent: false` esconde o especialista do seletor `/agents` sem impedir
 *   que o orquestrador o invoque (`subagent: true`).
 * - `preloadSkills: [nome]` injeta o corpo da skill no contexto do agente. É o
 *   único jeito confiável de garantir uma skill: com muitos plugins globais a
 *   lista de skills estoura o budget e as excedentes ficam só com o nome.
 * - Regras em `.agents/rules/*.md` sem `trigger:` no frontmatter são descartadas
 *   em silêncio.
 * - `EnableWriteTools` não existe: escrita vem da allowlist `tools:`.
 */
const AGY_TOOLS_WORKER = ['read_file', 'write_file', 'edit_file', 'run_command', 'manage_task', 'search_web'];
const AGY_TOOLS_ORCHESTRATOR = [
  ...AGY_TOOLS_WORKER,
  'ask_question',
  'define_subagent',
  'invoke_subagent',
  'manage_subagents',
  'send_message',
];

/** Skill primária pré-carregada por especialista: a que define o "como fazer" do papel. */
const AGY_PRIMARY_SKILL: Record<string, string> = {
  orchestrator: 'find-skills',
  'senior-engineer': 'agentic-coding',
  'bug-hunter': 'systematic-debugging',
  security: 'security-swarm-audit',
  qa: 'testing-automation',
  architect: 'software-architect',
  'form-engineer': 'web-forms',
  animation: 'emil-kowalski',
  database: 'data-engineering',
  devops: 'cloud-infra',
  docs: 'technical-writer',
  researcher: 'deep-research',
  discovery: 'brainstorming',
  'product-reasoner': 'grilling',
  pm: 'project-manager',
  evaluator: 'evaluation',
  techlead: 'senior-code-reviewer',
  'adversarial-critic': 'adversarial-critique',
  professor: 'professor-modo',
  'ai-engineer': 'ai-agent',
  'automation-engineer': 'automation-engineer',
  'skill-architect': 'find-skills',
  'agent-architect': 'task-playbook',
};

/** Arquivos que versões anteriores do export geravam em lugares que o agy não lê. */
const AGY_LEGACY_GENERATED = [
  '.gemini/agents',
  '.gemini/subagents',
  '.gemini/commands/agents.toml',
  '.gemini/commands/orchestrator.toml',
  'commands/agents.toml',
  'commands/orchestrator.toml',
  '.agents/skills/orchestrator/SKILL.md',
  '.agents/plugins/izanagi/subagents',
  '.agents/plugins/izanagi/commands/agents.toml',
  '.agents/plugins/izanagi/commands/orchestrator.toml',
  '.agents/plugins/izanagi/skills/orchestrator/SKILL.md',
];

/** Remove um arquivo (ou os .md/.toml de uma pasta) SOMENTE se carregar o marcador de gerado. */
function removeGeneratedLegacy(baseDir: string, rel: string): string[] {
  const removed: string[] = [];
  const abs = path.join(baseDir, rel);
  if (!fs.existsSync(abs)) return removed;
  const tryRemove = (file: string, relFile: string): void => {
    try {
      if (fs.readFileSync(file, 'utf-8').includes(GENERATED_MARKER)) {
        fs.unlinkSync(file);
        removed.push(relFile);
      }
    } catch { /* arquivo do usuário ou ilegível: preserva */ }
  };
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    tryRemove(abs, rel);
  } else if (stat.isDirectory()) {
    for (const f of fs.readdirSync(abs)) {
      if (f.endsWith('.md') || f.endsWith('.toml')) tryRemove(path.join(abs, f), `${rel}/${f}`);
    }
  }
  // Remove a pasta (e pais vazios dentro do legado) se ficou vazia.
  let dir = stat.isFile() ? path.dirname(abs) : abs;
  while (dir.startsWith(baseDir) && dir !== baseDir) {
    try {
      if (fs.readdirSync(dir).length > 0) break;
      fs.rmdirSync(dir);
    } catch { break; }
    dir = path.dirname(dir);
  }
  return removed;
}

function skillExists(sourceDir: string, name: string): boolean {
  return (
    fs.existsSync(path.join(sourceDir, '.skills', name, 'SKILL.md')) ||
    fs.existsSync(path.join(sourceDir, 'skills', name, 'SKILL.md'))
  );
}

function agyPreload(sourceDir: string, a: IzanagiAgentInfo): string[] {
  const out: string[] = [];
  const primary = AGY_PRIMARY_SKILL[a.slug];
  if (primary && skillExists(sourceDir, primary)) out.push(primary);
  if (out.length === 0) {
    const first = a.skills.find((s) => skillExists(sourceDir, s));
    if (first) out.push(first);
  }
  return out;
}

/**
 * JSON não comporta o marcador de gerado, então `writeIfAbsent` nunca o atualizaria.
 * Escreve se o arquivo não existe ou se `isOurs` reconhece o conteúdo atual como
 * gerado pelo Izanagi; JSON inválido ou de outro dono é preservado.
 */
function writeJsonIfOurs(
  baseDir: string,
  rel: string,
  value: unknown,
  isOurs: (current: unknown) => boolean
): string | null {
  const abs = path.join(baseDir, rel);
  if (fs.existsSync(abs)) {
    try {
      if (!isOurs(JSON.parse(fs.readFileSync(abs, 'utf-8')))) return null;
    } catch {
      return null;
    }
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(value, null, 2), 'utf-8');
  return rel;
}

/**
 * Injeta o modo padrão (orquestrador + skills + references) no documento sempre
 * carregado de cada CLI, antes do rodapé de proveniência quando houver um.
 */
function withDefaultMode(doc: string): string {
  if (doc.includes('## Modo padrão: Orquestrador do Izanagi')) return doc;
  const lines = doc.trimEnd().split('\n');
  const footerIdx = lines.map((l, i) => (l.includes(GENERATED_MARKER) ? i : -1)).filter((i) => i >= 0).pop();
  if (footerIdx === undefined) return `${doc.trimEnd()}\n\n${DEFAULT_ORCHESTRATOR_MODE}\n`;
  const before = lines.slice(0, footerIdx).join('\n').trimEnd();
  const after = lines.slice(footerIdx).join('\n');
  return `${before}\n\n${DEFAULT_ORCHESTRATOR_MODE}\n\n${after}\n`;
}

/**
 * Mescla chaves num JSON de configuração da CLI sem apagar as do usuário.
 * `apply` recebe o objeto atual e devolve true se mudou algo. JSON inválido é
 * preservado (nunca sobrescreve configuração que não consegue ler).
 */
function mergeJsonConfig(baseDir: string, rel: string, apply: (cfg: Record<string, unknown>) => boolean): string | null {
  const abs = path.join(baseDir, rel);
  let cfg: Record<string, unknown> = {};
  if (fs.existsSync(abs)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(abs, 'utf-8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      cfg = parsed;
    } catch {
      return null;
    }
  }
  if (!apply(cfg)) return null;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(cfg, null, 2)}\n`, 'utf-8');
  return rel;
}

/**
 * O catálogo v2 (`.skills/`) guarda referências em `references/references.md`, mas o
 * corpo das skills diz "references.md nesta pasta". Nas cópias distribuídas (biblioteca
 * do plugin, catálogo global) o arquivo também vai para a raiz da skill.
 */
export function flattenReferences(catalogRoot: string): number {
  if (!fs.existsSync(catalogRoot)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(catalogRoot)) {
    const nested = path.join(catalogRoot, name, 'references', 'references.md');
    const flat = path.join(catalogRoot, name, 'references.md');
    if (fs.existsSync(nested) && !fs.existsSync(flat)) {
      fs.copyFileSync(nested, flat);
      n++;
    }
  }
  return n;
}

/** Extrai o corpo de uma seção `## <heading>` de uma skill da fonte (uma fonte da verdade só). */
function skillSection(sourceDir: string, name: string, heading: string): string {
  for (const dir of ['.skills', 'skills']) {
    const file = path.join(sourceDir, dir, name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n');
    const start = text.indexOf(`## ${heading}`);
    if (start < 0) return '';
    const after = text.indexOf('\n## ', start + 3);
    return text.slice(text.indexOf('\n', start) + 1, after < 0 ? undefined : after).trim();
  }
  return '';
}

function yamlList(items: string[]): string {
  return `[${items.join(', ')}]`;
}

function antigravityCoreRuleTemplate(): string {
  return `---
trigger: always_on
---

# Izanagi AI: regras do workspace

- **Você executa.** Pedido de implementação termina com arquivos alterados (\`write_file\`/\`edit_file\`) e verificação rodada (\`run_command\`), não com explicação no chat.
- **Skills se leem, não se listam.** Antes de tarefa não trivial, escolha 1 a 3 skills (skill \`find-skills\`), leia o \`SKILL.md\` de cada uma em \`.skills/<nome>/\`, \`.agents/skills/<nome>/\` ou \`~/.gemini/config/plugins/izanagi/library/<nome>/\`, e declare numa linha o que vai aplicar.
- **Você é o Orquestrador do Izanagi por padrão.** O agy não tem configuração de agente padrão, então esta regra vale para qualquer sessão, com ou sem \`--agent orchestrator\`: siga o protocolo do agente \`orchestrator\` (leia no primeiro pedido da sessão o primeiro que existir: \`.agents/agents/orchestrator.md\` no projeto ou \`~/.gemini/config/plugins/izanagi/agents/orchestrator.md\` na instalação global).
- **Especialistas são subagentes reais.** Estão em \`.agents/agents/\`. Delegue com \`invoke_subagent\` quando a frente for especializada ou paralela; faça você mesmo quando for pequena.
- **Referências das skills.** Se a pasta da skill tiver \`references.md\` (ou \`references/references.md\`), leia quando a skill citar ou precisar de exemplo, receita ou direção visual. Landing/site: \`signature-experience/references.md\` é obrigatório.
- **Plano antes de código grande.** Mais de 3 arquivos ou decisão estrutural: \`grilling\` e \`plan-cold-review\` antes de codar.
- **Zero stub.** Sem \`TODO: implement\`, sem mock fingindo implementação.
- **Economia de contexto.** Leia por busca (\`run_command\` com \`rg\`/\`grep\`), não arquivo inteiro sem motivo; consulte \`.agents/memoria/mapa.md\` se existir.
- **Anti-genérico.** UI com identidade própria; rode \`anti-ai-slop\` antes de entregar.
- **Segurança.** Sem segredo no código; ação com dinheiro, cliente ou deleção pede confirmação.

${provenanceFooter('antigravity')}
`;
}

function antigravityOrchestratorAgentTemplate(
  sourceDir: string,
  orch: IzanagiAgentInfo,
  specialists: IzanagiAgentInfo[]
): string {
  const roster = specialists
    .map((s) => {
      const trigger = CLAUDE_AGENT_TRIGGERS[s.slug] ?? s.role;
      return `- \`${s.slug}\`: ${truncate(trigger, 150)}`;
    })
    .join('\n');
  const routing = skillSection(sourceDir, 'find-skills', 'Tabela de roteamento');

  return `---
name: orchestrator
description: Izanagi Orchestrator. Ponto de entrada principal, planeja, implementa direto nos arquivos e delega frentes especializadas aos subagentes do Izanagi.
mainAgent: true
subagent: false
model: inherit
tools: ${yamlList(AGY_TOOLS_ORCHESTRATOR)}
---

# Izanagi Orchestrator

Você é o líder técnico do Izanagi AI dentro do Antigravity. Você **entrega trabalho feito nos arquivos**, não respostas de chatbot.

## Como decidir cada pedido

1. **Pequeno e claro** (1 ou 2 arquivos, intenção óbvia): faça você mesmo, agora. Leia, edite, rode a verificação.
2. **Especializado** (segurança, banco, animação, infra, debug difícil...): \`invoke_subagent\` com o especialista da lista abaixo, passando objetivo, arquivos relevantes e critério de pronto.
3. **Frentes independentes** (ex.: API + UI + testes): despache os especialistas em paralelo; enquanto rodam, faça a parte que é sua.
4. **Vago ou grande** (feature nova, mais de 3 arquivos, decisão estrutural): skill \`grilling\` com o usuário, plano em arquivo, \`plan-cold-review\`, depois implementação.

Antes de encerrar o turno, colete o resultado de todo subagente despachado (\`manage_subagents\`), confira os arquivos que eles alteraram e rode build/teste. Nunca termine o turno só com subagentes "em andamento".

${SUBAGENT_BRIEF_FORMAT}

## Skills

Escolha 1 a 3 skills por tarefa pela tabela abaixo e **leia** cada uma com \`read_file\` no primeiro caminho que existir: \`.skills/<nome>/SKILL.md\`, \`.agents/skills/<nome>/SKILL.md\` ou, fora de projeto com Izanagi, \`~/.gemini/config/plugins/izanagi/library/<nome>/SKILL.md\`. Leia antes de aplicar. Leia pelo caminho: a lista de skills da sessão pode vir cortada pelo limite de contexto quando há muitos plugins instalados. Ao delegar, diga ao especialista quais skills ler.
${routing ? `\n${routing}\n` : ''}

## Especialistas (subagentes em \`.agents/agents/\`)

${roster}

## Entrega

Termine com: o que mudou (arquivos), como foi verificado (comando e resultado) e o que ficou pendente. Resultado de teste se reporta como saiu, inclusive falha.

> Fonte: \`agents/${orch.file}\` · ${provenanceFooter('antigravity')}
`;
}

function antigravitySpecialistTemplate(sourceDir: string, a: IzanagiAgentInfo): string {
  const trigger = CLAUDE_AGENT_TRIGGERS[a.slug] ?? `Use para tarefas de ${(a.role || a.name).toLowerCase()}.`;
  const preload = agyPreload(sourceDir, a);
  const skills = a.skills.filter((s) => skillExists(sourceDir, s));
  const skillLines = skills.length > 0
    ? skills.map((s) => `- \`${s}\``).join('\n')
    : '- (sem skills declaradas)';

  return `---
name: ${a.slug}
description: ${JSON.stringify(truncate(`${a.name}. ${trigger}`, 220))}
mainAgent: false
subagent: true
model: inherit
tools: ${yamlList(AGY_TOOLS_WORKER)}
${preload.length > 0 ? `preloadSkills: ${yamlList(preload)}\n` : ''}---

# ${a.name}

**Papel:** ${a.role}

${a.identity || a.role}

## Como trabalhar

- Você foi chamado pelo orquestrador para uma frente específica. Execute nos arquivos (\`write_file\`, \`edit_file\`) e verifique (\`run_command\`); não devolva só recomendação, a menos que o pedido seja revisão.
- Antes de codar, leia com \`read_file\` a sua skill primária${preload.length > 0 ? ` (\`${preload[0]}\`)` : ''} e no máximo mais 2 da sua lista que casem com a tarefa, no primeiro caminho que existir: \`.skills/<nome>/SKILL.md\`, \`.agents/skills/<nome>/SKILL.md\` ou \`~/.gemini/config/plugins/izanagi/library/<nome>/SKILL.md\`. Leia pelo caminho mesmo que a skill não apareça na sua lista de skills (ela pode ter sido cortada pelo limite de contexto). Se a pasta da skill tiver \`references.md\` (ou \`references/references.md\`), leia-o quando a skill citar ou quando precisar de exemplo, receita de código ou direção visual.
- Ao terminar, devolva: arquivos alterados, verificação rodada com resultado, pendências.

## Sempre

${a.always.length > 0 ? bullet(a.always, 8) : '- Seguir as convenções do projeto'}

## Nunca

${a.never.length > 0 ? bullet(a.never, 8) : '- Entregar stub ou código não verificado'}

## Suas skills

${skillLines}

> Fonte: \`agents/${a.file}\` · ${provenanceFooter('antigravity')}
`;
}

function antigravityAgentsSkillTemplate(): string {
  return `---
name: agents
description: Izanagi Orchestrator. Decompõe o pedido, implementa direto nos arquivos e delega frentes especializadas aos subagentes do Izanagi.
---

# /agents: Izanagi Orchestrator

Atue como o agente \`orchestrator\` do Izanagi (\`.agents/agents/orchestrator.md\` no projeto ou \`~/.gemini/config/plugins/izanagi/agents/orchestrator.md\` global): leia esse arquivo e siga o protocolo dele para o pedido do usuário. Para abrir a sessão já como orquestrador: \`agy --agent orchestrator\`.

> ${provenanceFooter('antigravity')}
`;
}

function antigravityGeminiMdTemplate(): string {
  return `# Izanagi AI (Antigravity)

Este projeto usa o Izanagi AI. Agente principal: \`orchestrator\` (\`agy --agent orchestrator\` ou \`/agents\`). Os especialistas são subagentes em \`.agents/agents/\` e o orquestrador os invoca com \`invoke_subagent\`.

Regras do workspace: \`.agents/rules/izanagi-core.md\`. Catálogo de skills: \`.skills/\` (ou \`.agents/skills/\`); escolha com a skill \`find-skills\`.

${provenanceFooter('antigravity')}
`;
}

export function exportToAntigravity(baseDir: string): string[] {
  const created: string[] = [];
  const source = resolveSourceDir(baseDir);
  const agents = loadIzanagiAgents(source);
  if (agents.length === 0) return created;
  const orchestrator = agents.find((a) => a.slug === 'orchestrator') || agents[0];
  const specialists = agents.filter((a) => a !== orchestrator);
  const push = (rel: string | null): void => { if (rel) created.push(rel); };

  // 0. Limpeza: o que versões anteriores geravam em lugares que o agy não lê, ou em duplicata.
  for (const rel of AGY_LEGACY_GENERATED) removeGeneratedLegacy(baseDir, rel);
  for (const a of agents) removeGeneratedLegacy(baseDir, `.agents/skills/izanagi-${a.slug}/SKILL.md`);

  // 1. skills.json: aponta para UM catálogo só. `skills/` e `.skills/` juntos duplicavam
  //    ~120 skills e empurravam as do Izanagi para fora do budget de contexto.
  const catalog = fs.existsSync(path.join(baseDir, '.skills'))
    ? '.skills'
    : fs.existsSync(path.join(baseDir, 'skills'))
      ? 'skills'
      : null;
  if (catalog) {
    // Reconhece o formato que versões anteriores emitiam (só `skills`/`.skills`).
    // Qualquer outra entrada é do usuário e preserva o arquivo.
    push(writeJsonIfOurs(baseDir, '.agents/skills.json', { entries: [{ path: catalog }] }, (cur) => {
      const entries = (cur as { entries?: Array<{ path?: string }> }).entries;
      return Array.isArray(entries) && entries.every((e) => e && (e.path === 'skills' || e.path === '.skills'));
    }));
  }

  // 2. GEMINI.md curto (é carregado em toda sessão: cada linha custa token sempre).
  push(writeIfAbsent(baseDir, 'GEMINI.md', withDefaultMode(antigravityGeminiMdTemplate())));

  // 3. Regra do workspace com `trigger: always_on` (sem trigger o agy descarta a regra).
  push(writeIfAbsent(baseDir, '.agents/rules/izanagi-core.md', antigravityCoreRuleTemplate()));

  // 4. Agentes nativos: orquestrador como principal, especialistas como subagentes invocáveis.
  const orchMd = antigravityOrchestratorAgentTemplate(source, orchestrator, specialists);
  push(writeIfAbsent(baseDir, '.agents/agents/orchestrator.md', orchMd));
  const specialistMd = new Map<string, string>();
  for (const s of specialists) {
    const md = antigravitySpecialistTemplate(source, s);
    specialistMd.set(s.slug, md);
    push(writeIfAbsent(baseDir, `.agents/agents/${s.slug}.md`, md));
  }

  // 5. Skill /agents (vira slash command no agy).
  push(writeIfAbsent(baseDir, '.agents/skills/agents/SKILL.md', antigravityAgentsSkillTemplate()));

  // 6. Plugin distribuível (`agy plugin install .agents/plugins/izanagi`): mesmo conteúdo,
  //    para quem quer o Izanagi em todo projeto sem export por workspace.
  let version = '1.0.0';
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    if (fs.existsSync(pkgPath)) version = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version || version;
  } catch { /* mantém o default */ }
  push(writeJsonIfOurs(
    baseDir,
    '.agents/plugins/izanagi/plugin.json',
    {
      name: 'izanagi',
      version,
      description: 'Izanagi AI: orquestrador e especialistas com skills de engenharia de software',
    },
    (cur) => (cur as { name?: string }).name === 'izanagi'
  ));
  // Biblioteca de skills dentro do plugin, FORA de `skills/`: o agy copia a pasta na
  // instalação mas não a lista no contexto (custo zero de budget). Os agentes leem por
  // caminho quando o projeto não tem `.skills/` nem `.agents/skills/`. Só a fonte do
  // framework gera a biblioteca; projeto consumidor já tem o catálogo em `.agents/skills/`.
  const catalogDir = path.join(baseDir, '.skills');
  if (fs.existsSync(catalogDir) && fs.existsSync(path.join(baseDir, 'agents'))) {
    const libRoot = path.join(baseDir, '.agents', 'plugins', 'izanagi', 'library');
    fs.rmSync(libRoot, { recursive: true, force: true });
    fs.cpSync(catalogDir, libRoot, { recursive: true });
    flattenReferences(libRoot);
    created.push('.agents/plugins/izanagi/library/');
  }
  push(writeIfAbsent(baseDir, '.agents/plugins/izanagi/rules/AGENTS.md', antigravityCoreRuleTemplate()));
  push(writeIfAbsent(baseDir, '.agents/plugins/izanagi/skills/agents/SKILL.md', antigravityAgentsSkillTemplate()));
  push(writeIfAbsent(baseDir, '.agents/plugins/izanagi/agents/orchestrator.md', orchMd));
  for (const s of specialists) {
    push(writeIfAbsent(baseDir, `.agents/plugins/izanagi/agents/${s.slug}.md`, specialistMd.get(s.slug)!));
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
  created.push(...exportToAntigravity(baseDir));
  return created;
}

