---
name: economia-tokens
description: "Engenharia de contexto para reduzir consumo de tokens sem perder profundidade: leitura direcionada (grep-first), cache de prompt, higiene de contexto e edição em diff. Use sempre, em toda tarefa, por padrão."
---

# Context Engineering — Economia de Tokens (v2)

Manual operacional denso de **Engenharia de Contexto** para agentes de código. Baseado em pesquisa 2026: Context Engineering (Anthropic, LangChain, mem0), Prompt Caching (Anthropic cache_control, OpenAI prefix caching), Lost-in-the-Middle (Stanford/Redis, arxiv:2307.03172), Sliding Window (Machine Learning Mastery), Model Routing (AI University), e práticas de produção de frameworks agentic de alto tráfego (>100k stars).

**Princípio fundador**: Contexto inchado não é só caro — é **pior**. Modelos degradam qualidade além de ~32K tokens (atenção U-shaped: primacy + recency bias, meio é esquecido). Cada token inútil no contexto dilui a atenção do modelo sobre tokens que importam.

**Regra absoluta**: Economia se aplica a **contexto inútil** (releituras, narração, histórico inchado, logs ruidosos). **NUNCA** ao entregável (código completo, estados reais, testes, tipagem estrita são obrigatórios mesmo que custem tokens).

---

## Pilar 1 — Protocolo de Leitura de Arquivos

A leitura de arquivos é o maior consumidor silencioso de tokens. Um arquivo de 500 linhas = ~2.000 tokens. Ler 10 arquivos inteiros por tarefa = ~20.000 tokens desperdiçados quando 3.000 bastariam.

### Matriz de decisão: como ler

| Situação | Ação correta | Ação errada (desperdiça) |
|---|---|---|
| Procurar onde uma função/variável é usada | `grep` com query direcionada | Abrir cada arquivo inteiro |
| Investigar um bug em função específica | Ler range de linhas (ex: L45-L80) | Ler o arquivo de 800 linhas inteiro |
| Entender a estrutura de um diretório | `list_dir` | `find . -type f` recursivo em node_modules |
| Ver o que mudou num commit | `git diff --stat` primeiro, depois diff do arquivo relevante | `git diff` sem filtro (despeja tudo) |
| Verificar se um padrão existe no projeto | `grep -r "padrão" --include="*.ts"` | Ler cada arquivo .ts manualmente |
| Re-verificar um arquivo já lido nesta sessão | **Não releia** — já está no contexto | Reler "por segurança" |
| Ver várias partes de um arquivo grande | Uma única leitura com range abrangente | 5 chamadas de leitura separadas |
| Confirmar tipo/assinatura de uma função | `grep` pela declaração | Abrir o arquivo inteiro para achar 1 linha |

### Regras rígidas

1. **Grep-First**: Antes de abrir qualquer arquivo, pergunte: "uma busca direcionada (grep/glob) resolve?". Se sim, use busca.
2. **Range-Read**: Ao investigar bug ou função, leia SÓ o trecho relevante (intervalo de linhas). Nunca o arquivo inteiro quando só 20 linhas importam.
3. **Zero-Releitura**: Nunca releia um arquivo que já está no contexto e não mudou desde a última leitura. Se editou, releia SÓ o trecho editado para confirmar.
4. **Batch-Read**: Se precisar ver 3 partes de um mesmo arquivo, agrupe numa leitura com range abrangente (ex: L1-L150) em vez de 3 chamadas (L10-L30, L50-L70, L120-L140).
5. **Tamanho máximo**: Evite ler mais de 200 linhas por vez, a menos que a tarefa exija (ex: auditoria de código inteiro, reescrita completa). Se o arquivo tem 800 linhas e só 50 importam, leia 50.

### Custo de referência

