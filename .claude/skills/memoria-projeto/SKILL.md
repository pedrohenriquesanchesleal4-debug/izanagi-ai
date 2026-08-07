---
name: memoria-projeto
description: "Mantém memória persistente do projeto entre sessões, guardando decisões, padrões de código e erros já resolvidos, para o agente melhorar a cada nova tarefa em vez de começar do zero. Use no INÍCIO de qualquer tarefa de código relevante (ler a memória) e no FINAL de qualquer tarefa que tenha gerado uma decisão, padrão ou correção de erro importante (atualizar a memória). Também dispara quando o usuário perguntar "o que já decidimos sobre X" ou "por que fizemos assim"."
---

# Memoria Projeto

Claude Code não tem memória de conversas passadas por padrão — cada sessão começa do zero. Esta skill cria essa memória usando arquivos no próprio repositório, em `.agents/memoria/` (adaptado do padrão `.claude/memoria/` para este projeto). ## Estrutura Se a pasta não existir, crie-a na primeira vez que esta skill for usada neste projeto. ## No início da tarefa 1. Leia os arquivos em `.agents/memoria/` relevantes para o que vai ser feito. Não precisa ler os três sempre — só o(s) relevante(s) ao pedido. 2. Aplique o que estiver lá (convenções, decisões já tomadas) sem precisar que o usuário… ## No final da tarefa Se a tarefa gerou algo que vale lembrar no futuro, adicione uma entrada curta (1-3 linhas, não um parágrafo) no arquivo certo: - Decisão de arquitetura, biblioteca escolhida, ou padrão de código novo → `decisoes.md` - Bug não óbvio que foi corrigido e como → `erros-corrigidos.md` - Erro repetido (2+ vezes), correção definitiva ou armadilha conhecida da stack →… **Regras para manter isso barato em tokens:** - Adicione só a linha nova (append), não reescreva o arquivo inteiro. - Nunca duplique uma entrada que já existe — se for uma atualização de algo já registrado, edite a linha existente em vez de criar outra. - Se um arquivo passar de ~60… - Formato de cada entrada: `- [AAAA-MM-DD] descrição curta e direta`. Sem explicações longas — o objetivo é lembrar rápido, não

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/memoria-projeto/SKILL.md`.
