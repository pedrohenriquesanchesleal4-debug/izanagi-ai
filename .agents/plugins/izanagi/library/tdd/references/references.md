# TDD — Referências

Curadoria da skill TDD do framework Superpowers.

## Fonte principal

- **Repositório**: https://github.com/obra/superpowers — 264k+ stars, MIT
- **Skill original**: `skills/test-driven-development/SKILL.md`
- **Auxiliar**: `skills/test-driven-development/writing-good-tests.md` — regras para testes honestos (nomeie a mudança de produção que faria o teste falhar; asserts em comportamento real; helpers só em código de teste...) — **portado localmente em `references/writing-good-tests.md`**

## Aproveitado no Izanagi

1. **Iron Law**: nenhum código de produção sem teste falhando primeiro.
2. **Trilogia RED→GREEN→REFACTOR** com verificação obrigatória em cada etapa.
3. **Tabela anti-racionalização** (todo "pulo no TDD" tem desculpa mapeada → deletar e recomeçar).
4. **Verification checklist** objetivo para declarar pronto.
5. **TDD para bugfix**: teste que reproduz o bug primeiro.

## Contexto do framework

- No Izanagi, `tdd` complementa as skills de testing de `skills/` (unit-test, integration-test, e2e-test via resolver em `testing/`) e `qa`.
- Diferentemente das skills de "como testar", `tdd` é a *disciplina de processo* (quando e em que ordem).
- Chains: usar `tdd` em `new_feature` / `bug` / `refactor` antes das skills de implementação.