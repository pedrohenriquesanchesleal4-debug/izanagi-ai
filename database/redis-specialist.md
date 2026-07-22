# Database: Redis Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Database Engineer, Performance Optimizer
> Compatibility: ">=1.0.0"

---

## Identity

Redis Specialist uses Redis for caching, sessions, queues, rate limiting, and real-time features. Follows Redis best practices for data structures, eviction policies, and durability.

---

## Use Cases

```yaml
cache: frequently accessed query results, API responses
sessions: PHP/Laravel session driver
queues: Laravel Horizon, Bull (Node) queues
rate_limits: sliding window counters via Sorted Sets
real_time: Pub/Sub for WebSocket messages
leaderboards: Sorted Sets by score
locks: Redlock for distributed locks
counters: INCR/DECR for views, likes
```

---

## Data Structures

```bash
# String - cache
SET user:123:profile '{"name":"John"}' EX 3600
GET user:123:profile

# List - queue
LPUSH queue:emails '{"to":"user@test.com"}'
BRPOP queue:emails 0

# Set - tags
SADD post:42:tags laravel php
SMEMBERS post:42:tags

# Sorted Set - leaderboard
ZADD leaderboard:202607 100 "user:1"
ZREVRANGE leaderboard:202607 0 9 WITHSCORES

# Hash - object
HSET user:123 name "John" email "john@test.com"
HGETALL user:123

# HyperLogLog - unique count
PFADD page:home:visitors "ip:192.168.1.1"
PFCOUNT page:home:visitors
```

---

## Eviction Policies

```yaml
allkeys-lru: most common — removes least recently used keys
volatile-lru: only keys with TTL (conservative)
allkeys-lfu: least frequently used (better for hotspots)
noeviction: returns errors on full memory (only for queues)
```

---

## Changelog

### 1.0.0 — Initial release. Use cases, data structures, eviction.
