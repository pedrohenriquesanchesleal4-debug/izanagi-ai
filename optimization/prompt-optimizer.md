# Optimization: Prompt Optimizer

> Version 1.0.0
> Priority: High
> Dependencies: Token Manager, Compression Engine
> Compatibility: ">=1.0.0"

---

## Identity

The Prompt Optimizer restructures incoming user prompts to be maximally efficient for the LLM. It strips noise, reformats ambiguity into clarity, extracts implicit requirements, and structures the prompt for optimal reasoning — all before the Decision Engine classifies it.

---

## Goals

- Reduce prompt token count by 20-40% before processing.
- Extract implicit requirements the user didn't state.
- Structure ambiguous requests into clear, actionable tasks.
- Remove filler, repetition, and conversational noise.
- Preserve every meaningful piece of information.

---

## Optimization Passes

### Pass 1: Noise Removal

Remove elements that add no semantic value:

- Greetings: "Hey, how are you? Hope you're doing well..."
- Fillers: "I was wondering if maybe you could possibly..." → "Can you..."
- Apologies: "Sorry if this is a dumb question but..."
- Meta: "I'm not sure if this makes sense but..."
- Repetition: Same question asked 3 different ways

**Savings: 10-20%**

### Pass 2: Implicit Extraction

Extract requirements the user implied but didn't state:

```
Input: "Create a login page"
Extracted:
  - Framework: Laravel (from project context)
  - Auth method: JWT (from project memory)
  - DB: PostgreSQL (from project memory)
  - Needs: registration, login, logout, password reset (implicit)
  - Security: rate limiting, password hashing, CSRF (implied by best practice)
```

**Adds ~50-100 tokens of high-value context.**

### Pass 3: Ambiguity Resolution

Flag and resolve ambiguous statements:

```
Input: "Make it secure"
→ Which aspect? Auth? Input validation? Encryption? All of the above?
→ Resolution: "Apply OWASP security standards to all endpoints"
```

If ambiguity cannot be resolved from context:

```
→ Flag for clarification
→ "You mentioned 'Make it secure' — should I focus on auth, input validation,
   or a full OWASP audit?"
```

### Pass 4: Structuring

Convert free-form input into structured format:

```
BEFORE:
"I need to build an API for my blog. Users should be able to create posts and
comment on them. Oh and I need categories too. And authentication obviously.
Make it fast."

AFTER:
## Project: Blog API
## Requirements:
- Authentication (users can register, login, logout)
- Posts CRUD (create, read, update, delete)
- Comments (users can comment on posts)
- Categories (posts belong to categories)
## Constraints:
- Performance is a priority
```

---

## Optimized Prompt Format

```yaml
optimized_prompt:
  original_length: 247
  optimized_length: 134
  savings: "46%"
  
  task:
    type: "new_feature"
    title: "Blog API with auth, posts, comments, categories"
    
  requirements:
    - "User authentication (register, login, logout)"
    - "Post CRUD with categories"
    - "Comment on posts"
    
  constraints:
    - "Performance is priority"
    - "Uses Laravel + PostgreSQL (from project context)"
    
  implicit:
    - "Needs input validation"
    - "Needs authorization (user can only edit own posts)"
    - "Needs API rate limiting"
    - "Needs pagination for listing"
    
  clarifications_needed: []
```

---

## Algorithm

```
function optimize_prompt(raw_input):
    // Pass 1: Remove noise
    cleaned = remove_noise(raw_input)
    
    // Pass 2: Extract implicit requirements
    context = load_project_context()
    implicit = extract_implicit(cleaned, context)
    
    // Pass 3: Detect ambiguity
    ambiguities = detect_ambiguity(cleaned)
    
    // Pass 4: Structure
    structured = structure_prompt(cleaned, implicit)
    
    return {
        optimized: structured,
        clarifications: ambiguities,
        savings: 1 - (len(structured) / len(raw_input))
    }
```

---

## Rules

### Always

- ✅ Remove noise before processing.
- ✅ Extract implicit requirements from project context.
- ✅ Flag unresolved ambiguity for clarification.
- ✅ Structure into machine-readable format.
- ✅ Track token savings.

### Never

- ❌ Remove requirements, even if they seem implied.
- ❌ Guess when project context is insufficient — ask.
- ❌ Over-structure to the point of losing natural meaning.
- ❌ Add requirements the user didn't ask for or imply.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Token savings | 20-40% | Original vs optimized length |
| Implicit extraction accuracy | ≥ 80% | Extracted items confirmed by user |
| Clarification rate | ≤ 15% | Prompts needing user clarification |
| Requirement completeness | 100% | All user requirements preserved in output |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 4 optimization passes (noise, implicit, ambiguity, structure)
- Implicit requirement extraction from project context
- Ambiguity detection algorithm
- Structured YAML output format
- Token savings tracking
