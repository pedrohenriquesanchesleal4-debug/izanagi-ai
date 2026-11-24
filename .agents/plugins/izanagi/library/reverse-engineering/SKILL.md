---
name: "reverse-engineering"
description: "Engenharia reversa autorizada e compreensão profunda de código legado. Use para mapear dependências, identificar entrypoints, traçar fluxos de execução, reconstruir contratos de API e interfaces a partir de referências existentes. Gatilhos de ativação: reverse engineering autorizada & análise arquitetural; triggering criteria; step-by-step workflow; verification steps."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Reverse Engineering Autorizada & Análise Arquitetural

> Migrado deterministicamente de `skills/reverse-engineering/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Engenharia reversa autorizada e compreensão profunda de código legado.
- **Ativar quando:** Use para mapear dependências, identificar entrypoints, traçar fluxos de execução, reconstruir contratos de API e interfaces a partir de referências existentes.
- **Escopo canônico:** Reverse Engineering Autorizada & Análise Arquitetural
- **Seções do corpo original:** Triggering Criteria · Step-by-Step Workflow · Verification Steps
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Mapeamento de Entrypoints:

**Mapeamento de Entrypoints:**

- Inspecione `package.json` (ou manifesto da stack), binários, arquivos `index.ts/main.go/app.py`.
   - Identifique pontos de inicialização de servidores, workers ou CLI.

### Passo 2 — Grafo de Dependências e Contratos:

**Grafo de Dependências e Contratos:**

- Mapeie imports internos e externos para entender as fronteiras de responsabilidade.
   - Isole tipos, interfaces de dados e rotas HTTP/RPC.

### Passo 3 — Traçado de Fluxo de Execução:

**Traçado de Fluxo de Execução:**

- Siga a cadeia: Rota -> Middleware -> Controller -> Service -> Banco de Dados.
   - Documente efeitos colaterais e persistência de estado.

### Passo 4 — Reconstrução de Interface:

**Reconstrução de Interface:**

- Decomponha o layout em grid, tokens de cor, tipografia e hierarquia de componentes.
   - Valide contratos visuais antes de propor refatoração.

## Verification Steps

<!-- fonte da verificação: quality-section-original -->

- O diagrama ou mapa conceitual reflete exatamente os caminhos existentes no código.
- Nenhuma operação destrutiva foi executada.

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

# Reverse Engineering Autorizada & Análise Arquitetural

> Protocolo de inspeção estática determinística para compreender bases de código e sistemas sem suposições e sem alterações destrutivas.

## Triggering Criteria
- Início de trabalho em base de código desconhecida ou pouco documentada.
- Investigação de contratos de API e fluxo de dados entre módulos.
- Reconstrução de interfaces baseando-se em screenshots ou referências existentes.

## Step-by-Step Workflow

1. **Mapeamento de Entrypoints:**
   - Inspecione `package.json` (ou manifesto da stack), binários, arquivos `index.ts/main.go/app.py`.
   - Identifique pontos de inicialização de servidores, workers ou CLI.

2. **Grafo de Dependências e Contratos:**
   - Mapeie imports internos e externos para entender as fronteiras de responsabilidade.
   - Isole tipos, interfaces de dados e rotas HTTP/RPC.

3. **Traçado de Fluxo de Execução:**
   - Siga a cadeia: Rota -> Middleware -> Controller -> Service -> Banco de Dados.
   - Documente efeitos colaterais e persistência de estado.

4. **Reconstrução de Interface:**
   - Decomponha o layout em grid, tokens de cor, tipografia e hierarquia de componentes.
   - Valide contratos visuais antes de propor refatoração.

## Verification Steps
- O diagrama ou mapa conceitual reflete exatamente os caminhos existentes no código.
- Nenhuma operação destrutiva foi executada.
