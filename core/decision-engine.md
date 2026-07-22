# Core: Decision Engine

> Version 1.0.0
> Priority: Critical
> Dependencies: Context Engine, Skill Registry
> Compatibility: ">=1.0.0"

---

## Identity

The Decision Engine is the entry point of every interaction. It classifies the incoming task, determines urgency and complexity, selects the appropriate skill chain (DAG), and validates that all dependencies are satisfied before execution.

---

## Goals

- Classify any input into a task type with confidence ≥ 90%.
- Route to the correct skill chain with zero ambiguity.
- Detect missing dependencies before execution.
- Respect token budget at routing time.
- Log every decision for reflection and evolution.

---

## Classification Schema

Every task is classified into exactly one category:

| Category | Examples |
|----------|----------|
| `new_project` | "Create a blog", "Start a SaaS app" |
| `new_feature` | "Add payment gateway", "Add search" |
| `bug` | "Login is broken", "500 error on checkout" |
| `refactor` | "Clean up this controller", "Extract service" |
| `review` | "Review my PR", "Is this code good?" |
| `question` | "How do I use Enum in PHP?", "What is CQRS?" |
| `explain` | "Explain this code", "Why is this slow?" |
| `security_audit` | "Audit my API", "Check for vulnerabilities" |
| `optimize` | "This query is slow", "Reduce memory usage" |
| `debug` | "Stack trace here", "Why is this null?" |
| `test` | "Write tests for this", "Coverage report" |
| `devops` | "Deploy to production", "Set up CI/CD" |
| `teach` | "Teach me Laravel", "What is dependency injection?" |
| `plan` | "Plan the next sprint", "Break down this feature" |
| `document` | "Document this API", "Generate README" |

---

## Skill Chain Matrix

```yaml
new_project:
  chain:
    - core/planning-engine
    - skills/software-architect
    - skills/requirement-analyzer
    - skills/risk-analyzer
    - skills/software-architect
  budget: 3000
  quality_gates: [security, style, completeness]

new_feature:
  chain:
    - skills/software-architect
    - skills/requirement-analyzer
    - coding/backend-engineer
    - testing/unit-test-engineer
  budget: 2500
  quality_gates: [security, style, completeness]

bug:
  chain:
    - skills/debug-specialist
    - skills/root-cause-analyzer
    - skills/bug-hunter
    - testing/integration-test-engineer
    - teaching/professor-mode
  budget: 2000
  quality_gates: [security, completeness]

refactor:
  chain:
    - skills/software-architect
    - skills/complexity-analyzer
    - skills/refactoring-specialist
    - testing/unit-test-engineer
    - skills/solid-validator
  budget: 2000
  quality_gates: [style, completeness]

review:
  chain:
    - skills/senior-code-reviewer
    - security/security-engineer
    - skills/performance-optimizer
    - skills/clean-code-validator
    - skills/solid-validator
  budget: 1500
  quality_gates: [security, style, clarity]

question:
  chain:
    - teaching/professor-mode
    - teaching/code-explainer
    - teaching/interactive-teaching
  budget: 1000
  quality_gates: [clarity, completeness]

teach:
  chain:
    - teaching/professor-mode
    - teaching/mentor-mode
    - teaching/adaptive-teaching
    - teaching/learning-tracker
  budget: 1500
  quality_gates: [clarity, completeness]

security_audit:
  chain:
    - security/security-engineer
    - security/owasp-auditor
    - security/pentest-reviewer
    - skills/bug-prevention
    - skills/documentation-writer
  budget: 3000
  quality_gates: [security, completeness]

optimize:
  chain:
    - skills/performance-optimizer
    - skills/complexity-analyzer
    - skills/dependency-analyzer
    - database/sql-optimizer
  budget: 2000
  quality_gates: [style, completeness]

devops:
  chain:
    - devops/devops-engineer
    - devops/docker-expert
    - devops/ci-cd-specialist
    - security/security-engineer
  budget: 2500

debug:
  chain:
    - skills/debug-specialist
    - skills/root-cause-analyzer
    - skills/logging-expert
  budget: 2000
  quality_gates: [completeness]

test:
  chain:
    - testing/unit-test-engineer
    - testing/integration-test-engineer
    - testing/e2e-test-engineer
  budget: 2000
  quality_gates: [completeness]

explain:
  chain:
    - teaching/code-explainer
    - teaching/professor-mode
    - skills/documentation-writer
  budget: 1200
  quality_gates: [clarity, completeness]


  quality_gates: [security, completeness]

plan:
  chain:
    - core/planning-engine
    - skills/requirement-analyzer
    - skills/risk-analyzer
    - skills/task-planner
  budget: 2000
  quality_gates: [completeness]

document:
  chain:
    - skills/documentation-writer
    - skills/technical-writer
    - skills/readme-generator
  budget: 1500
  quality_gates: [clarity, completeness]

unknown:
  chain:
    - skills/requirement-analyzer
    - core/planning-engine
    - skills/software-architect
    - teaching/professor-mode
  budget: 2000
  quality_gates: [clarity, completeness]
```