| Ação | Tokens estimados | Custo relativo |
|---|---|---|
| `grep` por padrão em 50 arquivos | ~200-500 | ✅ Barato |
| `list_dir` em diretório | ~100-300 | ✅ Barato |
| Ler range de 50 linhas | ~200-400 | ✅ Barato |
| Ler arquivo de 200 linhas inteiro | ~800-1.200 | ⚠️ Moderado |
| Ler arquivo de 500+ linhas inteiro | ~2.000-4.000 | ❌ Caro |
| Ler 10 arquivos inteiros (média 300 linhas) | ~12.000-15.000 | ❌❌ Muito caro |

---

## Pilar 2 — Alinhamento de Cache de Prompt (Cache-First Architecture)

Prompt Caching permite reutilizar o prefixo processado do prompt entre chamadas, gerando desconto de **50-90% nos tokens de entrada reutilizados** e redução de 13-31% em latência (TTFT). O cache funciona por **correspondência de prefixo**: se o início do prompt é idêntico entre chamadas, o cache acerta.

### Ordem obrigatória do prompt (estático → dinâmico)

```
┌─────────────────────────────────────────────┐
│ 1. System Prompt (identidade, regras)       │ ← Mais estável (cache hit máximo)
│ 2. Definições de ferramentas/tools          │
│ 3. Skills/Instruções carregadas             │
│ 4. Contexto estático (AGENTS.md, RULES.md)  │
│ 5. Conteúdo de referência (docs, exemplos)  │
│ 6. Histórico de conversa (turnos antigos)   │
│ 7. Resultados recentes de ferramentas       │
│ 8. Mensagem atual do usuário                │ ← Mais dinâmico (nunca no prefixo)
└─────────────────────────────────────────────┘
```

### Regras de cache

1. **Estático PRIMEIRO**: Instruções de sistema, regras, few-shot examples que não mudam vão no INÍCIO. Qualquer variabilidade no prefixo invalida o cache inteiro.
2. **Zero variabilidade invisível**: NUNCA injete timestamps, request IDs, session tokens ou dados dinâmicos no system prompt ou nas primeiras seções. Até 1 caractere diferente mata o cache.
3. **Threshold mínimo**: O prefixo estável precisa ter ≥1.024 tokens para ativar cache automático (OpenAI). Para Anthropic (Claude), o mínimo cacheável é **1.024 tokens** em modelos Opus/Sonnet e **2.048 tokens** em Haiku — prefixos menores nunca são cacheados, não importa quantas vezes se repitam.
   - Anthropic oferece dois modos: **automático** (um único campo `cache_control` no topo da requisição, cobrindo o prefixo inteiro) ou **breakpoints explícitos** (`cache_control` em blocos de conteúdo específicos — tools, system, messages, nessa ordem — para controle fino de onde o cache "corta").
   - TTL padrão de **5 minutos** (renovado a cada hit) ou **1 hora** (cache estendido, para sessões mais espaçadas). Um bloco já marcado não precisa ser marcado de novo em turnos seguintes — ele segue gerando hit enquanto acessado dentro do TTL.
   - Hit de cache custa uma fração do token de entrada normal; miss custa o preço cheio de escrita de cache (mais caro que um turno sem cache). Por isso, prefixo instável é pior que não cachear.
4. **Mensagem do usuário POR ÚLTIMO**: A pergunta dinâmica do usuário é SEMPRE o último item do contexto. Colocá-la no início mata 100% do cache.

### Matadores de cache (NUNCA faça)

| Anti-padrão | Por que mata o cache | Fix |
|---|---|---|
| Timestamp no system prompt | Muda a cada chamada → 0% hit | Remover timestamps de instruções estáticas |
| Reordenar tools entre chamadas | Prefixo diferente → cache miss | Manter ordem fixa de tool definitions |
| Carregar skills diferentes a cada turno | Prefixo instável | Carregar skills no início e manter fixas |
| Colocar pergunta do usuário antes das regras | Invalida todo o prefixo estável | Sempre: regras → contexto → pergunta |

---

## Pilar 3 — Higiene de Contexto (Context Hygiene)

O contexto é o maior vilão de custo. Contexto quadrático (n² atenção) degrada raciocínio, e informação no meio do contexto é esquecida (Lost-in-the-Middle).

### Sliding Window

