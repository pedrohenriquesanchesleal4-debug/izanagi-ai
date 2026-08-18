# Izanagi AI: Claude Code Integration

Este projeto usa o **Izanagi AI Framework**: framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e 22 agentes pré-definidos.

## Fonte da verdade

Este arquivo já cobre agentes, skills e regras essenciais do dia a dia: não precisa ler mais nada de saída. Consulte sob demanda só quando a tarefa exigir o tópico específico:

- `AGENTS.md`: só para: comandos avançados de dev, estrutura completa de pastas, release flow
- `SYSTEM.md`: só para: detalhes de engines internas, quality gates, arquitetura de memória
- `RULES.md`: só para: regras operacionais que não estejam listadas abaixo

## Orquestrador (`/agents`)

Digite `/agents` (`.claude/commands/agents.md`) para o protocolo completo de decomposição + swarm paralelo quando o pedido cobrir 2+ domínios ou for um projeto novo. Para o caso comum (uma frente clara), pule direto para a tabela abaixo.

## Agentes nativos (Agent tool)

Os 22 agentes em `.claude/agents/*.md` são **subagents nativos do Claude Code** (Agent tool). **Regra de despacho: delegar é o padrão, responder direto como generalista é a exceção.** Para qualquer tarefa não-trivial que bata com uma linha da tabela abaixo, use o Agent tool com aquele agente antes de escrever a resposta você mesmo: não absorva o trabalho do especialista. Chame também por `/<slug>` em `.claude/commands/` quando quiser forçar um agente específico.

| Agente | Quando usar |
|---|---|
| `adversarial-critic` | Crítica adversarial de implementações: caçar bugs, falhas de segurança, problemas de arquitetura, requisitos faltantes, problemas de… |
| `agent-architect` | Projeto de novos agentes especializados: Requirements → Capability Analysis → Skill Discovery → Composition → Prompt Generation →… |
| `ai-engineer` | Engenheiro de Software especializado em construir features com IA/LLM: RAG, embeddings e vector DBs, agentes autônomos… |
| `animation` | Motion Engineering & Experiências Cinematográficas Web (Awwwards SOTD / Apple Grade): Scrollytelling, GSAP ScrollTrigger/SplitText, WebGL… |
| `architect` | System Design de alta escala, Clean Architecture, DDD, CQRS, Hexagonal Architecture, ADRs, contratos de API e trade-offs operacionais |
| `automation-engineer` | Engenheiro de Automações Profissionais: decompõe o processo, pesquisa soluções existentes, escolhe a melhor stack… |
| `bug-hunter` | Debugging avançado em 6 fases (Reproduzir -> Isolar -> Hipótese -> Corrigir -> Verificar -> Prevenir), Root Cause Analysis (RCA),… |
| `database` | Modelagem de dados relacional e NoSQL (PostgreSQL, Redis, MongoDB), ORMs (Prisma/Drizzle/SQLAlchemy), indexação avançada, prevenção N+1,… |
| `devops` | Infraestrutura como Código (Terraform/OpenTofu), Docker multi-stage enxuto, Kubernetes, CI/CD automatizado (GitHub Actions),… |
| `discovery` | Investigador de Pré-Produção: entrevista em 3 fases (~15 perguntas, uma por vez), pesquisa referências REAIS em 2 trilhas… |
| `docs` | Technical Writing High-Craft: READMEs profissionais executáveis, documentação baseada no framework Diátaxis… |
| `evaluator` | Avaliação estruturada de resultados de agentes e workflows: score por métricas, verdict (PASS/PASS_WITH_WARNINGS/FAIL/BLOCKED/UNKNOWN),… |
| `form-engineer` | Engenharia de Formulários High-Craft: validação tipada Zod + React Hook Form, wizards multi-step com auto-save (localStorage/IndexedDB),… |
| `pm` | Technical Product & Project Management: decomposição de épicos em entregáveis granulares (WBS), escrita de User Stories em formato BDD… |
| `product-reasoner` | Raciocínio de produto e requisitos: converte intenção vaga em entendimento estruturado, critérios de aceite BDD e evidências antes de… |
| `professor` | Ensino Adaptativo & Mentoria Didática High-Craft: explicações pós-modificação de código em 3 blocos… |
| `qa` | Quality Assurance & Test Automation Specialist: testes unitários (Vitest/Pytest/Jest), integração de APIs, E2E resiliente com Playwright,… |
| `researcher` | Pesquisa estruturada baseada em evidência: coleta de fatos com fontes citadas, distinção FACT/ASSUMPTION/INFERENCE/UNKNOWN, priorização… |
| `security` | Auditoria de segurança SAST/DAST, mitigação OWASP Top 10, autenticação robusta (OAuth2/JWT/Argon2), blindagem de APIs, gestão de… |
| `senior-engineer` | Full-Stack Software Engineer High-Craft: implementação profunda de ponta a ponta, Clean Code, TDD estrito, zero AI-Slop, zero stubs e… |
| `skill-architect` | Arquitetura de novas skills: Capability Gap → Research → Draft → Examples → Tests → Security Scan → Evaluation → Register… |
| `techlead` | Liderança técnica operacional, Code Review pedagógico em 5 dimensões (Corretude, Segurança, Performance, Manutenibilidade, DX),… |

