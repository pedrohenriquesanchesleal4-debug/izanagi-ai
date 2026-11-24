---
name: "grilling"
description: "Interrogatório de plano no estilo grill-me: perguntas duras em rodadas, uma por vez e sempre com uma resposta sugerida, descendo cada ramo da árvore de decisão até não sobrar buraco. Termina com resumo do plano e veredito vale a pena / não vale. Use antes de começar qualquer feature, projeto ou decisão grande, ou quando o usuário pedir para ser questionado. Gatilhos de ativação: grilling: interrogar o plano até ele aguentar; quando usar; regras; rodadas."
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
- **Resumo:** Interrogatório de plano no estilo grill-me: perguntas duras em rodadas, uma por vez e sempre com uma resposta sugerida, descendo cada ramo da árvore de decisão até não sobrar buraco. Termina com resumo do plano e veredito vale a pena / não vale.
- **Ativar quando:** Use antes de começar qualquer feature, projeto ou decisão grande, ou quando o usuário pedir para ser questionado.
- **Escopo canônico:** Grilling: interrogar o plano até ele aguentar
- **Seções do corpo original:** Quando usar · Regras · Rodadas · Saída · Resumo do plano
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Uma pergunta por vez.

**Uma pergunta por vez.** Espere a resposta antes da próxima.

### Passo 2 — Toda pergunta vem com a sua aposta.

**Toda pergunta vem com a sua aposta.** Formato: `Q3 · Como cobra? Mensalidade fixa ou comissão por pedido? → minha aposta: mensalidade fixa, sem comissão`. O usuário corrige mais rápido do que escreve do zero.

### Passo 3 — Siga o ramo.

**Siga o ramo.** Se a resposta abre uma decisão dependente, resolva essa antes de voltar ao tronco (ex.: "quem paga?" decide "como cobra?", que decide "como recebe?").

### Passo 4 — Pergunte só o que muda o plano.

**Pergunte só o que muda o plano.** Se qualquer resposta deixa o plano igual, corte a pergunta.

### Passo 5 — Leia antes de perguntar.

**Leia antes de perguntar.** O que dá para descobrir no código ou nos arquivos, você descobre.

### Passo 6 — Pare cedo.

**Pare cedo.** Encerre quando uma rodada inteira não mudar nada, ou depois de 4 rodadas.

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
