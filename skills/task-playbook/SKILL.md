---
name: task-playbook
description: "Transforma um trabalho repetitivo em pasta de playbook com 3 partes: o processo (levantado por entrevista), a caixa (exemplos que deram certo, nunca refeitos) e a prova (checklist de pronto que o agente confere antes de entregar). Erro se corrige na pasta, não no chat. Use quando o usuário repete o mesmo tipo de tarefa ou quer 'um agente para X'."
triggers:
  - "quero um agente para fazer X toda semana"
  - "tarefa repetitiva que sempre sai diferente"
  - "padronizar entrega recorrente (proposta, relatório, post, e-mail)"
capabilities:
  - "process-capture"
  - "golden-examples"
  - "definition-of-done"
---

# Task Playbook: escreva o trabalho numa pasta, não num agente novo

Um agente por tarefa, ligado por fios, quebra quando a tarefa muda. Um agente só, lendo uma pasta por tarefa, aguenta. Times que cortaram ferramentas e passaram a descrever o trabalho em arquivos relataram mais acerto, não menos. O agente erra porque não sabe o seu trabalho, não por ser fraco.

## Quando usar

- Pedido de "agente para X" em que X é um ofício recorrente.
- Mesma tarefa saindo diferente a cada vez.

**Pule** para tarefa única. Para criar um agente de verdade, use `agent-architect`.

## Estrutura

```
.agents/playbooks/<tarefa>/
  processo.md   # passo a passo, entradas, decisões
  caixa/        # exemplos aprovados: modelo, planilha, e-mail elogiado
  prova.md      # checklist de pronto, cada item pode falhar
```

## 1. Processo (por entrevista)

Entreviste o usuário **uma pergunta por vez** até conseguir fazer a tarefa sem ele: entradas, fontes, ordem dos passos, decisões e quem aprova. Pare quando conseguir descrever um caso real do começo ao fim. Escreva em `processo.md` em passos numerados.

## 2. Caixa (o que deu certo fica guardado)

Toda entrega aprovada vira arquivo em `caixa/` com uma linha dizendo por que foi aprovada. Antes de produzir, o agente lê a caixa e parte do exemplo mais próximo. O que já saiu certo nunca é refeito do zero.

## 3. Prova (pronto é verificável)

`prova.md` lista critérios que podem falhar: "valores batem com a planilha", "tem CTA único", "menos de 200 palavras". O agente confere item por item **antes** de mostrar e reporta o resultado. Item que não pode falhar ("ficou bom") não entra.

## Regra de ouro

Quando o agente errar, **não corrija só no chat**. Corrija `processo.md`, adicione o exemplo à `caixa/` ou um item à `prova.md`. A próxima execução já nasce corrigida.

## Execução

1. Ler `processo.md`, a `caixa/` (no máximo os 2 exemplos mais próximos) e `prova.md`.
2. Produzir.
3. Rodar a prova e anexar o resultado.
4. Ação que envolve cliente ou dinheiro: parar e pedir aprovação humana.
