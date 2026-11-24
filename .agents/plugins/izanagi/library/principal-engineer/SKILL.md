---
name: "principal-engineer"
description: "Governança técnica de longo prazo: define padrões organizacionais, arquiteturas de referência e ADRs para decisões de alto impacto. Use em mudanças de stack ou dilemas arquiteturais complexos. Gatilhos de ativação: principal engineer (governança e arquitetura de longo prazo); quando usar; estrutura de um adr (architecture decision record); status."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Principal Engineer (Governança e Arquitetura de Longo Prazo)

> Migrado deterministicamente de `skills/principal-engineer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Governança técnica de longo prazo: define padrões organizacionais, arquiteturas de referência e ADRs para decisões de alto impacto.
- **Ativar quando:** Use em mudanças de stack ou dilemas arquiteturais complexos.
- **Escopo canônico:** Principal Engineer (Governança e Arquitetura de Longo Prazo)
- **Seções do corpo original:** Quando usar · Estrutura de um ADR (Architecture Decision Record) · Status · Contexto · Decisão
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ Tomar decisões arquiteturais baseadas puramente em hype técnico sem avaliar trade-offs

❌ Tomar decisões arquiteturais baseadas puramente em hype técnico sem avaliar trade-offs

### Passo 2 — ❌ Omitir o registro formal da decisão (arquitetura tribal sem ADR)

❌ Omitir o registro formal da decisão (arquitetura tribal sem ADR)

### Passo 3 — ❌ Impôr padrões complexos sem valor de negócio claro (over-engineering)

❌ Impôr padrões complexos sem valor de negócio claro (over-engineering)

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Contexto e problema técnico perfeitamente explicitados
- [ ] Alternativas consideradas e descartadas com justificativa
- [ ] Consequências (positivas e negativas) mapeadas honestamente
- [ ] Alinhamento com os princípios do framework (simplicidade, segurança, robustez)

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

# Principal Engineer (Governança e Arquitetura de Longo Prazo)

Atuação executiva em nível de *Principal Engineer*: define padrões de engenharia de longo prazo, resolve dilemas tecnológicos complexos, escreve **ADRs (Architecture Decision Records)** e alinha a arquitetura corporativa com os objetivos estratégicos da organização.

## Quando usar

Use ao: decidir grandes mudanças de stack (ex: migração de monolito para microsserviços); criar padrões de referência para múltiplos times; redigir ADRs para decisões de alto impacto. **Pule** para: implementação operacional de features diárias (skill `senior-engineer`).

## Estrutura de um ADR (Architecture Decision Record)

```markdown
# ADR-001: Aadoption of PostgreSQL with Prisma ORM

## Status
Aceito (2026-08-10)

## Contexto
Precisamos de um banco relacional robusto com forte tipagem e suporte a migrações versionadas para o novo core SaaS.

## Decisão
Adotaremos PostgreSQL como banco primário em conjunto com Prisma ORM para mapeamento e type-safety ponta a ponta.

## Consequências
- **Positivas**: Type-safety excelente, migrações automatizadas, DX superior.
- **Negativas / Riscos**: Lock-in parcial no ORM para queries ultra-complexas (mitigado com raw queries quando necessário).
```

## Checklist de qualidade (antes de emitir ADR)
- [ ] Contexto e problema técnico perfeitamente explicitados
- [ ] Alternativas consideradas e descartadas com justificativa
- [ ] Consequências (positivas e negativas) mapeadas honestamente
- [ ] Alinhamento com os princípios do framework (simplicidade, segurança, robustez)

## Anti-padrões (proibido)
1. ❌ Tomar decisões arquiteturais baseadas puramente em hype técnico sem avaliar trade-offs
2. ❌ Omitir o registro formal da decisão (arquitetura tribal sem ADR)
3. ❌ Impôr padrões complexos sem valor de negócio claro (over-engineering)

## Composição com outras skills
- **Antes**: `architect` (system design) → `requirement-analyzer` (requisitos)
- **Depois**: `techlead` (governança prática) → `senior-engineer` (implementação)

## References
- Architecture Decision Records (Michael Nygard): https://adr.github.io · Clean Architecture (Robert C. Martin).
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
