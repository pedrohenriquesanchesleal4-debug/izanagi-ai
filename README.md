# Izanagi AI

Framework **meta** modular e skill-oriented para engenharia de software autônoma orientada a agentes: routing → orquestração → avaliação → healing → memória, com 18 agentes especializados, 212 skills e uma CLI executável publicada no npm (`izanagi-ai`).

> **Filosofia:** Arquitetura primeiro. Código depois. Qualidade medida. Evolução contínua. Zero "cara de IA".

---

## Instalação

```bash
npm install -g izanagi-ai    # instalação global
npx izanagi <comando>        # ou execução direta sem instalar
izanagi --version
```

> O pacote é publicado como `izanagi-ai`; bins: `izanagi` e `izanagi-ai`.

---

## Comandos Principais da CLI

| Comando | Descrição |
|---|---|
| `izanagi init [dir] [--packs a,b,c]` | Cria projeto com `.agents/` e seleção de packs de skills. |
| `izanagi run [agent] --task "<task>"` | Analisa a tarefa, seleciona o agente ideal e resolve a cadeia de skills. |
| `izanagi create <agent\|skill> <name>` | Cria scaffold de agente (JSON) ou skill (SKILL.md). |
| `izanagi compile <agente> [arquivo]` | Compila um System Prompt completo do agente + fundação do sistema. |
| `izanagi list [skills\|agents]` | Lista skills e agentes registrados com aliases. |
| `izanagi doctor` | Auditoria de integridade: SYSTEM/RULES, JSONs de agentes, aliases → targets. |
| `izanagi export --cli <cli>` | Regenera adapters multi-CLI (claude, codex, cursor, copilot, kimi, all). |
| `izanagi --version` | Exibe a versão da CLI. |

### Exemplos

```bash
izanagi run "Criar uma landing page de um SaaS de analytics"
izanagi run architect --task "Design a microservices architecture"
izanagi create skill meu-fluxo
izanagi compile architect prompt_arquiteto.md
izanagi list skills
izanagi doctor
```

---

## Estrutura do Repositório

```
izanagi-ai/
├── bin/             Executável da CLI (bin/izanagi.js → dist/cli)
├── src/             Runtime real em TypeScript (orchestrator, evaluation, resolver, scanner, tracer, llm, cli)
├── core/            Engines (.md) + skill-resolver.json (aliases → targets + compositions)
├── agents/          18 definições de agentes em JSON (fonte da verdade dos comandos)
├── skills/          212 skills em skills/<name>/SKILL.md (+ references.md opcional)
├── references/      Curadoria de referências reais por domínio (webgl-3d, scrollytelling, stack-2026...)
├── .agents/memoria/ Memória persistente anti-repetição (contexto, decisoes, erros-corrigidos, learnings)
├── .opencode/       Comandos slash do Opencode (adapters em .claude/, .codex/, .cursor/...)
├── AGENTS.md        Instruções de operação do framework
├── SYSTEM.md        Fundação do sistema (arquitetura real do runtime)
└── RULES.md         Regras operacionais (Anti-Generic High-Craft & Cinematic UI)
```

---

## Agentes e Skills

O framework possui **18 agentes especializados** (`/discovery`, `/architect`, `/senior-engineer`, `/techlead`, `/automation-engineer`, `/security`, `/devops`, `/database`, `/qa`, `/bug-hunter`, `/docs`, `/pm`, `/professor`, `/researcher`, `/evaluator`, `/adversarial-critic`, `/form-engineer`, `/animation`) e **212 skills** encadeadas por domínio via `compositions` do `core/skill-resolver.json` (248 aliases, 15 composições). Ver `AGENTS.md` para a tabela completa.

---

## Desenvolvimento

```bash
npm install       # instala dependências
npm run build     # tsc && regenera .manifest
npm run doctor    # auditoria de integridade
node --test dist/runtime/tests/*.test.js   # 122 testes do runtime
npm run verify    # build + teste de instalação em sandbox
```

> **Gotcha:** `dist/` é gitignored e `bin/izanagi.js` importa de `../dist/cli/index.js` — rode `npm run build` antes de qualquer comando CLI local.

### Publicando no NPM

```bash
npm run bump:patch   # ou bump:minor / bump:major
npm publish          # prepublishOnly roda o build automaticamente
```

---

## Licença

MIT — Use, modifique, distribua. Apenas mantenha os créditos.
