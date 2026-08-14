---
name: self-critique
description: "Use antes de finalizar qualquer entrega complexa: aplica os 5 quality gates (stubs, segurança, craft, verificação, concisão) como auto-revisão."
---

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
