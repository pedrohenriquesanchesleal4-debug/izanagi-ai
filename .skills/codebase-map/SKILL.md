---
name: "codebase-map"
description: "Mapa persistente do repositório: gera uma vez um arquivo curto com módulos, pontos de entrada, dependências entre pastas e onde mora cada responsabilidade, e o consulta antes de abrir arquivos. Corta o custo de o agente reinvestigar o próprio projeto a cada pergunta. Use ao entrar num repo grande ou desconhecido, ou quando o agente estiver gastando token explorando. Gatilhos de ativação: codebase map: investigar uma vez, consultar sempre; quando usar; onde fica; como gerar (barato, sem ler tudo)."
version: 2.0.0
category: ai
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
    - mcp:execute_command
---

# Codebase Map: investigar uma vez, consultar sempre

> Migrado deterministicamente de `skills/codebase-map/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** IA & Agentes (`ai`)
- **Resumo:** Mapa persistente do repositório: gera uma vez um arquivo curto com módulos, pontos de entrada, dependências entre pastas e onde mora cada responsabilidade, e o consulta antes de abrir arquivos. Corta o custo de o agente reinvestigar o próprio projeto a cada pergunta.
- **Ativar quando:** Use ao entrar num repo grande ou desconhecido, ou quando o agente estiver gastando token explorando.
- **Escopo canônico:** Codebase Map: investigar uma vez, consultar sempre
- **Seções do corpo original:** Quando usar · Onde fica · Como gerar (barato, sem ler tudo) · Formato do mapa (máximo ~150 linhas) · Entradas
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Estrutura:

Estrutura: `git ls-files | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -40` para saber onde está o volume.

### Passo 2 — Entradas:

Entradas: `package.json` (`main`, `bin`, `scripts`), `Cargo.toml`, `pyproject.toml`, `go.mod`, `Dockerfile`, rotas.

### Passo 3 — Para cada pasta relevante, leia só cabeçalho e exports (grep -n "^export\|^def \|^func...

Para cada pasta relevante, leia só cabeçalho e exports (`grep -n "^export\|^def \|^func \|^pub fn" <pasta> | head`), não o corpo.

### Passo 4 — Dependências entre pastas:

Dependências entre pastas: `grep -rhoE "from ['\"](\.\./|@/|src/)[^'\"]+" src | sort | uniq -c | sort -rn | head -30`.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:ai -->

- Avaliar o output contra critério/dataset definido antes da execução (não 'pareceu bom').
- Confirmar validação estrutural de todo output/tool call consumido pela skill.
- Verificar presença das salvaguardas: timeout, retry criterioso, budget e isolamento contra prompt injection.
- Registrar exemplos de entrada/saída e taxa de falha observada na amostra testada.

## Common Rationalizations

- **"Modelo moderno entende sozinho, prompt detalhado é desperdício."**
  - Verdade: Sem few-shot, formato de saída estrito e guardrails, o output é probabilístico e imprevisível. Prompt engineering é especificação de comportamento — não decoração.
- **"Resposta plausível, então tá correto."**
  - Verdade: Plausibilidade é o produto, não a prova. Sem avaliação (dataset, critério, comparação), você está validando retórica — hallucinação apresentada como fato é falha classificada do framework.
- **"Embedding/recuperação ruim? Troco o modelo maior."**
  - Verdade: Trocar modelo mascara problema de chunking, consulta e qualidade de dados — e multiplica custo. Diagnostique o pipeline RAG antes de escalar o modelo.
- **"Jogo tudo no contexto, janela hoje é gigante."**
  - Verdade: Contexto inflado custa dinheiro, latência e atenção do modelo (lost in the middle). Economia de tokens é disciplina: contexto mínimo, cache, janela deslizante.
- **"Tool call retornou algo, sigo em frente."**
  - Verdade: Output de tool sem schema validado é dado não confiável entrando no raciocínio. Validar resposta é o mesmo anti-falhas de qualquer integração — LLM não é exceção.
- **"Prompt injection é teórico, meu caso é fechado."**
  - Verdade: Todo texto que entra pelo usuário/documento recuperado é superfície de injection. Fechado significa menos vetores, não zero — defesa custa uma instrução e um filtro.

## Red Flags

- Feature de LLM sem dataset/critério de avaliação (qualidade não medida).
- RAG respondendo sem citação/rastreabilidade da fonte recuperada.
- Tool/MCP exposto sem schema de entrada validado nem limite de escopo.
- Chamada de modelo sem timeout, retry criterioso ou budget de custo.
- Output do modelo parseado com confiança cega (sem validação estrutural).
- Instrução de sistema concatenada com input de usuário sem isolamento.
- Agente com efeito real no mundo sem dry-run nem confirmação de ação irreversível.

## Legacy Reference (v1)

# Codebase Map: investigar uma vez, consultar sempre

Agente sem mapa abre 20 arquivos para responder onde fica a autenticação. Com mapa, lê 1 arquivo de 150 linhas e abre direto o certo. Ferramentas como Graphify e Codebase Memory MCP indexam o repo num grafo; esta skill faz a versão sem dependência, em Markdown, que qualquer CLI lê.

## Quando usar

- Primeira tarefa num repo com mais de ~50 arquivos de código.
- Sempre que você se pegar abrindo arquivo só para descobrir o que ele faz.

**Pule** em repos pequenos (o próprio `ls` já é o mapa).

## Onde fica

`.agents/memoria/mapa.md`. Se já existe, **leia ele primeiro** e só depois abra código.

## Como gerar (barato, sem ler tudo)

1. Estrutura: `git ls-files | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -40` para saber onde está o volume.
2. Entradas: `package.json` (`main`, `bin`, `scripts`), `Cargo.toml`, `pyproject.toml`, `go.mod`, `Dockerfile`, rotas.
3. Para cada pasta relevante, leia só cabeçalho e exports (`grep -n "^export\|^def \|^func \|^pub fn" <pasta> | head`), não o corpo.
4. Dependências entre pastas: `grep -rhoE "from ['\"](\.\./|@/|src/)[^'\"]+" src | sort | uniq -c | sort -rn | head -30`.

## Formato do mapa (máximo ~150 linhas)

```markdown
# Mapa do repositório (gerado em AAAA-MM-DD, commit abc1234)

## Entradas
- CLI: bin/app.js -> src/cli/index.ts
- HTTP: src/server.ts (rotas em src/routes/)

## Módulos
| Pasta | Responsabilidade | Arquivos-chave |
|---|---|---|
| src/auth | sessão, JWT, middleware | session.ts, guard.ts |

## Fluxos principais
- Login: routes/auth.ts -> auth/session.ts -> db/users.ts

## Armadilhas
- dist/ é gerado; editar src/.
```

## Manutenção

- Atualize a linha do módulo que você mudou ao terminar a tarefa (uma edição, não regenerar tudo).
- Se o commit do cabeçalho estiver muito atrás (`git rev-list --count <commit>..HEAD` > 50), regenere.
- O mapa é guia, não verdade: se ele divergir do código, o código vence e o mapa é corrigido.

## Ferramentas externas (opcionais)

Se o usuário quiser automatizar: Codebase Memory MCP ou Graphify indexam o projeto num grafo consultável. Troca publicada pelos próprios projetos: muito menos contexto por pergunta, com alguma perda de precisão frente a ler o arquivo. Use o grafo para localizar e leia o arquivo antes de editar.
