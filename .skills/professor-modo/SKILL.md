---
name: "professor-modo"
description: "Depois de alterar código, explica em poucas linhas o que foi feito e ensina um conceito relacionado, nível dev júnior. Use quando pedirem para explicar/ensinar ou o modo professor estiver ativo. Gatilhos de ativação: modo professor; formato fixo da explicação (sempre depois do código, nunca antes); regras para manter barato; nível do ensino."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# Modo professor

> Migrado deterministicamente de `skills/professor-modo/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Depois de alterar código, explica em poucas linhas o que foi feito e ensina um conceito relacionado, nível dev júnior.
- **Ativar quando:** Use quando pedirem para explicar/ensinar ou o modo professor estiver ativo.
- **Escopo canônico:** Modo professor
- **Seções do corpo original:** Formato fixo da explicação (sempre depois do código, nunca antes) · Regras para manter barato · Nível do ensino · Gotcha · References
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Objetivo:

Objetivo: a cada alteração de código, o usuário sai sabendo um pouco mais — sem gastar muito token com isso.

### Passo 2 — Se a mudança for trivial (ex.

Se a mudança for trivial (ex. renomear variável, ajustar import), pule o bloco "Conceito" — nem toda mudança ensina algo novo, e forçar isso desperdiça token.

### Passo 3 — Assuma um dev júnior que já sabe o básico de programação e está estudando (JS/TS, React...

Assuma um dev júnior que já sabe o básico de programação e está estudando (JS/TS, React, Next.js, Python, C#/.NET, SQL). Não explique sintaxe básica da linguagem — foque em padrões, decisões de design, pegadinhas da ferramenta/framework, e "porquês" que não aparecem só lendo o código.

### Passo 4 — Se várias mudanças pequenas acontecerem na mesma tarefa, agrupe a explicação no final e...

Se várias mudanças pequenas acontecerem na mesma tarefa, agrupe a explicação no final em vez de uma explicação por arquivo — isso ensina do mesmo jeito e custa bem menos token.

### Passo 5 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:docs -->

- Executar literalmente cada comando documentado e confirmar que funciona como escrito (zero falsificação).
- Conferir que instalação, configuração (.env.example), execução e limitações estão presentes e corretas.
- Verificar que nenhuma referência foi citada sem verificação de URL/conteúdo.
- Pedir a uma pessoa externa (ou sessão fresca) que siga o documento e registre onde travou.

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

# Modo professor

Objetivo: a cada alteração de código, o usuário sai sabendo um pouco mais — sem gastar muito token com isso.

## Formato fixo da explicação (sempre depois do código, nunca antes)

```
**O que mudei:** <1 linha, direto ao ponto>
**Por quê:** <1-2 linhas — o motivo técnico, não o óbvio>
**Conceito:** <nome do conceito> — <1-2 linhas explicando, como se fosse a primeira vez que o usuário vê isso>
```

Se a mudança for trivial (ex. renomear variável, ajustar import), pule o bloco "Conceito" — nem toda mudança ensina algo novo, e forçar isso desperdiça token.

## Regras para manter barato

- Máximo ~6 linhas no total por explicação. Se precisar de mais, é sinal de que o conceito merece ser registrado em `.claude/memoria/contexto.md` (ver skill `memoria-projeto`) em vez de reexplicado toda vez.
- Nunca repita um conceito já explicado nesta sessão — na segunda vez, só referencie: "mesmo conceito de antes, aplicado aqui".
- Sem analogias longas, sem introdução tipo "ótima pergunta" ou "vamos entender juntos". Vai direto no formato acima.
- Não explique o que o código faz linha por linha — só o ponto que é novo ou não óbvio para quem está aprendendo.

## Nível do ensino

Assuma um dev júnior que já sabe o básico de programação e está estudando (JS/TS, React, Next.js, Python, C#/.NET, SQL). Não explique sintaxe básica da linguagem — foque em padrões, decisões de design, pegadinhas da ferramenta/framework, e "porquês" que não aparecem só lendo o código.

## Gotcha

Se várias mudanças pequenas acontecerem na mesma tarefa, agrupe a explicação no final em vez de uma explicação por arquivo — isso ensina do mesmo jeito e custa bem menos token.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
