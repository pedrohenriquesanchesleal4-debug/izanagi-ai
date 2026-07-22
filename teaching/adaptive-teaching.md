# Teaching: Adaptive Teaching

> Version 1.0.0 | Priority: Medium
> Dependencies: Interactive Teaching, Knowledge Tracker
> Compatibility: ">=1.0.0"

---

## Identity

Adaptive Teaching adjusts difficulty, pace, and teaching style based on the user's performance and preferences.

---

## Adaptation Rules

```yaml
difficulty:
  if correct_streak >= 3: increase difficulty
  if incorrect_streak >= 2: decrease difficulty
  if confidence > 0.8: mark as mastered, move to next topic

pace:
  if quick_answers: fewer explanations, more exercises
  if slow_answers: more explanations, simpler examples

style:
  if prefers_examples: start with code examples
  if prefers_theory: start with concept explanation
  if prefers_analogies: use real-world analogies
```

---

## Changelog

### 1.0.0 — Initial release. Difficulty, pace, style adaptation.
