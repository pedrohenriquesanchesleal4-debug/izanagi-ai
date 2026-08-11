---
name: handoff-protocol
description: "Protocolo formal de handoff entre agentes: transição estruturada com motivo, contexto mínimo, artefatos, decisões, constraints e questões em aberto. Nunca passar contexto livre ou payloads gigantes — só o que o agente seguinte precisa. Use em toda transição de agente dentro de um execution graph ou swarm."
version: 1.0.0
triggers:
  - handoff
  - repassar
  - transição de agente
  - passar para o próximo
  - entregar para
  - mudança de agente
capabilities:
  - handoff estruturado
  - contexto mínimo por destinatário
  - rastreabilidade de decisões
  - questões em aberto explícitas
dependencies: []
token_budget: 400
compatibility: ">=3.0.0"
risk: low
---

# Handoff Protocol — Transição Estruturada Entre Agentes

> **Nunca passe contexto irrelevante. Nunca passe payloads gigantes entre agentes.**

## Formato do handoff

```json
{
  "from": "architect",
  "to": "database",
  "reason": "schema_required",
  "context": {},
  "artifacts": ["architecture.md", "adr-001.md"],
  "decisions": ["monolito modular escolhido"],
  "constraints": ["PostgreSQL 16", "prisma"],
  "openQuestions": ["particionamento de tenant?"]
}
```

## Regras

1. **reason** é obrigatória e específica (não "continuar trabalho"): `schema_required`, `fix_needed`, `verification_required`.
2. **artifacts** referenciam arquivos em disco — o agente seguinte lê do disco, nunca de texto copiado.
3. **context** contém apenas o que o destinatário precisa: contexto mínimo por handoff.
4. **decisions** registram o que já foi decidido para o destinatário não rediscutir.
5. **constraints** são limites técnicos inegociáveis.
6. **openQuestions** listam o que ficou em aberto — o destinatário decide ou devolve.

## Validação

- Handoff sem reason clara → inválido.
- Handoff sem artifacts → contexto livre proibido.
- Contexto com campos não usados pelo destinatário → cortar.

## Exemplo de cadeia

```text
Discovery → [requirements] → Architect → [architecture + ADR] → Database → [schema] → Senior Engineer → [implementation] → Critic → [fixes] → Evaluator → [report]
```
