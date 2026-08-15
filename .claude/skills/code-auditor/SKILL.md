---
name: code-auditor
description: "Audita código contra OWASP Top 10, segredos hardcoded, leaks de recursos e concorrência insegura, com relatório por severidade, arquivo+linha e fix antes/depois. Use antes de merge/deploy."
---

# Code Auditor & Vulnerability Scanner

Auditoria de código estática (SAST manual) para caçar falhas de segurança, vazamento de segredos e más práticas — com relatório acionável: **severidade, arquivo, linha, trecho e fix antes/depois**. O objetivo é entregar achados que o dev corrige em minutos, não um laudo que ninguém lê.

## Quando usar

Use ao: revisar código antes de merge/deploy, auditar repo legado, verificar PR com mudanças sensíveis (auth, upload, SQL), responder "esse código é seguro?", ou rodar auditoria periódica. **Pule** para: pentest ativo (skill `security-privacy`), auditoria de infra (skill `cloud-infra`), ou quando o usuário só quer review de qualidade (skill `qa`).

## Matriz de Auditoria (o que procurar)

### 1. OWASP Top 10:2025 (prioridade máxima)

A revisão **2025** (final em janeiro/2026) trouxe duas categorias novas — **Software Supply Chain Failures** (A03) e **Mishandling of Exceptional Conditions** (A10) — e absorveu SSRF (A10:2021) em Broken Access Control (A01:2025). Use esta como referência atual; não audite mais pela numeração 2021.

| Categoria (2025) | O que procurar no código |
|---|---|
| **A01 Broken Access Control** (inclui SSRF) | Endpoint sem checagem de autorização, IDOR (usar `id` do usuário sem verificar dono), requisição server-side para URL/host controlado pelo usuário sem allowlist |
| **A02 Security Misconfiguration** | Debug habilitado em prod, headers ausentes (CSP, HSTS), CORS `*` com credenciais, default credentials, XML parser com entidades externas habilitadas (XXE) |
| **A03 Software Supply Chain Failures** *(novo)* | Dependência com CVE conhecido, lockfile ausente/não pinado, `postinstall` script não auditado, pacote sem provenance/assinatura verificável |
| **A04 Cryptographic Failures** | Hash fraco para senha (MD5/SHA1 em vez de bcrypt/argon2), TLS ausente/desatualizado, chave de criptografia hardcoded, senha em texto plano |
| **A05 Injection** | SQL/NoSQL/OS/HTML concatenação de input do usuário; `exec()` com shell; queries com f-string; XSS via `dangerouslySetInnerHTML`/`innerHTML`/`v-html` sem sanitização |
| **A06 Insecure Design** | Ausência de rate-limit em fluxo sensível por design, lógica de negócio que confia em dado vindo do cliente, falta de camada de validação centralizada |
| **A07 Authentication Failures** | Sessão sem expiração, JWT sem validação de assinatura/exp, rate-limit ausente em login, credenciais em texto plano |
| **A08 Software or Data Integrity Failures** | `pickle.loads`/`JSON.parse` de input não confiável sem schema, pipeline CI/CD sem verificação de integridade, auto-update sem assinatura |
| **A09 Security Logging & Alerting Failures** | Erros engolidos (`except: pass`), sem trilha de eventos de segurança (login, permissão negada), sem alerta para anomalias |
| **A10 Mishandling of Exceptional Conditions** *(novo)* | Fail-open em vez de fail-closed em erro, exceção não tratada expõe stack trace/dado sensível, caminho de erro que pula validação |

### 2. Secrets Management

- Chaves API, tokens JWT, senhas, certificados, connection strings **hardcoded** no código.
- `.env` versionado, segredos em logs, tokens em URL/query string.
- Padrões de grep: `(api[_-]?key|token|secret|password|passwd|senha)\s*[:=]\s*["'][^"']{8,}`
- Segredo em commit antigo (histórico git) = **comprometido**, exige rotação.

### 3. Performance & Memory (leaks)

