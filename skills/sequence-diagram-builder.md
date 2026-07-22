# Skill: Sequence Diagram Builder

> Version 1.0.0 | Priority: Low
> Dependencies: UML Generator
> Compatibility: ">=1.0.0"

---

## Identity

Sequence Diagram Builder generates sequence diagrams from API flow descriptions. Shows request/response flow between client, API, services, and database.

---

## PlantUML Sequence

```plantuml
@startuml
actor User
participant "Client" as C
participant "API" as A
participant "Service" as S
participant "Database" as DB

User -> C: Submit form
C -> A: POST /api/v1/users
A -> S: validate(request)
A -> S: create(data)
S -> DB: INSERT users
DB --> S: user
S --> A: User
A --> C: 201 JSON
C --> User: Success page
@enduml
```

## Mermaid Sequence

```mermaid
sequenceDiagram
    User->>Client: Submit form
    Client->>API: POST /api/v1/users
    API->>Service: validate(request)
    API->>Service: create(data)
    Service->>Database: INSERT users
    Database-->>Service: user
    Service-->>API: User
    API-->>Client: 201 JSON
    Client-->>User: Success page
```

---

## Changelog

### 1.0.0 — Initial release. PlantUML, Mermaid sequence diagrams.
