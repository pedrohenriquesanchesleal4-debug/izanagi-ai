---
name: "grilling"
description: "Interrogatório de plano: faz perguntas duras, uma por vez, até o plano não ter buraco (escopo, dados, erro, segurança, critério de pronto). Para quando as respostas param de mudar o plano. Use antes de começar qualquer feature, projeto ou decisão grande, ou quando o usuário pedir para ser questionado. Gatilhos de ativação: grilling: interrogar o plano até ele aguentar; quando usar; regras do interrogatório; ordem das perguntas."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Grilling: interrogar o plano até ele aguentar

> Migrado deterministicamente de `skills/grilling/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Interrogatório de plano: faz perguntas duras, uma por vez, até o plano não ter buraco (escopo, dados, erro, segurança, critério de pronto). Para quando as respostas param de mudar o plano.
- **Ativar quando:** Use antes de começar qualquer feature, projeto ou decisão grande, ou quando o usuário pedir para ser questionado.
- **Escopo canônico:** Grilling: interrogar o plano até ele aguentar
- **Seções do corpo original:** Quando usar · Regras do interrogatório · Ordem das perguntas · Saída · Plano validado
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Uma pergunta por vez.

**Uma pergunta por vez.** Espere a resposta. Pergunta em lista vira questionário e ninguém responde direito.

### Passo 2 — Ofereça a sua aposta.

**Ofereça a sua aposta.** Toda pergunta vem com uma resposta sugerida: `Quem pode apagar um projeto? (minha aposta: só o dono)`. O usuário corrige mais rápido do que escreve.

### Passo 3 — Pergunte o que dói.

**Pergunte o que dói.** Prefira perguntas cuja resposta muda o plano. Se qualquer resposta deixa o plano igual, não pergunte.

### Passo 4 — Pare cedo.

**Pare cedo.** Encerre quando 2 respostas seguidas não mudarem nada, ou depois de 12 perguntas.

### Passo 5 — Se der para descobrir lendo o código, leia em vez de perguntar.

**Se der para descobrir lendo o código, leia em vez de perguntar.**

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] ...

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

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
