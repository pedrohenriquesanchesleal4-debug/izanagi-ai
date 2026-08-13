# Izanagi AI — Agents

> Agents are compositions of skills. Each agent has a role, a set of skills it masters,
> and a default skill chain for common tasks.

---

## Available Agents (21 Core Agents)

| Agent | Command | Role | File |
|-------|---------|------|------|
| **Discovery** | `/discovery` | Pré-produção: entrevista condicional, pesquisa de referências, direções e prompt rico | `discovery-agent.json` |
| **Product Reasoner** | `/product-reasoner` | Raciocínio de produto: intenção vaga → requisitos estruturados, critérios BDD e evidências | `product-reasoner-agent.json` |
| **Animation Engineer** | `/animation` | Scrollytelling, WebGL 3D, motion signature, design cinematográfico | `animation-agent.json` |
| **Software Architect** | `/architect` | System design, Clean Arch, Hexagonal, DDD, CQRS, ADRs | `architect-agent.json` |
| **Senior Engineer** | `/senior-engineer` | Full-stack development, refactoring, código limpo e testável | `senior-engineer-agent.json` |
| **Tech Lead** | `/techlead` | Code review rigoroso, governança de arquitetura e mentoria | `techlead-agent.json` |
| **Automation Engineer** | `/automation-engineer` | Automação de processos: planilhas, browser, API, ETL (Python padrão, idempotência, retries) | `automation-engineer-agent.json` |
| **Security Engineer** | `/security` | Mitigação OWASP Top 10, auth, secure coding e secrets | `security-agent.json` |
| **DevOps Engineer** | `/devops` | Pipelines CI/CD, Docker, Kubernetes, IaC e observabilidade | `devops-agent.json` |
| **Database Engineer** | `/database` | Modelagem de dados, otimização SQL, PostgreSQL, Redis | `database-agent.json` |
| **QA & Test Automation Engineer** | `/qa` | Testes unitários, integração, E2E (Playwright), acessibilidade (WCAG), quality gates | `qa-agent.json` |
| **Bug Hunter** | `/bug-hunter` | Debugging sistemático e análise de causa raiz | `bug-hunter-agent.json` |
| **Documentation Writer** | `/docs` | Documentação técnica, READMEs e diagramas UML | `docs-agent.json` |
| **Project Manager** | `/pm` | Sprints, milestones, análise de riscos técnicos | `pm-agent.json` |
| **Professor** | `/professor` | Ensino adaptativo, explicação didática e mentoria técnica | `professor-agent.json` |
| **Researcher** | `/researcher` | Pesquisa estruturada baseada em evidência: FACT/ASSUMPTION/INFERENCE/UNKNOWN, fontes citadas | `researcher-agent.json` |
| **Evaluator** | `/evaluator` | Avaliação estruturada de resultados: score por métricas, verdict, detecção de regressões | `evaluator-agent.json` |
| **Adversarial Critic** | `/adversarial-critic` | Crítica destrutiva-construtiva: bugs, segurança, arquitetura, edge cases, overengineering | `adversarial-critic-agent.json` |
| **Form & UI Engineer** | `/form-engineer` | Formulários High-Craft: Zod + React Hook Form, wizards, auto-save, WCAG 2.2 AA | `form-engineer-agent.json` |
| **Agent Architect** | `/agent-architect` | Fábrica de agentes: Capability Analysis → Skill Discovery → Genome → Registration | `agent-architect-agent.json` |
| **Skill Architect** | `/skill-architect` | Fábrica de skills: Capability Gap → Draft → Tests → Security Scan → Register | `skill-architect-agent.json` |

Agentes core: 21 arquivos em `agents/*.json` (fonte de verdade, contagem derivada de `.manifest`).
Agentes gerados sob demanda ficam em `agents/generated/` (ex.: `c-systems-engineer.json`, criado pela Agent Factory para uma lacuna real e mantido por ter uso ativo — ver `izanagi agent create`).

---

## Agent Format

```json
{
  "name": "Agent Name",
  "version": "1.0.0",
  "role": "Description",
  "skills": ["skill-1", "skill-2"],
  "default_chain": {
    "new_project": ["skill-a", "skill-b"],
    "bug": ["skill-c", "skill-d"]
  },
  "model": "recommended-model",
  "token_budget": 4096
}
```
