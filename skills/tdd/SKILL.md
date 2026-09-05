---
name: tdd
description: "Test-Driven Development com Iron Law: escreva o teste antes, veja falhar, código mínimo, refatore. Use em toda feature, bugfix ou refatoração antes de escrever código de implementação."
triggers:
  - "implementar feature nova"
  - "corrigir bug com regressão"
  - "refatorar código com comportamento a preservar"
  - "antes de escrever qualquer código de produção"
capabilities:
  - "red-green-refactor"
  - "failing-test-first"
  - "regression-test"
  - "test-design"
---

# TDD — Test-Driven Development (Iron Law)

> **Nenhum código de produção sem um teste falhando primeiro.**

Escreva o teste → veja falhar (pelo motivo certo) → código mínimo → veja passar → refatore. Se você não viu o teste falhar, não sabe se ele testa a coisa certa.

## Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Escreveu código antes do teste? **Apague.** Não guarde "como referência", não adapte enquanto escreve o teste, não olhe para ele. Apagar é apagar. Implemente do zero a partir dos testes.

Exceções (pergunte ao humano): protótipos descartáveis, código gerado, arquivos de configuração.

## Ciclo RED → GREEN → REFACTOR

### RED — escreva um teste mínimo
- Uma única comportamento, nome claro, código real (mock só se inevitável).
- **Verifique o RED**: o teste FALHA (não erra), pelo motivo esperado (feature ausente, não typo).
- Teste passou? Você está testando comportamento existente — conserte o teste.
- Teste errou? Corrija o erro e rode de novo até falhar corretamente.

### GREEN — código mínimo
- O código mais simples que faz o teste passar. Nada de features extras, "melhorias", YAGNI.
- **Verifique o GREEN**: passa + demais testes seguem passando + saída limpa.
- Teste falhou? Conserte o código, não o teste.

### REFACTOR — limpe após o verde
- Remova duplicação, melhore nomes, extraia helpers. Testes seguem verdes. Sem comportamento novo.

## Testes bons

| Qualidade | Bom | Ruim |
|-----------|-----|------|
| Mínimo | Uma coisa só; sem "and" no nome | `test('valida email e domínio e whitespace')` |
| Claro | Nome descreve o comportamento | `test('test1')` |
| Mostra intenção | Demonstra a API desejada | Esconde o que o código deve fazer |

## Racionalizações comuns (todas = recomeçar)

- "Simples demais para testar" / "já testei manualmente" / "testes depois dão o mesmo resultado" / "vou guardar como referência" / "já gastei X horas, apagar é desperdício" / "TDD é dogmático, sou pragmático" — **todas são sinais de começar de novo com TDD.**

## Quando travar

| Problema | Solução |
|----------|---------|
| Não sei testar | Escreva a API que deseja; escreva a asserção primeiro; pergunte |
| Teste complicado demais | Design complicado demais — simplifique a interface |
| Preciso mockar tudo | Código acoplado demais — use dependency injection |
| Setup gigante | Extraia helpers; ainda complexo? simplifique o design |

## Bug fix com TDD

Bug encontrado? Escreva teste falhando que reproduz o bug → siga o ciclo → o teste prova o fix e previne regressão. **Nunca conserte bug sem teste.**

## TDD com agentes de IA (quando o agente escreve o teste E o código)

O maior risco de TDD conduzido por agente é o agente escrever teste e implementação na mesma resposta: ele passa a escrever testes que combinam com a implementação que acabou de gerar, não com o requisito original — o teste passa "por construção", não por verificação. Isso é pior que não ter TDD, porque cria falsa confiança.

- **Separe a autoria**: o RED (teste) é aprovado — pelo humano ou por outro agente/etapa — *antes* de qualquer código de implementação ser escrito. Quem escreve o teste não deve escrever o código no mesmo passo sem esse checkpoint.
- **Nunca gere teste + implementação no mesmo turno.** Se o teste e o código aparecem juntos, o RED nunca foi observado de verdade — volte e separe as etapas.
- **Desconfie de testes "verdes de primeira"**: se o agente entrega um teste que já passa, ele não viu o RED — force a reexecução do ciclo (apague a implementação, rode o teste, confirme a falha pelo motivo certo).
- Isso reforça — não substitui — a Iron Law: a garantia contra "testes que validam os próprios bugs do agente" é o mesmo RED→GREEN→REFACTOR já descrito acima, aplicado com checkpoint explícito entre teste e código.

## Verification Checklist (antes de declarar pronto)

- [ ] Toda função/método novo tem teste
- [ ] Vi cada teste falhar antes de implementar
- [ ] Cada teste falhou pelo motivo esperado (feature ausente, não typo)
- [ ] Código mínimo para passar cada teste
- [ ] Todos os testes passam, saída limpa
- [ ] Testes usam código real (mocks só se inevitável)
- [ ] Casos de borda e erros cobertos

Não marcou todos? Você pulou TDD. Recomece.

## Testes bons (referência local)

Antes de escrever ou mudar testes, leia `references/writing-good-tests.md` — regras de testes honestos: nomeie a quebra que o teste pega (bug, não decisão), derive expectativas à mão (nunca com o código sob teste), mock só o nível lento/externo, mocks espelham a estrutura real, e rode o **mutation check** antes de terminar.

## References

- Repo original: [obra/superpowers](https://github.com/obra/superpowers) — skill `skills/test-driven-development/SKILL.md` (+ `writing-good-tests.md`, portado localmente em `references/writing-good-tests.md`).
- Curadoria completa em `references.md`.