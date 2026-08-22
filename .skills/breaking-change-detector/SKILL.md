---
name: "breaking-change-detector"
description: "Detecta breaking changes em APIs e migrações de banco, classificando por semver (major/minor/patch) com estratégia de migração segura. Use antes de publicar mudanças em contratos de API ou schema de banco. Gatilhos de ativação: skill: breaking change detector; identity; api breaking changes; database breaking changes."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill: Breaking Change Detector

> Migrado deterministicamente de `skills/breaking-change-detector/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Detecta breaking changes em APIs e migrações de banco, classificando por semver (major/minor/patch) com estratégia de migração segura.
- **Ativar quando:** Use antes de publicar mudanças em contratos de API ou schema de banco.
- **Escopo canônico:** Skill: Breaking Change Detector
- **Seções do corpo original:** Identity · API Breaking Changes · Database Breaking Changes · Detection Flow · Changelog
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Load current API spec (OpenAPI)

Load current API spec (OpenAPI)

### Passo 2 — Load new API spec

Load new API spec

### Passo 3 — Diff endpoints, request/response schemas

Diff endpoints, request/response schemas

### Passo 4 — Classify each change (major/minor/patch)

Classify each change (major/minor/patch)

### Passo 5 — Generate breaking change report

Generate breaking change report

Database:

### Passo 6 — Load current migration state

Load current migration state

### Passo 7 — Load proposed migration

Load proposed migration

### Passo 8 — Check for drop/rename/type change operations

Check for drop/rename/type change operations

### Passo 9 — Flag breaking changes with rollback plan

Flag breaking changes with rollback plan

```

---

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

# Skill: Breaking Change Detector

## Identity

Detects breaking changes in APIs, database migrations, and public interfaces. Enforces semantic versioning: detects when a change requires a major or minor version bump.

---

## API Breaking Changes

```yaml
major_version_required:
  - Removing an endpoint
  - Removing/renaming a field from response
  - Making a previously optional field required in request
  - Changing endpoint URL structure
  - Changing auth method
  - Changing error response format
  
minor_version_allowed:
  - Adding a new endpoint
  - Adding a new optional field to response
  - Adding a new optional field to request
  - Deprecating an endpoint (with sunset header)

patch_allowed:
  - Bug fixes (no contract change)
  - Performance improvements
  - Additional error messages
```

---

## Database Breaking Changes

```yaml
safe:
  - Adding a new table
  - Adding a nullable column
  - Adding an index

breaking:
  - Removing a column (data loss)
  - Renaming a column (needs 2-phase: add + drop)
  - Changing column type (may fail with data)
  - Removing a table
  - Adding NOT NULL to a column (without default)

strategy:
  phase_1: "Add new column + dual-write (both old and new)"
  phase_2: "Backfill data"
  phase_3: "Start reading from new column"
  phase_4: "Remove old column"
```

---

## Detection Flow

```
1. Load current API spec (OpenAPI)
2. Load new API spec
3. Diff endpoints, request/response schemas
4. Classify each change (major/minor/patch)
5. Generate breaking change report

Database:
1. Load current migration state
2. Load proposed migration
3. Check for drop/rename/type change operations
4. Flag breaking changes with rollback plan
```

---

## Changelog

### 1.0.0 — Initial release. API breaking changes, DB breaking changes, detection flow.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
