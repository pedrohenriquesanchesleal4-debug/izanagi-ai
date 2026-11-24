---
name: "plan-cold-review"
description: "Revisão fria de plano: um revisor que NÃO viu a conversa lê só o plano escrito e aponta o que ficou implícito, ambíguo ou faltando. O plano só vai para código depois de aprovado. Use depois de escrever um plano e antes de implementar qualquer coisa de mais de um arquivo. Gatilhos de ativação: plan cold review: o plano tem que se explicar sozinho; quando usar; protocolo; o que o revisor não faz."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Plan Cold Review: o plano tem que se explicar sozinho

> Migrado deterministicamente de `skills/plan-cold-review/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Revisão fria de plano: um revisor que NÃO viu a conversa lê só o plano escrito e aponta o que ficou implícito, ambíguo ou faltando. O plano só vai para código depois de aprovado.
- **Ativar quando:** Use depois de escrever um plano e antes de implementar qualquer coisa de mais de um arquivo.
- **Escopo canônico:** Plan Cold Review: o plano tem que se explicar sozinho
- **Seções do corpo original:** Quando usar · Protocolo · O que o revisor NÃO faz · Sem suporte a subagente
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Escreva o plano em arquivo (.agents/plans/<slug.md ou o caminho que o projeto usar).

**Escreva o plano em arquivo** (`.agents/plans/<slug>.md` ou o caminho que o projeto usar). Plano que só existe no chat não pode ser revisado frio.

### Passo 2 — Despache um revisor sem histórico.

**Despache um revisor sem histórico.** Um subagente novo (Claude Code: Agent tool; Antigravity: `invoke_subagent`; Codex/Opencode: subagent equivalente) recebendo **apenas** o caminho do plano e esta instrução:

> Leia o plano. Você não sabe nada além dele. Liste: (a) termos usados sem definição, (b) passos que dependem de decisão não registrada, (c) arquivos ou APIs citados que você não conseguiria localizar, (d) critério de pronto ausente ou não verificável. Responda só a lista, no máximo 10 itens, mais grave primeiro.

### Passo 3 — Corrija o plano, não a conversa.

**Corrija o plano, não a conversa.** Cada item vira edição no arquivo. Se um item é falso positivo, anote no plano o porquê (o próximo leitor terá a mesma dúvida).

### Passo 4 — Repita no máximo 2 vezes.

**Repita no máximo 2 vezes.** Se depois de 2 rodadas ainda há item grave, o problema é de requisito: volte para `grilling` ou pergunte ao usuário.

### Passo 5 — Aprovação explícita.

**Aprovação explícita.** Mostre ao usuário o plano final e os itens resolvidos. Só implemente depois do "pode seguir", exceto se o usuário já autorizou seguir direto.

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
