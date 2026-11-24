---
name: codebase-map
description: "Mapa persistente do repositório. Use ao entrar num repo grande ou desconhecido, ou quando o agente estiver gastando…"
---

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

> Gerado pelo Izanagi AI: cópia fiel de `skills/codebase-map/SKILL.md` (fonte da verdade).
