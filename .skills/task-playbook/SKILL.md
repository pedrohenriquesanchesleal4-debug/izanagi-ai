---
name: "task-playbook"
description: "Transforma um trabalho repetitivo em pasta de playbook com 3 partes: o processo (levantado por entrevista), a caixa (exemplos que deram certo, nunca refeitos) e a prova (checklist de pronto que o agente confere antes de entregar). Erro se corrige na pasta, não no chat. Use quando o usuário repete o mesmo tipo de tarefa ou quer 'um agente para X'. Gatilhos de ativação: task playbook: escreva o trabalho numa pasta, não num agente novo; quando usar; estrutura; 1. processo (por entrevista)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Task Playbook: escreva o trabalho numa pasta, não num agente novo

> Migrado deterministicamente de `skills/task-playbook/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Transforma um trabalho repetitivo em pasta de playbook com 3 partes: o processo (levantado por entrevista), a caixa (exemplos que deram certo, nunca refeitos) e a prova (checklist de pronto que o agente confere antes de entregar). Erro se corrige na pasta, não no chat.
- **Ativar quando:** Use quando o usuário repete o mesmo tipo de tarefa ou quer 'um agente para X'.
- **Escopo canônico:** Task Playbook: escreva o trabalho numa pasta, não num agente novo
- **Seções do corpo original:** Quando usar · Estrutura · 1. Processo (por entrevista) · 2. Caixa (o que deu certo fica guardado) · 3. Prova (pronto é verificável)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Ler processo.md, a caixa/ (no máximo os 2 exemplos mais próximos) e prova.md.

Ler `processo.md`, a `caixa/` (no máximo os 2 exemplos mais próximos) e `prova.md`.

### Passo 2 — Produzir.

Produzir.

### Passo 3 — Rodar a prova e anexar o resultado.

Rodar a prova e anexar o resultado.

### Passo 4 — Ação que envolve cliente ou dinheiro:

Ação que envolve cliente ou dinheiro: parar e pedir aprovação humana.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

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
