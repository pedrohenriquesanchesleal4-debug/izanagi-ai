---
name: "lead-finder"
description: "Prospecção por intenção pública: a partir do que o negócio vende, busca na web posts públicos de pessoas reclamando do problema ou querendo trocar de fornecedor, devolve lista com link de cada post, nota de 0 a 100 de prontidão e uma resposta útil e personalizada para o humano revisar e enviar. Use quando o usuário quiser achar clientes, validar demanda ou montar lista de prospecção. Gatilhos de ativação: lead finder: achar quem já está pedindo o que você vende; quando usar; passo 1: entender a oferta; passo 2: buscar intenção pública."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Lead Finder: achar quem já está pedindo o que você vende

> Migrado deterministicamente de `skills/lead-finder/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Prospecção por intenção pública: a partir do que o negócio vende, busca na web posts públicos de pessoas reclamando do problema ou querendo trocar de fornecedor, devolve lista com link de cada post, nota de 0 a 100 de prontidão e uma resposta útil e personalizada para o humano revisar e enviar.
- **Ativar quando:** Use quando o usuário quiser achar clientes, validar demanda ou montar lista de prospecção.
- **Escopo canônico:** Lead Finder: achar quem já está pedindo o que você vende
- **Seções do corpo original:** Quando usar · Passo 1: entender a oferta · Passo 2: buscar intenção pública · Passo 3: pontuar (0 a 100) · Passo 4: rascunhar a resposta
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Pessoas descrevem publicamente o problema que o seu produto resolve, em fóruns, Reddit,...

Pessoas descrevem publicamente o problema que o seu produto resolve, em fóruns, Reddit, X, LinkedIn e reviews de concorrentes. Esta skill encontra esses posts, prioriza e prepara uma resposta que ajuda de verdade. Quem envia é o humano.

### Passo 2 — Do link do negócio ou de uma frase:

Do link do negócio ou de uma frase: o que resolve, para quem, preço aproximado, concorrentes. Gere 10 a 15 frases de dor como o cliente escreveria ("alguém indica sistema de pedidos sem comissão", "cansei do iFood cobrando 27%").

### Passo 3 — Busca web com as frases + site:reddit.com, fóruns do nicho, reviews negativas de concor...

Busca web com as frases + `site:reddit.com`, fóruns do nicho, reviews negativas de concorrentes, posts de "alguém indica". Só conteúdo público e recente (últimos 90 dias de preferência). Respeite os termos de cada plataforma; nada de login automatizado nem raspagem em massa.

### Passo 4 — Uma mensagem por lead, que ajuda primeiro:

Uma mensagem por lead, que **ajuda primeiro**: responde a dúvida do post, cita o detalhe que a pessoa escreveu e só então menciona a oferta, com transparência de que é o próprio negócio. Sem promessa que o produto não cumpre.

### Passo 5 — Tabela:

Tabela: nota, link do post, resumo da dor em 1 linha, rascunho da resposta. Ordenada por nota.

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

# Lead Finder: achar quem já está pedindo o que você vende

Pessoas descrevem publicamente o problema que o seu produto resolve, em fóruns, Reddit, X, LinkedIn e reviews de concorrentes. Esta skill encontra esses posts, prioriza e prepara uma resposta que ajuda de verdade. Quem envia é o humano.

## Quando usar

- Usuário quer clientes ou quer saber se existe demanda antes de construir (combina com `grilling`).

## Passo 1: entender a oferta

Do link do negócio ou de uma frase: o que resolve, para quem, preço aproximado, concorrentes. Gere 10 a 15 frases de dor como o cliente escreveria ("alguém indica sistema de pedidos sem comissão", "cansei do iFood cobrando 27%").

## Passo 2: buscar intenção pública

Busca web com as frases + `site:reddit.com`, fóruns do nicho, reviews negativas de concorrentes, posts de "alguém indica". Só conteúdo público e recente (últimos 90 dias de preferência). Respeite os termos de cada plataforma; nada de login automatizado nem raspagem em massa.

## Passo 3: pontuar (0 a 100)

| Sinal | Pontos |
|---|---|
| Pede solução explicitamente ("alguém indica") | +35 |
| Dor descrita com consequência (dinheiro, tempo) | +20 |
| Quer largar um concorrente | +20 |
| Post recente (< 30 dias) | +15 |
| Perfil compatível com o cliente ideal | +10 |

## Passo 4: rascunhar a resposta

Uma mensagem por lead, que **ajuda primeiro**: responde a dúvida do post, cita o detalhe que a pessoa escreveu e só então menciona a oferta, com transparência de que é o próprio negócio. Sem promessa que o produto não cumpre.

## Saída

Tabela: nota, link do post, resumo da dor em 1 linha, rascunho da resposta. Ordenada por nota.

## Regras

- **Nunca envia nada.** Envio, comentário e DM são do humano.
- Sem dado pessoal além do que está no post público; não cruze fontes para montar perfil de pessoa.
- Sem spam: no máximo uma abordagem por pessoa, e nenhuma onde a comunidade proíbe autopromoção.
