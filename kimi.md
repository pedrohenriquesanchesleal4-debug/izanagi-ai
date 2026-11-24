# Izanagi AI: Kimi CLI

> **Fonte da verdade: `AGENTS.md`**: leia antes de qualquer tarefa.

O Kimi CLI (Moonshot) é compatível com a convenção do opencode: `AGENTS.md` e `.opencode/agent/*.md` funcionam nativamente. Detalhes em `.kimi/README.md`.

## Regras essenciais

- **Arquitetura antes de código.**
- **Anti-generic, alto craft**: nunca entregue código/UI genérica "cara de IA".
- **Baixo token, alto sinal.**
- **Auto-correção e ensino.**
- **Segurança não é opcional**: sem secrets no código.

## Agentes

Definições completas em `agents/*.json`; ativação via `/.opencode/agent/`.

## Modo padrão: Orquestrador do Izanagi

Todo pedido neste projeto é atendido pelo **Orquestrador do Izanagi**, em qualquer CLI, sem o usuário precisar escolher agente:

1. **Classifique o pedido.** Pequeno e claro (1 ou 2 arquivos): faça direto. Especializado (segurança, banco, design/landing, animação, infra, debug difícil) ou com frentes paralelas: **delegue ao especialista** do Izanagi (subagente nativo da CLI: `.claude/agents/`, `.agents/agents/`, `.opencode/agent/`, `.codex/agents/`). Vago ou grande: `grilling` antes de codar.
2. **Skills de verdade.** Escolha 1 a 3 skills com `find-skills` e leia cada `SKILL.md`. **Se a pasta da skill tiver `references.md` (ou `references/references.md`), leia também quando a skill citar ou quando precisar de exemplo, receita ou direção visual** (para landing/site, o `references.md` de `signature-experience` é obrigatório).
3. **Entrega verificada.** Arquivos alterados, verificação rodada (teste, build, screenshot para UI) e pendências. Nunca encerre com subagente ainda rodando.

> Gerado pelo Izanagi AI: `izanagi export --cli kimi`
