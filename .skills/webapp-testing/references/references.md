# Webapp Testing — Referências

Curadoria de automação de testes web com navegador.

## Fonte principal

- **Índice**: https://github.com/ComposioHQ/awesome-claude-skills — 66k stars, maior lista curada de Claude Skills
- **Skill original**: `webapp-testing/` no repo (scripts Python `with_server.py`, `element_discovery.py`, exemplos) — **portados localmente em `examples/`** (paths de saída adaptados para `outputs/` do projeto)
- **Playwright**: https://playwright.dev/docs/intro — docs oficiais (Node, Python, .NET, Java)

## O que aproveitar no Izanagi

1. **Árvore de decisão** estático/dinâmico + reconhecimento-ante-ação.
2. **networkidle obrigatório** antes de inspecionar SPAs.
3. **Scripts como caixa-preta**: `--help` primeiro, nunca ler fonte completo (economiza contexto).
4. Seletores semânticos (role/text/data-testid) em vez de CSS frágil.

## Skills relacionadas no Izanagi

| Skill | Complemento |
|-------|-------------|
| `tdd` | disciplina RED→GREEN; webapp-testing cobre o teste E2E "de verdade" no browser |
| `qa-checklist` (`qa`) | lista de validação de qualidade (a11y, perf, responsividade) que o teste pode automatizar |
| `web-perf-seo` | Lighthouse + core web vitals que complementam os checks de UI |

## Uso típico

- Validação pós-merge / pré-deploy de páginas críticas (fluxos de compra, login, forms).
- Debug de comportamento: screenshot + console logs (script `console_logging.py` no repo original).
- Regressão visual simples: comparar screenshots antes/depois de mudança CSS.