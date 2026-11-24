---
name: plan-cold-review
description: "Revisão fria de plano no padrão elefante e peixinhos: quem conversou com o usuário (elefante) escreve o plano em arquivo; 2 ou 3 revisores sem a conversa (peixinhos) leem só o arquivo e apontam o que ficou implícito, ambíguo ou faltando, passo a passo. Código só depois de aprovado. Use depois de escrever um plano e antes de implementar qualquer coisa de mais de um arquivo."
triggers:
  - "revisar plano antes de codar"
  - "plano de implementação pronto, falta validar"
  - "evitar que o agente codifique premissas não ditas"
capabilities:
  - "context-free-review"
  - "plan-gap-detection"
  - "approval-gate"
---

# Plan Cold Review: o plano tem que se explicar sozinho

Quem escreveu o plano sabe o que quis dizer. O código vai ser escrito a partir do que está escrito. A distância entre os dois é onde nascem os bugs de entendimento. Padrão popularizado pelo plugin `elephant-goldfish` do Google: o **elefante** lembra de tudo e escreve; os **peixinhos dourados** não lembram de nada e por isso enxergam o que não foi escrito.

## Quando usar

- Depois de `grilling` ou de qualquer plano com mais de 3 passos.
- Antes de despachar implementação para outro agente (o outro agente também é um peixinho).

**Pule** para mudanças de um arquivo com intenção óbvia.

## Protocolo

1. **Elefante escreve `design_draft.md`** (ou `.agents/plans/<slug>.md`): objetivo, passos numerados, arquivos tocados, decisões e critério de pronto. Plano que só existe no chat não pode ser revisado frio.
2. **Despache 2 ou 3 peixinhos em paralelo**, cada um um subagente novo (Claude Code: Agent tool; Antigravity: `invoke_subagent`; Codex/OpenCode: subagent) recebendo **apenas** o caminho do arquivo e um foco diferente:
   - Peixinho A · **bordas**: "Para cada passo, que entrada ou evento faria ele falhar? (ex.: e se o mesmo pagamento chegar duas vezes?)"
   - Peixinho B · **ambiguidade**: "Que termo, arquivo ou API citado você não conseguiria localizar ou definir sem perguntar?"
   - Peixinho C · **prova** (opcional): "O critério de pronto é verificável? Que comando ou teste provaria cada item?"

   Instrução comum: *"Você não sabe nada além deste arquivo. Comente por passo (`Passo 2: ...`). No máximo 8 comentários, mais grave primeiro. Não proponha arquitetura nova nem reescreva o plano."*
3. **Corrija o arquivo, não a conversa.** Cada comentário vira edição no plano ou uma nota explicando por que não se aplica (o próximo leitor terá a mesma dúvida).
4. **No máximo 2 rodadas.** Se ainda houver comentário grave, o problema é de requisito: volte ao `grilling` ou pergunte ao usuário.
5. **Aprovação explícita.** Mostre o plano final e os comentários resolvidos. Só implemente depois do "pode seguir", salvo autorização prévia para seguir direto.

## Sem suporte a subagente

Simule um peixinho: salve o plano, releia o arquivo como se fosse a primeira vez e responda os três focos acima. É mais fraco (você ainda lembra da conversa), mas pega termos sem definição e passos sem critério.
