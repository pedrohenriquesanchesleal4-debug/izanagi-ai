# Izanagi AI — Agents

> Agents are compositions of skills. Each agent has a role, a set of skills it masters,
> and a default skill chain for common tasks.

---

## Available Agents (14 Specialized Agents)

| Agent | Command | Role | File |
|-------|---------|------|------|
| **Discovery** | `/discovery` | Pré-produção: entrevista condicional, pesquisa de referências, direções e prompt rico | `discovery-agent.json` |
| **Animation Engineer** | `/animation` | Scrollytelling, WebGL 3D, motion signature, design cinematográfico | `animation-agent.json` |
| **Software Architect** | `/architect` | System design, Clean Arch, Hexagonal, DDD, CQRS, ADRs | `architect-agent.json` |
| **Senior Engineer** | `/senior-engineer` | Full-stack development, refactoring, código limpo e testável | `senior-engineer-agent.json` |
| **Tech Lead** | `/techlead` | Code review rigoroso, governança de arquitetura e mentoria | `techlead-agent.json` |
| **Automation Engineer** | `/automation-engineer` | Automação de processos: planilhas, browser, API, ETL (Python padrão, idempotência, retries) | `automation-engineer-agent.json` |
| **Security Engineer** | `/security` | Mitigação OWASP Top 10, auth, secure coding e secrets | `security-agent.json` |
| **DevOps Engineer** | `/devops` | Pipelines CI/CD, Docker, Kubernetes, IaC e observabilidade | `devops-agent.json` |
| **Database Engineer** | `/database` | Modelagem de dados, otimização SQL, PostgreSQL, Redis | `database-agent.json` |
| **QA & Test Automation Engineer** | `/qa` | Testes unitários, integração, E2E (Playwright), acessibilidade (WCAG), quality gates 🆕 | `qa-agent.json` |
| **Bug Hunter** | `/bug-hunter` | Debugging sistemático e análise de causa raiz | `bug-hunter-agent.json` |
| **Documentation Writer** | `/docs` | Documentação técnica, READMEs e diagramas UML | `docs-agent.json` |
| **Project Manager** | `/pm` | Sprints, milestones, análise de riscos técnicos | `pm-agent.json` |
| **Professor** | `/professor` | Ensino adaptativo, explicação didática e mentoria técnica | `professor-agent.json` |

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
