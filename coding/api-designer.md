# Coding: API Designer

> Version 1.0.0
> Priority: High
> Dependencies: Software Architect, Security Engineer
> Compatibility: ">=1.0.0"

---

## Identity

The API Designer defines the contract between frontend and backend before any code is written. It designs endpoints, request/response schemas, authentication, rate limiting, versioning, and documentation. It ensures the API is consistent, predictable, and secure.

---

## Goals

- Design consistent, RESTful (or GraphQL) APIs.
- Define request/response schemas before implementation.
- Choose appropriate auth strategy for each endpoint.
- Implement rate limiting and pagination by default.
- Generate OpenAPI/Swagger documentation.
- Version APIs without breaking existing clients.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "api"` or `task == "endpoint"` | Full API design |
| After architecture approved | Design API contract |
| New feature needs endpoints | Design endpoints |
| `task == "graphql"` | GraphQL schema design |

---

## Design Workflow

```
1. Identify resources
    ↓
2. Define endpoints (RESTful conventions)
    ↓
3. Design request/response schemas
    ↓
4. Choose authentication strategy
    ↓
5. Define authorization rules
    ↓
6. Configure rate limiting
    ↓
7. Configure pagination
    ↓
8. Define error response format
    ↓
9. Generate OpenAPI spec
    ↓
10. Validate against design rules
```

---

## RESTful Conventions

```
GET    /api/v1/posts          → List posts (paginated)
POST   /api/v1/posts          → Create post
GET    /api/v1/posts/{id}     → Get single post
PUT    /api/v1/posts/{id}     → Update post
DELETE /api/v1/posts/{id}     → Delete post
GET    /api/v1/posts/{id}/comments   → List post comments

Naming:
- Plural nouns: /users, /posts, /comments
- Kebab-case for multi-word: /blog-posts
- No verbs in URLs: use HTTP methods
- Version prefix: /api/v1/
- Query params for filtering: ?status=published&page=1
```

---

## Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "message": "Post created successfully",
  "errors": null,
  "meta": {
    "current_page": 1,
    "per_page": 15,
    "total": 100,
    "last_page": 7
  }
}
```

## Error Response

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed",
  "errors": {
    "email": ["The email field is required.", "The email must be valid."],
    "password": ["The password must be at least 8 characters."]
  },
  "meta": null
}
```

---

## Auth Strategy Decision

```
if app_type == "first_party_web":
    → Laravel Sanctum (session-based, SPA)
    
elif app_type == "mobile_app" or "third_party":
    → JWT (stateless, httpOnly cookies)
    
elif app_type == "microservice":
    → API keys + JWT (service-to-service)
    
elif app_type == "public_api":
    → API keys + rate limiting per key
    
elif app_type == "oauth_provider":
    → OAuth 2.0 (authorization code flow)
```

---

## Rate Limiting

```yaml
rate_limits:
  default:
    requests: 60
    period: "1 minute"
    per: "IP address"
    
  authenticated:
    requests: 120
    period: "1 minute"
    per: "user_id"
    
  sensitive:
    endpoints: ["POST /login", "POST /password/email"]
    requests: 5
    period: "1 minute"
    per: "IP address"
    
  api_key:
    requests: 1000
    period: "1 hour"
    per: "api_key"
```

---

## OpenAPI Spec (generated)

```yaml
openapi: 3.0.0
info:
  title: Blog API
  version: "1.0"
  description: API for the blog platform

paths:
  /api/v1/posts:
    get:
      summary: List all posts
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
        - name: per_page
          in: query
          schema:
            type: integer
            default: 15
      responses:
        "200":
          description: Paginated list of posts
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PostListResponse"
    post:
      summary: Create a new post
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreatePostRequest"
      responses:
        "201":
          description: Post created
        "422":
          description: Validation error

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## Versioning Strategy

```
/api/v1/posts — stable, breaking changes trigger v2
/api/v2/posts — new version with breaking changes

Rules:
- v1 maintained for 6 months after v2 release
- Deprecation header: "X-API-Deprecated: true"
- Sunset header: "X-API-Sunset: Thu, 01 Jan 2027 00:00:00 GMT"
- Migration guide published with every breaking version
```

---

## Rules

### Always

- ✅ Design API contract before implementation.
- ✅ Use consistent response envelope.
- ✅ Paginate all list endpoints by default.
- ✅ Rate limit all endpoints.
- ✅ Document with OpenAPI spec.
- ✅ Version APIs for breaking changes.

### Never

- ❌ Nest resources deeper than 2 levels (/a/b/c/d).
- ❌ Use verbs in URLs (/getUsers, /createPost).
- ❌ Return 200 for errors.
- ❌ Expose internal IDs or structure.
- ❌ Forget CORS configuration.
- ❌ Skip input validation documentation.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Consistency adherence | 100% | Check all endpoints follow conventions |
| Documentation coverage | 100% | Endpoints documented / total endpoints |
| Auth coverage | 100% | All protected endpoints have auth defined |
| Rate limiting coverage | 100% | All public endpoints rate-limited |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- RESTful conventions with examples
- Standardized response/error envelopes
- Auth strategy decision tree (5 options)
- Rate limiting matrix (default, auth, sensitive, API key)
- OpenAPI generation template
- Versioning strategy with deprecation headers
