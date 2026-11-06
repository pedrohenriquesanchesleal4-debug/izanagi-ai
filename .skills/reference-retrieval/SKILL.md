---
name: "reference-retrieval"
description: "Recupera exemplos, contratos e documentação verificáveis antes de implementar integrações. Prioriza MCP, repositório local e fontes oficiais, com fallback honesto quando browser ou MCP não estiver disponível. Gatilhos de ativação: reference retrieval · agent-first grounding; workflow; mcp e exemplos; verification steps."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Reference Retrieval · Agent-first grounding

> Migrado deterministicamente de `skills/reference-retrieval/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Recupera exemplos, contratos e documentação verificáveis antes de implementar integrações. Prioriza MCP, repositório local e fontes oficiais, com fallback honesto quando browser ou MCP não estiver disponível.

- **Escopo canônico:** Reference Retrieval · Agent-first grounding
- **Seções do corpo original:** Workflow · MCP e exemplos · Verification Steps
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Detecte capabilities:

**Detecte capabilities**: verifique se há MCP de documentação/exemplos, browser portal,

Playwright, busca web e acesso ao repositório. Marque cada uma como `available`,
   `unavailable` ou `unknown`.

### Passo 2 — Prefira retrieval agent-first:

**Prefira retrieval agent-first**: consulte primeiro exemplos já existentes no projeto,

depois resources/tools MCP, depois documentação oficial versionada. Só use busca visual
   live quando a capability tiver sido detectada.

### Passo 3 — Capture evidência:

**Capture evidência**: para cada exemplo, registre URL ou caminho, versão/data, contrato

observado, limitações e o que será adaptado. Não trate marketing ou uma resposta sem
   fonte como fato.

### Passo 4 — Compare alternativas:

**Compare alternativas**: confirme nomes de imports, parâmetros, retornos, erros e

requisitos de runtime contra pelo menos uma fonte primária.

### Passo 5 — Emita um artefato curto:

**Emita um artefato curto**: `reference`, `source`, `version`, `observedContract`,

`adaptation`, `confidence` e `unknowns`. O agente de implementação consome esse
   artefato, não a transcrição completa da pesquisa.

### Passo 6 — Fallback explícito:

**Fallback explícito**: se a fonte não estiver acessível, produza `UNKNOWN`, cite a

última evidência disponível e peça uma decisão ou implemente somente contra contratos
   locais já comprovados.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] capability matrix registrada
- [ ] fonte primária ou caminho local citado
- [ ] versão/commit/data registrados quando disponíveis
- [ ] contrato de entrada, saída e erro observado
- [ ] desconhecidos e fallback declarados
- [ ] agente implementador recebeu o artefato de evidência

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

# Reference Retrieval · Agent-first grounding

Use esta skill antes de implementar qualquer integração, SDK, MCP, biblioteca de UI ou
API externa. O objetivo é transformar exemplos verificáveis em contratos de implementação,
não copiar snippets sem entender o contexto.

## Workflow

1. **Detecte capabilities**: verifique se há MCP de documentação/exemplos, browser portal,
   Playwright, busca web e acesso ao repositório. Marque cada uma como `available`,
   `unavailable` ou `unknown`.
2. **Prefira retrieval agent-first**: consulte primeiro exemplos já existentes no projeto,
   depois resources/tools MCP, depois documentação oficial versionada. Só use busca visual
   live quando a capability tiver sido detectada.
3. **Capture evidência**: para cada exemplo, registre URL ou caminho, versão/data, contrato
   observado, limitações e o que será adaptado. Não trate marketing ou uma resposta sem
   fonte como fato.
4. **Compare alternativas**: confirme nomes de imports, parâmetros, retornos, erros e
   requisitos de runtime contra pelo menos uma fonte primária.
5. **Emita um artefato curto**: `reference`, `source`, `version`, `observedContract`,
   `adaptation`, `confidence` e `unknowns`. O agente de implementação consome esse
   artefato, não a transcrição completa da pesquisa.
6. **Fallback explícito**: se a fonte não estiver acessível, produza `UNKNOWN`, cite a
   última evidência disponível e peça uma decisão ou implemente somente contra contratos
   locais já comprovados.

## MCP e exemplos

- Descubra resources/tools antes de invocar um nome presumido.
- Valide schema de entrada e saída de cada tool MCP antes de escrever o client.
- Nunca afirme que um MCP, browser portal ou CLI está disponível só porque existe uma
  skill ou uma referência textual.
- Nunca invente endpoint, import, flag, seletor ou versão para preencher uma lacuna.

## Verification Steps

- [ ] capability matrix registrada
- [ ] fonte primária ou caminho local citado
- [ ] versão/commit/data registrados quando disponíveis
- [ ] contrato de entrada, saída e erro observado
- [ ] desconhecidos e fallback declarados
- [ ] agente implementador recebeu o artefato de evidência