- **Turnos recentes (últimos 3-5)**: manter em fidelidade total — são os mais relevantes.
- **Turnos antigos**: comprimir para 1-2 linhas de resumo cada ("Editei arquivo X, corrigi bug Y").
- **NUNCA**: carregar histórico completo de 50 turnos "por segurança". Histórico completo = custo quadrático + qualidade degradada.

### Thresholds de compactação

| Contexto acumulado | Ação |
|---|---|
| < 8K tokens | Sem compactação necessária |
| 8K-16K tokens | Resumir turnos com mais de 10 turnos de distância |
| 16K-32K tokens | Compactar agressivamente: manter só últimos 5 turnos completos + resumo de 3-5 linhas do resto |
| > 32K tokens | ALERTA: Lost-in-the-Middle ativo. Compactar obrigatoriamente. Considerar reiniciar sessão com handoff |

**Referência de mecânica real**: o auto-compact do Claude Code dispara em ~95% da janela de contexto (200K tokens): pausa o turno atual, roda uma passada de sumarização sobre o histórico inteiro, e substitui os turnos antigos pelo resumo — preservando intenção/objetivo, conceitos técnicos discutidos, arquivos examinados/editados com trechos de código relevantes, erros encontrados e como foram corrigidos, e tarefas pendentes; descarta saídas brutas de ferramentas e raciocínio intermediário. Os pilares 3 e 5 desta skill replicam manualmente essa mesma lógica de seleção — o que é "crítico o suficiente para sobreviver à compactação" é exatamente o que deve ir no resumo de handoff (skill `handoff-sessao`) antes do limite ser atingido, com a vantagem de o agente escolher o que preservar em vez de depender de um resumo automático genérico.

### Informação posicional (Lost-in-the-Middle)

Modelos têm atenção U-shaped:

```
Atenção: █████████░░░░░░░░░░░░░░░░░░░░░░░█████████
         ↑ Início (primacy)    Meio (esquecido)    Fim (recency) ↑
```

- **Informação CRÍTICA** (objetivo, restrições, regras): colocar no INÍCIO e/ou no FIM do contexto.
- **Informação de SUPORTE** (exemplos, dados de referência): pode ir no meio.
- **Re-injeção de objetivo**: Em sessões longas (>20 turnos), re-injetar o objetivo principal a cada 8-10 turnos para não ser "esquecido".

### Regras de higiene

1. **Tool schemas ociosos**: Não mantenha definições de ferramentas/skills que não serão usadas na tarefa. Carregue só o que a tarefa exige.
2. **Memória seletiva**: Carregar de `.agents/memoria/` APENAS a seção relevante à tarefa (ex: só `erros-corrigidos.md` se for debug, só `decisoes.md` se for arquitetura). Nunca os 4 arquivos inteiros.
3. **Resultados de ferramentas**: Após processar resultado de ferramenta (grep, build, test), o resultado já está no contexto — não repita/resuma em texto o que a ferramenta já retornou.
4. **Contexto descartável**: Saída de `npm install`, `git status` quando nada mudou, e listagens de diretórios já explorados são descartáveis — não os referencie em turnos futuros.

---

## Pilar 4 — Protocolo de Edição Delta

Edições de código são o segundo maior consumidor de tokens (depois de leituras).

### Matriz de decisão: como editar

| Cenário | Ação correta | Tokens estimados | Ação errada |
|---|---|---|---|
| Mudar 1-3 linhas em arquivo de 200L | Edição pontual (replace_file_content) | ~100-200 | Reescrever o arquivo inteiro (~1.000) |
| Mudar 5+ trechos não-adjacentes | Multi-replace (multi_replace_file_content) | ~300-500 | 5 chamadas separadas de replace (~500-800) |
| Criar arquivo novo inteiro | write_to_file | Custo do conteúdo | N/A |
| Renomear/mover arquivo | Comando terminal (mv/ren) | ~50 | Ler + criar novo + deletar antigo (~2.000) |

### Regras rígidas

