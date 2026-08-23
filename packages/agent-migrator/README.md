# @izanagi/agent-migrator

Migrador determinístico e idempotente das definições de agentes v1 (`agents/*.json` — Agent Genome + chains) para a representação **v2 em YAML estrito** (`.agents/agents/<slug>.yaml`), interface de leitura para CLIs e futuros consumers.

> ADR-005 (`.agents/memoria/decisoes.md`) · Strangler Fig (ADR-001 segue válido): **`agents/*.json` permanece a fonte canônica**. Os YAMLs são derivação — **NUNCA edite-os à mão**: qualquer alteração nasce no JSON e se propaga por regeneração. Edições manuais são detectadas como `drift` pelo modo `--check`.

## Uso

```bash
# Da raiz do repositório — gera/regenera .agents/agents/<slug>.yaml
node packages/agent-migrator/cli.mjs

# Verifica sincronia sem escrever nada (CI, pré-commit)
node packages/agent-migrator/cli.mjs --check
```

| Flag | Descrição |
|---|---|
| `--src <dir>` | Fonte dos JSONs de agentes (padrão `agents`, varredura recursiva — inclui `agents/generated/*.json` quando existir) |
| `--dest <dir>` | Destino dos YAMLs derivados (padrão `.agents/agents`) |
| `--check` | Recalcula os YAMLs esperados e compara byte-a-byte sem escrever; reporta `DRIFT` (editado à mão), `AUSENTE` e órfãos (YAML sem origem) |
| `--json` | Relatório estruturado em JSON no stdout |
| `-h`, `--help` | Ajuda |

Exit codes: `0` sincronizado · `1` falha/desvio · `2` uso inválido.

Requisito: Node ≥ 18. Zero dependências npm.

## Topologia e nomenclatura

```
.agents/agents/
├── adversarial-critic.yaml      ← agents/adversarial-critic-agent.json
├── software-architect.yaml      ← agents/architect-agent.json
├── professor-mentor.yaml        ← agents/professor-agent.json
└── ...                          (um YAML por JSON)
```

- `<slug>` = slug determinístico do campo `name` do JSON (minúsculas, diacríticos removidos, não alfanuméricos → `-`; ex.: `"Professor / Mentor"` → `professor-mentor`). Fallback: nome do arquivo. Colisão de slug entre dois agentes = erro loud antes de escrever.
- Cada YAML registra `source: agents/<arquivo>.json` — caminho do JSON de origem relativo à raiz do repo.
- Varredura recursiva: `agents/generated/*.json` entra automaticamente se existir na árvore.

## Schema v2 gerado

Cabeçalho de governança em comentários + mapa cuja primeira chave é o metadado `source`; os demais campos são **espelhamento 1:1 das chaves do JSON fonte**, nesta ordem canônica (campo ausente no JSON = omitido no YAML; nada é inventado):

| Grupo | Chaves (ordem de emissão) |
|---|---|
| Metadado de derivação | `source` |
| Identidade | `name` · `version` · `model` · `compatibility` · `token_budget` · `tokenBudget` |
| Papel e instruções nucleares | `role` · `identity` · `purpose` |
| Skills e composição | `skills` · `optionalSkills` · `chains` |
| Diretivas comportamentais | `always` · `never` |
| Genome: capacidades/fronteiras | `capabilities` · `inputs` · `outputs` · `permissions` · `handoffs` · `memory` · `evaluation` |
| Extensões opcionais | `process` · `references` |

Chaves desconhecidas (JSON futuro) são anexadas em ordem alfabética após as conhecidas — a migração nunca descarta conteúdo silenciosamente. O output não contém timestamps nem campos calculados; o YAML é parseável por qualquer parser padrão (strings entre aspas duplas com escaping completo ou block scalars literais com chomping exato).

Exemplo (trecho real de `software-architect.yaml`):

```yaml
source: "agents/architect-agent.json"
name: "Software Architect"
version: "2.8.0"
role: "System Design de alta escala, Clean Architecture, DDD..."
chains:
  design_system:
    - "memoria-projeto"
    - "requirement-analyzer"
handoffs:
  - to: "senior-engineer"
    reason: "implementacao"
evaluation:
  metrics:
    - "correctness"
  minScore: 0.7
```

## Garantias

- **Idempotência byte-a-byte**: funções puras, ordem canônica de chaves, zero relógio no output. Rodadas repetidas sobre a mesma árvore produzem os mesmos bytes (verificável por sha256 da árvore).
- **Fidelidade campo-a-campo**: todo valor presente no JSON é emitido; ausência é omissão explícita. Cada arquivo renderizado passa por **round-trip interno obrigatório**: o leitor do subconjunto relê o YAML e compara profundamente com a estrutura esperada — divergência interrompe com motivo preciso.
- **Falha loud**: JSON inválido, `name` vazio, papel ausente (`role`/`purpose`), tipo errado, colisão de slug ou falha de round-trip = exit 1 com motivo por arquivo. Nunca stub silencioso.
- **Fonte intocada**: nada é escrito fora de `--dest`; destino dentro da fonte (ou vice-versa) é rejeitado.
- **Órfãos nunca apagados silenciosamente**: YAML sem JSON de origem é reportado e marca fora-de-sincronia; a remoção é decisão humana.

## Limitações conhecidas

- O leitor interno cobre apenas o subconjunto emitido (mapas/listas por indentação, escalares double-quoted, block scalars `|`/`|-`/`|+`, `[]`/`{}`) — não é um parser YAML geral; validação externa independente deve usar parser padrão.
- Strings multiline que **começam com whitespace** caem no fallback double-quoted (escapes `\n`), preservando fidelidade às custas de legibilidade. No corpus atual esse caso não ocorre.
- Listas aninhadas dentro de itens de lista não fazem parte do subconjunto (erro loud se aparecerem).

## Estrutura

```
packages/agent-migrator/
├── cli.mjs        # entrada CLI (--src --dest --check --json)
├── migrate.mjs    # biblioteca: slug, emitter YAML, leitor do subconjunto, round-trip, migração
├── package.json
└── README.md
```
