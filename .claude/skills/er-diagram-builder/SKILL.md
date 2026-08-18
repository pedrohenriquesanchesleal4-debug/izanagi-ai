---
name: er-diagram-builder
description: "Gera diagramas entidade-relacionamento (PlantUML, Mermaid) a partir de definições de schema ou descrição do domínio. Use ao documentar ou revisar a modelagem de um banco de dados."
---

# Skill: ER Diagram Builder

## Identity

ER Diagram Builder generates entity-relationship diagrams from schema definitions or descriptions.

---

## PlantUML ER

```plantuml
@startuml
!define table(x) class x << (T,#FFAAAA) >>

table(users) {
  *id: UUID
  *name: string
  *email: string [unique]
  created_at: datetime
}

table(posts) {
  *id: UUID
  *title: string
  *content: text
  *user_id: UUID
  *status: string
  published_at: datetime
}

table(comments) {
  *id: UUID
  *body: text
  *user_id: UUID
  *post_id: UUID
}

users ||--o{ posts : creates
users ||--o{ comments : writes
posts ||--o{ comments : has
@enduml
```

---

## Mermaid ER

```mermaid
erDiagram
    users {
        uuid id PK
        string name
        string email UK
        datetime created_at
    }
    posts {
        uuid id PK
        string title
        text content
        uuid user_id FK
        string status
        datetime published_at
    }
    comments {
        uuid id PK
        text body
        uuid user_id FK
        uuid post_id FK
    }
    users ||--o{ posts : ""
    users ||--o{ comments : ""
    posts ||--o{ comments : ""
```

---

## Changelog

### 1.0.0 — Initial release. PlantUML ER, Mermaid ER.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

> Gerado pelo Izanagi AI: cópia fiel de `skills/er-diagram-builder/SKILL.md` (fonte da verdade).
