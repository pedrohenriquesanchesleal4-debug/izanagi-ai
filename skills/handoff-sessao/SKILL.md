---
name: handoff-sessao
description: "Grava um resumo curto do estado da tarefa em andamento para retomar na próxima sessão sem perder contexto. Use quando o usuário disser 'pausa'/'continuo depois' ou a conversa estiver perto do limite de contexto."
---

# Handoff de Sessão

Grava o **estado da tarefa em progresso** para a próxima sessão retomar no ponto exato — sem perder contexto e sem reexplicar. Complementa a skill `memoria-projeto` (que guarda conhecimento permanente: decisões, padrões, erros corrigidos).

## Quando acionar

- Usuário indica que vai parar/continuar depois ("vou parar por aqui", "continuo depois", "pausa").
- A tarefa está pela metade (ex. feature com 3 de 5 passos feitos).
- O contexto da conversa está grande e prestes a ser resumido/perdido (limite de contexto próximo).
- Fim de sessão de trabalho em tarefa longa (multi-sessão).

## O que gravar (arquivo: `.agents/memoria/em-andamento.md`)

Formato obrigatório — curto, denso, sem narrativa:

```markdown
## <nome da tarefa> — <data ISO>

- **Objetivo**: <1 linha — o que a tarefa entrega>
- **Feito**: <lista curta do que já está pronto e validado>
- **Falta**: <lista curta do que ainda falta>
- **Próximo passo concreto**: <1 linha — ação exata ao retomar, ex.: "rodar `npm run verify` e commitar">>
- **Arquivos tocados**: <paths; opcional se óbvio>
- **Armadilhas**: <decisões/erros que quem retomar precisa saber; 1-2 linhas>
```

Exemplo real:

```markdown
## Migração pg para mysql — 2026-08-10
- Objetivo: migrar schema do blog (12 tabelas) com zero perda de dados
- Feito: mapeamento de tipos feito; script de export em `scripts/export.py` testado
- Falta: script de import; diff de contagem; rollback testado
- Próximo passo: escrever `scripts/import.py` com upsert por id
- Arquivos tocados: scripts/export.py, docs/migracao.md
- Armadilhas: DATETIME sem fuso no mysql — padronizar UTC antes do import
```

## Regras

- **Sobrescreva** a entrada da mesma tarefa (é estado atual, não histórico) — uma entrada por tarefa ativa.
- **Concluiu? Apague** a entrada — o que vale a pena para sempre vai para `decisoes.md`/`erros-corrigidos.md` via `memoria-projeto`.
- **Ao retomar uma sessão, leia este arquivo primeiro** se existir — economiza o usuário reexplicar onde parou.
- **Sem histórico longo**: se a tarefa mudou de natureza, nova entrada; a antiga é apagada.
- **Registre armadilhas**: decisão que parece estranha retomando sem contexto (ex. "escolhemos X porque Y") — 1 linha evita refazer o debate.

## Workflow de gravação (3 passos, rápido)

1. **Leia** `.agents/memoria/em-andamento.md` (existe? qual tarefa está ativa?).
2. **Atualize/sobrescreva** a entrada da tarefa atual com o formato acima.
3. **Confirme** ao usuário: "Handoff gravado — ao retomar, começo lendo o estado."

## Checklist de qualidade (antes de encerrar sessão)

- [ ] Entrada da tarefa atual existe no formato padrão
- [ ] Próximo passo é uma ação concreta e executável
- [ ] Armadilhas/decisões não-óbvias registradas
- [ ] Entradas de tarefas concluídas apagadas
- [ ] Nada de dados sensíveis no arquivo (se houver, mascarar)

## Anti-padrões (proibido)

1. ❌ Gravar histórico gigante da conversa (estado atual, não ata)
2. ❌ Próximo passo vago ("continuar a tarefa")
3. ❌ Acumular entradas desatualizadas da mesma tarefa
4. ❌ Deixar entrada de tarefa concluída
5. ❌ Confiar na memória sem escrever ("lembro do que falta")
6. ❌ Segredos/credenciais no arquivo de handoff

## Por que não confiar só no auto-compact

Ferramentas de agente de código já compactam sozinhas quando a janela de contexto se esgota (ex.: Claude Code dispara em ~95% do limite, resume o histórico e descarta saída bruta de ferramentas/raciocínio intermediário). Isso não substitui o handoff desta skill por três motivos:

1. **O resumo automático é genérico** — otimizado para "não perder o fio", não para o formato denso e específico (Objetivo/Feito/Falta/Próximo passo/Armadilhas) que quem retoma precisa.
2. **Não sobrevive ao fim da sessão** — auto-compact preserva contexto dentro da mesma sessão; não grava nada em disco para uma sessão nova, um outro agente, ou o dia seguinte.
3. **Cadência de checkpoint deliberada bate cadência reativa** — a prática recomendada para tarefas longas é gravar estado a cada unidade de trabalho concluída (sub-problema resolvido, decisão tomada), não só quando o limite técnico é atingido. Gravar só ao estourar o contexto é tarde demais se a sessão cair antes disso (crash, fechamento acidental, timeout).

Por isso: grave o handoff em pontos naturais de parada (fim de sub-tarefa, decisão importante) — não espere o aviso de contexto cheio.

## Composição com outras skills

- **Antes**: `memoria-projeto` (ler conhecimento permanente ao iniciar) → trabalho em si
- **Depois**: `memoria-projeto` (registrar decisões/erros permanentes) → `professor-modo` (explicar o que mudou) → próxima sessão começa lendo `em-andamento.md`

## References

- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026) para gestão de contexto multi-sessão.
