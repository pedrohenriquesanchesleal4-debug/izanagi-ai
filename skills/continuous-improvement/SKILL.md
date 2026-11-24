---
name: continuous-improvement
description: "Reflete sobre um ciclo de trabalho concluído, extrai aprendizados e atualiza a memória persistente do projeto (.agents/memoria/). Use ao encerrar sprints, marcos ou após resolver bugs complexos."
---

# Continuous Improvement (Evolução Contínua e Aprendizado)

Processo sistemático de reflexão pós-execução para extrair lições, atualizar a **memória persistente do projeto** (`.agents/memoria/`) e aprimorar continuamente a base de conhecimento do framework.

## Quando usar

Use ao: concluir uma feature compleja ou ciclo de sprint; resolver um bug difícil cujo aprendizado deve ser guardado; finalizar um projeto e consolidar o ADR-lite. **Pule** para: tarefas rotineiras e isoladas sem aprendizado estrutural.

## Workflow de Melhoria Contínua (4 passos)

### 1. Reflexão pós-execução (O que aconteceu?)
Analise o que correu bem, onde houve fricção e qual obstáculo inesperado apareceu durante a tarefa.

### 2. Extração de padrão ou anti-padrão
Converta a experiência em uma regra reutilizável (ex: "Sempre validar X antes de chamar Y").

### 3. Atualização da Memória Persistente
Escreva o aprendizado no arquivo correspondente em `.agents/memoria/`:
- `learnings.md`: novos padrões e descobertas.
- `decisoes.md`: trade-offs e ADRs.
- `erros-corrigidos.md`: armadilhas técnicas evitadas.

### 4. Proposta de evolução de skill
Se o aprendizado for genérico o bastante, sugira a atualização de uma skill ou regra do framework para beneficiar futuros projetos.

## Lição só entra com evidência (recursão em 2 níveis)

Padrão de harness recursivo (ex.: Harness², ReasoningBank): o agente melhora o próprio processo sem retreinar o modelo, mas só guarda o que tem prova.

**Dentro da tarefa (propor, sondar, compor):**
1. *Propor*: uma mudança no processo (prompt, ordem de passos, skill usada).
2. *Sondar*: rodar as duas versões no mesmo caso, ou comparar com a execução anterior.
3. *Compor*: ficar com a versão que teve resultado observável melhor (teste passou, menos retrabalho, menos tokens).

**Entre tarefas (lições com prova):** cada entrada em `learnings.md` segue o formato

```
- [AAAA-MM-DD] <regra em 1 frase>
  Evidência: <o que foi medido ou observado, com arquivo/comando>
  Escopo: <quando vale> · Status: candidata | adotada (após 2 usos confirmados) | descartada
```

Lição sem evidência fica como `candidata` e não vira regra. Lição que falhou na reutilização vira `descartada` com o motivo (isso também é conhecimento).

## Checklist de qualidade (antes de encerrar)
- [ ] Lição principal extraída e documentada em 1-2 frases claras
- [ ] Memória persistente (`.agents/memoria/`) atualizada
- [ ] Nenhum aprendizado valioso perdido na conversa volátil
- [ ] Regras de prevenção de erros registradas

## Anti-padrões (proibido)
1. ❌ Encerrar sessões complexas sem registrar nada na memória do projeto
2. ❌ Registrar apenas "funcionou" sem documentar o *porquê* ou a *armadilha* evitada
3. ❌ Acumular dados obsoletos na memória persistente

## Composição com outras skills
- **Antes**: `self-critique` (auto-revisão) → `qa` (validação)
- **Depois**: `memoria-projeto` (armazenamento persistente) → início da próxima tarefa com contexto enriquecido

## References
- Continuous improvement in software engineering (Kaizen / Post-mortem culture): Google SRE Book (Incident Post-mortems).
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
