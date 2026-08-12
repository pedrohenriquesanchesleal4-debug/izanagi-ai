# Benchmarks

> Suíte de benchmarks do Izanagi AI — tarefas reais para medir o framework
> entre versões (regression benchmarking). Cada caso possui `task`,
> `requirements`, `expectedArtifacts`, `validators` e `metrics`.

---

## Executar

```bash
izanagi benchmark list            # lista todos os casos
izanagi benchmark run             # roda a suíte completa
izanagi benchmark run coding      # roda só um domínio
izanagi benchmark compare <a> <b> # compara duas versões (regression)
```

Relatórios ficam em `.izanagi/state/benchmarks/<id>.json` e são comparáveis
entre versões do framework.

## Domínios

| Domínio | Exemplos de caso |
|---|---|
| `coding` | função TypeScript tipada com testes |
| `debugging` | causa raiz de null-ref em SSR (Next.js) |
| `architecture` | monólito modular com ADRs e Mermaid |
| `security` | auditoria OWASP de API Express |
| `database` | schema PostgreSQL/Prisma com índices |
| `frontend` | landing dark com scroll-driven animation |
| `backend` | API REST com auth JWT + Zod |
| `automation` | ETL CSV → API com validação e retry |
| `research` | comparação de stack com fontes e confiança |
| `refactoring` | strangler fig com strategy pattern |

## Casos externos (custom)

Casos embutidos vivem em código (`src/runtime/benchmarks/definitions.ts`).
Para adicionar casos do seu projeto, crie arquivos `benchmarks/*.json` com o
formato abaixo — o registry carrega automaticamente (sem duplicar IDs dos
embutidos):

```json
{
  "id": "meu-caso",
  "domain": "coding",
  "task": "descrição da tarefa",
  "requirements": ["requisito 1", "requisito 2"],
  "expectedArtifacts": ["src/foo.ts"],
  "validators": [
    { "name": "no-stub", "message": "sem TODO", "check": "!text.includes(\"TODO\")" }
  ],
  "metrics": ["correctness", "maintainability"],
  "tags": ["custom"]
}
```

Os `validators.check` são expressões JS sobre `text` (output em string).
Consulte `benchmarks/requirements-bdd.json` para um exemplo completo.

## Critérios de qualidade

Uma mudança no framework só é considerada melhoria se não piorar:

- success rate (taxa de casos passando)
- score médio (qualidade dos artefatos)
- consumo de tokens por caso
- latência
- taxa de regressão (delta negativo entre versões)

> "Melhorias" que apenas aumentam o prompt e consomem mais tokens sem
> melhorar o score são rejeitadas — o benchmark existe para provar.