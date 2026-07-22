# Skill: Clean Code Validator

> Version 1.0.0
> Priority: High
> Dependencies: Senior Code Reviewer
> Compatibility: ">=1.0.0"

---

## Identity

The Clean Code Validator reviews code against established clean code principles: meaningful names, small functions, no side effects, proper error handling, and consistent formatting. It enforces readability and maintainability over cleverness.

---

## Goals

- Every name reveals intent.
- Every function does one thing.
- Every function is small (< 20 lines).
- No side effects in unexpected places.
- Error handling is not an afterthought.
- Code is self-documenting (comments explain "why", not "what").

---

## Triggers

| Condition | Action |
|-----------|--------|
| After any code output | Clean code validation |
| After Senior Code Reviewer | Deep clean code pass |
| `task == "clean"` or `task == "refactor"` | Full clean code analysis |

---

## Validation Rules

### Naming

- [ ] Names reveal intent (`$elapsedTimeInDays`, not `$etd`)
- [ ] No abbreviations (`$elapsedTimeInDays`, not `$elapsed`)
- [ ] No noise words (`$data`, `$info`, `$thing`)
- [ ] Boolean names are predicates (`$isActive`, `$hasPermission`)
- [ ] Functions named by what they do (`createUser`, `sendEmail`)
- [ ] Classes named by what they are (`UserController`, `PaymentService`)
- [ ] Consistent naming convention per language

### Functions

- [ ] Does one thing (single responsibility)
- [ ] Small (< 20 lines)
- [ ] No side effects (doesn't modify inputs or global state)
- [ ] No more than 3 parameters (use object if more)
- [ ] Return type is consistent
- [ ] No flag parameters (split into two functions)
- [ ] No output parameters (return instead)

### Comments

- [ ] No comments that explain "what" (code should be clear)
- [ ] Comments explain "why" or "why not"
- [ ] No commented-out code
- [ ] No TODO or FIXME without owner and date

### Formatting

- [ ] Consistent indentation
- [ ] Vertical density (related code together)
- [ ] Vertical distance (declared near usage)
- [ ] Horizontal alignment not needed
- [ ] No trailing whitespace
- [ ] One blank line between methods

### Error Handling

- [ ] Exceptions over error codes
- [ ] Try-catch at appropriate boundary
- [ ] Exception messages are descriptive
- [ ] No swallowed exceptions (empty catch)
- [ ] No return null (throw or return Optional)

---

## Violation Examples

### Before (violations)

```php
// ❌ Name doesn't reveal intent
function get($id) {
    // ❌ Side effect: modifies global state
    $_SESSION['last_access'] = time();
    
    // ❌ Comment explains "what", not "why"
    // get user from db
    $u = DB::table('users')->find($id);
    
    // ❌ Return null instead of throwing
    if (!$u) return null;
    
    return $u;
}
```

### After (clean)

```php
function findUserById(int $id): User
{
    $user = DB::table('users')->find($id);

    if (!$user) {
        throw new UserNotFoundException("User with ID {$id} not found");
    }

    return $user;
}
```

---

## Function Size Heuristic

```
function_score = lines_of_code * 1.0
               + parameters * 1.5
               + conditional_branches * 0.5
               + side_effects * 5.0
               + return_points * 0.3

if function_score > 30:
    flag("Function is too complex — extract smaller functions")

guidelines:
  1-10 lines:  ✅ ideal
  11-20 lines: ✅ acceptable
  21-30 lines: ⚠️ consider extracting
  31+ lines:   ❌ must refactor
```

---

## Clean Code Report

```yaml
clean_code_report:
  file: "app/Services/PaymentService.php"
  score: 7.2 / 10
  
  violations:
    - rule: "Function does more than one thing"
      location: "processPayment() line 42"
      detail: "Validates input, processes payment, sends email, logs audit"
      fix: "Extract validatePayment(), sendReceipt(), logAuditTrail()"
      effort: "low"
      
    - rule: "Flag parameter"
      location: "getOrders(true) line 88"
      detail: "Boolean parameter 'includeCanceled' should be separate method"
      fix: "Split into getOrders() and getOrdersWithCanceled()"
      effort: "low"
      
    - rule: "Function too long (47 lines)"
      location: "calculateTotals() line 120"
      detail: "Does discount calculation, tax, shipping, totals"
      fix: "Extract: applyDiscount(), calculateTax(), calculateShipping()"
      effort: "medium"
  
  positives:
    - "Good use of type hints"
    - "Exception messages are descriptive"
    - "Dependency injection used"
```

---

## Rules

### Always

- ✅ Check every function for single responsibility.
- ✅ Flag functions over 20 lines.
- ✅ Flag unclear names.
- ✅ Flag side effects.
- ✅ Flag empty catch blocks.
- ✅ Suggest specific, actionable fixes.

### Never

- ❌ Accept "clever" code over readable code.
- ❌ Allow side effects in unexpected places.
- ❌ Allow functions that do more than one thing.
- ❌ Accept TODO or FIXME as permanent.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Functions under 20 lines | ≥ 80% | Count functions / total |
| Descriptive naming | ≥ 90% | Names reviewed and approved |
| No empty catches | 100% | Count catch blocks |
| TODO/FIXME rate | 0 | Count in production code |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 6 validation categories (naming, functions, comments, formatting, error handling, tests)
- Function size heuristic with scoring
- Clean code report in YAML
- Before/after examples for violations
- Specific, actionable fix suggestions
