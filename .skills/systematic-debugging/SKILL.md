---
name: "systematic-debugging"
description: "Depuração em 6 fases (reproduzir, isolar, hipótese, corrigir, verificar, prevenir) com causa raiz comprovada por evidência, nunca por chute. Use em qualquer erro, crash ou teste falhando, antes de qualquer correção. Gatilhos de ativação: systematic debugging — manual operacional; quando usar; classificação rápida (antes de mergulhar); processo (6 fases obrigatórias)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Systematic Debugging — Manual Operacional

> Migrado deterministicamente de `skills/systematic-debugging/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Depuração em 6 fases (reproduzir, isolar, hipótese, corrigir, verificar, prevenir) com causa raiz comprovada por evidência, nunca por chute.
- **Ativar quando:** Use em qualquer erro, crash ou teste falhando, antes de qualquer correção.
- **Escopo canônico:** Systematic Debugging — Manual Operacional
- **Seções do corpo original:** Quando usar · Classificação Rápida (Antes de Mergulhar) · Processo (6 Fases Obrigatórias) · Regras de Ouro · Anti-padrões (NUNCA)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — FASE 1 — REPRODUZIR

Sem reprodução, sem fix. O erro precisa ser visto com os próprios olhos (ou logs).

| Passo | Ação | Evidência necessária |
|---|---|---|
| 1a | Rode o código e capture a falha | Mensagem de erro completa + stack trace |
| 1b | Anote o contexto | Versão, ambiente, OS, Node version, dados de entrada |
| 1c | Reduza ao MRE (Menor Reprodução Possível) | Menor input + menor código que reproduz |
| 1d | Se não reproduz → procure a condição real | Timing? Ordem? Dados específicos? Race condition? |

**Regra**: Se após 3 tentativas não reproduz, a fase não acabou. Investigue: ambiente diferente? Dados diferentes? Timing?

### Passo 2 — FASE 2 — ISOLAR (Encontrar a Causa)

Localize a camada/função/linha exata que falha.

| Técnica | Quando usar | Como |
|---|---|---|
| **Bisect manual** | Bug em trecho de código | Comente metade do código, teste, repita |
| **`git bisect`** | Bug introduzido por commit | `git bisect start`, `git bisect bad`, `git bisect good <hash>` |
| **Eliminação de variáveis** | Múltiplas possíveis causas | Remova uma variável por vez, teste cada remoção |
| **Logging cirúrgico** | Fluxo complexo | `console.log` em pontos estratégicos (remover depois!) |
| **Pergunta "o que mudou?"** | Bug recente | Diff do último commit/deploy — 80% dos bugs vêm de uma mudança |
| **Distributed tracing** | Bug atravessa múltiplos serviços/microserviços | Correlacione pelo trace ID (ex. OpenTelemetry) e identifique o span com maior latência ou erro — sem isso, correlacionar timestamps de logs entre serviços não sincronizados é adivinhação |

### Passo 3 — FASE 3 — HIPÓTESE (Causa Raiz, Não Sintoma)

| Regra | Detalhe |
|---|---|
| 1-3 hipóteses baseadas em **evidência** | Nunca opinião ou "acho que" |
| Cada hipótese tem teste que a prova ou refuta | Print de verificação, teste unitário mínimo, chamada isolada |
| Prefira a hipótese que explica **todos** os sintomas | Hipótese que explica 1 de 3 sintomas provavelmente está errada |
| **Causa raiz ≠ Sintoma** | Corrigir sintoma = bug volta |

**Técnica formal — 5 Whys**: parta do sintoma e pergunte "por quê?" repetidamente (tipicamente 5 iterações), cada resposta virando a próxima pergunta, até chegar num defeito acionável (não mais um "porque sim"). Exemplo: *API retorna 500* → por quê? *query falhou* → por quê? *conexão do pool esgotada* → por quê? *conexão não é liberada em erro* → por quê? *falta `finally`/`using` no código de acesso* → causa raiz: recurso não é liberado em caminho de exceção.

**Quando há múltiplas causas candidatas concorrendo** (bug com sintomas espalhados, causa não óbvia): use um **diagrama de Ishikawa/Fishbone** (Kaoru Ishikawa) antes do 5 Whys — mapeie candidatas por categoria (Código/Lógica, Dados/Input, Ambiente/Config, Dependências, Concorrência/Timing, Infra/Rede) para não fixar prematuramente numa hipótese só porque foi a primeira lembrada. Só depois de mapear as categorias, aplique 5 Whys na(s) mais provável(is).

**Limite**: Após 3 hipóteses refutadas sem confirmação → **pare e reconsidere**. Você pode estar olhando a camada errada:

| Camada a reconsiderar | Sinais |
|---|---|
| Rede | Timeout, CORS, DNS |
| Permissão | EACCES, 403 |
| Cache | Funciona em incognito mas não em normal |
| Build velho | Código editado mas comportamento não muda |
| Dados | Funciona com dados limpos mas não com dados reais |
| Race condition | Falha intermitente, ordem-dependente |

### Passo 4 — FASE 4 — CORRIGIR (Mínimo e Limpo)

1. **Teste de regressão PRIMEIRO** (Red → Green): escreva um teste que falha com o bug e passará com o fix.
2. **Fix mínimo** que ataca a causa raiz — nada de gambiarras.
3. Código limpo, com o mesmo padrão do projeto.

| Proibido no fix | Por quê |
|---|---|
| `try/catch` vazio | Esconde a falha |
| `// TODO fix later` | Nunca será fixado |
| `as any` / `as unknown as` | Silencia o tipo, não resolve |
| Desabilitar/deletar teste que falha | Esconde o problema |
| Mudar 10 coisas de uma vez | Impossível saber qual resolveu |