**Depois de despachar, o agente não usa 1 skill isolada:** cada `.claude/agents/<slug>.md` termina com uma seção **Chains** (ex: `fullstack`, `bug`, `refactor`, `review`) que já define a sequência de 3 a 9 skills daquele domínio, na ordem em que uma alimenta a próxima. Identifique qual chain bate com o pedido e siga a sequência completa: acionar 1 skill e ignorar o resto da chain é a violação que a Regra 3 do `RULES.md` (Skill Composition Obrigatória) proíbe.

**Mapa rápido tarefa → agente(s) → chain:**
- Ideia vaga / ainda não sabe o que construir → `discovery` (entrevista + pesquisa) → `product-reasoner` (requisitos/BDD) → `architect`.
- Requisitos definidos, decisão estrutural em aberto → `architect` (ADR) → `senior-engineer` implementa.
- Implementar feature/CRUD/bugfix/refactor → `senior-engineer` (chains `implement`/`bug`/`refactor`/`fullstack` conforme o pedido).
- Feature com LLM/RAG/agentes/tool-calling → `ai-engineer`, não `senior-engineer`.
- Site/landing/dashboard novo → `discovery`/`architect` primeiro (Style Selector, regra 15), depois `senior-engineer` com a chain `fullstack` (inclui `anti-ai-slop` no fim, obrigatório).
- Cobrança/assinatura/checkout → `senior-engineer` com `payments-billing` na chain (webhook + idempotência, nunca liberar acesso pelo retorno do navegador).
- Antes de merge/deploy → `security` + `qa` + `techlead` em paralelo (chain `review`); `adversarial-critic` só se pedirem para caçar pontos cegos.
- Bug difícil/reincidente → `bug-hunter` (chain `systematic-debugging` → `tdd`).
- Nota objetiva PASS/FAIL contra critério já definido → `evaluator`; revisão pedagógica do "porquê" → `techlead`.

**Execução paralela obrigatória** para frentes independentes: cada agente roda com contexto isolado, só o resultado final volta. Casos canônicos de fan-out (protocolo completo em `/agents`):
- Feature nova (fronteiras estruturais independentes): `architect` + `database` + `security` em paralelo, depois `senior-engineer` implementa em sequência.
- Revisão de PR antes de merge: `security` + `qa` + `techlead` em paralelo por padrão (cada um responde uma pergunta diferente: risco de segurança, testes/cobertura, padrão de código); acrescente `adversarial-critic` só quando pedirem para caçar pontos cegos explicitamente.
- Nunca use um único agente genérico para um pedido que cobre 2+ domínios da tabela acima: divida em frentes e dispare em paralelo.

## Skills (biblioteca inteira, nativa)

Todas as 106 skills da biblioteca (`skills/<name>/SKILL.md`) foram exportadas fielmente para `.claude/skills/<name>/SKILL.md`. O Claude Code descobre nome+descrição de cada uma automaticamente ao abrir este projeto (custo fixo pequeno por skill) e só lê o corpo completo quando de fato a ativa: não é preciso listá-las aqui de novo nem chamar `izanagi export` para elas aparecerem. Peça por nome ("use a skill X") ou deixe o Claude escolher pela descrição; cada agente nativo também referencia as suas em "Skills relevantes" no próprio `.claude/agents/<slug>.md`.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA": identidade visual bespoke por nicho (rule 14), zinc-950/glassmorphism é uma direção possível, nunca o padrão default.
- **Zero travessão "—" e zero "--" duplo.** Ornamento de texto: usar "·", ":" ou ponto final. Hífen simples "-" (compostos, ranges, bullets) continua normal.
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas; use `/agents` para o protocolo completo.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

> Regras específicas de cada agente (always/never) vivem em `.claude/agents/<slug>.md`: lidas sob demanda só quando aquele agente é ativado, não duplicadas aqui.

---
Gerado pelo Izanagi AI em `C:\Users\pedro.leal\Documents\NexusAI`: `izanagi export --cli claude`
