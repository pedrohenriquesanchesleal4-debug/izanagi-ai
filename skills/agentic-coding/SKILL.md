---
name: agentic-coding
description: "Codificacao autonoma em loop de agente (planejar -> codar -> testar -> refletir -> corrigir) com verificacao empirica obrigatoria, loops finitos com limite de tentativas e diagnostico por log. Use ao implementar features, corrigir falhas de build/teste ou rodar sessoes longas de codigo; pule para parallel-agents quando a tarefa tem 2+ dominios independentes e para professor-modo quando so precisa explicar."
---

# Agentic Coding (Codificação Autônoma em Loop)

O agente que codifica em ciclo fechado: planeja, executa em incrementos pequenos, verifica com comandos reais, diagnostica falhas pelo log e corrige o delta. Nenhuma tarefa é declarada concluída sem evidência empírica (build, teste ou log executado).

## Quando usar

Use ao implementar features, corrigir erros de build/teste, refatorar ou rodar sessões longas de código onde o resultado só é conhecido depois de executar. **Pule para**: `parallel-agents` quando a tarefa se divide em 2+ domínios independentes (UI + backend + DB); `professor-modo` quando o pedido é só explicação; `brainstorming` quando o design ainda não existe.

## Stack / Padrões

- **Comandos de verificação do projeto** (`npm run build`, `npm test`, `npm run doctor`) — a evidência empírica que fecha o loop. Descubra os comandos reais no `package.json`/README antes de começar.
- **`git diff` / `git status`** — revisão por delta em vez de releitura total (token economy).
- **Log completo do erro** — diagnóstico por causa raiz, nunca por resumo truncado.

## Workflow (6 passos)

1. **Planeje demarcado**: antes de tocar em arquivo, liste os arquivos a criar/editar e verifique premissas por inspeção direta (grep/read) — nunca suponha API ou assinatura que não viu.

2. **Execute incrementalmente**: uma mudança por vez, um arquivo por passada, editando por diff. Alteração destrutiva (delete/rename em massa) exige confirmação.

3. **Verifique empiricamente** — loop finito com limite de tentativas (nunca `while true`):

```powershell
# Loop de verificação com teto de tentativas (PowerShell)
$tentativas = 0
do {
  $tentativas++
  npm run build 2>&1 | Tee-Object -FilePath .agents\tmp\build.log
  if ($LASTEXITCODE -ne 0) {
    $erro = Select-String -Path .agents\tmp\build.log -Pattern "error TS|Error:" | Select-Object -First 1
    Write-Host "FALHA ($tentativas/3): $($erro.Line)"
  }
} while ($LASTEXITCODE -ne 0 -and $tentativas -lt 3)
if ($LASTEXITCODE -ne 0) { Write-Host "ESCALAR: mudar abordagem ou perguntar." }
```

4. **Diagnostique pelo log**: leia o erro inteiro (não só o summary), identifique arquivo+linha, formule a hipótese e confirme antes de corrigir. Corrija **apenas o primeiro erro** da lista — os demais costumam ser sintomas encadeados.

5. **Self-fix com regressão**: após corrigir, rode o comando que falhou **e** a suíte vizinha. Nunca desabilite teste quebrado para passar.

6. **Reflita e feche**: resumo do que mudou com as evidências (saída de build/teste) e, se descobriu padrão novo, registre em `.agents/memoria/learnings.md`.

## Regras de ouro

- **Sempre** exigir evidência de execução (log/teste real) antes de declarar pronto.
- Loop é sempre finito: máx. 3 tentativas por erro; estourou, **mude a abordagem**.
- Uma mudança por verificação: corrija 1 erro, rode, corrija o próximo.
- Nunca assumir API/assinatura sem inspeção direta do código.
- Nunca engolir exceções (`catch {}`) para fingir sucesso.
- Nunca re-verificar por releitura total — revise o diff.
- Nenhuma tarefa é concluída sem o comando real do projeto ter rodado.

## Checklist

- [ ] Plano explicita arquivos a criar/editar
- [ ] Premissas verificadas por inspeção (grep/read)
- [ ] Build/teste real executado com evidência no output
- [ ] Loop com limite de tentativas (sem loop infinito)
- [ ] Nenhum teste desabilitado para "passar"
- [ ] Diff revisado antes da entrega
- [ ] Aprendizado registrado se houve padrão novo

## Anti-padrões

1. ❌ **Loop sem limite** ("vou tentar até dar certo") — queima tokens e acumula mudanças não revertidas.
2. ❌ **Correção em lote** (10 erros de uma vez) — erros encadeados; o primeiro fix derruba os demais.
3. ❌ **API suposta** ("essa lib deve ter X") sem verificar — alucinação de interface vira build quebrado.
4. ❌ **Exceção engolida** — esconde a falha e invalida a própria verificação.
5. ❌ **Pronto por inspeção** ("deve funcionar") — código que não compilou não existe.
6. ❌ **Reler o arquivo inteiro para conferir** — custo de tokens; `git diff` cobre.
7. ❌ **Persistir na mesma abordagem após 3 falhas** — insanidade do loop; escalar ou perguntar.

## Composição com outras skills

- **Antes**: `memoria-projeto` (erros já corrigidos e decisões), `tdd` (escrever o teste que falha antes do código), `task-planner` (frentes pequenas), `economia-tokens` (contexto mínimo)
- **Depois**: `self-critique` (revisão do diff), `qa` (auditoria final), `professor-modo` (explicar o que mudou)

## References

- pytest: https://docs.pytest.org · Node.js: https://nodejs.org/api · Git: https://git-scm.com/doc
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
