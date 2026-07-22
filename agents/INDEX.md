# Nexus AI — Agents

> Agents are compositions of skills. Each agent has a role, a set of skills it masters,
> and a default skill chain for common tasks.

---

## Available Agents

| Agent | Role | Skills | File |
|-------|------|--------|------|
| **Software Architect** | System design & architecture | Software Architect, Clean Arch, Hexagonal, DDD, CQRS | `architect-agent.json` |
| **Senior Engineer** | Full-stack development & code quality | Backend, Frontend, Code Review, Refactoring, Testing | `senior-engineer-agent.json` |
| **Bug Hunter** | Debugging & root cause analysis | Debug Specialist, Bug Hunter, Root Cause Analyzer | `bug-hunter-agent.json` |
| **Security Engineer** | Application security | Security Engineer, OWASP Auditor, Pentest Reviewer | `security-agent.json` |
| **Professor** | Teaching & mentoring | Professor Mode, Mentor Mode, Explainer, Interactive | `professor-agent.json` |
| **DevOps Engineer** | Infrastructure & deployment | DevOps, Docker, K8s, CI/CD, Monitoring, Linux | `devops-agent.json` |
| **Database Engineer** | Data modeling & optimization | Database Engineer, SQL Optimizer, PostgreSQL, Redis | `database-agent.json` |
| **Project Manager** | Delivery management | Project Manager, Task Planner, Release Planner, Risk Analyzer | `pm-agent.json` |
| **Tech Lead** | Team & technical leadership | Tech Lead, Code Review, Architecture, Mentoring | `techlead-agent.json` |
| **Documentation Writer** | Technical documentation | Documentation Writer, Technical Writer, README, UML | `docs-agent.json` |

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