1. **Diff, não rewrite**: Prefira edições pontuais (diff/patch) a reescrever o arquivo inteiro quando só uma parte muda.
2. **Não echo de volta**: Não cole o arquivo inteiro no chat para "mostrar o resultado" — mostre só o trecho alterado, a menos que o usuário peça.
3. **Batch edits**: Se precisa mudar 4 trechos não-adjacentes no mesmo arquivo, use UMA chamada de `multi_replace` — não 4 chamadas separadas.
4. **Verificação pós-edit**: Para confirmar que a edição funcionou, releia SÓ o trecho editado (range de linhas), nunca o arquivo inteiro.

---

## Pilar 5 — Protocolo de Comunicação (Zero Fluff)

Tokens de saída custam **mais** que tokens de entrada na maioria dos provedores. Narração desnecessária infla o custo de saída.

### Proibições absolutas

| Anti-padrão | Tokens desperdiçados | Exemplo |
|---|---|---|
| Narrar o que vai fazer antes de fazer | ~50-100 por ocorrência | "Vou analisar o código e verificar..." |
| Repetir o pedido do usuário de volta | ~30-80 | "Você pediu para eu criar um componente que..." |
| Frases de preenchimento | ~10-20 cada | "Com certeza!", "Ótima pergunta!", "Vamos lá!" |
| Parágrafos de introdução/conclusão | ~50-150 | "Em resumo, as mudanças que fizemos foram..." |
| Resumir artefato recém-criado | ~100-300 | Re-narrar o conteúdo inteiro do plano/walkthrough |
| Explicar conceito já explicado na sessão | ~100-500 | Repetir o que é "Clean Architecture" pela 3ª vez |
| Listar passos que serão executados | ~50-150 | "Primeiro vou X, depois Y, depois Z" |

### Padrão correto

- Execute e reporte o resultado. Sem narração antes.
- Respostas diretas: bullets curtos, sem parágrafos de envoltura.
- Ao explicar uma mudança: o que mudou + por quê (se não-óbvio). Máximo 3-5 bullets.
- Especifique formato de saída quando possível: "só o código", "máx. 5 linhas", "bullets curtos".

---

## Pilar 6 — Protocolo de Terminal & Ferramentas

Comandos de terminal geram saída massiva que polui o contexto (builds, logs, testes, diffs).

### Filtragem de saída obrigatória

| Comando | Saída bruta estimada | Filtro obrigatório | Saída filtrada |
|---|---|---|---|
| `git diff` (commit grande) | 5.000-50.000 tokens | `git diff --stat` primeiro | ~200-500 tokens |
| `npm run build` (com warnings) | 2.000-10.000 tokens | Sem filtro (precisa ver erros) | N/A |
| `npm install` | 1.000-5.000 tokens | Já descartável após sucesso | ~0 |
| `git log` completo | 5.000-50.000 tokens | `git log -n 5 --oneline` | ~100-200 tokens |
| `find . -type f` em projeto | 2.000-20.000 tokens | `find . -type f -name "*.ts" --not -path "*/node_modules/*"` | ~200-500 tokens |
| Testes falhando (output longo) | 2.000-10.000 tokens | Ler só a seção de falha (grep "FAIL") | ~200-500 tokens |
| `ls -R` recursivo | 1.000-50.000 tokens | `list_dir` do diretório específico | ~100-300 tokens |

### Regras rígidas

1. **Agrupe comandos relacionados**: `comando1; comando2; comando3` numa única chamada em vez de 3 chamadas separadas (cada chamada tem overhead de contexto).
2. **Filtre sempre**: Para comandos com saída longa, use `| head -n 20`, `| tail -n 20`, `--stat`, `--oneline`, `-n 5`.
3. **Não repita comandos**: Nunca rode o mesmo comando de verificação 2+ vezes seguidas sem alterar nada entre elas.
4. **Descarte após uso**: Saída de `npm install`, `git add`, `git push` é descartável — não referencie em turnos futuros.
5. **Byte-cap de segurança**: Para comandos imprevisíveis, considere `COMMAND 2>&1 | head -c 4000` para limitar a saída a ~1.000 tokens.

---

