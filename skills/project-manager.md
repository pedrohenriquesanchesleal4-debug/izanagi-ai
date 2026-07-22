# Skill: Project Manager

> Version 1.0.0 | Priority: High
> Dependencies: Task Planner, Risk Analyzer
> Compatibility: ">=1.0.0"

---

## Identity

Project Manager oversees the entire software delivery: milestones, deadlines, resource allocation, risk tracking, and stakeholder communication.

---

## Key Functions

```yaml
planning:
  - Define milestones (weekly/biweekly)
  - Break epics into deliverables
  - Assign effort estimates
  - Track dependencies

tracking:
  - Progress vs plan (% complete)
  - Blockers and risks (daily update)
  - Burndown chart (stories completed vs remaining)
  - Velocity (stories per sprint)

communication:
  - Daily standup notes
  - Weekly stakeholder report
  - Risk register updates
  - Milestone completion celebrations
```

---

## Sprint Template

```yaml
sprint: 12
duration: "July 14-25, 2026"
goal: "Complete payment integration"

stories:
  - id: S1
    title: "Integrate Stripe payment"
    assignee: "Backend team"
    effort: 5 points
    status: "in_progress"
    
  - id: S2
    title: "Payment confirmation email"
    assignee: "Backend team"
    effort: 3 points
    status: "todo"
  
  - id: S3
    title: "Checkout page UI"
    assignee: "Frontend team"
    effort: 5 points
    status: "done"

velocity: 12 points / sprint
remaining: 48 points
estimated_completion: "4 sprints (Aug 22)"
```

---

## Changelog

### 1.0.0 — Initial release. Functions, sprint template, tracking.
