---
name: find-skills
description: "Roteador de skills: dada a tarefa, encontra as 1 a 3 skills do catálogo Izanagi que realmente se aplicam, lê só essas e descarta o resto. Resolve o problema de skills listadas e nunca usadas e o de ler skills demais. Use no início de qualquer tarefa não trivial, antes de escrever código."
triggers:
  - "qual skill usar para esta tarefa"
  - "começar uma tarefa nova de implementação, design, debug ou revisão"
  - "o agente não está usando as skills"
  - "find skills / achar a skill certa"
capabilities:
  - "skill-routing"
  - "progressive-disclosure"
  - "token-budgeting"
---

# Find Skills: roteamento de skills por tarefa

O catálogo tem mais de 100 skills. Ler todas custa caro e não ajuda; não ler nenhuma faz o agente responder como generalista. Esta skill é o meio-termo: **escolher poucas, ler de verdade, aplicar**.

## Quando usar

- Antes de implementar, revisar, depurar ou projetar algo que vá além de uma edição trivial.
- Quando o usuário citar um domínio (UI, segurança, banco, vídeo, automação) e você não souber qual skill cobre.

**Pule** para perguntas factuais curtas, edição de uma linha ou quando o usuário já nomeou a skill.

## Protocolo (4 passos, nesta ordem)

1. **Classifique a tarefa** em no máximo 2 domínios da tabela abaixo.
2. **Escolha 1 a 3 skills.** Nunca mais que 3 por tarefa. Uma skill primária (o "como fazer") e no máximo duas de verificação (o "como provar").
3. **Leia o `SKILL.md` de cada uma** (`.skills/<nome>/SKILL.md`, ou `skills/<nome>/SKILL.md` se a primeira não existir). Leia só o arquivo principal; `references/` apenas se o SKILL.md mandar.
4. **Declare em uma linha** o que vai aplicar: `Skills: tdd (ciclo red/green), anti-ai-slop (auditoria final)`. Isso deixa o uso auditável.

## Tabela de roteamento

| Domínio | Primária | Verificação |
|---|---|---|
| Feature / bugfix de código | `agentic-coding` ou `tdd` | `self-critique` |
| Bug difícil ou reincidente | `systematic-debugging` | `tdd` (teste de regressão) |
| UI, landing, site | `impeccable` ou `design-taste` | `anti-ai-slop`, `site-launch-checklist` |
| Motion, animação | `emil-kowalski` ou `motion-design` | `web-perf-seo` |
| Arquitetura / decisão estrutural | `software-architect` | `tradeoff-analyzer` |
| Plano antes de codar | `grilling` | `plan-cold-review` |
| Segurança / app feito com IA | `security-swarm-audit` | `defense-in-depth` |
| Banco de dados | `data-engineering` | `breaking-change-detector` |
| LLM, RAG, agentes | `ai-agent` | `prompt-engineering` |
| Automação, scraping, ETL | `automation-engineer` | `error-recovery` |
| Vídeo | `hyperframes` ou `remotion-video` | `video-post-production` |
| Repo grande ou desconhecido | `codebase-map` | `economia-tokens` |
| Trabalho repetitivo de um ofício | `task-playbook` | `evaluation` |
| Deploy, CI/CD, infra | `cloud-infra` | `sre-reliability` |

Se nada na tabela casar, procure por nome: liste `.skills/` e escolha pelo nome da pasta. Não leia descrições de 100 skills uma a uma.

## Regras

- **Ler é obrigatório, listar não conta.** Citar uma skill sem abrir o arquivo é o defeito que esta skill existe para matar.
- **Teto de 3.** Se a tarefa parece pedir 5 skills, ela deve ser quebrada em subtarefas, cada uma com o seu roteamento.
- **Não releia.** Skill já lida nesta sessão continua valendo; não abra de novo.
- **Skill errada se descarta rápido.** Se após ler a skill não se aplica, diga em uma linha e siga sem ela.

## Saída esperada

Uma linha no começo da resposta:

```
Skills: <primária> (<o que aplicar>), <verificação> (<o que conferir>)
```