### Passo 5 — FASE 5 — VERIFICAR

| Verificação | O que confirma |
|---|---|
| Rode o MRE original | O erro sumiu |
| Rode a suíte completa (`npm run build`/`test`/`verify`/`doctor`) | Nada quebrou |
| Valide o cenário real de uso | Fix funciona no contexto real, não só no MRE |
| Verifique edge cases | Input vazio, null, extremos, concorrência |

### Passo 6 — FASE 6 — PREVENIR (Regressão)

1. Mantenha o teste de regressão na suíte permanentemente.
2. Adicione logging estruturado no ponto falho se fizer sentido.
3. Registre em `.agents/memoria/erros-corrigidos.md`:

```markdown
- [AAAA-MM-DD] [ÁREA] Sintoma → Causa raiz → Fix aplicado (1-3 linhas)
```

---

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

# Systematic Debugging — Manual Operacional

Depurador cirúrgico. **Nunca chuta.** Todo bug é resolvido com causa raiz comprovada por reprodução — não por tentativa e erro. Se não reproduziu, não corrigiu: apenas adivinhou.

## Quando usar

- Erros, crashes, exceções, testes falhando, CI vermelho, comportamento inesperado.
- O usuário pede "debug", "corrija", "está quebrando", "erro em", "não funciona".
- **Antes** de qualquer correção de código que não seja mudança planejada de feature.

**Pule** para `agentic-coding` quando é implementação de feature nova (não bug); `self-correction` quando o erro é do próprio agente (não do código do usuário).

---

## Classificação Rápida (Antes de Mergulhar)

Antes de depurar código, elimine o óbvio:

| Categoria | Sintoma típico | Verificação (5 segundos) | Fix rápido |
|---|---|---|---|
| **Build obsoleto** | CLI roda código antigo | `npm run build` foi rodado? | Recompilar |
| **Cache** | Comportamento inconsistente | Browser cache, CDN cache, `.next/cache` | Limpar cache + hard refresh |
| **Permissão/Ambiente** | `EACCES`, `ENOENT`, porta ocupada | Verificar path, `.env`, porta | Corrigir path/env/porta |
| **Dependência** | `MODULE_NOT_FOUND`, tipo incompatível | `npm ls <pkg>`, lockfile atualizado? | `rm -rf node_modules && npm ci` |
| **Encoding** | Caracteres estranhos, BOM, CRLF | Verificar encoding do arquivo | Salvar como UTF-8 sem BOM |
| **Dado corrompido** | Crash em input específico | Testar com input limpo | Validar/sanitizar input |

Se o problema está nesta lista, **não precisa das 6 fases** — corrija e siga.

---

## Processo (6 Fases Obrigatórias)

### FASE 1 — REPRODUZIR

Sem reprodução, sem fix. O erro precisa ser visto com os próprios olhos (ou logs).

| Passo | Ação | Evidência necessária |
|---|---|---|
| 1a | Rode o código e capture a falha | Mensagem de erro completa + stack trace |
| 1b | Anote o contexto | Versão, ambiente, OS, Node version, dados de entrada |
| 1c | Reduza ao MRE (Menor Reprodução Possível) | Menor input + menor código que reproduz |
| 1d | Se não reproduz → procure a condição real | Timing? Ordem? Dados específicos? Race condition? |

**Regra**: Se após 3 tentativas não reproduz, a fase não acabou. Investigue: ambiente diferente? Dados diferentes? Timing?

### FASE 2 — ISOLAR (Encontrar a Causa)

Localize a camada/função/linha exata que falha.

| Técnica | Quando usar | Como |
|---|---|---|
| **Bisect manual** | Bug em trecho de código | Comente metade do código, teste, repita |
| **`git bisect`** | Bug introduzido por commit | `git bisect start`, `git bisect bad`, `git bisect good <hash>` |
| **Eliminação de variáveis** | Múltiplas possíveis causas | Remova uma variável por vez, teste cada remoção |
| **Logging cirúrgico** | Fluxo complexo | `console.log` em pontos estratégicos (remover depois!) |
| **Pergunta "o que mudou?"** | Bug recente | Diff do último commit/deploy — 80% dos bugs vêm de uma mudança |
| **Distributed tracing** | Bug atravessa múltiplos serviços/microserviços | Correlacione pelo trace ID (ex. OpenTelemetry) e identifique o span com maior latência ou erro — sem isso, correlacionar timestamps de logs entre serviços não sincronizados é adivinhação |

### FASE 3 — HIPÓTESE (Causa Raiz, Não Sintoma)

| Regra | Detalhe |
|---|---|
| 1-3 hipóteses baseadas em **evidência** | Nunca opinião ou "acho que" |
| Cada hipótese tem teste que a prova ou refuta | Print de verificação, teste unitário mínimo, chamada isolada |
| Prefira a hipótese que explica **todos** os sintomas | Hipótese que explica 1 de 3 sintomas provavelmente está errada |
| **Causa raiz ≠ Sintoma** | Corrigir sintoma = bug volta |

**Técnica formal — 5 Whys**: parta do sintoma e pergunte "por quê?" repetidamente (tipicamente 5 iterações), cada resposta virando a próxima pergunta, até chegar num defeito acionável (não mais um "porque sim"). Exemplo: *API retorna 500* → por quê? *query falhou* → por quê? *conexão do pool esgotada* → por quê? *conexão não é liberada em erro* → por quê? *falta `finally`/`using` no código de acesso* → causa raiz: recurso não é liberado em caminho de exceção.

**Quando há múltiplas causas candidatas concorrendo** (bug com sintomas espalhados, causa não óbvia): use um **diagrama de Ishikawa/Fishbone** (Kaoru Ishikawa) antes do 5 Whys — mapeie candidatas por categoria (Código/Lógica, Dados/Input, Ambiente/Config, Dependências, Concorrência/Timing, Infra/Rede) para não fixar prematuramente numa hipótese só porque foi a primeira lembrada. Só depois de mapear as categorias, aplique 5 Whys na(s) mais provável(is).

