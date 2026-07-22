# Skill: Accessibility Reviewer

> Version 1.0.0 | Priority: Medium
> Dependencies: Frontend Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Accessibility Reviewer audits interfaces against WCAG 2.2 AA standards. Covers perceivable, operable, understandable, and robust principles.

---

## WCAG Principles

```yaml
perceivable:
  - All images have alt text
  - Captions for video content
  - Color not sole means of conveying info
  - Contrast ratio ≥ 4.5:1 (AA) or 3:1 (large text)
  
operable:
  - All functions available via keyboard
  - No keyboard traps
  - Skip navigation link
  - Touch targets ≥ 44x44px
  
understandable:
  - Page language defined (lang attribute)
  - Consistent navigation
  - Error suggestions provided
  - Input labels/purpose clear
  
robust:
  - Semantic HTML (landmarks, headings)
  - ARIA attributes valid and correct
  - Works with screen readers (NVDA, VoiceOver)
```

---

## Audit Tools

```yaml
automated:
  - axe-core (browser extension)
  - Lighthouse accessibility score
  - WAVE evaluation tool

manual:
  - Keyboard navigation (Tab through all interactive elements)
  - Screen reader (NVDA: Windows, VoiceOver: Mac)
  - Zoom to 200% (no content loss)
  - Reduced motion (prefers-reduced-motion)
```

---

## Changelog

### 1.0.0 — Initial release. WCAG principles, audit tools.
