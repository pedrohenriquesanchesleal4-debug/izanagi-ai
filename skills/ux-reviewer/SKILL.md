---
name: ux-reviewer
description: "Avaliação de experiência do usuário (UX) baseada nas 10 heurísticas de Nielsen e boas práticas de usabilidade moderna: visibilidade do status, consistência, prevenção de erros, flexibilidade, carga cognitiva e design estético. Use ao revisar fluxos de tela, telas de conversão ou interfaces completas antes de release."
---

# UX Reviewer (Heurísticas de Nielsen & Usabilidade)

Avaliação de usabilidade e experiência do usuário (UX) aplicando as **10 heurísticas de Jakob Nielsen** e padrões modernos de interação digital — garantindo interfaces intuitivas, de baixa carga cognitiva e alta conversão.

## Quando usar

Use ao: revisar fluxos de telas (onboarding, checkout, dashboard); auditar interfaces completas antes de release; diagnosticar problemas de abandono ou fricção; validar wireframes ou protótipos. **Pule** para: auditoria estritamente de acessibilidade WCAG (skill `accessibility-reviewer`); código SAST de segurança (skill `code-auditor`).

## As 10 Heurísticas de Nielsen Aplicadas à Web Moderna

1. **Visibilidade do status do sistema**: Feedback imediato para qualquer ação (spinner de loading, toast de sucesso/erro, barra de progresso em uploads).
2. **Correspondência entre o sistema e o mundo real**: Linguagem natural do usuário, sem jargões técnicos de banco de dados ou backend ("Erro 500 no insert" → "Não foi possível salvar seu perfil. Tente novamente.").
3. **Controle e liberdade do usuário**: Saídas claras (botão "Cancelar", "Desfazer", voltar sem perder preenchimento de formulário).
4. **Consistência e padrões**: Padrões visuais e de interação uniformes (botões primários sempre na mesma posição, ícones com o mesmo significado).
5. **Prevenção de erros**: Confirmações em ações destrutivas (excluir conta), validação inline em formulários antes do submit.
6. **Reconhecimento em vez de lembrança**: Menus visíveis, histórico recente, auto-complete, placeholders claros em inputs.
7. **Flexibilidade e eficiência de uso**: Atalhos de teclado para power users, sem atrapalhar iniciantes.
8. **Estética e design minimalista**: Zero poluição visual, hierarquia tipográfica clara, uso generoso de espaços em branco (*whitespace*).
9. **Ajuda aos usuários a reconhecer, diagnosticar e recuperar de erros**: Mensagens de erro em linguagem clara indicando exatamente o que falhou e como resolver.
10. **Ajuda e documentação**: Tooltips contextuais, FAQs acessíveis, guias de onboarding curtos.

## Workflow de auditoria UX (4 passos)

### 1. Mapear o fluxo crítico
Identifique a jornada principal do usuário (ex: Signup → Onboarding → Primeira Ação de Valor).

### 2. Avaliação heurística por tela
Passe por cada tela aplicando as 10 heurísticas. Anote fricções, ambiguidades e gargalos de atenção.

### 3. Classificação de severidade dos achados
- **Critical**: Impede o usuário de concluir a tarefa principal (ex: botão de pagamento que não clica).
- **High**: Causa alta fricção ou confusão grave (ex: termo técnico incompreensível).
- **Medium**: Inconsistência estética ou menor eficiência (ex: espaçamento irregular).
- **Low**: Detalhe polido desejável.

### 4. Relatório estruturado de UX
Apresente o achado, a heurística violada, a severidade e a sugestão exata de correção.

## Exemplo de Relatório de UX (Formato Padrão)

```yaml
ux_audit:
  tela: "Checkout & Pagamento"
  pontuacao_geral: "7.5 / 10"
  achados:
    - heurística: "1_visibilidade_do_status"
      severidade: "critical"
      problema: "Botão 'Pagar' não exibe indicador de progresso; usuário clica 3 vezes gerando cobranças duplicadas."
      fix: "Desabilitar botão no clique, exibir spinner interno e texto 'Processando pagamento...'."

    - heurística: "5_prevencao_de_erros"
      severidade: "high"
      problema: "Inputs de cartão não possuem formatação automática (espaços a cada 4 dígitos)."
      fix: "Aplicar máscara automática e validação de bandeira em tempo real."
```

## Checklist de qualidade (antes de entregar)
- [ ] Todo clique/ação do usuário possui feedback visual imediato (loading, hover, active)
- [ ] Linguagem orientada ao usuário final (sem termos de infra/backend)
- [ ] Ações destrutivas possuem diálogo de confirmação explícito
- [ ] Formulários com validação inline clara e amigável
- [ ] Hierarquia visual guia o olho para a ação principal (CTA único por seção)
- [ ] Espaçamento e tipografia consistentes em todo o fluxo
- [ ] Mensagens de erro explicam a causa e o caminho de recuperação

## Anti-padrões (proibido)
1. ❌ Telas em branco sem feedback durante chamadas de API pesadas
2. ❌ Mensagens de erro crípticas ("Ocorreu um erro inesperado. Código: ERR_AUTH_492")
3. ❌ Destruição de dados sem modal de confirmação ("Tem certeza?" em apagar projeto)
4. ❌ Formulários longos sem agrupamento lógico ou indicador de progresso (multi-step)
5. ❌ CTAs concorrentes com a mesma importância visual na mesma tela (dois botões primários idênticos)
6. ❌ Textos explicativos longos onde um ícone ou tooltip resolveria

## Composição com outras skills
- **Before**: `design-directions` (direção visual) → `frontend` (implementação da UI)
- **After**: `accessibility-reviewer` (acessibilidade a11y) → `qa` (validação de fluxos E2E)

## References
- Nielsen Norman Group (NN/g) Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/ · Don Norman, *The Design of Everyday Things* · About Face (Alan Cooper).
- Veja `references.md` nesta pasta — curadoria de continuação (2026).
