---
name: economia-tokens
description: Reduz o consumo de tokens em QUALQUER tarefa de código ou análise de arquivos. Use sempre, em toda tarefa — não é preciso o usuário pedir "economize tokens". Ativa quando for ler arquivos grandes, editar código, explicar mudanças, rodar comandos, ou revisar um diff. Evita reler arquivos inteiros sem necessidade, corta narração desnecessária, prefere trechos/diffs a colar arquivos completos, e agrupa chamadas de ferramentas.
---

# Economia de tokens (Context Engineering)

Instruções permanentes de como trabalhar de forma econômica. Valem para a sessão inteira, não só na primeira leitura. Baseadas em pesquisa 2026: context engineering (mem0, LangChain), prompt caching (Anthropic/OpenAI), lost-in-the-middle (Redis, arxiv), sliding window e model routing (AI University, Token Optimize).

## Leitura de arquivos

- Antes de ler um arquivo inteiro, pergunte: "uma busca (grep/glob) direcionada resolve?". Se sim, use busca em vez de abrir o arquivo todo.
- Ao investigar um bug ou função específica, leia só o trecho relevante (range de linhas), não o arquivo inteiro.
- Nunca releia um arquivo que já está no contexto e não mudou desde a última leitura.
- Se precisar ver várias partes de um mesmo arquivo grande, agrupe numa única leitura em vez de várias chamadas pequenas.

## Contexto (o maior vilão de custo)

- **Lost-in-the-middle (real)**: modelos degradam qualidade além de ~32K tokens de contexto e esquecem o meio. Contexto inchado não é só caro, é pior. Mantenha o contexto mínimo necessário — "dá pra fazer com 5K tokens? faça".
- **Sliding window**: quando uma conversa fica longa, mantenha os últimos N turnos em fidelidade total e resuma os anteriores (1 linha cada). Nunca carregue histórico completo "por segurança".
- **Prompt caching (estrutura o prompt para cache)**: conteúdo estático PRIMEIRO (instruções de sistema, regras, exemplos few-shot que não mudam), conteúdo pesado no MEIO, e conteúdo dinâmico (pergunta do usuário, resultados recentes de ferramentas) POR ÚLTIMO. Prefixos estáveis = cache hit = até 75-90% de desconto em re-processamento.
- **Tool schemas ociosos**: não mantenha definições de ferramentas/skills que não serão usadas na tarefa. Carregue só o que a tarefa exige.
- **Memory isolada**: carregue de `.agents/memoria/` apenas o que é relevante à tarefa atual (uma seção de um arquivo, não os 4 arquivos inteiros).
- **Model routing**: tarefas de classificação/roteamento são baratas; tarefas de raciocínio profundo são caras. Não use o modelo mais forte para decidir o trivial.
- **Output constraints**: especifique o formato da saída ("bullets curtos", "máx. 5 linhas", "só o código") — tokens de saída custam mais que os de entrada e "explique em detalhe" infla o custo.

## Edição de código

- Prefira edições pontuais (diff/patch) a reescrever o arquivo inteiro quando só uma parte muda.
- Não cole de volta o arquivo inteiro no chat para "mostrar o resultado" — mostre só o trecho alterado, a menos que o usuário peça o arquivo completo.

## Comunicação

- Não narre o que vai fazer antes de fazer ("vou analisar o código...", "deixa eu verificar..."). Só execute e reporte o resultado.
- Respostas diretas: sem repetir de volta o que o usuário já disse, sem resumir o pedido antes de responder.
- Ao explicar uma mudança, seja telegráfico: bullets curtos, sem parágrafos de introdução/conclusão.
- Evite frases de preenchimento ("Com certeza!", "Ótima pergunta!", "Vamos lá!").

## Comandos e ferramentas

- Agrupe comandos relacionados numa única chamada de terminal (ex.: `comando1 && comando2`) em vez de várias chamadas separadas.
- Ao rodar comandos que geram saída grande (ex. `git diff`, logs, build), filtre ou limite a saída (`--stat`, `| head`, `| tail`) em vez de despejar tudo no contexto.
- Não rode o mesmo comando de verificação repetidamente sem necessidade (ex. rodar testes 3x seguidas sem mudar nada).

## Exceção consciente (quando NÃO economizar)

Economia de tokens NUNCA sacrifica profundidade de entrega. Em tarefas de produção (SaaS, sistemas, componentes), o código completo, os estados reais e os testes são obrigatórios mesmo que custem tokens — a economia se aplica a contexto inútil (releituras, narração, histórico inchado), não a entregável. Se a pessoa pedir algo que exija contexto grande (ex: auditoria de código inteiro), o contexto necessário é justificado — economize no resto.

## Gotchas (erros comuns que fazem gastar token à toa)

- Reler o mesmo arquivo em cada turno "por segurança" — só releia se o arquivo pode ter mudado (edição externa, outro processo).
- Colar o diff inteiro de um commit grande quando só 2-3 linhas importam para a pergunta.
- Explicar de novo um conceito que já foi explicado nesta sessão.
- Rodar `ls -R` ou `find` em diretórios grandes (ex. `node_modules`) sem filtro.
- Manter todo o histórico da conversa no contexto quando um resumo de 3 linhas basta (sliding window).
- Colocar a pergunta dinâmica do usuário no COMEÇO do prompt (mata o cache de prefixo).

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
