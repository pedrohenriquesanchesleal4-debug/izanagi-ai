---
name: grilling
description: "Interrogatório de plano no estilo grill-me. Use antes de começar qualquer feature, projeto ou decisão grande, ou quando o…"
---

# Grilling: interrogar o plano até ele aguentar

Plano bom é plano que sobreviveu a perguntas ruins de responder. Inspirado no `grill-me` (Matt Pocock): entreviste sem dó até chegar a um entendimento compartilhado, percorrendo cada ramo da árvore de decisão e resolvendo as dependências entre decisões uma a uma.

## Quando usar

- Antes de uma feature de mais de um arquivo, de um projeto novo ou de uma migração.
- Quando o usuário pede "me questiona", "valida meu plano" ou quer saber se uma ideia vale a pena.

**Pule** quando a tarefa já tem critério de aceite escrito e é pequena, ou quando o usuário pediu para não ser perguntado.

## Regras

1. **Uma pergunta por vez.** Espere a resposta antes da próxima.
2. **Toda pergunta vem com a sua aposta.** Formato: `Q3 · Como cobra? Mensalidade fixa ou comissão por pedido? → minha aposta: mensalidade fixa, sem comissão`. O usuário corrige mais rápido do que escreve do zero.
3. **Siga o ramo.** Se a resposta abre uma decisão dependente, resolva essa antes de voltar ao tronco (ex.: "quem paga?" decide "como cobra?", que decide "como recebe?").
4. **Pergunte só o que muda o plano.** Se qualquer resposta deixa o plano igual, corte a pergunta.
5. **Leia antes de perguntar.** O que dá para descobrir no código ou nos arquivos, você descobre.
6. **Pare cedo.** Encerre quando uma rodada inteira não mudar nada, ou depois de 4 rodadas.

## Rodadas

| Rodada | Foco | Perguntas típicas |
|---|---|---|
| 1 · Problema | quem e por quê | Quem paga? Qual é a dor, em palavras do cliente? Como saber que resolveu? |
| 2 · Mecânica | como funciona | Como cobra? Como o usuário recebe o resultado? O que entra e o que sai? |
| 3 · Posição | por que este e não outro | Público exato? O que diferencia do que já existe? Por qual canal chega? |
| 4 · Risco | o que quebra | Bordas (vazio, duplicado, concorrente), falha de dependência externa, segurança, o que fica fora da v1 |

Para software, a rodada 4 inclui sempre: dados (onde mora, quem é dono), permissões (quem não pode ver/fazer), idempotência (e se o mesmo evento chegar duas vezes?) e critério de pronto verificável.

## Saída

```
## Resumo do plano
- Público: ...
- Diferencial: ...
- Entrega: ...
- Canal: ...
Decisões: Q1 → ..., Q2 → ... (uma por linha)
Fora da v1: ...
Riscos aceitos: ...
Critério de pronto:
- [ ] ...

Veredito: VALE A PENA SEGUIR (validado em N rodadas) | NÃO VALE AGORA (motivo em 1 frase)
```

Depois do veredito positivo, ofereça transformar o resumo em plano de implementação e passar por `plan-cold-review`.

## Quando dizer não

Se a rodada 1 não tiver resposta concreta (ninguém paga, dor vaga, sucesso não mensurável) ou o custo descoberto passar do valor declarado, o veredito é **não vale agora**. Desistir cedo é resultado válido e barato.

> Gerado pelo Izanagi AI: cópia fiel de `skills/grilling/SKILL.md` (fonte da verdade).
