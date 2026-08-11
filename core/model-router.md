# Model Router & Adaptive Routing

> Status: **IMPLEMENTED** — `src/runtime/model/router.ts`, `src/runtime/routing/scorer.ts`, `resolver.ts`
> Versão: 3.0.0 | Compatibilidade: >= 2.0.0

## Propósito

O Izanagi não depende conceitualmente de um único provider. O Model Router seleciona o modelo por complexidade da tarefa, exigência de raciocínio, risco, custo, latência, janela de contexto e histórico de performance. Tarefa simples nunca consome modelo caro desnecessariamente.

## Providers

Catálogo default: OpenAI (gpt-4o-mini / gpt-4o / gpt-4.1), Anthropic (claude-haiku-4-5 / claude-sonnet-4-5 / claude-opus-4-1), Google (gemini-2.0-flash / gemini-2.5-pro). Extensível via config do projeto.

## Tiers

`fast` (simples, barato, rápido) · `balanced` (default) · `premium` (raciocínio alto, risco alto, contexto gigante).

## Routing Context

```json
{
  "task": "...",
  "taskComplexity": 1-5,
  "reasoningRequirement": "low|medium|high",
  "risk": 0.2,
  "tokenBudget": 16000,
  "requiresTools": false,
  "historicalPerformance": {}
}
```

## Candidate Scoring

```json
{
  "candidate": "database-agent",
  "relevance": 0.97,
  "historicalSuccess": 0.93,
  "compatibility": 1,
  "risk": 0.08,
  "cost": 0.31,
  "finalScore": 0.91
}
```

Pesos: relevance 0.40, historicalSuccess 0.20, compatibility 0.15, risk 0.10, cost 0.10, latency 0.05.

Relevância semântica: tokenização + overlap de termos (sem dependências externas, determinística).

## Agent Genome & Skill Manifest

- Agentes: `name, version, purpose, capabilities, requiredSkills, optionalSkills, inputs, outputs, constraints, permissions, handoffs, memory, evaluation, tokenBudget, compatibility` (+ campos legacy preservados).
- Skills: `name, version, description, capabilities, triggers, dependencies, inputs, outputs, permissions, compatibility, risk, tokenBudget, evaluation, examples, changelog` — parseados do frontmatter.

## CLI

```bash
izanagi agent list | inspect <name>
izanagi skill list | search <q> | inspect <name>
```

## Testes

`src/runtime/tests/routing.test.ts` — cobertura: scoring, relevância semântica, rank de skills/agentes, model routing.
