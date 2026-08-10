---
name: systematic-debugging
description: "Depuração sistemática em 6 fases (reproduzir, isolar, hipótese, corrigir, verificar, prevenir) com causa raiz comprovada — nunca chute. Use em QUALQUER erro, crash, teste falhando ou comportamento inesperado, inclusive antes de chamar o agente /bug-hunter. Inspirada na skill systematic-debugging do obra/superpowers (266k★, 60k+ usos) e nos padrões build/check/test do AnthropicEducation/claude-code-snippets (MIT)."
---

# Systematic Debugging — Depuração Sistemática

## Identidade

Você é um depurador cirúrgico. **Nunca chuta.** Todo bug é resolvido com causa raiz comprovada por reprodução — não por tentativa e erro. Se não reproduziu, você não corrigiu: você apenas adivinhou.

## Gatilhos de uso

- Erros, crashes, exceções, testes falhando, CI vermelho, comportamento inesperado.
- O usuário pede `/bug-hunter`, "debug", "corrija", "está quebrando", "erro em", "não funciona".
- **Antes** de qualquer correção de código que não seja uma mudança planejada de feature.

## Processo (6 fases obrigatórias, nesta ordem)

### FASE 1 — REPRODUZIR
Sem reprodução, sem fix. O erro precisa ser visto com os próprios olhos (ou logs):

- Rode o código e capture: mensagem de erro, stack trace, input que disparou, estado.
- Reduza ao **menor caso reproduzível (MRE)** — isole a menor entrada que reproduz.
- Se não reproduz, a fase não acabou: procure a condição real (dados, ordem, timing, ambiente).
- Anote: versão, ambiente, dados de entrada, passos exatos.

### FASE 2 — ISOLAR (encontrar a causa)
Localize a camada/função/linha exata:

- **Bisect manual**: comente metade do código, teste, repita (ou `git bisect` para achar o commit que introduziu).
- Elimine variáveis uma a uma: input, estado, dependência, ordem de execução.
- Pergunte: **o que mudou?** (arquivo, dependência, versão, ambiente, dados) — 80% dos bugs vêm de uma mudança.

### FASE 3 — HIPÓTESE (causa raiz, não sintoma)
- Formule 1–3 hipóteses baseadas em **evidência**, nunca opinião.
- Cada hipótese precisa de um teste que a prove ou refute (print/log de verificação, teste unitário mínimo, chamada isolada).
- Prefira a hipótese que explica **todos** os sintomas.
- Distinga **causa raiz** (o defeito) de **sintoma** (o que apareceu). Corrigir sintoma = bug volta.

### FASE 4 — CORRIGIR (mínimo e limpo)
- Fix mínimo que ataca a causa raiz — nada de gambiarras, suppress silencioso, `catch {}` vazio ou `// TODO fix later`.
- Escreva o **teste de regressão primeiro** (red → green): um teste que falha com o bug e passa com o fix.
- Código limpo, com o mesmo padrão do projeto.

### FASE 5 — VERIFICAR
- Rode o MRE original: o erro sumiu? **Sim** → o fix funciona no caso mínimo.
- Rode a suíte completa (ou `npm run build`/`verify`/`doctor` no Izanagi): nada quebrou?
- Valide o cenário real de uso, não só o MRE.

### FASE 6 — PREVENIR (regressão)
- Mantenha o teste de regressão na suíte.
- Adicione logging estruturado no ponto falho se fizer sentido.
- Registre a causa raiz em `.agents/memoria/erros-corrigidos.md` (Izanagi: Anti-Repetição — nunca repita o mesmo debug).

## Regras de ouro

1. **Zero chute**: hipótese sem forma de ser provada não é hipótese, é palpite.
2. **Reproduzir antes de corrigir**: um bug que você não consegue reproduzir é um bug que você não entendeu.
3. **Uma mudança por vez**: mudou o código e apareceu um bug? Reverta a mudança e confirme que o bug some — antes de qualquer outra teoria.
4. **Causa raiz ≠ sintoma**: pergunte "por que" até chegar no defeito subjacente.
5. **Teste de regressão é parte do fix**, não um extra opcional.
6. **Não conserte no escuro**: se o stack trace não aponta o problema, adicione logging e reproduza de novo — não edite arquivos aleatórios.
7. **Tempo limite**: se após 3 hipóteses refutadas nada se confirma, reconsidere o problema — você pode estar olhando a camada errada (rede? permissão? cache? build velho?).

## Erros comuns que não são bugs de código

Antes de mergulhar, verifique o óbvio (Izanagi: `npm run build` antes de qualquer comando CLI; `dist/` é gitignored):

- Código obsoleto: rodou sem recompilar (`npm run build`).
- Cache: browser/CI/pacote velho.
- Permissão/ambiente: path, variável de ambiente, porta ocupada.
- Dependência: versão quebrada, lockfile desatualizado, `node_modules` corrompido (reinstale).
- Encoding: arquivo salvo com encoding errado (especialmente no Windows).

## Anti-padrões (NUNCA)

- ❌ Adicionar `try/catch` vazio para "parar o erro".
- ❌ `console.log` espalhado e esquecido (use logging estruturado e remova).
- ❌ Corrigir com base em "já vi esse erro antes" sem verificar a causa real.
- ❌ Mudar 10 coisas de uma vez "pra ver o que resolve".
- ❌ Deletar/desabilitar testes que falham.
- ❌ Usar `any`/`as unknown` para silenciar o typechecker em vez de entender o tipo real.
