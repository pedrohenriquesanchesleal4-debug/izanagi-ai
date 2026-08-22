---
name: "automation-security"
description: "Protege credenciais e dados sensíveis em automações: .env fora do Git, secret managers, menor privilégio e sanitização de logs (LGPD/GDPR). Use em toda automação que toque credenciais, APIs ou dados pessoais. Gatilhos de ativação: automation security — credenciais e dados protegidos; quando usar; regras duras (não negociáveis); dados sensíveis (lgpd/gdpr)."
version: 2.0.0
category: security
tools:
  mcp:
    - mcp:fs_read
    - mcp:execute_command
---

# Automation Security — Credenciais e Dados Protegidos

> Migrado deterministicamente de `skills/automation-security/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Segurança (`security`)
- **Resumo:** Protege credenciais e dados sensíveis em automações: .env fora do Git, secret managers, menor privilégio e sanitização de logs (LGPD/GDPR).
- **Ativar quando:** Use em toda automação que toque credenciais, APIs ou dados pessoais.
- **Escopo canônico:** Automation Security — Credenciais e Dados Protegidos
- **Seções do corpo original:** Quando usar · Regras duras (não negociáveis) · Dados sensíveis (LGPD/GDPR) · Padrão de código (Python) · Verificações antes de entregar (checklist de auditoria)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Nunca credenciais no código, no terminal, em logs, em arquivos versionados, em screensh...

**Nunca** credenciais no código, no terminal, em logs, em arquivos versionados, em screenshots, em payloads de erro.

### Passo 2 — .env local + .env.example versionado (com placeholders SEU_TOKEN_AQUI, sem valores reais).

**`.env` local + `.env.example` versionado** (com placeholders `SEU_TOKEN_AQUI`, sem valores reais). `*.env` no `.gitignore` — confirme que o `.gitignore` **cobre** o arquivo (teste com `git status`).

### Passo 3 — Secret managers quando disponíveis:

**Secret managers quando disponíveis**: Vault, AWS Secrets Manager, GitHub Actions secrets, variáveis de ambiente de CI. A automação lê do ambiente, nunca tem o segredo no repo.

### Passo 4 — Menor privilégio:

**Menor privilégio**: conta/credencial dedicada com escopo mínimo (ex: token read-only para leitura, conta service específica do projeto). Nunca admin/owner para tarefa simples.

### Passo 5 — Token em memória apenas:

**Token em memória apenas**: nunca serialize para log/arquivo/relatório. Se precisar de referência para debug, logue os 4 últimos caracteres (`...a1b2`).

### Passo 6 — Rotação:

**Rotação**: credencial vazada = revogar imediatamente + gerar nova + registrar no log de incidentes. Credencial exposta em commit antigo: assuma comprometida.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] `grep -rEi "(senha|password|token|api_key|secret)\s*[:=]\s*['\"][^'\"]{4,}" .` no projeto → **zero** hits
- [ ] `.env` ausente do Git? Rodou `git status` e confirmou que não aparece?
- [ ] `.env.example` versionado com placeholders e comentário de instrução?
- [ ] Logs não capturam corpo de resposta/headers com token?
- [ ] Credencial tem escopo mínimo (não é admin/root)?
- [ ] Destino confirmado (URL correta, ambiente certo)?
- [ ] Dados pessoais mascarados nos relatórios?
- [ ] Temporários limpos ao final?
- [ ] `README` documenta como criar o `.env` (comando `cp .env.example .env` + onde obter cada valor)?

## Common Rationalizations

- **"Input interno é confiável, validação é para API pública."**
  - Verdade: A fronteira interna de hoje é a integração exposta de amanhã. Validar na fronteira onde o dado entra custa pouco; sanitizar após incidente custa caro.
- **"Estamos atrás de firewall/rede privada, estamos seguros."**
  - Verdade: Network perimeter falha comum: SSRF, credencial vazada e supply chain ignoram firewall. Camadas independentes (defense in depth) existem porque qualquer camada isolada falha sozinha.
- **"Logue tudo para facilitar debug, incluindo o payload."**
  - Verdade: Payload contém token, PII e credencial. Log é arquivo de leak esperando auditoria. Logging estruturado com redação é obrigação, não refinamento.
- **"Segurança agora trava o sprint; compensamos depois."**
  - Verdade: 'Depois' em segurança é pós-incidente. OWASP Top 10 é lista de erros conhecidos e baratos de evitar na escrita, caríssimos de corrigir em produção.
- **"Valido no frontend, backend confia."**
  - Verdade: Frontend é sugestão, backend é contrato. Qualquer requisição pode ser forjada fora da UI; validação server-side é a única que existe de fato.
- **"Secrets em variável de código é temporário até o .env ficar pronto."**
  - Verdade: Temporário em código versionado é permanente no histórico do Git. Rotação de chave pós-leak dói muito mais que 10 minutos de configuração.

## Red Flags

- SQL/comando montado por concatenação de input.
- Token, cookie ou segredo aparecendo em log, URL ou mensagem de erro.
- Stacktrace cru retornado ao usuário (fingerprint da aplicação).
- Dependência sem verificação de CVE na atualização.
- Permissão/privilégio amplo demais 'para simplificar' (viola menor privilégio).
- Endpoint mutante sem autenticação, rate limit ou idempotency key.
- Criptografia caseira ou hash fraco (MD5/SHA1) para credencial.

## Legacy Reference (v1)

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
