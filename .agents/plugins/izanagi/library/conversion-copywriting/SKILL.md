---
name: "conversion-copywriting"
description: "Copywriting persuasivo e específico para headline, CTA e microcopy: benefício mensurável, prova concreta, verbo de ação, sem clichê de IA. Use ao escrever qualquer texto voltado a conversão (landing, pricing, onboarding, email transacional). Gatilhos de ativação: skill conversion copywriting — izanagi; identidade; o teste da especificidade; estrutura de headline (acima da dobra)."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# Skill Conversion Copywriting — Izanagi

> Migrado deterministicamente de `skills/conversion-copywriting/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Copywriting persuasivo e específico para headline, CTA e microcopy: benefício mensurável, prova concreta, verbo de ação, sem clichê de IA.
- **Ativar quando:** Use ao escrever qualquer texto voltado a conversão (landing, pricing, onboarding, email transacional).
- **Escopo canônico:** Skill Conversion Copywriting — Izanagi
- **Seções do corpo original:** Identidade · O Teste da Especificidade · Estrutura de Headline (acima da dobra) · CTA (Call to Action) · Objeção-Resposta (para seções de pricing/FAQ/comparação)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Benefício mensurável primeiro, mecanismo depois:

**Benefício mensurável primeiro**, mecanismo depois: `[resultado com número] + [como]`. Ex: "Reduza custo de API em 63% com cache de resposta" — não "Otimize sua infraestrutura de IA."

### Passo 2 — Uma promessa por headline.

**Uma promessa por headline.** Empilhar 3 benefícios na mesma frase dilui todos.

### Passo 3 — Verbo de ação concreto, nunca abstrato:

**Verbo de ação concreto**, nunca abstrato: "Corte", "Gere", "Rastreie", "Elimine" — não "Otimize", "Eleve", "Transforme", "Desbloqueie" (tells do catálogo `anti-ai-slop`).

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Nenhuma frase passa no "serve pra qualquer produto" (o teste da especificidade)
- [ ] Toda métrica/prova social citada é real ou está marcada como placeholder explícito para o cliente preencher (nunca inventada)
- [ ] Zero verbo abstrato de catálogo `anti-ai-slop` (Elevate, Unlock, Transform, Empower, Seamless, Cutting-edge...)
- [ ] CTA descreve a ação real, não um comando genérico
- [ ] Cada seção de objeção responde UMA pergunta real do comprador

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

# Skill Conversion Copywriting — Izanagi

## Identidade

`anti-ai-slop` diz o que NÃO escrever (clichê genérico). Esta skill ensina o que escrever no lugar: copy que converte porque é específica, concreta e resolve a objeção real do leitor no momento em que ela aparece.

## O Teste da Especificidade

Toda frase de copy passa por uma pergunta: **"essa frase poderia estar em qualquer produto do mundo, ou só faz sentido no meu?"** Se serve pra qualquer produto, é slop.

| Genérico (falha o teste) | Específico (passa o teste) |
|---|---|
| "A melhor forma de gerenciar sua equipe" | "Corte 4h/semana de status meeting: cada tarefa atualiza sozinha quando o PR fecha" |
| "Rápido e confiável" | "P95 de 80ms, 99.95% uptime nos últimos 12 meses (status.exemplo.com)" |
| "Simplifique seu fluxo de trabalho" | "De 6 ferramentas pra 1: substitui planilha de horas, Slack de aprovação e e-mail de nota fiscal" |
| "Junte-se a milhares de usuários satisfeitos" | "2.340 times ativos, NPS 71" (ou não usar prova social até ter o número real) |

## Estrutura de Headline (acima da dobra)

1. **Benefício mensurável primeiro**, mecanismo depois: `[resultado com número] + [como]`. Ex: "Reduza custo de API em 63% com cache de resposta" — não "Otimize sua infraestrutura de IA."
2. **Uma promessa por headline.** Empilhar 3 benefícios na mesma frase dilui todos.
3. **Verbo de ação concreto**, nunca abstrato: "Corte", "Gere", "Rastreie", "Elimine" — não "Otimize", "Eleve", "Transforme", "Desbloqueie" (tells do catálogo `anti-ai-slop`).

## CTA (Call to Action)

- CTA descreve o que acontece ao clicar, não um comando vago: "Ver preço por time" > "Começar agora"; "Testar com meus dados" > "Saiba mais".
- Reduza fricção percebida no microcopy abaixo do botão quando o pedido é sensível: "sem cartão de crédito", "cancele quando quiser", "2 minutos de setup" — só se for verdade.
- Um CTA primário por seção. CTA secundário (se existir) é visualmente subordinado, nunca do mesmo peso.

## Objeção-Resposta (para seções de pricing/FAQ/comparação)

Toda seção de conversão deve responder objeções reais do comprador, não listar features:
1. Levante a objeção mais provável daquele ponto do funil ("é caro pra time pequeno?", "dá pra migrar sem perder dados?", "e se eu já uso X?").
2. Responda com fato verificável (número, garantia, comparação direta), não com reafirmação vaga da promessa.
3. Uma objeção por bloco — não misture 3 respostas num parágrafo só.

## Microcopy (formulários, erros, estados vazios)

- Erro de formulário diz o que corrigir, não que "algo deu errado": "E-mail já cadastrado. Entrar em vez de criar conta?" > "Erro de validação."
- Estado vazio orienta a próxima ação, não descreve a ausência: "Crie seu primeiro projeto para ver métricas aqui" > "Nenhum dado encontrado."
- Confirmação de ação irreversível nomeia a consequência real: "Isso cancela a assinatura no fim do ciclo atual (14/03)" > "Tem certeza?"

## Checklist Antes de Entregar

- [ ] Nenhuma frase passa no "serve pra qualquer produto" (o teste da especificidade)
- [ ] Toda métrica/prova social citada é real ou está marcada como placeholder explícito para o cliente preencher (nunca inventada)
- [ ] Zero verbo abstrato de catálogo `anti-ai-slop` (Elevate, Unlock, Transform, Empower, Seamless, Cutting-edge...)
- [ ] CTA descreve a ação real, não um comando genérico
- [ ] Cada seção de objeção responde UMA pergunta real do comprador

## Skills Relacionadas

- `anti-ai-slop` — catálogo do que evitar (esta skill é o complemento positivo: o que escrever)
- `ux-reviewer` — heurísticas de usabilidade do fluxo onde a copy vive
- `design-directions` — tom de voz faz parte da direção de design escolhida

## References

Veja `references.md` nesta pasta.
