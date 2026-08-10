---
name: requirement-analyzer
description: "Análise e decomposição rigorosa de requisitos de software: extração de regras funcionais e não-funcionais, identificação de ambiguidades, definição de critérios de aceite (BDD / Given-When-Then) e mapeamento de restrições técnicas. Use ao receber especificações vagas ou iniciar novos épicos."
---

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
