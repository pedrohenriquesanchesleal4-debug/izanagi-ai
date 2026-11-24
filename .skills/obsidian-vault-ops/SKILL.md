---
name: "obsidian-vault-ops"
description: "Cofre de conhecimento (Obsidian ou pasta Markdown) operado por agente: estrutura de pastas por área do negócio, CLAUDE.md de voz e contexto, pasta FILA para pedidos e GERADOS para entregas, briefings automáticos e revisão semanal. Use quando o usuário quiser um segundo cérebro, organizar o conhecimento do negócio para a IA ou automatizar rotinas sobre notas. Gatilhos de ativação: obsidian vault ops: o negócio em arquivos que a ia lê; quando usar; estrutura; system/claude.md (curto, atualizado toda semana)."
version: 2.0.0
category: ai
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
    - mcp:execute_command
---

# Obsidian Vault Ops: o negócio em arquivos que a IA lê

> Migrado deterministicamente de `skills/obsidian-vault-ops/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** IA & Agentes (`ai`)
- **Resumo:** Cofre de conhecimento (Obsidian ou pasta Markdown) operado por agente: estrutura de pastas por área do negócio, CLAUDE.md de voz e contexto, pasta FILA para pedidos e GERADOS para entregas, briefings automáticos e revisão semanal.
- **Ativar quando:** Use quando o usuário quiser um segundo cérebro, organizar o conhecimento do negócio para a IA ou automatizar rotinas sobre notas.
- **Escopo canônico:** Obsidian Vault Ops: o negócio em arquivos que a IA lê
- **Seções do corpo original:** Quando usar · Estrutura · SYSTEM/CLAUDE.md (curto, atualizado toda semana) · Fila → gerados (o motor mais simples) · Rotinas (cada uma é um prompt + um gatilho)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Usuário cria 07-FILA/DRAFT-<tipo-<tema.md com notas, ângulo e dados.

Usuário cria `07-FILA/DRAFT-<tipo>-<tema>.md` com notas, ângulo e dados.

### Passo 2 — O agente pega o arquivo, lê CLAUDE.md e a pesquisa relacionada, escreve em 08-GERADOS/...

O agente pega o arquivo, lê `CLAUDE.md` e a pesquisa relacionada, escreve em `08-GERADOS/` e move o pedido para `07-FILA/feito/`.

### Passo 3 — Usuário edita e publica.

Usuário edita e publica. Nada sai para fora sem aprovação humana.

Convenções curtas valem mais que integrações: `RECEBIDO: R$ 3.000 - Cliente - mensalidade` numa nota do dia é suficiente para o agente lançar a receita.

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

# Obsidian Vault Ops: o negócio em arquivos que a IA lê

Três peças: o cofre guarda (Obsidian ou qualquer pasta Markdown), o agente entende (Claude Code, Antigravity, Codex) e um automatizador dispara no horário (n8n, cron, Task Scheduler). Arquivo de texto simples é a memória mais barata e portátil que existe.

## Quando usar

Pedido de "segundo cérebro", de organizar conhecimento para IA, ou de rotinas recorrentes sobre notas (briefing, rascunho, revisão).

**Comece pequeno.** Construir tudo de uma vez é o jeito mais rápido de não construir nada: fim de semana para estrutura + CLAUDE.md; uma automação por semana depois.

## Estrutura

```
cofre/
  SYSTEM/CLAUDE.md   # lido por toda automação antes de agir
  01-CLIENTES/       # uma pasta por cliente (log de conversas, pendências)
  02-PROJETOS/       # uma pasta por projeto (status, próximo marco)
  03-OPERACOES/      # como o negócio funciona (processos)
  04-CONTEUDO/       # rascunhos, calendário, posts
  05-FINANCAS/       # receitas, despesas, notas
  06-PESQUISA/       # notas, briefings, referências
  07-FILA/           # pedidos para o agente (entrada)
  08-GERADOS/        # o que o agente entrega (saída)
```

## SYSTEM/CLAUDE.md (curto, atualizado toda semana)

Negócio (quem atende, como ganha dinheiro) · clientes ativos e status · projetos ativos e próximo marco · voz (tom, palavras que usa e que nunca usa) · meta acompanhada · **foco da semana** (a seção que mais muda a qualidade das respostas).

## Fila → gerados (o motor mais simples)

1. Usuário cria `07-FILA/DRAFT-<tipo>-<tema>.md` com notas, ângulo e dados.
2. O agente pega o arquivo, lê `CLAUDE.md` e a pesquisa relacionada, escreve em `08-GERADOS/` e move o pedido para `07-FILA/feito/`.
3. Usuário edita e publica. Nada sai para fora sem aprovação humana.

Convenções curtas valem mais que integrações: `RECEBIDO: R$ 3.000 - Cliente - mensalidade` numa nota do dia é suficiente para o agente lançar a receita.

## Rotinas (cada uma é um prompt + um gatilho)

| Rotina | Lê | Entrega |
|---|---|---|
| Pulso dos projetos (manhã) | `02-PROJETOS/*` | em dia, travado, atrasado, o que precisa de você |
| Briefing pré-reunião (30 min antes) | pasta do cliente | linha do tempo, prometido vs entregue, abertos, 3 pautas |
| Revisão semanal (domingo) | notas da semana | o que avançou e por quê, o que travou, padrão da semana, 3 prioridades |

## Regras

- Automação só lê e escreve dentro do cofre; envio de e-mail, cobrança ou post exige aprovação.
- Dado sensível (financeiro, cliente) fica fora de repositório público e de sincronização sem criptografia.
- Rotina que ninguém leu por 2 semanas é desligada.
