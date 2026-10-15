---
name: reverse-engineering
description: "Engenharia reversa autorizada e compreensão profunda de código legado. Use para mapear dependências, identificar entrypoints, traçar fluxos de execução, reconstruir contratos de API e interfaces a partir de referências existentes."
version: 2.0.0
category: architecture
triggers:
  - "compreender base de código legado sem documentação"
  - "mapear fluxo de execução e entrypoints"
  - "reconstruir contratos de API e dependências"
  - "reconstruir interface a partir de referências"
capabilities:
  - "reverse-engineering"
  - "codebase-mapping"
  - "static-analysis"
  - "dependency-graph"
dependencies: []
token_budget: 1200
risk: low
compatibility: ">=2.0.0"
---

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
