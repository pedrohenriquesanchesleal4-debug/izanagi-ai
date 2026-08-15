---
name: automation-security
description: "Protege credenciais e dados sensíveis em automações: .env fora do Git, secret managers, menor privilégio e sanitização de logs (LGPD/GDPR). Use em toda automação que toque credenciais, APIs ou dados pessoais."
---

# Automation Security — Credenciais e Dados Protegidos

Camada de segurança obrigatória para qualquer automação que toque **credenciais, dados pessoais ou destinos externos**. Sem isso, uma automação que funciona é um vazamento esperando para acontecer.

## Quando usar

Use em **toda** automação que: autentique em API (token/key), leia/envie dados pessoais (clientes, funcionários, LGPD/GDPR), escreva em sistemas externos (CRM, ERP, planilha compartilhada), ou rode em CI/servidor (credenciais de ambiente). **Pule** para automações 100% locais sem dados sensíveis — mas mesmo assim mantenha `.env` para facilitar evolução.

## Regras duras (não negociáveis)

1. **Nunca** credenciais no código, no terminal, em logs, em arquivos versionados, em screenshots, em payloads de erro.
2. **`.env` local + `.env.example` versionado** (com placeholders `SEU_TOKEN_AQUI`, sem valores reais). `*.env` no `.gitignore` — confirme que o `.gitignore` **cobre** o arquivo (teste com `git status`).
3. **Secret managers quando disponíveis**: Vault, AWS Secrets Manager, GitHub Actions secrets, variáveis de ambiente de CI. A automação lê do ambiente, nunca tem o segredo no repo.
4. **Menor privilégio**: conta/credencial dedicada com escopo mínimo (ex: token read-only para leitura, conta service específica do projeto). Nunca admin/owner para tarefa simples.
5. **Token em memória apenas**: nunca serialize para log/arquivo/relatório. Se precisar de referência para debug, logue os 4 últimos caracteres (`...a1b2`).
6. **Rotação**: credencial vazada = revogar imediatamente + gerar nova + registrar no log de incidentes. Credencial exposta em commit antigo: assuma comprometida.

## Dados sensíveis (LGPD/GDPR)

- **Sanitize antes de logar**: emails completos não são necessários — máscara parcial quando o diagnóstico exigir (`jo***@empresa.com`). CPF/telefone: mascarar ou hashear.
- **Minimização**: não copie dados pessoais para lugares desnecessários; use só as colunas necessárias para a tarefa.
- **Temporários**: apague arquivos temporários com dados sensíveis no `finally` (ou `tempfile` com auto-cleanup).
- **Relatórios de erro de API**: logue status HTTP + código do erro + mensagem resumida — **nunca** corpo completo da resposta (pode conter PII ou tokens).
- **Upload para destino externo**: verifique o destino antes (URL correta, ambiente de produção? sandbox?). Um dry-run que lista o que SERIA enviado evita envio errado.
- **Destinos externos**: confirme domínio/ambiente (prod vs staging) — erro clássico é apontar para produção com dados de teste ou vice-versa.

## Padrão de código (Python)

```python
import os
from dotenv import load_dotenv

load_dotenv()  # .env local, fora do git

API_TOKEN = os.environ["API_TOKEN"]   # KeyError se faltar — falha cedo, nunca default vazio
CLIENT_ID = os.getenv("CLIENT_ID", "")  # opcional com default explícito

def redact(value: str) -> str:
    """Máscara para logs: mostra só o final."""
    return f"...{value[-4:]}" if value else "(vazio)"
```

**Falhe cedo**: `os.environ["X"]` (KeyError) em vez de `os.getenv("X", "")` silencioso — credencial ausente deve quebrar a automação com mensagem clara, não falhar no meio do processamento.

## Verificações antes de entregar (checklist de auditoria)

- [ ] `grep -rEi "(senha|password|token|api_key|secret)\s*[:=]\s*['\"][^'\"]{4,}" .` no projeto → **zero** hits
- [ ] `.env` ausente do Git? Rodou `git status` e confirmou que não aparece?
- [ ] `.env.example` versionado com placeholders e comentário de instrução?
- [ ] Logs não capturam corpo de resposta/headers com token?
- [ ] Credencial tem escopo mínimo (não é admin/root)?
- [ ] Destino confirmado (URL correta, ambiente certo)?
- [ ] Dados pessoais mascarados nos relatórios?
- [ ] Temporários limpos ao final?
- [ ] `README` documenta como criar o `.env` (comando `cp .env.example .env` + onde obter cada valor)?

## Anti-padrões (proibido)

1. ❌ Token hardcoded no script "porque é rápido"
2. ❌ `.env` com valores reais versionado (mesmo em repo privado)
3. ❌ Logar `response.text` completo em erro de API
4. ❌ `print(f"Token: {token}")` em debug esquecido
5. ❌ Conta admin para automação que só lê
6. ❌ Enviar dados para URL fixa sem confirmação de ambiente
7. ❌ `except Exception: pass` engolindo erro de auth (parece que funcionou, mas não autenticou)
8. ❌ Credencial no histórico do git (commit antigo) sem rotação

## Composição com outras skills

- **Antes**: `automation-engineer` (orquestração) → `automation-planning` (escopo)
- **Depois**: `api-automation` (headers de auth) → `data-validation` (o que está sendo enviado) → `automation-documentation` (README com setup do .env) → `security-privacy` (auditoria OWASP/LGPD completa do framework)

## References

- 12-factor config: https://12factor.net/config · python-dotenv: https://github.com/theskumar/python-dotenv · GitHub Secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- Ver skill `security-privacy` (OWASP/LGPD completo) do framework.

> Gerado pelo Izanagi AI — cópia fiel de `skills/automation-security/SKILL.md` (fonte da verdade).
