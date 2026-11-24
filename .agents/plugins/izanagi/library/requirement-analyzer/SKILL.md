---
name: "requirement-analyzer"
description: "Use ao receber requisitos vagos ou iniciar um épico: decompõe em requisitos funcionais/não-funcionais e critérios de aceite BDD. Gatilhos de ativação: requirement analyzer (análise e refinamento de requisitos); quando usar; matriz de análise de requisitos; critérios de aceite no formato bdd (given-when-then)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Requirement Analyzer (Análise e Refinamento de Requisitos)

> Migrado deterministicamente de `skills/requirement-analyzer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Use ao receber requisitos vagos ou iniciar um épico: decompõe em requisitos funcionais/não-funcionais e critérios de aceite BDD.
- **Ativar quando:** Use ao receber requisitos vagos ou iniciar um épico: decompõe em requisitos funcionais/não-funcionais e critérios de aceite BDD.
- **Escopo canônico:** Requirement Analyzer (Análise e Refinamento de Requisitos)
- **Seções do corpo original:** Quando usar · Matriz de Análise de Requisitos · Critérios de Aceite no Formato BDD (Given-When-Then) · Checklist de qualidade (antes de avançar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Decompõe pedidos e especificações em requisitos funcionais, não-funcionais e critérios...

Decompõe pedidos e especificações em **requisitos funcionais, não-funcionais e critérios de aceite testáveis**, eliminando ambiguidades antes que o código comece a ser escrito.

### Passo 2 — Use ao:

Use ao: receber um briefing vago ou complexo do usuário; traduzir histórias de usuário em especificações técnicas; preparar o escopo para arquitetura e planejamento. **Pule** para: tarefas técnicas já especificadas com precisão (skill `task-planner`).

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Requisitos funcionais enumerados e sem ambiguidades
- [ ] Requisitos não-funcionais com métricas mensuráveis (latência, uptime, segurança)
- [ ] Critérios de aceite escritos em formato BDD claro
- [ ] Restrições tecnológicas explicitadas

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

# Requirement Analyzer (Análise e Refinamento de Requisitos)

Decompõe pedidos e especificações em **requisitos funcionais, não-funcionais e critérios de aceite testáveis**, eliminando ambiguidades antes que o código comece a ser escrito.

## Quando usar

Use ao: receber um briefing vago ou complexo do usuário; traduzir histórias de usuário em especificações técnicas; preparar o escopo para arquitetura e planejamento. **Pule** para: tarefas técnicas já especificadas com precisão (skill `task-planner`).

## Matriz de Análise de Requisitos

| Tipo | O que define | Exemplo |
|---|---|---|
| **Funcional (RF)** | O que o sistema *faz* | O usuário deve poder redefinir a senha via email. |
| **Não-Funcional (RNF)** | Como o sistema se *comporta* | O tempo de resposta da API deve ser < 200ms no percentil 95. |
| **Restrição (RES)** | Limites tecnológicos ou de negócio | Hospedagem restrita à AWS us-east-1; conformidade com LGPD. |

## Critérios de Aceite no Formato BDD (Given-When-Then)

```gherkin
Funcionalidade: Recuperação de Senha
  Cenário: Solicitação de reset com email válido
    Dado que o usuário está na tela de recuperação de senha
    Quando ele insere um email cadastrado "user@example.com"
    E clica em "Enviar instruções"
    Então um email com token de reset é disparado
    E uma mensagem de sucesso é exibida na tela
```

## Checklist de qualidade (antes de avançar)
- [ ] Requisitos funcionais enumerados e sem ambiguidades
- [ ] Requisitos não-funcionais com métricas mensuráveis (latência, uptime, segurança)
- [ ] Critérios de aceite escritos em formato BDD claro
- [ ] Restrições tecnológicas explicitadas

## Anti-padrões (proibido)
- ❌ Aceitar requisitos vagos ("o sistema deve ser rápido e bonito")
- ❌ Misturar regras de negócio com detalhes de implementação de UI
- ❌ Omitir requisitos de segurança ou tratamento de erro nas especificações

## Composição com outras skills
- **Before**: `discovery` (entrevista inicial) → `pm` (gestão de projeto)
- **After**: `task-planner` (planejamento) → `architect` (arquitetura)

## References
- Agile Requirements & BDD (Specification by Example): Gojko Adzic.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
