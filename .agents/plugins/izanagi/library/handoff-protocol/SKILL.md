---
name: "handoff-protocol"
description: "Protocolo de handoff estruturado entre agentes (motivo, contexto mínimo, artefatos, decisões, questões em aberto). Use em toda transição de agente dentro de um execution graph ou swarm. Gatilhos de ativação: handoff protocol — transição estruturada entre agentes; formato do handoff; regras; validação."
version: 2.0.0
category: ai
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
    - mcp:execute_command
---

# Handoff Protocol — Transição Estruturada Entre Agentes

> Migrado deterministicamente de `skills/handoff-protocol/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** IA & Agentes (`ai`)
- **Resumo:** Protocolo de handoff estruturado entre agentes (motivo, contexto mínimo, artefatos, decisões, questões em aberto).
- **Ativar quando:** Use em toda transição de agente dentro de um execution graph ou swarm.
- **Escopo canônico:** Handoff Protocol — Transição Estruturada Entre Agentes
- **Seções do corpo original:** Formato do handoff · Regras · Validação · Exemplo de cadeia
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — reason é obrigatória e específica (não "continuar trabalho"):

**reason** é obrigatória e específica (não "continuar trabalho"): `schema_required`, `fix_needed`, `verification_required`.

### Passo 2 — artifacts referenciam arquivos em disco — o agente seguinte lê do disco, nunca de texto...

**artifacts** referenciam arquivos em disco — o agente seguinte lê do disco, nunca de texto copiado.

### Passo 3 — context contém apenas o que o destinatário precisa:

**context** contém apenas o que o destinatário precisa: contexto mínimo por handoff.

### Passo 4 — decisions registram o que já foi decidido para o destinatário não rediscutir.

**decisions** registram o que já foi decidido para o destinatário não rediscutir.

### Passo 5 — constraints são limites técnicos inegociáveis.

**constraints** são limites técnicos inegociáveis.

### Passo 6 — openQuestions listam o que ficou em aberto — o destinatário decide ou devolve.

**openQuestions** listam o que ficou em aberto — o destinatário decide ou devolve.

## Verification Steps

<!-- fonte da verificação: quality-section-original -->

- Handoff sem reason clara → inválido.
- Handoff sem artifacts → contexto livre proibido.
- Contexto com campos não usados pelo destinatário → cortar.

## Common Rationalizations

- **"Modelo moderno entende sozinho, prompt detalhado é desperdício."**
  - Verdade: Sem few-shot, formato de saída estrito e guardrails, o output é probabilístico e imprevisível. Prompt engineering é especificação de comportamento — não decoração.
- **"Resposta plausível, então tá correto."**
  - Verdade: Plausibilidade é o produto, não a prova. Sem avaliação (dataset, critério, comparação), você está validando retórica — hallucinação apresentada como fato é falha classificada do framework.
- **"Embedding/recuperação ruim? Troco o modelo maior."**
  - Verdade: Trocar modelo mascara problema de chunking, consulta e qualidade de dados — e multiplica custo. Diagnostique o pipeline RAG antes de escalar o modelo.
- **"Jogo tudo no contexto, janela hoje é gigante."**
  - Verdade: Contexto inflado custa dinheiro, latência e atenção do modelo (lost in the middle). Economia de tokens é disciplina: contexto mínimo, cache, janela deslizante.
- **"Tool call retornou algo, sigo em frente."**
  - Verdade: Output de tool sem schema validado é dado não confiável entrando no raciocínio. Validar resposta é o mesmo anti-falhas de qualquer integração — LLM não é exceção.
- **"Prompt injection é teórico, meu caso é fechado."**
  - Verdade: Todo texto que entra pelo usuário/documento recuperado é superfície de injection. Fechado significa menos vetores, não zero — defesa custa uma instrução e um filtro.

## Red Flags

- Feature de LLM sem dataset/critério de avaliação (qualidade não medida).
- RAG respondendo sem citação/rastreabilidade da fonte recuperada.
- Tool/MCP exposto sem schema de entrada validado nem limite de escopo.
- Chamada de modelo sem timeout, retry criterioso ou budget de custo.
- Output do modelo parseado com confiança cega (sem validação estrutural).
- Instrução de sistema concatenada com input de usuário sem isolamento.
- Agente com efeito real no mundo sem dry-run nem confirmação de ação irreversível.

## Legacy Reference (v1)

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
