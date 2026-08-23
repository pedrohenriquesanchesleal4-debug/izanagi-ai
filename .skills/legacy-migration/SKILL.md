---
name: "legacy-migration"
description: "Estratégias de migração de sistemas legados (strangler fig, big bang, parallel run) e extração de dados de sistemas antigos. Use ao migrar funcionalidades para uma nova plataforma. Gatilhos de ativação: skill legacy migration — izanagi; estrategias de migracao; extracao de dados; migracao de conteudo."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill Legacy Migration — Izanagi

> Migrado deterministicamente de `skills/legacy-migration/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Estratégias de migração de sistemas legados (strangler fig, big bang, parallel run) e extração de dados de sistemas antigos.
- **Ativar quando:** Use ao migrar funcionalidades para uma nova plataforma.
- **Escopo canônico:** Skill Legacy Migration — Izanagi
- **Seções do corpo original:** Estrategias de Migracao · Extracao de Dados · Migracao de Conteudo · Boas Praticas · References
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Identificar modulo para migrar

Identificar modulo para migrar

### Passo 2 — Implementar no novo sistema

Implementar no novo sistema

### Passo 3 — Roteador redireciona trafego gradualmente

Roteador redireciona trafego gradualmente

### Passo 4 — Remover modulo antigo quando 100% migrado

Remover modulo antigo quando 100% migrado

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Skill Legacy Migration — Izanagi

## Estrategias de Migracao

### Strangler Fig Pattern (Preferido)
```
Old System ←─── Router ───→ New System
                │
                └── Gradually redirect routes
```

1. Identificar modulo para migrar
2. Implementar no novo sistema
3. Roteador redireciona trafego gradualmente
4. Remover modulo antigo quando 100% migrado

### Parallel Run
```
User → Old System (primary)
     → New System (shadow, validate results)
```
- Usar para migracoes criticas (ex: dados financeiros)
- Validar resultados do novo vs antigo automaticamente
- Switch para novo apos confianca estabelecida

### Big Bang
- Migrar tudo de uma vez em uma janela
- Risco alto, mas mais rapido
- Usar apenas quando inviavel rodar em paralelo

---

## Extracao de Dados

### Wordpress → Supabase
```tsx
// Mapeamento WordPress → Supabase
const wpToSupabase = {
  wp_posts → posts (title, content, slug, status, created_at)
  wp_postmeta → post_metadata (meta_key, meta_value)
  wp_users → profiles (display_name, email)
  wp_terms → categories (name, slug)
  wp_term_relationships → post_categories (post_id, category_id)
};
```

### ETL Process
1. Extract: `SELECT * FROM wp_posts WHERE post_status = 'publish'`
2. Transform: limpar HTML, converter shortcodes, mapear IDs
3. Load: `INSERT INTO posts (...) ON CONFLICT (old_id) DO NOTHING`
4. Validate: comparar contagem de registros

---

## Migracao de Conteudo

### Preservacao de URLs
```nginx
# Redirecionar URLs antigas para novas
rewrite ^/wp-content/uploads/(.*)$ /uploads/$1 permanent;
rewrite ^/category/(.*)$ /noticias/categoria/$1 permanent;
rewrite ^/(\d{4})/(\d{2})/(.*)$ /noticias/$3 permanent;
```

### SEO Durante Migracao
- Mapear 301 redirects de todas as URLs antigas
- Preservar meta descriptions e titles
- Submeter novo sitemap ao Search Console
- Monitorar 404s apos migracao

---

## Boas Praticas

| Pratica | Descricao |
|---------|-----------|
| Feature parity | Nao migrar ate atingir paridade de funcionalidades |
| Rollback plan | Ter plano claro para voltar atras |
| Data validation | Validar dados migrados automaticamente |
| Performance baseline | Medir performance antes/depois |
| User communication | Comunicar mudancas e possiveis downtime |
| Staging migration | Testar migracao completa em staging primeiro |

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
