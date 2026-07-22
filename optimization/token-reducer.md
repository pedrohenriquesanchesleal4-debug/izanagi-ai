# Optimization: Token Reducer

> Version 1.0.0
> Priority: High
> Dependencies: Compression Engine, Context Engine
> Compatibility: ">=1.0.0"

---

## Identity

The Token Reducer works alongside the Compression Engine to proactively reduce token consumption before content is generated. It applies techniques like shortening prompts, removing redundant instructions, and choosing compact output formats — all without losing meaning.

---

## Goals

- Reduce prompt tokens by 20-40% before generation.
- Reduce output tokens by 15-30% through format optimization.
- Eliminate all redundant instructions and meta-commentary.
- Choose the most token-efficient format for every output type.

---

## Reduction Techniques

### Technique 1: Shorten Instructions

Remove redundant meta-instructions that are already encoded in the skill.

```
BEFORE:
"Now I will analyze the requirements you provided and think about what architecture would be best for your project. Let me consider the different options available..."

AFTER:
"## Architecture Analysis"
```

**Savings: ~40 tokens per occurrence.**

### Technique 2: Compact Lists

Use compact list format instead of verbose bullet points.

```
BEFORE:
"- First, we need to create a migration file for the users table
 - Second, we create the User model with the necessary relationships
 - Third, we implement the AuthController with login and register methods"

AFTER:
"1. Users migration
 2. User model (relationships)
 3. AuthController (login, register)"
```

**Savings: ~30 tokens per list.**

### Technique 3: No Meta-Commentary

Eliminate sentences about what the AI is doing or about to do.

```
BEFORE: "Let me now generate the code for the controller. I'll make sure to include proper validation and error handling."

AFTER: (just the code)
```

**Savings: ~20 tokens per occurrence.**

### Technique 4: Use Shorthand Headers

```
BEFORE: "## Analysis of Requirements"
AFTER:  "## Requirements"

BEFORE: "## Description of the Architecture Pattern"
AFTER:  "## Architecture"

BEFORE: "## Implementation Details and Code Examples"
AFTER:  "## Implementation"
```

**Savings: ~10 tokens per header.**

### Technique 5: Remove Redundant Code Comments

When code is self-explanatory, omit comments.

```
// ❌ Verbose
$user = User::find($id); // Find the user by their ID from the database

// ✅ Clean
$user = User::find($id);
```

**Savings: ~15 tokens per comment.**

### Technique 6: Compact Error Messages

```
BEFORE: "An error occurred while processing your request. Please try again later."
AFTER:  "Error processing request. Try again later."
```

**Savings: ~10 tokens per message.**

---

## Format Selection

Choose the most token-efficient format based on content type:

| Content Type | Best Format | Token Savings vs Default |
|-------------|-------------|------------------------|
| Code | Code block (```) | Baseline |
| Config | YAML | 20% vs JSON |
| Data | JSON compact (no spaces) | 30% vs pretty-print |
| List | Markdown list | Baseline |
| Table | Pipe table | 30% vs HTML table |
| Decision | YAML | 40% vs prose |
| Report | YAML + prose mix | 25% vs all prose |
| Teaching | Short code + explanation | 35% vs long explanation |

---

## Algorithm

```
function reduce_prompt(prompt):
    techniques = [
        shorten_instructions,
        remove_meta_commentary,
        compact_headers,
        remove_redundant_examples,
    ]
    
    for technique in techniques:
        if size(prompt) > target:
            prompt = technique(prompt)
    
    return prompt


function reduce_output(output, format):
    if format == "code":
        output = remove_redundant_comments(output)
        output = compact_imports(output)
    
    elif format == "list":
        output = use_compact_list(output)
    
    elif format == "decision":
        output = use_yaml_format(output)
    
    elif format == "teaching":
        output = prioritize_code_over_explanation(output)
    
    return output
```

---

## Rules

### Always

- ✅ Reduce prompt tokens before every generation.
- ✅ Choose the most token-efficient format for the content.
- ✅ Remove meta-commentary about what the AI is doing.
- ✅ Use compact lists over verbose bullet points.

### Never

- ❌ Reduce content that would make it unclear or ambiguous.
- ❌ Remove security-critical explanations.
- ❌ Eliminate necessary context for understanding.
- ❌ Sacrifice teaching quality for token savings.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Prompt reduction | 20-40% | Original vs reduced size |
| Output reduction | 15-30% | Original vs reduced size |
| Clarity retention | ≥ 95% | User follow-up clarification rate |
| Format efficiency | Optimal per type | Tokens per content type |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 6 reduction techniques
- Format selection matrix for 8 content types
- Prompt and output reduction algorithms
- Teaching quality preservation rules
