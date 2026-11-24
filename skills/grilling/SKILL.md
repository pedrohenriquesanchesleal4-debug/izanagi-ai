---
name: grilling
description: "Interrogatório de plano: faz perguntas duras, uma por vez, até o plano não ter buraco (escopo, dados, erro, segurança, critério de pronto). Para quando as respostas param de mudar o plano. Use antes de começar qualquer feature, projeto ou decisão grande, ou quando o usuário pedir para ser questionado."
triggers:
  - "me questiona / grill me / me enche de pergunta"
  - "validar plano antes de implementar"
  - "decidir se vale a pena levar uma ideia adiante"
  - "requisito vago para feature grande"
capabilities:
  - "plan-interrogation"
  - "requirements-gap-finding"
  - "go-no-go-decision"
---

# Grilling: interrogar o plano até ele aguentar

Plano bom é plano que sobreviveu a perguntas ruins de responder. Esta skill faz essas perguntas antes que o código as faça.

## Quando usar

- Antes de uma feature de mais de um arquivo, de um projeto novo ou de uma migração.
- Quando o usuário pede "me questiona", "valida meu plano" ou quer decidir se uma ideia vale a pena.

**Pule** quando a tarefa já tem critério de aceite escrito e é pequena, ou quando o usuário pediu explicitamente para não ser perguntado.

## Regras do interrogatório

1. **Uma pergunta por vez.** Espere a resposta. Pergunta em lista vira questionário e ninguém responde direito.
2. **Ofereça a sua aposta.** Toda pergunta vem com uma resposta sugerida: `Quem pode apagar um projeto? (minha aposta: só o dono)`. O usuário corrige mais rápido do que escreve.
3. **Pergunte o que dói.** Prefira perguntas cuja resposta muda o plano. Se qualquer resposta deixa o plano igual, não pergunte.
4. **Pare cedo.** Encerre quando 2 respostas seguidas não mudarem nada, ou depois de 12 perguntas.
5. **Se der para descobrir lendo o código, leia em vez de perguntar.**

## Ordem das perguntas

1. **Objetivo:** que problema some quando isto estiver pronto? Como saber que deu certo (número, comportamento observável)?
2. **Usuário e fluxo:** quem usa, qual o caminho feliz em 3 passos?
3. **Dados:** o que entra, o que sai, onde mora, quem é dono?
4. **Bordas:** vazio, enorme, duplicado, concorrente, offline, sem permissão.
5. **Falha:** o que acontece quando a dependência externa cai? Retry, fila, mensagem ao usuário?
6. **Segurança:** quem não pode ver ou fazer isto? Tem segredo, dinheiro ou dado pessoal no caminho?
7. **Escopo:** o que fica de fora da v1, explicitamente?
8. **Pronto:** lista de critérios verificáveis (teste, comando, print) que define "terminado".

## Saída

Ao encerrar, entregue um bloco curto que vira entrada para implementação ou para `plan-cold-review`:

```
## Plano validado
Objetivo: ...
Fora de escopo: ...
Decisões: (pergunta -> resposta, uma por linha)
Riscos aceitos: ...
Critério de pronto:
- [ ] ...
```

## Decisão go/no-go

Se o objetivo da pergunta 1 não tiver resposta concreta, ou o custo descoberto passar do valor declarado, recomende **não fazer agora** e diga o motivo em uma frase. Desistir cedo é resultado válido.
