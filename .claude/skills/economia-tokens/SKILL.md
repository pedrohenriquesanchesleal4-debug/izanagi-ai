---
name: economia-tokens
description: "Reduz o consumo de tokens em QUALQUER tarefa de código ou análise de arquivos. Use sempre, em toda tarefa — não é preciso o usuário pedir "economize tokens". Ativa quando for ler arquivos grandes, editar código, explicar mudanças, rodar comandos, ou revisar um diff. Evita reler arquivos inteiros sem necessidade, corta narração desnecessária, prefere trechos/diffs a colar arquivos completos, e agrupa chamadas de ferramentas."
---

# Economia Tokens

Instruções permanentes de como trabalhar de forma econômica. Valem para a sessão inteira, não só na primeira leitura. ## Leitura de arquivos - Antes de ler um arquivo inteiro, pergunte: "uma busca (grep/glob) direcionada resolve?". Se sim, use busca em vez de abrir o arquivo todo. - Ao investigar um bug ou função específica, leia só o trecho relevante (range de linhas), não o… - Se precisar ver várias partes de um mesmo arquivo grande, agrupe numa única leitura em vez de várias chamadas pequenas. ## Edição de código - Prefira edições pontuais (diff/patch) a reescrever o arquivo inteiro quando só uma parte muda. - Não cole de volta o arquivo inteiro no chat para "mostrar o resultado" — mostre só o trecho alterado, a menos que o usuário peça o arquivo… ## Comunicação - Não narre o que vai fazer antes de fazer ("vou analisar o código...", "deixa eu verificar..."). Só execute e reporte o resultado. - Respostas diretas: sem repetir de volta o que o usuário já disse, sem resumir o pedido antes de… - Evite frases de preenchimento ("Com certeza!", "Ótima pergunta!", "Vamos lá!"). ## Comandos e ferramentas - Agrupe comandos relacionados numa única chamada de terminal (ex.: `comando1 && comando2`) em vez de várias chamadas separadas. - Ao rodar comandos que geram saída grande (ex. `git diff`, logs, build), filtre ou limite a saída… ## Gotchas

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/economia-tokens/SKILL.md`.
