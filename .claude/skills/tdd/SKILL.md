---
name: tdd
description: "Test-Driven Development com Iron Law: escreva o teste antes, veja falhar, código mínimo para passar, refatore. Use em qualquer feature, bugfix ou refatoração antes de escrever código de implementação. Inspirado na skill test-driven-development do obra/superpowers (264k stars)."
---

# Tdd

> **Nenhum código de produção sem um teste falhando primeiro.** Escreva o teste → veja falhar (pelo motivo certo) → código mínimo → veja passar → refatore. Se você não viu o teste falhar, não sabe se ele testa a coisa certa. ## Iron Law Escreveu código antes do teste? **Apague.** Não guarde "como referência", não adapte enquanto escreve o teste, não olhe para ele. Apagar é apagar. Implemente do zero a partir dos testes. Exceções (pergunte ao humano): protótipos descartáveis, código gerado, arquivos de configuração. ## Ciclo RED → GREEN → REFACTOR - Uma única comportamento, nome claro, código real (mock só se inevitável). - **Verifique o RED**: o teste FALHA (não erra), pelo motivo esperado (feature ausente, não typo). - Teste passou? Você está testando comportamento existente —… - O código mais simples que faz o teste passar. Nada de features extras, "melhorias", YAGNI. - **Verifique o GREEN**: passa + demais testes seguem passando + saída limpa. - Teste falhou? Conserte o código, não o teste. - Remova duplicação, melhore nomes, extraia helpers. Testes seguem verdes. Sem comportamento novo. ## Testes bons | Qualidade | Bom | Ruim | |-----------|-----|------| | Mínimo | Uma coisa só; sem "and" no nome | `test('valida email e domínio e whitespace')` | | Claro | Nome descreve o comportamento | `test('test1')` | | Mostra intenção | Demonstra… ## Racionalizações comuns

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/tdd/SKILL.md`.
