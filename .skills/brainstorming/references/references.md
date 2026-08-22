# Brainstorming — Referências

Curadoria do método de brainstorming do framework Superpowers (obra/superpowers).

## Fonte principal

- **Repositório**: https://github.com/obra/superpowers — 264k+ stars, 23k+ forks, MIT
- **Skill original**: `skills/brainstorming/SKILL.md` no repo
- **Docs**: https://blog.fsck.com/2025/10/09/superpowers/ (release announcement do método)

## O que aproveitar no Izanagi

1. **HARD-GATE** — proibição absoluta de implementar antes de design aprovado; aplica-se a todo projeto, inclusive "simples".
1b. **Triagem em 3 trilhas** (verificado no SKILL.md original, 2026): **Spike** (pergunta de viabilidade → só um relatório, não vira código mantido), **Bounded** (mudança bem delimitada em código existente → design curto no chat, sem doc separado), **Architectural** (subsistema/reestruturação → processo completo + spec escrita). Regra: "quando em dúvida, trilha mais pesada"; complexidade oculta descoberta no meio da tarefa faz upgrade de trilha. Só a trilha Architectural aprovada invoca a skill de planejamento (`writing-plans`) — nenhuma outra skill de implementação antes.
2. **Entrevista 1-pergunta-por-vez** com foco em propósito/restrição/sucesso.
3. **2-3 abordagens com trade-offs**, recomendação primeiro.
4. **Design em seções** com aprovação incremental.
5. **Design doc versionado** + auto-revisão (placeholder/contradição/ambiguidade/escopo).
6. **User review gate** antes de planejar implementação.
7. **Decomposição de multi-subsistemas** antes de detalhar.

## Skills relacionadas do Superpowers (relevantes para o Izanagi)

| Skill | Uso |
|-------|-----|
| `test-driven-development` | RED→GREEN→REFACTOR com "Iron Law" (não-código-sem-teste-falhando) — portada como skill `tdd` no Izanagi |
| `systematic-debugging` | Debug por hipótese antes de corrigir — sobrepõe `debug-specialist`/`root-cause-analyzer` do Izanagi |
| `writing-plans` | Plano de implementação claro o suficiente para júnior seguir — sobrepõe `task-planner` |
| `using-git-worktrees` | Isolamento de branch com worktrees — padrão opcional para devops |
| `subagent-driven-development` | Delegar tarefas a subagentes com revisão — ecoa o modo Swarm do orquestrador |

## Discovery de produto (entrevista dirigida a evidência)

- **Teresa Torres — Continuous Discovery Habits** (livro; https://www.producttalk.org/): 5 hábitos — (1) entrevistar ≥1 cliente/semana, (2) mapear oportunidades em uma **Opportunity Solution Tree** (outcome → oportunidades → soluções → testes de suposição), (3) testar suposições antes de construir, (4) rodar experimentos pequenos continuamente, (5) trio de produto (PM + design + engenharia) junto na descoberta — não repassado via relatório de pesquisa.
- Aplicação no Izanagi: usar a árvore de oportunidades como checklist mental na Fase 2 (perguntas 6-10) para não pular de "dor" direto para "feature" sem validar a oportunidade.

## Onde instalar (caso queira o pacote completo)

- Claude Code: `/plugin install superpowers@claude-plugins-official`
- OpenCode: `Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md`
- Direto: `git clone https://github.com/obra/superpowers.git`