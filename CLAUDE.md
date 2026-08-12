# Izanagi AI — Claude Code Integration (v2.10.3)

Este projeto usa o **Izanagi AI Framework** (v2.10.3) — framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e 21 agentes especializados core + gerados.

## Fonte da verdade

> **Leia `AGENTS.md` antes de qualquer tarefa.** Ele é a referência completa do framework (agentes, comandos, estrutura, release flow). Este arquivo é apenas um resumo operacional.

- `AGENTS.md` — referência canônica do framework
- `SYSTEM.md` — fundação do sistema (engines, quality gates, memória)
- `RULES.md` — regras operacionais (incluindo Masterpiece Gate e Anti-Rush & Absolute Fidelity)

## Agentes Especializados (21 Core + Gerados)

Ative com `/` — os comandos do Swarm cobrem todos os domínios:
- `/agents` — Orquestrador Multi-Agente (Swarm Mode paralelo)
- `/discovery` — Investigador de Pré-Produção e prompt rico
- `/product-reasoner` — Requisitos com evidências FACT/ASSUMPTION/UNKNOWN e critérios BDD
- `/animation` — Diretor de Experiência Cinematográfica Web (Scrollytelling, WebGL)
- `/architect` — Arquiteto de Sistemas (Clean Arch, DDD, CQRS, ADRs)
- `/senior-engineer` — Full-Stack Engineer High-Craft com TDD estrito
- `/c-systems-engineer` — Engenharia C & Baixo Nível (gestão de memória, ponteiros, GCC/CMake, Valgrind)
- `/techlead` — Tech Lead (Code review pedagógico e governança)
- `/automation-engineer` — Engenheiro de Automações Profissionais (APIs, Browser, ETL)
- `/security` — Security Engineer (OWASP Top 10, Auth, SAST)
- `/devops` — DevOps Engineer (Docker, K8s, CI/CD, IaC)
- `/database` — Database Engineer (SQL, PostgreSQL, Redis, modelagem)
- `/qa` — QA & Test Automation Engineer (Unitários, Integração, E2E Playwright, WCAG)
- `/bug-hunter` — Debugging avançado & Root Cause Analysis
- `/docs` — Technical Writer (READMEs, diagramas, documentação Diátaxis)
- `/pm` — Project Manager (Sprints, milestones, análise de riscos)
- `/professor` — Professor / Mentor (Ensino adaptativo)
- `/researcher` — Pesquisa estruturada baseada em evidência
- `/evaluator` — Critério técnico e avaliação objetiva de entregas
- `/adversarial-critic` — Crítica destrutiva-construtiva e pontos cegos
- `/form-engineer` — Engenharia de Formulários High-Craft (Zod + React Hook Form, Wizards)
- `/agent-architect` & `/skill-architect` — Fábrica de Agentes e Skills sob demanda

## Regras Inegociáveis & Masterpiece Gate

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — estética Apple-like/Awwwards (`bg-zinc-950`, glassmorphism, bento grids, micro-interações).
- **Anti-Rush & Absolute Fidelity to References (Lei da Fidelidade Absoluta a Referências):** Proibido respostas apressadas ou estudo superficial de referências (ex: `igloo.inc`). Exigida decompilação rigorosa de grid, tipografia, animações e micro-interações para entrega de excelência *High-Craft* autêntica.
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Zero Stubs / Zero Lazy Code:** Toda entrega deve ser profunda, rica e funcional de primeira.

---
Gerado pelo Izanagi AI em `C:\Users\pedro.leal\Documents\NexusAI` — `izanagi export --cli claude`
