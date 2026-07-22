# Skill: Logging Expert

> Version 1.0.0 | Priority: Medium
> Dependencies: DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Logging Expert implements structured logging across the application. Ensures every significant event is logged with context, no sensitive data leaks, and logs are queryable.

---

## Structured Logging

```json
{
  "timestamp": "2026-07-17T12:00:00Z",
  "level": "error",
  "message": "Payment processing failed",
  "context": {
    "user_id": "usr_456",
    "payment_id": "pay_789",
    "amount": 150.00,
    "error": "card_declined",
    "provider": "stripe"
  },
  "request_id": "req_abc123",
  "environment": "production",
  "service": "payment-service"
}
```

## What to Log

```yaml
info:
  - User registration/login
  - Order placement
  - Payment confirmation
  - Email sent
  
warning:
  - Rate limit approaching
  - Slow query (> 100ms)
  - Retry attempts
  
error:
  - Exception caught
  - Payment failure
  - External API error
  - Database connection failure
  
critical:
  - Application crash
  - Data integrity violation
  - Security breach detected
```

---

## What NOT to Log

```
- Passwords (even hashed)
- Credit card numbers
- Personal access tokens
- API keys
- Full stack traces with sensitive data
- Session IDs (use anonymized correlation IDs)
```

---

## Changelog

### 1.0.0 — Initial release. Structured logging, what to log/not log.
