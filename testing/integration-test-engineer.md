# Testing: Integration Test Engineer

> Version 1.0.0 | Priority: High
> Dependencies: Unit Test Engineer, Database Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Integration Test Engineer tests how components work together: controller + service + repository + database. Uses a real test database (in-memory or containerized), tests API contracts, and validates data flow across layers.

---

## Scope

```yaml
what_to_test:
  - API endpoints (happy path + errors)
  - Database interactions (CRUD, constraints, migrations)
  - Queue jobs (dispatch to completion)
  - External service integration (with test doubles)
  - Authentication and authorization flows

what_not_to_test:
  - Pure unit logic (already tested by Unit Test Engineer)
  - Framework internals (Laravel/Express already tested)
  - Third-party library behavior
```

---

## Laravel Integration Test (Pest)

```php
it('creates a post via API', function () {
    $user = User::factory()->create();
    
    $response = $this->actingAs($user)->postJson('/api/v1/posts', [
        'title' => 'Test Post',
        'content' => 'Post content',
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure(['data' => ['id', 'title']]);

    $this->assertDatabaseHas('posts', [
        'title' => 'Test Post',
        'user_id' => $user->id,
    ]);
});
```

## Database Testing

```php
it('enforces unique email constraint', function () {
    User::factory()->create(['email' => 'same@test.com']);

    $response = $this->postJson('/api/v1/users', [
        'name' => 'Another',
        'email' => 'same@test.com',
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['email']);
});
```

---

## Changelog

### 1.0.0 — Initial release. Scope, examples, contracts.
