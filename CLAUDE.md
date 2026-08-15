# Izanagi AI — Claude Code Integration

Este projeto usa o **Izanagi AI Framework** — framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e 22 agentes pré-definidos.

## Fonte da verdade

Este arquivo já cobre agentes, skills e regras essenciais do dia a dia — não precisa ler mais nada de saída. Consulte sob demanda só quando a tarefa exigir o tópico específico:

- `AGENTS.md` — só para: comandos avançados de dev, estrutura completa de pastas, release flow
- `SYSTEM.md` — só para: detalhes de engines internas, quality gates, arquitetura de memória
- `RULES.md` — só para: regras operacionais que não estejam listadas abaixo

## Agentes nativos (Agent tool)

Os 22 agentes em `.claude/agents/*.md` são **subagents nativos do Claude Code**: aparecem no Agent tool e o Claude delega sozinho quando a `description` de cada um bate com a tarefa (não precisa chamar por nome). Chame também por `/<slug>` em `.claude/commands/` quando quiser forçar um agente específico.

| Agente | Quando usar |
|---|---|
| `adversarial-critic` | Crítica adversarial de implementações: caçar bugs, falhas de… |
| `agent-architect` | Projeto de novos agentes especializados: Requirements → Capability… |
| `ai-engineer` | Engenheiro de Software especializado em construir features com… |
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

## Skills (biblioteca inteira, nativa)

Todas as 103 skills da biblioteca (`skills/<name>/SKILL.md`) foram exportadas fielmente para `.claude/skills/<name>/SKILL.md`. O Claude Code descobre nome+descrição de cada uma automaticamente ao abrir este projeto (custo fixo pequeno por skill) e só lê o corpo completo quando de fato a ativa — não é preciso listá-las aqui de novo nem chamar `izanagi export` para elas aparecerem. Peça por nome ("use a skill X") ou deixe o Claude escolher pela descrição; cada agente nativo também referencia as suas em "Skills relevantes" no próprio `.claude/agents/<slug>.md`.

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
