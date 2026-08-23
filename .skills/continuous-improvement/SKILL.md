---
name: "continuous-improvement"
description: "Reflete sobre um ciclo de trabalho concluído, extrai aprendizados e atualiza a memória persistente do projeto (.agents/memoria/). Use ao encerrar sprints, marcos ou após resolver bugs complexos. Gatilhos de ativação: continuous improvement (evolução contínua e aprendizado); quando usar; workflow de melhoria contínua (4 passos); checklist de qualidade (antes de encerrar)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Continuous Improvement (Evolução Contínua e Aprendizado)

> Migrado deterministicamente de `skills/continuous-improvement/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Reflete sobre um ciclo de trabalho concluído, extrai aprendizados e atualiza a memória persistente do projeto (.agents/memoria/).
- **Ativar quando:** Use ao encerrar sprints, marcos ou após resolver bugs complexos.
- **Escopo canônico:** Continuous Improvement (Evolução Contínua e Aprendizado)
- **Seções do corpo original:** Quando usar · Workflow de Melhoria Contínua (4 passos) · Checklist de qualidade (antes de encerrar) · Anti-padrões (proibido) · Composição com outras skills
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Reflexão pós-execução (O que aconteceu?)

Analise o que correu bem, onde houve fricção e qual obstáculo inesperado apareceu durante a tarefa.

### Passo 2 — Extração de padrão ou anti-padrão

Converta a experiência em uma regra reutilizável (ex: "Sempre validar X antes de chamar Y").

### Passo 3 — Atualização da Memória Persistente

Escreva o aprendizado no arquivo correspondente em `.agents/memoria/`:
- `learnings.md`: novos padrões e descobertas.
- `decisoes.md`: trade-offs e ADRs.
- `erros-corrigidos.md`: armadilhas técnicas evitadas.

### Passo 4 — Proposta de evolução de skill

Se o aprendizado for genérico o bastante, sugira a atualização de uma skill ou regra do framework para beneficiar futuros projetos.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Lição principal extraída e documentada em 1-2 frases claras
- [ ] Memória persistente (`.agents/memoria/`) atualizada
- [ ] Nenhum aprendizado valioso perdido na conversa volátil
- [ ] Regras de prevenção de erros registradas

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

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
