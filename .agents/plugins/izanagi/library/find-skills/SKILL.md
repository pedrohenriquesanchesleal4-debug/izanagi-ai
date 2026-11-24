---
name: "find-skills"
description: "Roteador de skills: dada a tarefa, encontra as 1 a 3 skills do catálogo Izanagi que realmente se aplicam, lê só essas e descarta o resto. Resolve o problema de skills listadas e nunca usadas e o de ler skills demais. Use no início de qualquer tarefa não trivial, antes de escrever código. Gatilhos de ativação: find skills: roteamento de skills por tarefa; quando usar; protocolo (4 passos, nesta ordem); tabela de roteamento."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Find Skills: roteamento de skills por tarefa

> Migrado deterministicamente de `skills/find-skills/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Roteador de skills: dada a tarefa, encontra as 1 a 3 skills do catálogo Izanagi que realmente se aplicam, lê só essas e descarta o resto. Resolve o problema de skills listadas e nunca usadas e o de ler skills demais.
- **Ativar quando:** Use no início de qualquer tarefa não trivial, antes de escrever código.
- **Escopo canônico:** Find Skills: roteamento de skills por tarefa
- **Seções do corpo original:** Quando usar · Protocolo (4 passos, nesta ordem) · Tabela de roteamento · Regras · Saída esperada
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Classifique a tarefa em no máximo 2 domínios da tabela abaixo.

**Classifique a tarefa** em no máximo 2 domínios da tabela abaixo.

### Passo 2 — Escolha 1 a 3 skills.

**Escolha 1 a 3 skills.** Nunca mais que 3 por tarefa. Uma skill primária (o "como fazer") e no máximo duas de verificação (o "como provar").

### Passo 3 — Leia o SKILL.md de cada uma (.skills/<nome/SKILL.md, ou skills/<nome/SKILL.md se a prim...

**Leia o `SKILL.md` de cada uma** (`.skills/<nome>/SKILL.md`, ou `skills/<nome>/SKILL.md` se a primeira não existir). Leia só o arquivo principal; `references/` apenas se o SKILL.md mandar.

### Passo 4 — Declare em uma linha o que vai aplicar:

**Declare em uma linha** o que vai aplicar: `Skills: tdd (ciclo red/green), anti-ai-slop (auditoria final)`. Isso deixa o uso auditável.

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
| Design system / marca de referência | `design-md` | `anti-ai-slop` |
| Pedido visual vago, efeito de scroll, hero | `web-design-vocabulary` | `animation-web` |
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
| Setup do agente, custo alto, skills ignoradas | `setup-recommender` | `economia-tokens` |
| Achar clientes, validar demanda | `lead-finder` | `grilling` |
| Segundo cérebro, notas, rotinas sobre arquivos | `obsidian-vault-ops` | `task-playbook` |

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
