---
name: technology-selection
description: "Escolha de tecnologia para automacoes: linguagem, bibliotecas e abordagem (API vs browser) com justificativa explicita. Python por padrao, mas a linguagem e consequencia do problema. Use antes de implementar."
---

# Technology Selection — Escolha com Justificativa

## Hierarquia de abordagem web (sempre)

1. API oficial → 2. integração direta → 3. HTTP/API documentada → 4. browser automation → 5. UI gráfica.

Se existe API confiável, use-a. Browser automation só quando não existe alternativa melhor.

## Critérios de escolha

| Critério | Pergunta |
|---|---|
| Manutenibilidade | A stack tem docs boas e comunidade ativa? |
| Robustez | Lida com retries, validação, idempotência bem? |
| Adequação | É a ferramenta certa para o problema (não a mais famosa)? |
| Custo | Tempo de desenvolvimento, dependências, infra necessária? |
| Segurança | Gerencia credenciais, evita secrets no código? |

## Padrão de decisão

- **Python** (pandas, openpyxl, httpx, Playwright, Pydantic) — padrão para automação de dados, planilhas, scraping, integrações.
- **TypeScript/Node** — quando o ecossistema web/JS é obrigatório (browser extension, npm packages).
- **C#/.NET** — ecossistema Microsoft/Windows obrigatório.
- A linguagem é consequência do problema, nunca preferência arbitrária.

## Regras

- Justifique SEMPRE a escolha em uma linha (ex: "httpx por timeouts+retries nativos, melhor que requests para este fluxo").
- Prefira bibliotecas oficiais e amplamente adotadas a soluções obscuras.
- Mínimo de dependências necessário: cada dependência é superfície de manutenção e risco.

## References

- Ver `automation-engineer/references.md` (documentação canônica por ferramenta).
