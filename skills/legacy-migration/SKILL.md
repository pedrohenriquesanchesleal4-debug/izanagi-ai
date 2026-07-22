---
name: legacy-migration
description: |
  Skill de Migracao de Sistemas Legados para o Portal. Aborda estrategias de migracao
  (strangler fig, big bang, parallel run), extracao de dados de sistemas antigos (WordPress,
  bancos relacionais), e modernizacao gradual. Use esta skill ao migrar funcionalidades
  de sistemas legados para a nova plataforma.
---

# Skill Legacy Migration — Portal

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
