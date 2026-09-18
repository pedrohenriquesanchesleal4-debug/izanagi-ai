# Referências — Model Routing por Agente nas CLIs de IA (2026)

> Documenta a pergunta: "posso delegar MODELOS DIFERENTES por agente/papel para não esgotar a cota de um modelo só?"
> Resposta curta: **sim, em 5 das 6 ferramentas principais** — com graus diferentes de controle. Verificado contra docs oficiais em 2026-09-18.
> Regras Izanagi: depois de qualquer uso, atualizar esta tabela se algo mudar (modelos/marcas mudam rápido — foto de 2026-09-18).

## Tabela comparativa

| Ferramenta | Rótulo | Como funciona | Fonte |
|---|---|---|---|
| OpenCode | **SUPORTA** | `agent` config em `opencode.json`: propriedade `model` por agente (`provider/model-id`) + `mode` (`primary|subagent|all`), `temperature`, permissões. Subagente sem `model` herda o do primário. Múltiplos providers configuráveis (anthropic/openai/google) | https://opencode.ai/docs/agents · https://opencode.ai/docs/providers |
| Claude Code | **SUPORTA** | frontmatter `model:` em `.claude/agents/*.md` (alias `opus/sonnet/haiku/fable` ou ID completo, `inherit`); resolução: invocação > frontmatter > `CLAUDE_CODE_SUBAGENT_MODEL` > modelo da conversa; `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` trava | https://code.claude.com/docs/en/subagents · https://code.claude.com/docs/en/model-config |
| Cursor | **SUPORTA** | `.cursor/agents/*.md` frontmatter `model:` — `inherit` ou ID específico (`composer-2`, `gpt-5.6-sol`, `claude-opus-5`) com params `[effort=high,context=300k]`; built-in `explore` já usa modelo mais rápido (routing por papel) | https://cursor.com/docs/agent/subagents · https://docs.cursor.com/en/models |
| Codex (OpenAI) | **SUPORTA** | subagents TOML em `~/.codex/agents/*.toml` com `model` + `model_reasoning_effort`; default `[agents] default_subagent_model`; built-ins `default/worker/explorer` com modelos distintos | https://developers.openai.com/codex/subagents/ |
| GitHub Copilot | **SUPORTA** | custom agents YAML com `model` no frontmatter (ausente = herda default); catálogo multi-modelo por cliente (Chat/CLI/cloud agent) com seleção `Auto` e fallback LTS | https://docs.github.com/en/copilot/reference/custom-agents-configuration · https://docs.github.com/en/copilot/reference/ai-models/supported-models |
| Antigravity (Google) | **LIMITADO** | subagente custom aceita `model:` somente como tier `inherit / flash / pro` (modelo arbitrário por agente NÃO documentado publicamente); seletor de reasoning model por conversa (Gemini 3.x, Claude Sonnet 4.6/Opus 4.6 thinking, GPT-OSS-120b) | https://antigravity.google/docs/models · https://antigravity.google/docs/subagents/ |

## Padrão recomendado (anti-cota-única)

1. **Pin por papel, não por ferramenta**: orquestrador/planejador em premium, especialistas em balanced, verificação/extração/QA em fast — é exatamente o `Model Router` do Izanagi (`src/runtime/model/router.ts`, `routeForRole`, pin via `roles` na config ou `IZANAGI_MODEL_{COMMANDER,SPECIALIST,WORKER}`).
2. **Fallback explícito**: todo papel define um modelo barato de fallback para quando o premium estiver indisponível/rate-limited (não morre a tarefa por cota).
3. **Múltiplos providers** (OpenCode/Claude Code): distribuir o volume entre providers distintos também dilui cota (ex: análise em Anthropic, geração em Google/OpenAI).
4. **Antigravity**: usar tiers por subagente (`flash` para varredura, `pro` para execução) — o controle arbitrário por modelo não é público hoje; não depender disso.

## Como usar no Izanagi

- **Configurar CLI do usuário**: aplicar o padrão acima no `opencode.json`/`.claude/settings.json` correspondente (só o adaptador da CLI em uso — `izanagi export --cli <cli>` regenera sob demanda).
- **Runtime do framework**: model routing já é nativo (roles/tiers + hint por agente no genome JSON); a configuração por CLI complementa/externaliza o mesmo princípio.
- **Antes de mudar modelos**: conferir datas de "foto" desta tabela e validar no doc oficial (links acima).