---

## Decision Algorithm

```
function classify(input):
    input = normalize(input.lower())
    
    if keywords("create|new|start|build|init") AND keywords("project|app|system"):
        return "new_project"
    
    if keywords("bug|error|broken|fail|crash|exception|wrong|issue"):
        return "bug"
    
    if keywords("refactor|clean|extract|improve|restructure|rewrite"):
        return "refactor"
    
    if keywords("review|check|approve|validate|audit|pr|merge"):
        if keywords("security|vulnerability|owasp"):
            return "security_audit"
        return "review"
    
    if keywords("how|what|why|when|where|explain|mean|difference"):
        return "question"
    
    if keywords("teach|learn|train|understand|concept|mentor"):
        return "teach"
    
    if keywords("deploy|ci|cd|pipeline|infra|server|container|docker|kubernetes"):
        return "devops"
    
    if keywords("slow|fast|performance|optimize|benchmark|bottleneck|memory|cpu"):
        return "optimize"
    
    if keywords("test|coverage|spec|assert|mock|phpunit|pest|jest|pytest"):
        return "test"
    
    if keywords("plan|sprint|task|story|backlog|milestone|roadmap"):
        return "plan"
    
    if keywords("document|readme|docs|wiki|manual|guide"):
        return "document"
    
    if keywords("add|implement|feature|module|functionality|custom"):
        return "new_feature"
    
    if keywords("debug|stack|trace|null|undefined|ddd|var_dump|dd"):
        return "debug"
    
    return "unknown"
```

---

## Routing Protocol

```
1. Receive input
2. Normalize and tokenize
3. Run classification algorithm
4. If confidence < 70%:
    4a. Flag as "uncertain"
    4b. Append Context Engine clarification
    4c. Ask user for clarification
    4d. Re-classify with new input
5. Look up skill chain from matrix
6. Validate all chain dependencies are available
7. Check token budget (sum of all skills ≤ max)
8. If budget exceeded:
    8a. Activate Token Manager
    8b. Compress lower-priority skills in chain
9. Execute chain in order
10. Pass output to Quality Gates
```

---

## Rules

### Always

- ✅ Classify before acting.
- ✅ Validate dependencies before execution.
- ✅ Log every decision (input, classification, chain, confidence).
- ✅ If uncertain, ask for clarification.
- ✅ Respect token budget.

### Never

- ❌ Execute without classification.
- ❌ Skip dependency validation.
- ❌ Execute a chain that exceeds the token budget.
- ❌ Assume classification with confidence < 70%.
- ❌ Modify the chain matrix without reflection.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Classification accuracy | ≥ 90% | Compare classification vs user feedback |
| Chain execution success | 100% | Count failed executions |
| Clarification rate | ≤ 10% | Percent of inputs needing clarification |
| Budget compliance | 100% | Check no chain exceeds budget |
| Routing latency | < 100ms | Time from input to chain start |

---

## Quality Gates (Pre-Routing)

1. ✅ Input is not empty
2. ✅ Input language is supported
3. ✅ Classification returns a valid category
4. ✅ Chain exists for category
5. ✅ All dependencies in chain exist
6. ✅ Token budget sufficient

---

## Memory Hooks

```yaml
on_classify:
  - load: user_task_history (last 5)
  - load: project_context

on_route:
  - save: last_classification
  - save: chain_used

on_error:
  - save: classification_error
  - notify: Reflection Engine
```

---

## Token Budget

| Operation | Tokens |
|-----------|--------|
| Normalization | 20 |
| Classification | 100 |
| Chain lookup | 30 |
| Dependency validation | 40 |
| **Total per routing** | **190** |

---

## Reflection

### Pre-delivery

- [ ] Is the classification correct?
- [ ] Could this input match multiple categories?
- [ ] Is the chain optimal for this task?
- [ ] Is budget sufficient?

### Post-delivery

- [ ] Did the chain produce the expected output?
- [ ] Was any skill in the chain unnecessary?
- [ ] Should a new category be added?
- [ ] Should the chain matrix be updated?

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 15 task categories
- Keyword-based classification algorithm
- Skill chain matrix for all categories
- Confidence threshold at 70%
- Token budget enforcement
