# IZANAGI AI — Checkpoint & Self-Healing Swarm Engine

> Version 1.0.0
> Commercial-Grade Meta-Framework Extension (Inspirado em LangGraph + MetaGPT + CrewAI)

---

## 1. Visão Geral

O **Checkpoint & Self-Healing Swarm Engine** é o módulo avançado que eleva o Izanagi ao padrão de frameworks comerciais de alta resiliência (como LangGraph e MetaGPT). Ele garante:
1. **Persistent State Checkpoints**: Salvamento de estado intermediário a cada passo da execução multi-agente, permitindo retomada exata (time-travel debugging) em caso de falha.
2. **Self-Healing Test-Fix Loops**: Se um teste falhar ou o build quebrar, o agente de correção (Bug Hunter / Senior Engineer) recebe automaticamente o log de erro exato, aplica o patch corretivo e revalida sem intervenção humana.
3. **Autonomous Multi-Agent Swarm Collaboration**: Sincronização paralela entre agentes especializados (ex: Database + Backend + Frontend + QA) com handoffs estruturados e validação cruzada.

---

## 2. Arquitetura de Execução Stateful

```
Task Input → Decision Engine → Parallel Swarm Dispatch
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
 [Database Agent]              [Senior Engineer]            [Security Agent]
 (Schema & Migrations)        (API & UI Implementation)     (OWASP Audit & Auth)
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      ▼
                            [Stateful Checkpoint]
                                      │
                             [Quality Gates & Tests]
                                      │
                          ┌───────────┴───────────┐
                      (Passo)                  (Falhou)
                          │                       │
                          ▼                       ▼
                     [Delivery]           [Self-Healing Loop]
                                          (Auto-fix com erro)
```

---

## 3. Protocolo de Auto-Cura (Self-Healing)

Quando o Quality Gate ou o comando de verificação (`npm run build`, testes) falhar:
1. **Captura do Erro**: O framework extrai o stack trace e o erro exato do terminal.
2. **Injeção Cirúrgica**: O erro é injetado diretamente no contexto do agente especialista responsável.
3. **Patch Automático**: O agente gera o diff corretivo.
4. **Revalidação**: O comando de teste é reexecutado de forma autônoma até o sucesso (`0 errors`).
