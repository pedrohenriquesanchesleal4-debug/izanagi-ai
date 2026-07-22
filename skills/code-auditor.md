# Skill: Code Auditor & Vulnerability Scanner

**Versão:** 1.0.0  
**Domínio:** Security & Quality Assurance  
**Budget de Tokens:** ~2500  

---

## Contexto & Objetivo
Escanear repositórios e trechos de código em busca de falhas de segurança (SAST), vazoes de segredo, más práticas arquiteturais, vazamento de memória e concorrência insegura.

---

## Matriz de Auditoria
- **OWASP Top 10**: Injection, Broken Auth, Data Exposure, XXE, Broken Access Control, Security Misconfiguration, XSS, Deserialization, Vulnerable Components, Insufficient Logging.
- **Secrets Management**: Chaves API, Tokens JWT, senhas hardcoded, certificados expostos.
- **Performance & Memory**: Leaks de conexões de banco, arquivos não fechados, loops infinitos.

---

## Checklist de Qualidade
- [ ] Análise efetuada com severidade classificada (CRITICAL, HIGH, MEDIUM, LOW).
- [ ] Todo problema identificado possui o arquivo, trecho de código e linha correspondente.
- [ ] Recomendação de correção (Fix) fornecida com exemplo claro antes/depois.
