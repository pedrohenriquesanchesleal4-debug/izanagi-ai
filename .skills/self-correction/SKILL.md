---
name: "self-correction"
description: "Use ao notar erro de build, teste falhando ou desvio de regra do projeto: isola a causa, aplica correção cirúrgica e registra o aprendizado. Gatilhos de ativação: self-correction (auto-correção em tempo de execução); quando usar; workflow de auto-correção (4 passos); exemplo de registro de erro corrigido (`.agents/memoria/erros-corrigidos.md`)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Self-Correction (Auto-Correção em Tempo de Execução)

> Migrado deterministicamente de `skills/self-correction/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Use ao notar erro de build, teste falhando ou desvio de regra do projeto: isola a causa, aplica correção cirúrgica e registra o aprendizado.
- **Ativar quando:** Use ao notar erro de build, teste falhando ou desvio de regra do projeto: isola a causa, aplica correção cirúrgica e registra o aprendizado.
- **Escopo canônico:** Self-Correction (Auto-Correção em Tempo de Execução)
- **Seções do corpo original:** Quando usar · Workflow de Auto-Correção (4 passos) · Exemplo de Registro de Erro Corrigido (`.agents/memoria/erros-corrigidos.md`) · Checklist de qualidade (antes de entregar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Detecção precoce do desalinhamento

Assim que o comando falhar ou o teste retornar erro,pare imediatamente a expansão do código. Não adicione mais features.

### Passo 2 — Isolamento do delta (causa imediata)

Compare o que foi alterado (`git diff`) com o comportamento esperado. Identifique exatamente qual linha ou premissa falhou.

### Passo 3 — Correção cirúrgica

Altere apenas o necessário para sanar o erro. Evite refatorações paralelas não solicitadas.

### Passo 4 — Registro na memória persistente (Aprendizado Anti-Repetição)

Se o erro foi conceitual ou de padrão, registre o aprendizado em `.agents/memoria/erros-corrigidos.md` ou `learnings.md` para que a próxima sessão não tropece no mesmo obstáculo.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Erro detectado e isolado sem desviar para refatorações tangenciais
- [ ] Correção aplicada com menor diff possível
- [ ] Verificação empírica executada (build/teste passou)
- [ ] Aprendizado registrado na memória do projeto (se aplicável)

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

# Self-Correction (Auto-Correção em Tempo de Execução)

Mecanismo para detectar desvios, erros ou falhas de execução no próprio trabalho, isolar o delta incorreto, aplicar a correção cirúrgica e **registrar o aprendizado na memória persistente** para não repetir o erro.

## Quando usar

Use ao: receber erro de build/teste após uma alteração; notar que a solução inicial violou uma regra do projeto (ex: padrão anti-AI-slop ou regra de arquitetura); identificar que um edge case foi esquecido. **Pule** para: depuração sistemática de bugs complexos em código legado (skill `systematic-debugging` / `bug-hunter`).

## Workflow de Auto-Correção (4 passos)

### 1. Detecção precoce do desalinhamento
Assim que o comando falhar ou o teste retornar erro,pare imediatamente a expansão do código. Não adicione mais features.

### 2. Isolamento do delta (causa imediata)
Compare o que foi alterado (`git diff`) com o comportamento esperado. Identifique exatamente qual linha ou premissa falhou.

### 3. Correção cirúrgica
Altere apenas o necessário para sanar o erro. Evite refatorações paralelas não solicitadas.

### 4. Registro na memória persistente (Aprendizado Anti-Repetição)
Se o erro foi conceitual ou de padrão, registre o aprendizado em `.agents/memoria/erros-corrigidos.md` ou `learnings.md` para que a próxima sessão não tropece no mesmo obstáculo.

## Exemplo de Registro de Erro Corrigido (`.agents/memoria/erros-corrigidos.md`)

```markdown
- **Erro**: Uso de `import ... from 'next/router'` em componente Server Client (App Router).
- **Causa**: Confusão entre Pages Router e App Router (Next.js 14+).
- **Correção**: Substituir por `import { useRouter } from 'next/navigation'`.
- **Prevenção**: Sempre verificar se o componente possui diretiva `'use client'` ou se está em Server Component antes de importar hooks de roteamento.
```

## Checklist de qualidade (antes de entregar)
- [ ] Erro detectado e isolado sem desviar para refatorações tangenciais
- [ ] Correção aplicada com menor diff possível
- [ ] Verificação empírica executada (build/teste passou)
- [ ] Aprendizado registrado na memória do projeto (se aplicável)

## Anti-padrões (proibido)
1. ❌ Ignorar o erro e tentar seguir com código empilhado em cima da falha
2. ❌ Reescrever o arquivo inteiro quando apenas uma linha estava incorreta
3. ❌ Culpar o compilador ou a ferramenta sem analisar o próprio código
4. ❌ Não registrar o erro, permitindo que ocorra novamente na próxima iteração

## Composição com outras skills
- **Antes**: `agentic-coding` (loop de execução) → `systematic-debugging` (análise de causa raiz)
- **Depois**: `continuous-improvement` (evolução contínua) → `memoria-projeto` (atualização da memória)

## References
- Self-correction in autonomous agents: Anthropic / OpenAI engineering notes · Error recovery patterns.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
