---
name: automation-security
description: "Seguranca em automacoes: credenciais fora do codigo, .env fora do Git, menor privilegio, sem secrets em logs, sanitizacao de dados e verificacao de destinos. Use em toda automacao que toque dados ou servicos externos."
---

# Automation Security — Credenciais e Dados Protegidos

## Regras duras

1. **Nunca** credenciais no código, no terminal, em logs, em arquivos versionados, em screenshots.
2. **.env local + .env.example versionado** (sem valores reais); `*.env` no `.gitignore`.
3. Preferir **secret managers** quando disponíveis (Vault, AWS Secrets Manager, variáveis de CI).
4. **Menor privilégio**: a credencial faz só o que a automação precisa (conta dedicada, escopo limitado).
5. **Token em memória apenas**, nunca serializado para log/arquivo.

## Dados sensíveis

- Sanitize antes de logar: emails completos não são necessários, máscaras parciais quando o diagnóstico exigir (ex: `jo***@empresa.com`).
- LGPD/GDPR: não copie dados pessoais para lugares desnecessários; apague temporários no fim.
- Ao reportar erros de API, logue status + erro resumido — nunca corpo completo com dados sensíveis.

## Verificações antes de entregar

- Grep no projeto por credenciais hardcoded (senha=, token=, api_key=).
- `.env` ausente do git? `.gitignore` cobre?
- Logs com possíveis secrets?
- A automação pede mais permissão do que precisa?

## References

- 12-factor config: https://12factor.net/config · python-dotenv: https://github.com/theskumar/python-dotenv
- Ver skill `security-privacy` (OWASP/LGPD completo) do framework.
