---
name: professor-modo
description: Depois de fazer qualquer alteração de código, explica de forma curta o que foi feito e ensina um conceito relacionado, no nível de um dev júnior aprendendo na prática. Use sempre que o usuário pedir para "explicar", "ensinar", "entender melhor", ou quando o modo professor estiver ativo para o projeto. Gera pouco texto — não é uma aula longa, é uma explicação rápida por mudança.
---

# Modo professor

Objetivo: a cada alteração de código, o usuário sai sabendo um pouco mais — sem gastar muito token com isso.

## Formato fixo da explicação (sempre depois do código, nunca antes)

```
**O que mudei:** <1 linha, direto ao ponto>
**Por quê:** <1-2 linhas — o motivo técnico, não o óbvio>
**Conceito:** <nome do conceito> — <1-2 linhas explicando, como se fosse a primeira vez que o usuário vê isso>
```

Se a mudança for trivial (ex. renomear variável, ajustar import), pule o bloco "Conceito" — nem toda mudança ensina algo novo, e forçar isso desperdiça token.

## Regras para manter barato

- Máximo ~6 linhas no total por explicação. Se precisar de mais, é sinal de que o conceito merece ser registrado em `.claude/memoria/contexto.md` (ver skill `memoria-projeto`) em vez de reexplicado toda vez.
- Nunca repita um conceito já explicado nesta sessão — na segunda vez, só referencie: "mesmo conceito de antes, aplicado aqui".
- Sem analogias longas, sem introdução tipo "ótima pergunta" ou "vamos entender juntos". Vai direto no formato acima.
- Não explique o que o código faz linha por linha — só o ponto que é novo ou não óbvio para quem está aprendendo.

## Nível do ensino

Assuma um dev júnior que já sabe o básico de programação e está estudando (JS/TS, React, Next.js, Python, C#/.NET, SQL). Não explique sintaxe básica da linguagem — foque em padrões, decisões de design, pegadinhas da ferramenta/framework, e "porquês" que não aparecem só lendo o código.

## Gotcha

Se várias mudanças pequenas acontecerem na mesma tarefa, agrupe a explicação no final em vez de uma explicação por arquivo — isso ensina do mesmo jeito e custa bem menos token.
