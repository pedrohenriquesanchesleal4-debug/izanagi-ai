---
name: "plan-cold-review"
description: "Revisão fria de plano no padrão elefante e peixinhos: quem conversou com o usuário (elefante) escreve o plano em arquivo; 2 ou 3 revisores sem a conversa (peixinhos) leem só o arquivo e apontam o que ficou implícito, ambíguo ou faltando, passo a passo. Código só depois de aprovado. Use depois de escrever um plano e antes de implementar qualquer coisa de mais de um arquivo. Gatilhos de ativação: plan cold review: o plano tem que se explicar sozinho; quando usar; protocolo; sem suporte a subagente."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Plan Cold Review: o plano tem que se explicar sozinho

> Migrado deterministicamente de `skills/plan-cold-review/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Revisão fria de plano no padrão elefante e peixinhos: quem conversou com o usuário (elefante) escreve o plano em arquivo; 2 ou 3 revisores sem a conversa (peixinhos) leem só o arquivo e apontam o que ficou implícito, ambíguo ou faltando, passo a passo. Código só depois de aprovado.
- **Ativar quando:** Use depois de escrever um plano e antes de implementar qualquer coisa de mais de um arquivo.
- **Escopo canônico:** Plan Cold Review: o plano tem que se explicar sozinho
- **Seções do corpo original:** Quando usar · Protocolo · Sem suporte a subagente
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Elefante escreve design_draft.md (ou .agents/plans/<slug.md):

**Elefante escreve `design_draft.md`** (ou `.agents/plans/<slug>.md`): objetivo, passos numerados, arquivos tocados, decisões e critério de pronto. Plano que só existe no chat não pode ser revisado frio.

### Passo 2 — Despache 2 ou 3 peixinhos em paralelo, cada um um subagente novo (Claude Code:

**Despache 2 ou 3 peixinhos em paralelo**, cada um um subagente novo (Claude Code: Agent tool; Antigravity: `invoke_subagent`; Codex/OpenCode: subagent) recebendo **apenas** o caminho do arquivo e um foco diferente:

- Peixinho A · **bordas**: "Para cada passo, que entrada ou evento faria ele falhar? (ex.: e se o mesmo pagamento chegar duas vezes?)"
   - Peixinho B · **ambiguidade**: "Que termo, arquivo ou API citado você não conseguiria localizar ou definir sem perguntar?"
   - Peixinho C · **prova** (opcional): "O critério de pronto é verificável? Que comando ou teste provaria cada item?"

   Instrução comum: *"Você não sabe nada além deste arquivo. Comente por passo (`Passo 2: ...`). No máximo 8 comentários, mais grave primeiro. Não proponha arquitetura nova nem reescreva o plano."*

### Passo 3 — Corrija o arquivo, não a conversa.

**Corrija o arquivo, não a conversa.** Cada comentário vira edição no plano ou uma nota explicando por que não se aplica (o próximo leitor terá a mesma dúvida).

### Passo 4 — No máximo 2 rodadas.

**No máximo 2 rodadas.** Se ainda houver comentário grave, o problema é de requisito: volte ao `grilling` ou pergunte ao usuário.

### Passo 5 — Aprovação explícita.

**Aprovação explícita.** Mostre o plano final e os comentários resolvidos. Só implemente depois do "pode seguir", salvo autorização prévia para seguir direto.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

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

# Plan Cold Review: o plano tem que se explicar sozinho

Quem escreveu o plano sabe o que quis dizer. O código vai ser escrito a partir do que está escrito. A distância entre os dois é onde nascem os bugs de entendimento. Padrão popularizado pelo plugin `elephant-goldfish` do Google: o **elefante** lembra de tudo e escreve; os **peixinhos dourados** não lembram de nada e por isso enxergam o que não foi escrito.

## Quando usar

- Depois de `grilling` ou de qualquer plano com mais de 3 passos.
- Antes de despachar implementação para outro agente (o outro agente também é um peixinho).

**Pule** para mudanças de um arquivo com intenção óbvia.

## Protocolo

1. **Elefante escreve `design_draft.md`** (ou `.agents/plans/<slug>.md`): objetivo, passos numerados, arquivos tocados, decisões e critério de pronto. Plano que só existe no chat não pode ser revisado frio.
2. **Despache 2 ou 3 peixinhos em paralelo**, cada um um subagente novo (Claude Code: Agent tool; Antigravity: `invoke_subagent`; Codex/OpenCode: subagent) recebendo **apenas** o caminho do arquivo e um foco diferente:
   - Peixinho A · **bordas**: "Para cada passo, que entrada ou evento faria ele falhar? (ex.: e se o mesmo pagamento chegar duas vezes?)"
   - Peixinho B · **ambiguidade**: "Que termo, arquivo ou API citado você não conseguiria localizar ou definir sem perguntar?"
   - Peixinho C · **prova** (opcional): "O critério de pronto é verificável? Que comando ou teste provaria cada item?"

   Instrução comum: *"Você não sabe nada além deste arquivo. Comente por passo (`Passo 2: ...`). No máximo 8 comentários, mais grave primeiro. Não proponha arquitetura nova nem reescreva o plano."*
3. **Corrija o arquivo, não a conversa.** Cada comentário vira edição no plano ou uma nota explicando por que não se aplica (o próximo leitor terá a mesma dúvida).
4. **No máximo 2 rodadas.** Se ainda houver comentário grave, o problema é de requisito: volte ao `grilling` ou pergunte ao usuário.
5. **Aprovação explícita.** Mostre o plano final e os comentários resolvidos. Só implemente depois do "pode seguir", salvo autorização prévia para seguir direto.

## Sem suporte a subagente

Simule um peixinho: salve o plano, releia o arquivo como se fosse a primeira vez e responda os três focos acima. É mais fraco (você ainda lembra da conversa), mas pega termos sem definição e passos sem critério.
