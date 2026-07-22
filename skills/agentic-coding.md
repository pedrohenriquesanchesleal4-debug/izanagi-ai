# Skill: Agentic Coding

**Versão:** 1.0.0  
**Domínio:** Autonomous LLM Systems & Agent Workflows  
**Budget de Tokens:** ~2500  

---

## Contexto & Objetivo
Esta skill orienta a construção, refatoração e otimização de agentes autônomos de código (ex: Antigravity, OpenCode, Claude Code, Cursor Agents). Garante ciclo fechado de planejamento, execução, autoverificação e tratamento resiliente de erros.

---

## Princípios da Skill
1. **Loop Autônomo Seguro**: Planejar -> Fazer -> Testar -> Refletir -> Corrigir.
2. **Navegação Não-Destrutiva**: Nunca alterar arquivos críticos sem backup ou confirmação prévia quando incerto.
3. **Verificação Empírica**: Nenhuma tarefa é declarada concluída sem evidência de log ou teste executado com sucesso.
4. **Contexto Mínimo Viável**: Manter o uso de tokens eficiente com leituras focadas e resumos sintéticos.

---

## Workflow
```
[Receber Tarefa] 
       │
       ▼
[Análise de Requisitos & Estudo do Codebase] 
       │
       ▼
[Elaborar Plano de Execução Demarcado] 
       │
       ▼
[Executar Alterações de Forma Incremental]
       │
       ▼
[Executar Testes / Linters / Build] 
       │
       ├─► (Falha) ──► [Diagnóstico por Log & Self-Fix] ──┐
       │                                                   │
       └─► (Sucesso) ──► [Reflexão Final & Walkthrough] ◄──┘
```

---

## Checklist de Qualidade
- [ ] O plano explicita os arquivos que serão modificados/criados.
- [ ] Nenhuma premissa sobre o código foi assumida sem inspeção direta.
- [ ] Erros de execução foram analisados via logs completos.
- [ ] Alterações foram verificadas empiricamente (testes executados).
- [ ] Documentação e walkthrough atualizados após a execução.

---

## Regras
- **Sempre**: Exigir evidência de execução antes de finalizar uma tarefa.
- **Nunca**: Engolir exceções ou desabilitar testes quebrados para fingir sucesso.
