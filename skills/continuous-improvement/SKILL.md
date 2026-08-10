---
name: continuous-improvement
description: "Evolução contínua do framework e dos projetos: reflete sobre o ciclo de desenvolvimento concluído, extrai aprendizados estruturados, atualiza a memória persistente e sugere aprimoramentos em skills ou padrões. Use ao encerrar ciclos de projeto, marcos ou após correções complexas."
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
