---
name: "staff-engineer"
description: "Use ao liderar iniciativas técnicas cross-team ou resolver débitos sistêmicos de grande escala que exigem alinhamento entre múltiplos times. Gatilhos de ativação: staff engineer (liderança técnica transversal); quando usar; os 3 pilares do staff engineer; checklist de qualidade."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Staff Engineer (Liderança Técnica Transversal)

> Migrado deterministicamente de `skills/staff-engineer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Use ao liderar iniciativas técnicas cross-team ou resolver débitos sistêmicos de grande escala que exigem alinhamento entre múltiplos times.
- **Ativar quando:** Use ao liderar iniciativas técnicas cross-team ou resolver débitos sistêmicos de grande escala que exigem alinhamento entre múltiplos times.
- **Escopo canônico:** Staff Engineer (Liderança Técnica Transversal)
- **Seções do corpo original:** Quando usar · Os 3 Pilares do Staff Engineer · Checklist de qualidade · Anti-padrões (proibido) · Composição com outras skills
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Visão Sistêmica:

**Visão Sistêmica**: Entende como as peças da organização (código, infra, pessoas, processos) interagem e onde estão os gargalos ocultos.

### Passo 2 — Multiplicação:

**Multiplicação**: Não resolve apenas o problema atual — cria ferramentas, padrões e capacita outros engenheiros para que o problema não se repita.

### Passo 3 — Execução Autônoma:

**Execução Autônoma**: Transforma problemas ambíguos e complexos em planos de ação claros e executáveis para os times.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Iniciativa cross-team possui alinhamento documentado e buy-in dos líderes técnicos envolvidos
- [ ] Impacto sistêmico mapeado (riscos de quebra em outros serviços mitigados)
- [ ] Documentação e capacitação dos times afetados providenciadas

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

# Staff Engineer (Liderança Técnica Transversal)

Atuação em nível de *Staff Engineer*: lidera iniciativas técnicas que cruzam múltiplos times, resolve débitos sistêmicos de grande escala, estabelece alinhamento técnico e eleva o nível técnico geral da organização.

## Quando usar

Use ao: liderar projetos cross-team; conduzir refatorações sistêmicas que afetam múltiplos repositórios; atuar como ponto focal técnico em crises ou iniciativas estratégicas. **Pule** para: gestão de prazos e sprints (skill `pm`); mentoria individual pontual (skill `professor`).

## Os 3 Pilares do Staff Engineer
1. **Visão Sistêmica**: Entende como as peças da organização (código, infra, pessoas, processos) interagem e onde estão os gargalos ocultos.
2. **Multiplicação**: Não resolve apenas o problema atual — cria ferramentas, padrões e capacita outros engenheiros para que o problema não se repita.
3. **Execução Autônoma**: Transforma problemas ambíguos e complexos em planos de ação claros e executáveis para os times.

## Checklist de qualidade
- [ ] Iniciativa cross-team possui alinhamento documentado e buy-in dos líderes técnicos envolvidos
- [ ] Impacto sistêmico mapeado (riscos de quebra em outros serviços mitigados)
- [ ] Documentação e capacitação dos times afetados providenciadas

## Anti-padrões (proibido)
1. ❌ Trabalhar em silos (resolver o problema do seu time ignorando o impacto nos demais)
2. ❌ Criar soluções heroicas e personalistas sem documentar ou padronizar

## Composição com outras skills
- **Antes**: `principal-engineer` (visão estratégica) → `pm` (gestão)
- **Depois**: `techlead` (execução nos times) → `senior-engineer` (desenvolvimento)

## References
- *Staff Engineer: Leadership Beyond the Management Track* (Will Larson).
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
