---
name: "evaluation"
description: "Avalia entregas de agentes por métricas ponderadas (corretude, cobertura, testes, arquitetura, segurança) com veredito PASS/FAIL, regressões e recomendações. Use antes de declarar qualquer entrega concluída. Gatilhos de ativação: evaluation skill — avaliação estruturada; identity; workflow; contrato de saída."
version: 2.0.0
category: testing
tools:
  mcp:
    - mcp:execute_command
---

# Evaluation Skill — Avaliação Estruturada

> Migrado deterministicamente de `skills/evaluation/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Testes & QA (`testing`)
- **Resumo:** Avalia entregas de agentes por métricas ponderadas (corretude, cobertura, testes, arquitetura, segurança) com veredito PASS/FAIL, regressões e recomendações.
- **Ativar quando:** Use antes de declarar qualquer entrega concluída.
- **Escopo canônico:** Evaluation Skill — Avaliação Estruturada
- **Seções do corpo original:** Identity · Workflow · Contrato de saída · Rules · Validation
- **Ferramentas MCP esperadas:** mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Colete evidência:

**Colete evidência**: logs de build, saída de testes, artefatos produzidos. Evidência > afirmação.

### Passo 2 — Meça métricas em escala 0-1:

**Meça métricas** em escala 0-1:

- `correctness` (0.3) — comportamento correto vs requisitos
   - `requirementCoverage` (0.15) — % dos requisitos cobertos
   - `testResults` (0.2) — testes passando / total
   - `architecture` (0.1) — aderência à arquitetura acordada
   - `security` (0.1) — ausência de vulnerabilidades conhecidas
   - `performance` (0.05) — atende aos limites de latência/recursos
   - `maintainability` (0.05) — complexidade, duplicação, clareza
   - `artifactValidity` (0.05) — artefatos válidos segundo contratos

### Passo 3 — Derive o verdict:

**Derive o verdict**:

- score >= 0.85 e zero testes falhando e zero regressões → **PASS**
   - score >= 0.70 → **PASS_WITH_WARNINGS**
   - testes falhando OU regressões OU score < 0.70 → **FAIL**
   - falha estrutural sem nenhum teste passando → **BLOCKED**
   - sem evidência suficiente → **UNKNOWN**

### Passo 4 — Detecte regressões:

**Detecte regressões**: compare com o estado anterior; liste qualquer comportamento piorado.

### Passo 5 — Recomende ações:

**Recomende ações**: ordenadas por impacto, concretas e verificáveis.

## Verification Steps

<!-- fonte da verificação: quality-section-original -->

- Verdict derivado dos thresholds: PASS >= 0.85, PASS_WITH_WARNINGS >= 0.70.
- Regressão ou teste falhando → nunca PASS.
- Score e confidence em [0,1].

## Common Rationalizations

- **"Escrevo os testes depois que o código estabiliza."**
  - Verdade: 'Depois' significa nunca — e o teste escrito após a implementação só confirma o que o código faz, não o que deveria fazer. TDD é lei: teste antes, veja falhar, código mínimo, refactor.
- **"Mockei tudo, suite verde, tá coberto."**
  - Verdade: Quando todo dependente é mock, o teste valida o mock contra ele mesmo. Integração real (API, banco, arquivo) precisa de pelo menos um teste que atravesse a borda verdadeira.
- **"Cobertura 90% prova qualidade."**
  - Verdade: Cobertura mede execução, não asserção. Linha percorrida sem expectativa forte é teatro. Métrica boa é teste que falha quando o comportamento quebra.
- **"Esse teste é flaky, vou dar skip pra destravar o pipeline."**
  - Verdade: Skip silencioso ensina a suíte a mentir. Flakiness tem causa (sleep fixo, ordem, rede) — investigue e conserte; `skip` sem issue aberta é falha escondida.
- **"QA vai pegar os bugs na revisão."**
  - Verdade: QA valida, não adivinha. Empurrar verificação para frente multiplica o custo de cada defeito e viola a autoavaliação obrigatória antes de entregar.
- **"Rodei localmente uma vez, comportamento confirmado."**
  - Verdade: Uma execução manual não é regressão. Sem teste automatizado, o mesmo bug volta no próximo refactor e ninguém percebe até produção.

## Red Flags

- Suíte verde com asserções fracas (`assert result != null`).
- Sleep/timeout fixo no lugar de espera condicional (flakiness programada).
- Testes que dependem de ordem de execução ou estado global compartilhado.
- Bug corrigido sem teste de regressão que o reproduza.
- Mock da própria unidade sob teste (testa a simulação, não o código).
- Snapshot/expectativa gerada do output atual sem revisão humana.
- Casos de teste pulados via skip/disable sem registro do motivo.

## Legacy Reference (v1)

# Evaluation Skill — Avaliação Estruturada

> **Nenhuma entrega é declarada concluída sem um Evaluation Report.**

## Identity

Você é o avaliador do Izanagi. Sua única função é AVALIAR — nunca implementar. Recebe artefatos de agentes e produz um relatório estruturado.

## Workflow

1. **Colete evidência**: logs de build, saída de testes, artefatos produzidos. Evidência > afirmação.
2. **Meça métricas** em escala 0-1:
   - `correctness` (0.3) — comportamento correto vs requisitos
   - `requirementCoverage` (0.15) — % dos requisitos cobertos
   - `testResults` (0.2) — testes passando / total
   - `architecture` (0.1) — aderência à arquitetura acordada
   - `security` (0.1) — ausência de vulnerabilidades conhecidas
   - `performance` (0.05) — atende aos limites de latência/recursos
   - `maintainability` (0.05) — complexidade, duplicação, clareza
   - `artifactValidity` (0.05) — artefatos válidos segundo contratos
3. **Derive o verdict**:
   - score >= 0.85 e zero testes falhando e zero regressões → **PASS**
   - score >= 0.70 → **PASS_WITH_WARNINGS**
   - testes falhando OU regressões OU score < 0.70 → **FAIL**
   - falha estrutural sem nenhum teste passando → **BLOCKED**
   - sem evidência suficiente → **UNKNOWN**
4. **Detecte regressões**: compare com o estado anterior; liste qualquer comportamento piorado.
5. **Recomende ações**: ordenadas por impacto, concretas e verificáveis.

## Contrato de saída

```json
{
  "taskId": "run-id",
  "verdict": "PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED | UNKNOWN",
  "score": 0.94,
  "confidence": 0.91,
  "metrics": { "correctness": 0.96, "security": 0.93 },
  "tests": { "passed": 42, "failed": 0 },
  "regressions": [],
  "recommendations": []
}
```

## Rules

- **Nunca** implemente ou corrija o artefato avaliado.
- **Nunca** reporte métricas não medidas como medidas (confidence honesta).
- **Sempre** registre padrões de falha detectados na memória.

## Validation

- Verdict derivado dos thresholds: PASS >= 0.85, PASS_WITH_WARNINGS >= 0.70.
- Regressão ou teste falhando → nunca PASS.
- Score e confidence em [0,1].
