---
name: memoria-projeto
description: Mantém memória persistente do projeto entre sessões, guardando decisões, padrões de código e erros já resolvidos, para o agente melhorar a cada nova tarefa em vez de começar do zero. Use no INÍCIO de qualquer tarefa de código relevante (ler a memória) e no FINAL de qualquer tarefa que tenha gerado uma decisão, padrão ou correção de erro importante (atualizar a memória). Também dispara quando o usuário perguntar "o que já decidimos sobre X" ou "por que fizemos assim".
---

# Memória do projeto

Claude Code não tem memória de conversas passadas por padrão — cada sessão começa do zero. Esta skill cria essa memória usando arquivos no próprio repositório, em `.agents/memoria/` (adaptado do padrão `.claude/memoria/` para este projeto).

## Estrutura

```
.agents/memoria/
├── contexto.md      # visão geral do projeto, stack, convenções já estabelecidas
├── decisoes.md       # decisões de arquitetura/design e o porquê (1-3 linhas cada)
├── erros-corrigidos.md  # bugs/erros já enfrentados e como foram resolvidos
└── learnings.md     # lições anti-repetição: erros 2+ vezes, correções definitivas, armadilhas da stack
```

Se a pasta não existir, crie-a na primeira vez que esta skill for usada neste projeto.

## No início da tarefa

1. Leia os arquivos em `.agents/memoria/` relevantes para o que vai ser feito. Não precisa ler os três sempre — só o(s) relevante(s) ao pedido.
2. Aplique o que estiver lá (convenções, decisões já tomadas) sem precisar que o usuário repita o contexto.

## No final da tarefa

Se a tarefa gerou algo que vale lembrar no futuro, adicione uma entrada curta (1-3 linhas, não um parágrafo) no arquivo certo:

- Decisão de arquitetura, biblioteca escolhida, ou padrão de código novo → `decisoes.md`
- Bug não óbvio que foi corrigido e como → `erros-corrigidos.md`
- Erro repetido (2+ vezes), correção definitiva ou armadilha conhecida da stack → `learnings.md`
- Convenção nova do projeto (nome de pastas, estilo, stack) → `contexto.md`

**Regras para manter isso barato em tokens:**

- Adicione só a linha nova (append), não reescreva o arquivo inteiro.
- Nunca duplique uma entrada que já existe — se for uma atualização de algo já registrado, edite a linha existente em vez de criar outra.
- Se um arquivo passar de ~60 linhas, condense entradas antigas relacionadas em vez de deixar crescer sem limite.
- Formato de cada entrada: `- [AAAA-MM-DD] descrição curta e direta`. Sem explicações longas — o objetivo é lembrar rápido, não documentar tudo.

## Checklist anti-repetição (antes de escrever código)

Toda tarefa de código começa por esta triagem — 30 segundos que evitam redescobrir o que já é conhecido:

- (a) Esse problema já foi resolvido? → confira `erros-corrigidos.md` e `learnings.md`.
- (b) Essa armadilha já foi registrada? → busque a área/stack do projeto em `learnings.md`.
- (c) Alguma decisão prévia contradiz o plano? → releia `decisoes.md` antes de propor caminho novo.

Se qualquer resposta for "sim", parta da entrada existente — não resolva de novo o que a memória já resolveu.

## Reincidência (erro repetido)

Erro já registrado que se repete é o sinal mais barato de melhoria — registre:

1. Localize a entrada original em `erros-corrigidos.md` ou `learnings.md`.
2. Atualize com a marcação `[REINCIDÊNCIA]` e incremente a contagem (Nx → N+1x).
3. Com **3+ reincidências**, crie uma entrada de destaque em `learnings.md` (⚠️ + formato abaixo) e condense as entradas antigas relacionadas.

Formato de entrada em `learnings.md`:

```
- [AAAA-MM-DD] ⚠️ [ÁREA] erro repetido Nx → sintoma + causa raiz + correção definitiva (1-3 linhas cada)
```

Exemplo:

```
- [2026-08-07] ⚠️ [BUILD] erro repetido 3x → CLI roda código obsoleto + causa: `dist/` não recompilado + correção: rodar `npm run build` antes de qualquer comando CLI local
```

## Não registrar

- Coisas óbvias que qualquer leitura do código já mostra.
- Detalhes temporários da tarefa atual (isso é conversa, não memória).
- Qualquer dado sensível (senhas, chaves, tokens de API, dados de cliente).

## Gotcha

Se o projeto já tem um `CLAUDE.md` na raiz, não duplique informação entre ele e `.claude/memoria/contexto.md` — `CLAUDE.md` é para regras permanentes do projeto, a memória é para o que foi sendo aprendido ao longo do tempo.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