- Conexões de banco/HTTP não fechadas (sem `with`/`finally`/context manager).
- Arquivos abertos sem close; streams sem flush.
- Loops infinitos ou recursão sem base; caches sem limite.
- Objetos grandes retidos (listeners não removidos, referências globais).

### 4. Concorrência insegura

- Race conditions em shared state sem lock (threads/async).
- `+=`/read-modify-write em dict/contador compartilhado.
- Deadlock por ordem de locks inconsistente.
- Banco: transações sem isolamento adequado, upsert não atômico.

## Workflow de auditoria (5 passos)

1. **Mapeie a superfície**: pontos de entrada de input (routes, args, uploads, webhooks) e saídas (queries, exec, render, API).
2. **Varredura por grep dirigida**: segredos, `exec(`, `eval(`, `innerHTML`, `pickle`, `raw(` SQL — liste candidatos.
3. **Analise cada candidato com contexto**: leia a função inteira, não só a linha — verifique se o input é alcançável e se há validação antes.
4. **Classifique severidade**: CRITICAL (remoto/explorável sem auth) > HIGH (explorável com esforço) > MEDIUM (requer condição) > LOW (defensivo/estilo).
5. **Escreva o relatório** com fix antes/depois por achado.

## Formato de relatório (obrigatório)

```
## [SEVERIDADE] <Título curto>
- **Arquivo**: <path>:<linha>
- **Vetor**: como um atacante explora
- **Trecho vulnerável**:
  ```<lang>
  <código com a falha>
  ```
- **Fix**:
  ```<lang>
  <código corrigido>
  ```
- **Impacto**: <o que acontece se explorado>
- **CVE/ref**: <padrão OWASP ou CVE relacionado, quando aplicável>
```

Regras do relatório: **todo** achado tem arquivo+linha+trecho+fix. Severidade classificada em todos. Zero achado "vibes" sem evidência. Ao final: resumo com contagem por severidade e prioridade de correção.

## Checklist de qualidade (antes de entregar)

- [ ] Superfície de ataque mapeada (entradas/saídas)
- [ ] Grep dirigido por padrões de risco executado
- [ ] Todo achado com arquivo, linha, trecho e fix antes/depois
- [ ] Severidade classificada (CRITICAL/HIGH/MEDIUM/LOW) em todos
- [ ] Falsos positivos filtrados (analisou contexto, não só regex)
- [ ] Resumo final com prioridade de correção
- [ ] `npm audit`/`pip-audit` rodado para componentes (se aplicável)

## Anti-padrões (proibido)

1. ❌ Reportar regex match sem analisar se o input é alcançável (falso positivo)
2. ❌ Achado sem linha/trecho (impossível de corrigir)
3. ❌ Fix vago ("use prepared statements") sem exemplo de código
4. ❌ Ignorar acessos comuns: auth ausente em endpoint novo
5. ❌ Tratar segredo em repo como "só troco a string" — exige rotação
6. ❌ Auditoria só do caminho feliz — procure o caminho do atacante
7. ❌ Relatório sem priorização (dev não sabe por onde começar)

## Composição com outras skills

- **Antes**: `security-privacy` (framework completo OWASP/LGPD) → `automation-security` (credenciais em automações)
- **Depois**: `bug-hunter` (correção com teste de regressão) → `qa` (validação final) → `techlead` (code review que ensina)

## References

- OWASP Top 10:2025 (revisão atual, final jan/2026): https://owasp.org/Top10/2025/ · OWASP Cheat Sheets: https://cheatsheetseries.owasp.org
- SAST: Semgrep (regras YAML, rápido, open-source) https://semgrep.dev · GitHub CodeQL (análise semântica profunda) https://codeql.github.com · Gitleaks (segredos em histórico git) https://gitleaks.io
- Secure code review: Snyk https://snyk.io/learn/secure-code-review/ · Trivy (scanner de componentes/containers) https://trivy.dev
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).

> Gerado pelo Izanagi AI — cópia fiel de `skills/code-auditor/SKILL.md` (fonte da verdade).
