---
name: automation-planning
description: "Planejamento de automacoes: decompor o processo em etapas, definir escopo, entradas/saidas, criterios de sucesso, riscos e cronograma antes de implementar. Use no inicio de qualquer tarefa de automacao."
---

# Automation Planning — Projetar Antes de Automatizar

## Fases do planejamento

1. **Entender o processo**: o que acontece hoje, passo a passo? Quem executa, com que frequência, com que volume?
2. **Definir escopo**: o que entra, o que NÃO entra (limites claros evitam automação monstro).
3. **Mapear entradas/saídas**: origem dos dados (planilha/API/banco/UI), formato, destino, formato esperado.
4. **Definir critérios de sucesso**: como saber que a automação funcionou? Métricas mensuráveis (ex: N registros validados e enviados, 0 duplicados).
5. **Listar riscos**: dados inconsistentes, API instável, mudança de layout, volume alto, credenciais, reexecução.
6. **Escolher abordagem**: API vs browser vs planilha direta (ver `technology-selection`).
7. **Planejar validação e testes**: como testar antes da execução real (dry-run, fixtures).

## Entregável

Plano curto antes de codar:

```
OBJETIVO: ...
ENTRADA: ... | SAÍDA: ...
ABORDAGEM: ... (por quê)
CRITÉRIO DE SUCESSO: ...
RISCOS: ... | MITIGAÇÃO: ...
ETAPAS: 1) ... 2) ... 3) ...
TESTES: ...
```

## Regras

- Nunca implemente antes do plano (mesmo que o plano seja 10 linhas).
- Se houver ambiguidade que impeça o plano correto, pergunte — mas descubra o que der antes (análise de arquivos, docs, pesquisa).
- Planejamento curto é melhor que planejamento burocrático: alto sinal, baixo ruído.

## References

- Ver skill `automation-engineer` (fluxo completo Entender → Entregar).
