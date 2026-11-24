---
name: obsidian-vault-ops
description: "Cofre de conhecimento (Obsidian ou pasta Markdown) operado por agente: estrutura de pastas por área do negócio, CLAUDE.md de voz e contexto, pasta FILA para pedidos e GERADOS para entregas, briefings automáticos e revisão semanal. Use quando o usuário quiser um segundo cérebro, organizar o conhecimento do negócio para a IA ou automatizar rotinas sobre notas."
triggers:
  - "segundo cérebro / cofre no Obsidian"
  - "organizar notas para a IA usar"
  - "briefing automático antes de reunião"
  - "revisão semanal automática"
capabilities:
  - "vault-structure"
  - "queue-driven-generation"
  - "recurring-briefings"
---

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
