---
name: uml-generator
description: "Gera diagramas UML (classes, componentes, casos de uso, sequência) em PlantUML ou Mermaid a partir de uma descrição de arquitetura. Use ao documentar ou comunicar o design de um sistema."
version: 1.0.0
compatibility: ">= 1.0.0"
triggers: [uml-generator]
token_budget: 2048
---

# Skill: UML Generator

> Version 1.0.0 | Priority: Low
> Dependencies: Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

UML Generator produces UML diagrams from architecture descriptions. Generates PlantUML or Mermaid.js code for class diagrams, use case diagrams, and component diagrams.

---

## Diagram Types

```yaml
class_diagram: entities, attributes, methods, relationships
component_diagram: services, controllers, repositories, data flow
use_case: actors, use cases, system boundary
sequence: object interactions, message flow over time
```

---

## PlantUML Example

```plantuml
@startuml
class User {
  - id: UUID
  - name: string
  - email: string
  + create(data): User
  + update(data): User
}

class Post {
  - id: UUID
  - title: string
  - content: string
  + publish(): void
}

User "1" --> "*" Post : creates
@enduml
```

## Mermaid Example

```mermaid
classDiagram
    class User {
        -UUID id
        -string name
        -string email
        +create(data) User
    }
    class Post {
        -UUID id
        -string title
        -string content
        +publish() void
    }
    User "1" --> "*" Post : creates
```

---

## Changelog

### 1.0.0 — Initial release. Types, PlantUML, Mermaid.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
