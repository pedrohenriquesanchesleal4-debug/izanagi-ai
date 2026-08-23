# @izanagi/skill-migrator

Conversor determinístico e idempotente de skills v1 (`skills/<name>/SKILL.md`) para o catálogo **Agent Skills v2** (`.skills/<name>/SKILL.md`), com divulgação progressiva e biblioteca de anti-racionalização por domínio.

> ADR-004: derivação do conteúdo **REAL** da fonte original. Proibido inventar conteúdo ou deixar seção obrigatória vazia — qualquer falha de preenchimento é erro loud, nunca stub silencioso. A fonte `skills/` é somente leitura.

## Uso

```bash
# Migração real (padrões: src=skills, dest=.skills)
node packages/skill-migrator/cli.mjs

# Equivalente explícito
node packages/skill-migrator/cli.mjs --src skills --dest .skills

# Simula e valida tudo sem escrever nada
node packages/skill-migrator/cli.mjs --dry-run

# Verifica drift: re-migra para um catálogo temporário e compara byte-a-byte
# com o destino real (somente leitura; exit 1 em qualquer diferença)
node packages/skill-migrator/cli.mjs --check
```

| Flag | Descrição |
|---|---|
| `--src <dir>` | Fonte das skills v1 (padrão `skills`) |
| `--dest <dir>` | Destino do catálogo v2 (padrão `.skills`) |
| `--dry-run` | Processa e valida em memória; não cria arquivos |
| `--clean` | Remove o destino antes de migrar |
| `--check` | Detecta drift (ausente/extra/diferente) entre re-migração limpa e destino, sem escrever |
| `--json` | Imprime o relatório estruturado em JSON |
| `-h`, `--help` | Ajuda |

Exit codes: `0` sucesso · `1` falha de migração/validação/drift · `2` uso inválido.

Requisito: Node ≥ 18. Zero dependências npm.

## Formato v2 gerado

```markdown
---
name: "api-automation"
description: "<descrição original + gatilhos derivados do título/headings>"
version: 2.0.0
category: engineering        # heurística determinística (ver abaixo)
tools:
  mcp:
    - mcp:fs_write           # mapeado por categoria
    - mcp:execute_command
references:                  # progressive disclosure: arquivos disponíveis
  - "references.md"          # em .skills/<name>/references/ (opcional)
---

# <Título original>

## Triggering Criteria          # domínio, resumo, "Ativar quando", escopo, seções
## Step-by-Step Workflow        # extraído fielmente do corpo (estratégias abaixo)
## Verification Steps           # checklist original, seção de qualidade ou fallback honesto
## Common Rationalizations      # biblioteca por categoria (rationalizations.mjs)
## Red Flags                    # biblioteca por categoria (rationalizations.mjs)
## Legacy Reference (v1)        # corpo original preservado byte-a-byte
```

`references.md` existente na fonte é copiado para `.skills/<name>/references/references.md`, e o front-matter declara `references:` com a lista EXATA do que foi disponibilizado — consumidores leem metadados leves no `skill list` e carregam o conteúdo sob demanda (`skill show <name> --ref <file>` no izanagi-next).

### Categorias e MCP

`engineering · testing · security · design · docs · devops · data · ai`

Inferência em duas fases, determinística:
1. **Fase 1** — padrão forte no NOME da skill (ordem fixa das regras resolve empates).
2. **Fase 2** — ≥ 2 termos fracos DISTINTOS (normalizados sem diacríticos, agrupados por prefixo) em nome + descrição + headings. O corpo corrido nunca entra na inferência.
3. Fallback: `engineering`.

Mapeamento MCP por categoria: `engineering→[fs_write, execute_command]` · `testing→[execute_command]` · `security→[fs_read, execute_command]` · `design/docs→[fs_read, fs_write]` · `devops→[execute_command, fs_write]` · `data→[execute_command, fs_read]` · `ai→[fs_read, fs_write, execute_command]`.

### Estratégias de extração do workflow (em ordem de preferência)

| Estratégia | Quando |
|---|---|
| `workflow-section-steps` | Seção `## Workflow*` com subseções `###` → 1 passo por subseção, conteúdo verbatim |
| `workflow-section-ordered` | Seção de workflow com lista ordenada → 1 passo por item |
| `top-level-ordered` | Primeira lista ordenada que não seja bloco de proibições (❌/"nunca" ≥ 50% dos itens) |
| `paragraphs-as-steps` | Prosa top-level (≥ 2 parágrafos), título = primeira sentença |
| `sections-as-steps` | Último recurso: cada seção vira um passo "Aplicar: \<heading\>" |

A estratégia usada fica registrada em comentário HTML dentro da seção (rastreabilidade). Idem a fonte dos Verification Steps (`checklist-original`, `quality-section-original` ou `fallback-honesto:<categoria>`).

## Garantias

- **Idempotência**: rodadas repetidas produzem output byte-idêntico (funções puras, ordem de leitura ordenada, zero timestamps no output). Verificado com sha256 da árvore em múltiplas execuções.
- **Fidelidade**: o corpo original é preservado integralmente em `Legacy Reference (v1)` — comparado byte-a-byte nas 106 skills.
- **Validação dupla**: cada arquivo gerado passa por auto-validação (front-matter completo + seções obrigatórias não vazias) e o parser relê o catálogo (round-trip YAML) nos testes.
- **Falha loud**: skill sem corpo aproveitável, front-matter quebrado ou divergência nome/diretório interrompe com motivo por skill e exit 1 — nunca stub silencioso.
- **Fonte intocada**: nada é escrito fora de `--dest`; `--dest` dentro de `--src` é rejeitado.

## Limitações conhecidas

- O parser YAML cobre apenas o subconjunto usado pelo contrato (escalares, block scalars `>`/`|`, mapas aninhados, listas) — não é um parser YAML geral.
- Skills transversais sem domínio claro podem cair em `engineering` (ex.: `caveman`, comunicação comprimida) — residual documentado da heurística.
- `Legacy Reference` preserva o texto original mas normaliza espaços de borda (início/fim do corpo); o miolo é byte-a-byte.

## Estrutura

```
packages/skill-migrator/
├── cli.mjs               # entrada CLI (--src --dest --dry-run --clean --check --json)
├── migrate.mjs           # biblioteca: parse, heurística, extração, render, validação
├── rationalizations.mjs  # biblioteca anti-racionalização + fallbacks por categoria
└── package.json
```