## Pilar 7 — Coordenação de Memória & Multi-Agente

Em workflows multi-agente, o maior desperdício é passar payloads gigantes entre agentes.

### Regras

1. **Coordenar por artefatos em disco**: Agentes escrevem resultados em arquivos (`.agents/memoria/`, artefatos de projeto). Outros agentes leem SÓ o que precisam desses arquivos.
2. **NUNCA**: Passar o conteúdo inteiro de um arquivo de um agente para outro via contexto. Passe o caminho do arquivo e deixe o agente receptor ler o que precisa.
3. **Sub-agentes com contexto limpo**: Ao criar sub-agentes, forneça SÓ o contexto necessário para a sub-tarefa. Não replique toda a sessão do agente pai.
4. **Memória persistente**: Decisões importantes, erros resolvidos e padrões aprendidos vão para `.agents/memoria/` — onde sobrevivem entre sessões. Não dependam de re-explicação no chat.
5. **Handoff econômico**: Ao encerrar sessão (skill `handoff-sessao`), grave resumo de 5-10 linhas com: objetivo, feito, falta, próximo passo, arquivos tocados, armadilhas. Nunca o histórico completo.

---

## Exceção Consciente (Quando NÃO economizar)

Economia de tokens **NUNCA** sacrifica profundidade de entrega. Estas situações justificam custo alto:

| Situação | Justificativa |
|---|---|
| Implementar feature/componente completo | Código completo, estados reais, testes são obrigatórios |
| Auditoria de segurança do código inteiro | O contexto necessário é justificado pela criticidade |
| Reescrita/refatoração de arquivo inteiro | Se o arquivo inteiro muda, o arquivo inteiro precisa ser lido/escrito |
| Debugging de bug complexo | Logs completos e stack traces são necessários para RCA |
| Criação de sistema SaaS completo | Ciclo vertical completo (Landing + Auth + Dashboard + API + DB + README) é obrigatório |

**Economize no resto** — contexto de suporte, narração, releituras, logs ruidosos, histórico inflado.

---

## Checklist Rápido (Antes de Cada Ação)

Use este checklist mental antes de cada ação na sessão:

- [ ] **Vou ler um arquivo?** → Grep resolve? Se sim, grep. Se não, range mínimo.
- [ ] **Já li esse arquivo nesta sessão?** → Não releia. Já está no contexto.
- [ ] **Vou rodar um comando?** → Tem filtro de saída? (--stat, | head, -n 5)
- [ ] **Vou editar código?** → Edição pontual (diff) ou preciso reescrever tudo?
- [ ] **Vou responder ao usuário?** → Sem narração? Sem repetir o pedido? Bullets curtos?
- [ ] **Sessão está longa (>20 turnos)?** → Hora de compactar. Re-injetar objetivo.
- [ ] **Vou criar sub-agente?** → Contexto mínimo para a sub-tarefa. Não replique a sessão.
- [ ] **Precisei de informação de memória?** → Ler SÓ o arquivo/seção relevante de `.agents/memoria/`.

---

## Quantificação de Impacto

| Pilar | Desperdício típico sem a regra | Economia estimada |
|---|---|---|
| Leitura direcionada (grep-first) | 15.000-20.000 tokens/sessão | 60-75% redução em leitura |
| Cache alignment | 40-90% re-processamento desnecessário | 50-90% em cache hits |
| Sliding window + compactação | Contexto cresce linearmente sem limite | Teto de ~16K tokens efetivos |
| Edição delta | 3-5x mais tokens por reescrita integral | 60-80% redução em edição |
| Comunicação zero-fluff | 500-2.000 tokens/sessão em narração | 100% eliminação |
| Filtragem de terminal | 5.000-30.000 tokens em logs ruidosos | 80-95% redução |
| Memória em disco | Payload entre agentes = duplicação | ~0 tokens de transferência |
| **TOTAL COMBINADO** | — | **60-85% redução no custo total** |

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

> Gerado pelo Izanagi AI: cópia fiel de `skills/economia-tokens/SKILL.md` (fonte da verdade).
