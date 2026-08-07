---
name: testing-automation
description: "Testes para automacoes: unitarios (transformacoes, validacoes), integracao (API, banco, arquivos) e E2E (browser) com pytest. Teste a automacao antes de executar em producao. Use ao implementar qualquer automacao."
---

# Testing Automation — Automatize, Mas Teste Primeiro

## Estratégia

1. **Unitários** (pytest): transformações, validações, parsing, regras de negócio — dados de exemplo em fixtures.
2. **Integração**: chamadas reais a API (com mock quando necessário), banco, leitura/escrita de arquivos.
3. **E2E (browser)**: pytest-playwright — abrir, executar fluxo, verificar resultado observável.
4. **Dry-run**: `--dry-run` executa o pipeline de validação sem efeitos reais — obrigatório antes da primeira execução real.

## Padrões

- **Fixtures** com dados realistas (incluindo casos limite: vazios, duplicados, formatos errados).
- **Mock de serviços externos** (responses/httpx MockTransport) para testes determinísticos e rápidos.
- **Testes de falha**: garanta que a automação NÃO silencia erros (assert em logs/exceções).
- Teste de retomada: processar 10, falhar no 5, verificar que reexecução continua do 6 (checkpoint).
- Seletores resilientes em testes E2E (`getByRole`, `getByLabel`), nunca posição.

## Regras

- Toda transformação/validação complexa precisa de teste unitário.
- Rodar a suíte antes de considerar a automação pronta: `pytest -q`.
- Teste cobrindo o que mais quebra: parsing de dados reais, retries, checkpoints, auth.

## References

- pytest: https://docs.pytest.org · pytest-playwright: https://playwright.dev/python/docs/test-runners
- Ver skills `automation-engineer`, `error-recovery`.
