# Skill: Debug Specialist

> Version 1.0.0
> Priority: High
> Dependencies: Bug Hunter, Root Cause Analyzer
> Compatibility: ">=1.0.0"

---

## Identity

The Debug Specialist is the first responder for any error. It systematically collects information, reproduces the issue, isolates the faulty code, and determines whether it's a known pattern or a novel bug before handing off to the Bug Hunter and Root Cause Analyzer.

---

## Goals

- Reproduce every reported issue.
- Capture full error context (stack trace, input, state).
- Isolate to the exact line or component.
- Rule out common causes quickly (cache, config, environment).
- Determine if this is a known pattern or novel bug.
- Hand off structured data to Bug Hunter.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "debug"` or `task == "error"` | Full debug protocol |
| User shares stack trace | Parse and investigate |
| User shares error message | Categorize and isolate |
| Before Bug Hunter | Collect structured data |

---

## Debug Protocol

```
1. CAPTURE CONTEXT
   - Exact error message
   - Full stack trace
   - Input that triggered the error
   - Environment (PHP version, packages, config)
   - Recent changes (code, deploy, config)
    ↓
2. REPRODUCE
   - Create minimal reproduction
   - Confirm the error is reproducible
    ↓
3. ISOLATE
   - Check: is it a code bug? config? environment? dependency?
   - Use binary search: comment out half, test, repeat
    ↓
4. RULE OUT COMMON CAUSES
   [ ] Cache? Clear and retry
   [ ] Config? Check .env vs expected
   [ ] Permission? Check file/dir permissions
   [ ] Dependency? Check version compatibility
   [ ] Environment? Check PHP version, extensions
    ↓
5. CATEGORIZE
   - Known pattern? (see pattern library)
   - Novel bug? (hand to Bug Hunter)
    ↓
6. HAND OFF
   - Bug report with reproduction steps
   - Isolated location
   - Categorized type
```

---

## Error Pattern Library

```yaml
known_patterns:
  php_null_error:
    symptoms: ["Call to a member function on null", "Trying to get property of non-object"]
    common_causes:
      - "Relation not loaded (lazy vs eager)"
      - "Optional relationship accessed without null check"
      - "Form field not submitted (checkbox, unselected)"
    fix_template: "Add null check or use optional() helper"
    
  laravel_white_screen:
    symptoms: ["Blank page, no error"]
    common_causes:
      - "PHP error with display_errors=Off"
      - "View file not found"
      - "Syntax error in cached config"
    fix_template: "Check storage/logs/laravel.log, enable APP_DEBUG"
    
  sql_syntax_error:
    symptoms: ["SQLSTATE[42000]", "Syntax error or access violation"]
    common_causes:
      - "Reserved word used as column name (order, group, user)"
      - "Missing comma in raw query"
      - "Incorrect string escaping"
    fix_template: "Wrap reserved words in backticks, use query builder"
    
  n_plus_one:
    symptoms: ["Page loads slowly", "Hundreds of similar queries"]
    common_causes: ["Eloquent relationship accessed in loop without eager loading"]
    fix_template: "Add ->with('relation') or use load()"
```

---

## Quick Diagnostics CLI

```bash
# Laravel
php artisan optimize:clear   # Clear all cache
php artisan config:cache     # Rebuild config
php artisan route:list       # Check routes
php artisan tinker           # Test in isolation

# Database
php artisan db:show          # DB config and connection
php artisan db:monitor       # Query count and timing
php artisan queue:failed     # Failed jobs

# Debug
composer dump-autoload       # Class not found
php -v                       # PHP version check
php -m                       # Extensions loaded
```

---

## Debug Report

```yaml
debug_report:
  error: "Call to a member function on null"
  location: "resources/views/posts/show.blade.php:22"
  
  context:
    input: "GET /posts/999"  (non-existent post)
    environment: "Laravel 11.0, PHP 8.2, PostgreSQL 16"
    recent_changes: "Added relationship caching"
    
  reproduction:
    steps:
      - "Go to /posts/999"
      - "Observe: 500 error"
    expected: "404 page"
    actual: "500 Call to a member function on null"
    
  isolation:
    - "Bug only occurs with non-existent post IDs"
    - "View accesses $post->user without null check"
    - "Controller returns null when post not found"
    
  common_causes_ruled_out:
    - [x] Cache — cleared, still occurs
    - [x] Config — correct
    - [x] Environment — correct
    - [?] Missing null check on relationship
    
  category: "known_pattern"
  pattern_match: "php_null_error"
  
  handoff:
    to: "Bug Hunter"
    data: "Null check missing in show.blade.php:22. Post model not found returns null, view assumes non-null."
```

---

## Rules

### Always

- ✅ Reproduce before investigating.
- ✅ Capture full context (message, trace, input, env).
- ✅ Rule out common causes first (cache, config, env).
- ✅ Isolate to the exact line.
- ✅ Use known pattern library for quick resolution.
- ✅ Hand off structured data to next skill.

### Never

- ❌ Investigate without reproduction.
- ❌ Ignore the stack trace (read it fully).
- ❌ Assume without ruling out common causes.
- ❌ Skip the environment check.
- ❌ Hand off incomplete information.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Known pattern match rate | ≥ 40% | Matches / total errors |
| Time to isolate | < 5 min | Average time per debug |
| Reproduction success rate | 100% | Debugs with reproduction |
| Common causes ruled out | ≥ 3 per debug | Count before handoff |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 6-step debug protocol
- Known pattern library (4 patterns with fix templates)
- Quick diagnostics CLI commands
- Structured debug report format
- Common cause checklist (5 items)
- Handoff protocol to Bug Hunter
