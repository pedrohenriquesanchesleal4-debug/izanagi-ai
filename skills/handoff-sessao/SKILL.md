---
name: handoff-sessao
description: Grava um resumo curto do estado da tarefa em andamento para retomar na próxima sessão sem perder contexto e sem precisar reexplicar tudo de novo. Use quando o usuário disser "vou parar por aqui", "continuo depois", "pausa" ou quando a conversa estiver ficando muito longa e perto do limite de contexto.
---

# Handoff de sessão

Complementa a skill `memoria-projeto`, mas para o "estado da tarefa em progresso" (não para conhecimento permanente do projeto).

## Quando acionar

- Usuário indica que vai parar/continuar depois.
- A tarefa está pela metade (ex. feature com 3 de 5 passos feitos).
- O contexto da conversa está grande e prestes a ser resumido/perdido.

## O que gravar

Escreva (ou atualize) `.agents/memoria/em-andamento.md` com no máximo estes campos, curtos:

```
## <nome da tarefa> — <data>
- Objetivo: <1 linha>
- Feito: <lista curta do que já foi feito>
- Falta: <lista curta do que falta>
- Próximo passo concreto: <1 linha — o que fazer assim que retomar>
```

## Regras

- Sobrescreva a entrada da mesma tarefa em vez de acumular várias entradas desatualizadas — isso é estado atual, não histórico.
- Quando a tarefa for concluída, apague a entrada dela deste arquivo (o que vale a pena lembrar para sempre já deve ter ido para `decisoes.md` ou `erros-corrigidos.md` via a skill `memoria-projeto`).
- Ao retomar uma sessão, leia este arquivo primeiro se ele existir — economiza o usuário ter que reexplicar onde parou.
