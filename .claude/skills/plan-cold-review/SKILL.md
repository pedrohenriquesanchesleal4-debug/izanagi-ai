---
name: plan-cold-review
description: "Revisão fria de plano. Use depois de escrever um plano e antes de implementar qualquer coisa de mais de…"
---

# Plan Cold Review: o plano tem que se explicar sozinho

Quem escreveu o plano sabe o que quis dizer. O código vai ser escrito a partir do que está escrito. A distância entre os dois é onde nascem os bugs de entendimento. O revisor frio mede essa distância porque ele só tem o texto.

## Quando usar

- Depois de `grilling` ou de qualquer plano com mais de 3 passos.
- Antes de despachar implementação para outro agente (o outro agente também é "frio").

**Pule** para mudanças de um arquivo com intenção óbvia.

## Protocolo

1. **Escreva o plano em arquivo** (`.agents/plans/<slug>.md` ou o caminho que o projeto usar). Plano que só existe no chat não pode ser revisado frio.
2. **Despache um revisor sem histórico.** Um subagente novo (Claude Code: Agent tool; Antigravity: `invoke_subagent`; Codex/Opencode: subagent equivalente) recebendo **apenas** o caminho do plano e esta instrução:
   > Leia o plano. Você não sabe nada além dele. Liste: (a) termos usados sem definição, (b) passos que dependem de decisão não registrada, (c) arquivos ou APIs citados que você não conseguiria localizar, (d) critério de pronto ausente ou não verificável. Responda só a lista, no máximo 10 itens, mais grave primeiro.
3. **Corrija o plano, não a conversa.** Cada item vira edição no arquivo. Se um item é falso positivo, anote no plano o porquê (o próximo leitor terá a mesma dúvida).
4. **Repita no máximo 2 vezes.** Se depois de 2 rodadas ainda há item grave, o problema é de requisito: volte para `grilling` ou pergunte ao usuário.
5. **Aprovação explícita.** Mostre ao usuário o plano final e os itens resolvidos. Só implemente depois do "pode seguir", exceto se o usuário já autorizou seguir direto.

## O que o revisor NÃO faz

- Não opina sobre estilo de código nem propõe arquitetura nova.
- Não reescreve o plano.
- Não pede contexto da conversa: se precisaria dele, isso já é um item da lista.

## Sem suporte a subagente

Se a CLI não tiver subagente, simule: salve o plano, limpe da sua atenção o histórico e releia o arquivo como se fosse a primeira vez, respondendo a mesma lista (a)-(d). É mais fraco, mas ainda pega termos sem definição.

> Gerado pelo Izanagi AI: cópia fiel de `skills/plan-cold-review/SKILL.md` (fonte da verdade).
