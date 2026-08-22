---
name: "memoria-projeto"
description: "Mantém memória persistente do projeto entre sessões (decisões, padrões, erros resolvidos). Use no início de uma tarefa para ler o histórico e no final para registrar o que foi aprendido. Gatilhos de ativação: memória do projeto; estrutura; no início da tarefa; no final da tarefa."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Memória do projeto

> Migrado deterministicamente de `skills/memoria-projeto/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Mantém memória persistente do projeto entre sessões (decisões, padrões, erros resolvidos).
- **Ativar quando:** Use no início de uma tarefa para ler o histórico e no final para registrar o que foi aprendido.
- **Escopo canônico:** Memória do projeto
- **Seções do corpo original:** Estrutura · No início da tarefa · No final da tarefa · Checklist anti-repetição (antes de escrever código) · Reincidência (erro repetido)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Leia os arquivos em .agents/memoria/ relevantes para o que vai ser feito.

Leia os arquivos em `.agents/memoria/` relevantes para o que vai ser feito. Não precisa ler os três sempre — só o(s) relevante(s) ao pedido.

### Passo 2 — Aplique o que estiver lá (convenções, decisões já tomadas) sem precisar que o usuário r...

Aplique o que estiver lá (convenções, decisões já tomadas) sem precisar que o usuário repita o contexto.

## Verification Steps

<!-- fonte da verificação: quality-section-original -->

- (a) Esse problema já foi resolvido? → confira `erros-corrigidos.md` e `learnings.md`.
- (b) Essa armadilha já foi registrada? → busque a área/stack do projeto em `learnings.md`.
- (c) Alguma decisão prévia contradiz o plano? → releia `decisoes.md` antes de propor caminho novo.

## Common Rationalizations

- **"Código limpo se auto-documenta, comentário é redundância."**
  - Verdade: Código mostra o COMO, nunca o PORQUÊ nem o contrato de uso. README com instalação/execução/configuração é parte da entrega, não cortesia.
- **"README eu escrevo antes do publish."**
  - Verdade: Antes do publish é depois do esquecimento. Documentação escrita junto à implementação captura decisões que em 3 dias já não estão mais na memória.
- **"Doc envelhece rápido, então melhor nem escrever."**
  - Verdade: Doc desatualizada é corrigível; doc ausente é institucionalizada ignorância. O framework exige limitações conhecidas documentadas — honestidade sobre o que falta é conteúdo, não fraqueza.
- **"Só eu uso esse projeto, documento é overhead."**
  - Verdade: 'Eu daqui a 6 meses' também é outro desenvolvedor. Handoff sem documentação transforma toda manutenção futura em arqueologia.
- **"Coloquei um exemplo genérico no README, serve."**
  - Verdade: Exemplo que não roda é pior que nenhum: ensina errado com autoridade. Todo comando documentado precisa ter sido executado de fato (zero falsificação).
- **"Referência eu completo depois, agora é só chute razoável."**
  - Verdade: URL inventada é alucinação documentada. Nunca entregue referência não verificada — pesquise ou declare explicitamente que não verificou.

## Red Flags

- README sem comando exato de instalação e execução testado.
- `.env.example` ausente num projeto que exige configuração.
- Documentação divergente do comportamento real do código.
- Seção 'Limitações' vazia ou omitida (finge completude).
- Link/referência citada sem verificação (risco de alucinação).
- Termo de domínio usado sem definição numa base nova.

## Legacy Reference (v1)

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

### Camada certa para cada tipo de informação

Prática consolidada em 2026 para agentes de código (Claude Code e equivalentes): nem tudo que "vale lembrar" deve virar linha de memória.

| Tipo de informação | Onde vai | Por quê |
|---|---|---|
| Regra permanente, sempre válida (stack, convenção de nome) | `CLAUDE.md` | Carregado em toda sessão — precisa ser curto e universal |
| Regra que precisa ser **enforced** deterministicamente | Hook (`.claude/settings.json`) | Instrução em texto pode ser ignorada; hook não |
| Conhecimento contextual (só relevante para certas tarefas) | Skill | Carregado sob demanda, não polui toda sessão |
| Decisão/erro/aprendizado que evolui com o tempo | `.agents/memoria/*.md` (esta skill) | Histórico vivo, apendado, não é regra fixa |

Referência de ordem de grandeza real: o `CLAUDE.md`/`MEMORY.md` do Claude Code é truncado nas primeiras **~200 linhas ou 25KB** (o que vier primeiro) — o mesmo motivo pelo qual esta skill manda condensar arquivos de memória acima de ~60 linhas: arquivo inchado além do limite de carregamento é arquivo parcialmente ignorado.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
