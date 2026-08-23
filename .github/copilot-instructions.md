# Izanagi AI: GitHub Copilot Instructions

> **Fonte da verdade: `AGENTS.md`**: o Copilot lê `AGENTS.md` nativamente. Este arquivo reforça as regras essenciais e indexa os agentes do framework.

## Regras essenciais

- **Arquitetura antes de código.** Pense antes de agir; arquitetura primeiro, código depois.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA": identidade visual bespoke por nicho, zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção.** Reflita após cada tarefa; registre erros; evolua.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.
- **Qualidade é medida.** Se não pode ser medido, não pode ser melhorado.

## Sempre

- Arquitetura antes de código; IaC versionado; monitoramento desde o dia 1; secrets por ferramenta própria.

## Nunca

- Commit `.env`; container root; deploy sem CI; hardcode de configuração de ambiente; código genérico "cara de IA".

## Agentes do framework

- `adversarial-critic`: Crítica adversarial de implementações: caçar bugs, falhas de segurança, problemas de arquitetura, requisitos faltantes, problemas de performance, edge cases, suposições incorretas, overengineering e AI slop
- `agent-architect`: Projeto de novos agentes especializados: Requirements → Capability Analysis → Skill Discovery → Composition → Prompt Generation → Guardrails → Evaluation → Agent Genome → Registration
- `ai-engineer`: Engenheiro de Software especializado em construir features com IA/LLM: RAG, embeddings e vector DBs, agentes autônomos (ReAct/Plan-and-Execute), tool-calling e MCP, prompt engineering versionado, avaliação/guardrails de saída de LLM, streaming e trade-offs reais de custo/latência/qualidade por tier de modelo. Não é o "senior-engineer genérico com IA": é dono de tudo que envolve chamar, orquestrar ou avaliar um modelo de linguagem dentro do produto.
- `animation`: Motion Engineering & Experiências Cinematográficas Web (Awwwards SOTD / Apple Grade): Scrollytelling, GSAP ScrollTrigger/SplitText, WebGL 3D (Three.js/React Three Fiber), Smooth Scroll (Lenis), Micro-interações e Motion Signature
- `architect`: System Design de alta escala, Clean Architecture, DDD, CQRS, Hexagonal Architecture, ADRs, contratos de API e trade-offs operacionais
- `automation-engineer`: Engenheiro de Automações Profissionais: decompõe o processo, pesquisa soluções existentes, escolhe a melhor stack (qualquer linguagem: Python, TypeScript, C#, Go, Bash... a escolha é consequência do problema), implementa com validação, idempotência, retries, logging estruturado, testes, dry-run e documentação completa. Nunca gera scripts: projeta sistemas de automação confiáveis, testáveis, seguros e sustentáveis.
- `bug-hunter`: Debugging avançado em 6 fases (Reproduzir -> Isolar -> Hipótese -> Corrigir -> Verificar -> Prevenir), Root Cause Analysis (RCA), rastreamento empírico de stack traces e escrita de testes de regressão obrigatórios
- `database`: Modelagem de dados relacional e NoSQL (PostgreSQL, Redis, MongoDB), ORMs (Prisma/Drizzle/SQLAlchemy), indexação avançada, prevenção N+1, migrações atômicas sem downtime e query tuning (EXPLAIN ANALYZE)
- `devops`: Infraestrutura como Código (Terraform/OpenTofu), Docker multi-stage enxuto, Kubernetes, CI/CD automatizado (GitHub Actions), Observabilidade (OpenTelemetry/Prometheus) e deploys Zero Downtime
- `discovery`: Investigador de Pré-Produção: entrevista em 3 fases (~15 perguntas, uma por vez), pesquisa referências REAIS em 2 trilhas (visual + técnica), arquiteta a solução (blueprint + ADR-lite) e entrega um prompt rico de implementação. Nunca escreve código: o HARD-GATE só cai por dispensa explícita do usuário.
- `docs`: Technical Writing High-Craft: READMEs profissionais executáveis, documentação baseada no framework Diátaxis (Tutorials, How-to, Reference, Explanation), diagramas de arquitetura/sequência Mermaid.js, OpenAPI/Swagger e guias de onboarding
- `evaluator`: Avaliação estruturada de resultados de agentes e workflows: score por métricas, verdict (PASS/PASS_WITH_WARNINGS/FAIL/BLOCKED/UNKNOWN), detecção de regressões e recomendações acionáveis
- `form-engineer`: Engenharia de Formulários High-Craft: validação tipada Zod + React Hook Form, wizards multi-step com auto-save (localStorage/IndexedDB), feedback inline instantâneo, Optimistic UI e acessibilidade WCAG 2.2 AA
- `pm`: Technical Product & Project Management: decomposição de épicos em entregáveis granulares (WBS), escrita de User Stories em formato BDD (Given-When-Then), mapeamento de dependências críticas e matriz de riscos técnicos
- `product-reasoner`: Raciocínio de produto e requisitos: converte intenção vaga em entendimento estruturado, critérios de aceite BDD e evidências antes de qualquer código
- `professor`: Ensino Adaptativo & Mentoria Didática High-Craft: explicações pós-modificação de código em 3 blocos (O que mudou -> Por que mudou -> Conceito-chave), analogias intuitivas sem jargões e exercícios práticos de fixação
- `qa`: Quality Assurance & Test Automation Specialist: testes unitários (Vitest/Pytest/Jest), integração de APIs, E2E resiliente com Playwright, auditoria de acessibilidade WCAG 2.2 AA (axe-core) e Quality Gates
- `researcher`: Pesquisa estruturada baseada em evidência: coleta de fatos com fontes citadas, distinção FACT/ASSUMPTION/INFERENCE/UNKNOWN, priorização de fontes oficiais e relatório com nível de confiança
- `security`: Auditoria de segurança SAST/DAST, mitigação OWASP Top 10, autenticação robusta (OAuth2/JWT/Argon2), blindagem de APIs, gestão de segredos, Defense-in-Depth e conformidade LGPD/GDPR
- `senior-engineer`: Full-Stack Software Engineer High-Craft: implementação profunda de ponta a ponta, Clean Code, TDD estrito, zero AI-Slop, zero stubs e ciclo vertical completo
- `skill-architect`: Arquitetura de novas skills: Capability Gap → Research → Draft → Examples → Tests → Security Scan → Evaluation → Register (zero skills desnecessárias)
- `techlead`: Liderança técnica operacional, Code Review pedagógico em 5 dimensões (Corretude, Segurança, Performance, Manutenibilidade, DX), governança de padrões de código e desbloqueio de engenheiros

Definições completas em `agents/*.json` e skills em `skills/<name>/SKILL.md`.

---
Gerado pelo Izanagi AI: `izanagi export --cli copilot`
