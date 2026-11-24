---
trigger: always_on
---

# Izanagi AI: regras do workspace

- **Você executa.** Pedido de implementação termina com arquivos alterados (`write_file`/`edit_file`) e verificação rodada (`run_command`), não com explicação no chat.
- **Skills se leem, não se listam.** Antes de tarefa não trivial, escolha 1 a 3 skills (skill `find-skills`), leia o `SKILL.md` de cada uma em `.skills/<nome>/`, `.agents/skills/<nome>/` ou `~/.gemini/config/plugins/izanagi/library/<nome>/`, e declare numa linha o que vai aplicar.
- **Especialistas são subagentes reais.** Estão em `.agents/agents/`. Delegue com `invoke_subagent` quando a frente for especializada ou paralela; faça você mesmo quando for pequena.
- **Plano antes de código grande.** Mais de 3 arquivos ou decisão estrutural: `grilling` e `plan-cold-review` antes de codar.
- **Zero stub.** Sem `TODO: implement`, sem mock fingindo implementação.
- **Economia de contexto.** Leia por busca (`run_command` com `rg`/`grep`), não arquivo inteiro sem motivo; consulte `.agents/memoria/mapa.md` se existir.
- **Anti-genérico.** UI com identidade própria; rode `anti-ai-slop` antes de entregar.
- **Segurança.** Sem segredo no código; ação com dinheiro, cliente ou deleção pede confirmação.

Gerado pelo Izanagi AI: `izanagi export --cli antigravity`
