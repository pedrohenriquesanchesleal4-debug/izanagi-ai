---
name: code-auditor
description: "Auditoria de código (SAST manual): varredura por OWASP Top 10 (injection, broken auth, XSS, SSRF, deserialization, access control, misconfiguration), vazamento de segredos (API keys, JWT, senhas hardcoded), más práticas arquiteturais, leaks de recursos (conexões, arquivos), concorrência insegura e dependências vulneráveis. Relatório com severidade classificada, arquivo+linha+trecho e fix antes/depois. Use ao revisar código quanto a segurança, ou antes de merge/deploy."
---

# Code Auditor & Vulnerability Scanner

Auditoria de código estática (SAST manual) para caçar falhas de segurança, vazamento de segredos e más práticas — com relatório acionável: **severidade, arquivo, linha, trecho e fix antes/depois**. O objetivo é entregar achados que o dev corrige em minutos, não um laudo que ninguém lê.

## Quando usar

Use ao: revisar código antes de merge/deploy, auditar repo legado, verificar PR com mudanças sensíveis (auth, upload, SQL), responder "esse código é seguro?", ou rodar auditoria periódica. **Pule** para: pentest ativo (skill `security-privacy`), auditoria de infra (skill `cloud-infra`), ou quando o usuário só quer review de qualidade (skill `qa`).

## Matriz de Auditoria (o que procurar)

### 1. OWASP Top 10 (prioridade máxima)

| Categoria | O que procurar no código |
|---|---|
| **Injection** | SQL/NoSQL/OS/HTML concatenação de input do usuário; `exec()` com shell; queries com f-string |
| **Broken Auth** | Sessão sem expiração, JWT sem validação de assinatura/exp, senha em texto plano, rate-limit ausente em login |
| **Data Exposure** | Logar PII, retornar objeto inteiro na API (senha incluída), CORS `*` com credenciais |
| **XXE** | Parsing de XML com entidades externas habilitadas (`lxml`, `DocumentBuilder` sem `disallow-doctype`) |
| **Broken Access Control** | Endpoint sem checagem de autorização, IDOR (usar `id` do usuário sem verificar dono) |
| **Security Misconfiguration** | Debug habilitado em prod, headers ausentes (CSP, HSTS), CORS aberto, default credentials |
| **XSS** | `dangerouslySetInnerHTML`, `innerHTML`, `v-html`, saída não escapada de input |
| **Deserialization** | `pickle.loads`, `JSON.parse` de input não confiável sem schema |
| **Vulnerable Components** | Dependências com CVE conhecido (rodar `npm audit`/`pip-audit`/`trivy`) |
| **Insufficient Logging** | Erros engolidos (`except: pass`), sem trilha de eventos de segurança (login, permissão negada) |

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

- OWASP Top 10: https://owasp.org/Top10/ · OWASP Cheat Sheets: https://cheatsheetseries.owasp.org · Snyk code review: https://snyk.io/learn/secure-code-review/ · Trivy: https://trivy.dev
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
