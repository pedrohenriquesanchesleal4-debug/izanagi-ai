---
name: "self-critique"
description: "Use antes de finalizar qualquer entrega complexa: aplica os 5 quality gates (stubs, segurança, craft, verificação, concisão) como auto-revisão. Gatilhos de ativação: self-critique (auto-revisão crítica de entrega); quando usar; rubrica de auto-revisão (os 5 quality gates do izanagi); workflow de auto-revisão (3 passos)."
version: 2.0.0
category: testing
tools:
  mcp:
    - mcp:execute_command
references:
  - "references.md"
---

# Self-Critique (Auto-Revisão Crítica de Entrega)

> Migrado deterministicamente de `skills/self-critique/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Testes & QA (`testing`)
- **Resumo:** Use antes de finalizar qualquer entrega complexa: aplica os 5 quality gates (stubs, segurança, craft, verificação, concisão) como auto-revisão.
- **Ativar quando:** Use antes de finalizar qualquer entrega complexa: aplica os 5 quality gates (stubs, segurança, craft, verificação, concisão) como auto-revisão.
- **Escopo canônico:** Self-Critique (Auto-Revisão Crítica de Entrega)
- **Seções do corpo original:** Quando usar · Rubrica de Auto-Revisão (Os 5 Quality Gates do Izanagi) · Workflow de Auto-Revisão (3 passos) · Checklist de qualidade (antes de entregar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Inspeção do Diff Final (`git diff`)

Revise linha por linha do que foi produzido nesta sessão. Procure por imports órfãos, variáveis não utilizadas e tratamento de erro ausente.

### Passo 2 — Avaliação contra as Regras Globais

Confirme se as leis do framework (ciclo vertical completo, zero listas para SaaS, sem stubs) foram rigorosamente obedecidas.

### Passo 3 — Emissão do Veredito

- **Aprovado**: Entrega liberada.
- **Reprovado internamente**: Correção imediata do achado antes de enviar ao usuário.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Nenhum stub, `TODO` ou código incompleto remanescente
- [ ] Tratamento de erros real implementado em todas as rotas/funções críticas
- [ ] Tipagem estrita validada (sem `any` injustificado em TypeScript)
- [ ] Build e testes validados empiricamente
- [ ] Diff limpo, sem arquivos temporários ou lixo no commit

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

# Self-Critique (Auto-Revisão Crítica de Entrega)

Protocolo de auditoria interna onde o agente atua como seu próprio revisor exigente, aplicando **quality gates rigorosos** antes de entregar qualquer código, texto ou arquitetura ao usuário.

## Quando usar

Use **obrigatoriamente** antes de finalizar qualquer tarefa complexa, feature full-stack, refatoração ou entrega de sistema. **Pule** para: revisões colaborativas com o Tech Lead (skill `techlead`).

## Rubrica de Auto-Revisão (Os 5 Quality Gates do Izanagi)

1. **Gate de Completude (Zero Stubs)**: Há algum `TODO`, `// implement later`, função vazia ou dado mockado onde deveria haver lógica real?
2. **Gate de Segurança**: Há secrets expostos, SQL injection, validação de input ausente ou falha de autorização?
3. **Gate de Craft (Anti AI-Slop)**: O código e a UI fogem do padrão genérico? Há tipagem estrita e semântica clara?
4. **Gate de Verificação**: O build e os testes foram rodados e passaram com evidência?
5. **Gate de Concisão**: Há arquivos gigantes desnecessários ou código duplicado (DRY violado)?

## Workflow de Auto-Revisão (3 passos)

### 1. Inspeção do Diff Final (`git diff`)
Revise linha por linha do que foi produzido nesta sessão. Procure por imports órfãos, variáveis não utilizadas e tratamento de erro ausente.

### 2. Avaliação contra as Regras Globais
Confirme se as leis do framework (ciclo vertical completo, zero listas para SaaS, sem stubs) foram rigorosamente obedecidas.

### 3. Emissão do Veredito
- **Aprovado**: Entrega liberada.
- **Reprovado internamente**: Correção imediata do achado antes de enviar ao usuário.

## Checklist de qualidade (antes de entregar)
- [ ] Nenhum stub, `TODO` ou código incompleto remanescente
- [ ] Tratamento de erros real implementado em todas as rotas/funções críticas
- [ ] Tipagem estrita validada (sem `any` injustificado em TypeScript)
- [ ] Build e testes validados empiricamente
- [ ] Diff limpo, sem arquivos temporários ou lixo no commit

## Anti-padrões (proibido)
1. ❌ Entregar código com base na pressuposição de que "deve funcionar" sem checar o diff
2. ❌ Ignorar pequenos débitos técnicos ("depois a gente arruma")
3. ❌ Deixar comentários órfãos ou código comentado morto
4. ❌ Pular a auto-revisão por pressa

## Composição com outras skills
- **Antes**: `agentic-coding` (implementação) → `code-auditor` (segurança)
- **Depois**: `qa` (validação final) → entrega ao usuário

## References
- Code review best practices: Google Engineering Practices documentation · Clean Code (Robert C. Martin).
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
