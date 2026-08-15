# Izanagi AI — Claude Code Integration

Este projeto usa o **Izanagi AI Framework** — framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e 21 agentes pré-definidos.

## Fonte da verdade

Este arquivo já cobre agentes, skills e regras essenciais do dia a dia — não precisa ler mais nada de saída. Consulte sob demanda só quando a tarefa exigir o tópico específico:

- `AGENTS.md` — só para: comandos avançados de dev, estrutura completa de pastas, release flow
- `SYSTEM.md` — só para: detalhes de engines internas, quality gates, arquitetura de memória
- `RULES.md` — só para: regras operacionais que não estejam listadas abaixo

## Agentes nativos (Agent tool)

Os 21 agentes em `.claude/agents/*.md` são **subagents nativos do Claude Code**: aparecem no Agent tool e o Claude delega sozinho quando a `description` de cada um bate com a tarefa (não precisa chamar por nome). Chame também por `/<slug>` em `.claude/commands/` quando quiser forçar um agente específico.

| Agente | Quando usar |
|---|---|
| `adversarial-critic` | Crítica adversarial de implementações: caçar bugs, falhas de… |
| `agent-architect` | Projeto de novos agentes especializados: Requirements → Capability… |
| `animation` | Motion Engineering & Experiências Cinematográficas Web… |
| `architect` | System Design de alta escala, Clean Architecture, DDD, CQRS,… |
| `automation-engineer` | Engenheiro de Automações Profissionais — decompõe o processo,… |
| `bug-hunter` | Debugging avançado em 6 fases (Reproduzir -> Isolar -> Hipótese ->… |
| `database` | Modelagem de dados relacional e NoSQL (PostgreSQL, Redis, MongoDB),… |
| `devops` | Infraestrutura como Código (Terraform/OpenTofu), Docker multi-stage… |
| `discovery` | Investigador de Pré-Produção — entrevista em 3 fases… |
| `docs` | Technical Writing High-Craft: READMEs profissionais executáveis,… |
| `evaluator` | Avaliação estruturada de resultados de agentes e workflows: score… |
| `form-engineer` | Engenharia de Formulários High-Craft: validação tipada Zod + React… |
| `pm` | Technical Product & Project Management: decomposição de épicos em… |
| `product-reasoner` | Raciocínio de produto e requisitos: converte intenção vaga em… |
| `professor` | Ensino Adaptativo & Mentoria Didática High-Craft: explicações… |
| `qa` | Quality Assurance & Test Automation Specialist: testes unitários… |
| `researcher` | Pesquisa estruturada baseada em evidência: coleta de fatos com… |
| `security` | Auditoria de segurança SAST/DAST, mitigação OWASP Top 10,… |
| `senior-engineer` | Full-Stack Software Engineer High-Craft — implementação profunda de… |
| `skill-architect` | Arquitetura de novas skills: Capability Gap → Research → Draft →… |
| `techlead` | Liderança técnica operacional, Code Review pedagógico em 5… |

**Execução paralela**: para tarefas com frentes independentes, dispare vários agentes de uma vez — cada um roda com contexto isolado e só o resultado final volta. Casos canônicos de fan-out:
- Feature nova (fronteiras estruturais independentes): `architect` + `database` + `security` em paralelo, depois `senior-engineer` implementa em sequência.
- Revisão de PR antes de merge: `security` + `qa` + `techlead` em paralelo por padrão (cada um responde uma pergunta diferente: risco de segurança, testes/cobertura, padrão de código); acrescente `adversarial-critic` só quando pedirem para caçar pontos cegos explicitamente.

## Skills sempre carregadas

10 skills universais ficam nativas em `.claude/skills/<nome>/SKILL.md` (Claude Code carrega nome+descrição sempre; corpo completo só quando ativada):

- `caveman` — Ultra-compressed communication mode. Cuts output tokens…
- `brainstorming` — Transforma uma ideia bruta em design aprovado por…
- `deep-research` — Pesquisa multi-fonte na web: plano de busca, execução de…
- `frontend` — Design tokens do Tailwind e padrões de UI de alto craft…
- `tdd` — Test-Driven Development com Iron Law: escreva o teste…
- `security-privacy` — Use ao implementar autenticação, autorização, validação…
- `qa` — Use para auditar código antes de merge/deploy: TypeScript…
- `memoria-projeto` — Mantém memória persistente do projeto entre sessões…
- `economia-tokens` — Engenharia de contexto para reduzir consumo de tokens sem…
- `handoff-sessao` — Grava um resumo curto do estado da tarefa em andamento…

## Skills especializadas (via agente)

As outras 93 skills da biblioteca (`skills/<nome>/SKILL.md`) não ficam pré-carregadas — cada agente nativo já referencia as suas na seção "Skills relevantes" do próprio `.claude/agents/<slug>.md` e as lê sob demanda quando é ativado. Isso evita pagar ~100 tokens fixos por skill em toda sessão só por ela existir na biblioteca.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — identidade visual bespoke por nicho (rule 14), zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

> Regras específicas de cada agente (always/never) vivem em `.claude/agents/<slug>.md` — lidas sob demanda só quando aquele agente é ativado, não duplicadas aqui.

---
Gerado pelo Izanagi AI em `/home/pedro/Documentos/VsCode/izanagi-ai/izanagi-ai` — `izanagi export --cli claude`
