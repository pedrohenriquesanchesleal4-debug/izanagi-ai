# Core: Compression Engine

> Version 1.0.0
> Priority: High
> Dependencies: Token Manager
> Compatibility: ">=1.0.0"

---

## Identity

The Compression Engine is activated when the Token Manager detects that usage exceeds 70% of the budget. It applies lossy and lossless compression strategies to reduce token count while preserving semantic meaning and critical information.

---

## Goals

- Reduce token count by 30-50% when activated.
- Preserve 100% of decisions, security items, and action items.
- Eliminate 100% of redundancy, filler, and repetition.
- Complete compression in under 200ms.

---

## Compression Levels

| Level | Reduction | When Used | Risk |
|-------|-----------|-----------|------|
| **Lossless** | 10-20% | Budget at 70-80% | None — removes whitespace, shortens identifiers |
| **Light** | 20-35% | Budget at 80-90% | Low — summarizes examples, drops verbose explanations |
| **Aggressive** | 35-50% | Budget at 90-100% | Medium — drops non-critical examples, shortens code blocks |
| **Emergency** | 50-70% | Budget exceeded | High — keeps only decisions, security items, and action items |

---

## Compression Strategies

### 1. Remove Filler (Lossless)

```
Before: "I would recommend that you consider using..."
After:  "Use..."

Before: "In order to achieve this goal, we need to..."
After:  "To do this..."

Before: "It is important to note that the system should..."
After:  "The system must..."
```

### 2. Condense Lists (Light)

```
Before:
- First, create a new controller
- Second, add the validation rules
- Third, implement the service layer

After:
1. Create controller
2. Add validation
3. Implement service
```

### 3. Summarize Code (Light)

```
Before:
public function store(Request $request)
{
    $validated = $request->validate([
        'name' => 'required|string|max:255',
        'email' => 'required|email|unique:users',
        'password' => 'required|min:8|confirmed',
    ]);
    
    $user = User::create($validated);
    
    return response()->json($user, 201);
}

After:
// UserController::store — validates name, email, password → creates user → returns 201
```

### 4. Drop Repetition (Aggressive)

Remove content that has appeared verbatim in the last 3 responses. Track using a rolling hash of content blocks.

### 5. Keyword-Only Memory (Emergency)

```
Before:
"We decided to use JWT tokens stored in httpOnly cookies for authentication because it provides better XSS protection compared to localStorage. The refresh token endpoint is rate-limited to 5 requests per minute."

After:
"Auth: JWT in httpOnly cookies (XSS protection). Refresh rate-limited: 5/min."
```

---

## Decision Preservation

The following content types are **never** compressed below their minimum viable form:

| Content Type | Minimum Form |
|-------------|-------------|
| Security decision | Full — must remain readable |
| Vulnerability finding | Full — including severity and location |
| Action item | Full — including owner and deadline |
| Breaking change | Full — including migration path |
| Error explanation | Cause + fix (can remove stack trace) |
| User preference | Full — exact wording |

---

## Algorithm

```
function compress(content, target_level):
    if target_level == "lossless":
        content = remove_filler(content)
        content = shorten_markdown_headers(content)
        content = remove_trailing_whitespace(content)
    
    elif target_level == "light":
        content = compress_lossless(content)
        content = condense_lists(content)
        content = summarize_examples(content, keep=2)
        content = shorten_code_blocks(content, keep_signatures=true)
    
    elif target_level == "aggressive":
        content = compress_light(content)
        content = drop_redundant_blocks(content)
        content = summarize_code_blocks(content)
        content = keep_only_first_sentence_of_explanations(content)
    
    elif target_level == "emergency":
        content = extract_decisions(content)
        content = extract_security_items(content)
        content = extract_action_items(content)
        content = drop_everything_else(content)
    
    return content
```

---

## Quality Check After Compression

1. ✅ All decisions preserved?
2. ✅ All security items preserved?
3. ✅ All action items preserved?
4. ✅ No grammatical errors introduced?
5. ✅ Still understandable to the user?

If any check fails, revert to the previous level and retry.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Compression ratio | ≥ 2:1 (aggressive) | original size / compressed size |
| Decision loss rate | 0% | Count lost decisions |
| User comprehension | ≥ 95% | Follow-up user clarification rate |
| Compression speed | < 200ms | Execution time |

---

## Memory Hooks

```yaml
on_compress:
  - save: compression_log (level, ratio, items_dropped)
  - save: preserved_decisions

on_failure:
  - notify: Token Manager
  - revert: to previous compression level
```

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 4 compression levels: lossless, light, aggressive, emergency
- Content-type preservation rules
- Rolling hash for repetition detection
- Quality check after every compression