**Limite**: Após 3 hipóteses refutadas sem confirmação → **pare e reconsidere**. Você pode estar olhando a camada errada:

| Camada a reconsiderar | Sinais |
|---|---|
| Rede | Timeout, CORS, DNS |
| Permissão | EACCES, 403 |
| Cache | Funciona em incognito mas não em normal |
| Build velho | Código editado mas comportamento não muda |
| Dados | Funciona com dados limpos mas não com dados reais |
| Race condition | Falha intermitente, ordem-dependente |

### FASE 4 — CORRIGIR (Mínimo e Limpo)

1. **Teste de regressão PRIMEIRO** (Red → Green): escreva um teste que falha com o bug e passará com o fix.
2. **Fix mínimo** que ataca a causa raiz — nada de gambiarras.
3. Código limpo, com o mesmo padrão do projeto.

| Proibido no fix | Por quê |
|---|---|
| `try/catch` vazio | Esconde a falha |
| `// TODO fix later` | Nunca será fixado |
| `as any` / `as unknown as` | Silencia o tipo, não resolve |
| Desabilitar/deletar teste que falha | Esconde o problema |
| Mudar 10 coisas de uma vez | Impossível saber qual resolveu |

### FASE 5 — VERIFICAR

| Verificação | O que confirma |
|---|---|
| Rode o MRE original | O erro sumiu |
| Rode a suíte completa (`npm run build`/`test`/`verify`/`doctor`) | Nada quebrou |
| Valide o cenário real de uso | Fix funciona no contexto real, não só no MRE |
| Verifique edge cases | Input vazio, null, extremos, concorrência |

### FASE 6 — PREVENIR (Regressão)

1. Mantenha o teste de regressão na suíte permanentemente.
2. Adicione logging estruturado no ponto falho se fizer sentido.
3. Registre em `.agents/memoria/erros-corrigidos.md`:

```markdown
- [AAAA-MM-DD] [ÁREA] Sintoma → Causa raiz → Fix aplicado (1-3 linhas)
```

---

## Regras de Ouro

1. **Zero chute**: Hipótese sem forma de ser provada não é hipótese, é palpite.
2. **Reproduzir antes de corrigir**: Bug que não reproduz = bug não entendido.
3. **Uma mudança por vez**: Mudou código e bug apareceu? Reverta e confirme que some.
4. **Causa raiz ≠ sintoma**: Pergunte "por que?" até o defeito subjacente.
5. **Teste de regressão é parte do fix**, não extra opcional.
6. **Não conserte no escuro**: Se stack trace não aponta, adicione logging e reproduza.
7. **3 hipóteses refutadas = mudar camada** ou escalar.

---

## Anti-padrões (NUNCA)

| Anti-padrão | Consequência |
|---|---|
| ❌ `try/catch {}` vazio para "parar o erro" | Bug escondido, reaparece em produção |
| ❌ `console.log` espalhado e esquecido | Poluição de output, leak de dados |
| ❌ "Já vi esse erro antes" sem verificar causa real | Causa diferente, fix errado |
| ❌ Mudar 10 coisas de uma vez "pra ver o que resolve" | Impossível atribuir causa |
| ❌ Deletar/desabilitar testes que falham | Regressão garantida |
| ❌ `as any` / `as unknown` para silenciar typechecker | Esconde o tipo real do problema |
| ❌ Persistir na mesma abordagem após 3 falhas | Insanidade do loop |

---

## Composição com outras skills

- **Antes**: `memoria-projeto` (erros já corrigidos — não repita), `economia-tokens` (ler logs com eficiência)
- **Durante**: `agentic-coding` (loop verificação empírica), `tdd` (teste de regressão primeiro)
- **Depois**: `self-critique` (revisar o fix), `continuous-improvement` (registrar aprendizado)

## References

- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
