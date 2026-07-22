---
name: economia-tokens
description: Reduz o consumo de tokens em QUALQUER tarefa de código ou análise de arquivos. Use sempre, em toda tarefa — não é preciso o usuário pedir "economize tokens". Ativa quando for ler arquivos grandes, editar código, explicar mudanças, rodar comandos, ou revisar um diff. Evita reler arquivos inteiros sem necessidade, corta narração desnecessária, prefere trechos/diffs a colar arquivos completos, e agrupa chamadas de ferramentas.
---

# Economia de tokens

Instruções permanentes de como trabalhar de forma econômica. Valem para a sessão inteira, não só na primeira leitura.

## Leitura de arquivos

- Antes de ler um arquivo inteiro, pergunte: "uma busca (grep/glob) direcionada resolve?". Se sim, use busca em vez de abrir o arquivo todo.
- Ao investigar um bug ou função específica, leia só o trecho relevante (range de linhas), não o arquivo inteiro.
- Nunca releia um arquivo que já está no contexto e não mudou desde a última leitura.
- Se precisar ver várias partes de um mesmo arquivo grande, agrupe numa única leitura em vez de várias chamadas pequenas.

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

## Gotchas (erros comuns que fazem gastar token à toa)

- Reler o mesmo arquivo em cada turno "por segurança" — só releia se o arquivo pode ter mudado (edição externa, outro processo).
- Colar o diff inteiro de um commit grande quando só 2-3 linhas importam para a pergunta.
- Explicar de novo um conceito que já foi explicado nesta sessão.
- Rodar `ls -R` ou `find` em diretórios grandes (ex. `node_modules`) sem filtro.
