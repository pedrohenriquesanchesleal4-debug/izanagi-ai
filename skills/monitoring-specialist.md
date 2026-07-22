# Skill: Monitoring Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Observability Expert
> Compatibility: ">=1.0.0"

---

## Identity

Monitoring Specialist configures alerting rules, on-call rotations, runbooks, and incident response procedures.

---

## Alert Rules

```yaml
critical:
  - rule: "Error rate > 5% for 5 minutes"
    action: "Page on-call (PagerDuty/OpsGenie)"
    response: "15 minutes"
    
  - rule: "p99 latency > 2s for 5 minutes"
    action: "Page on-call"
    response: "15 minutes"
    
  - rule: "Service down (health check fails)"
    action: "Page on-call immediately"
    response: "5 minutes"

warning:
  - rule: "Error rate > 2% for 10 minutes"
    action: "Slack notification"
    
  - rule: "Disk > 80%"
    action: "Slack notification"
    
  - rule: "Slow query count > 10/minute"
    action: "Slack notification"
```

---

## Incident Response

```
1. DETECT — Alert fires or user reports
2. ACKNOWLEDGE — On-call person acknowledges (2 min)
3. ASSESS — What's the impact? How many users affected?
4. MITIGATE — Apply immediate fix (rollback, feature flag)
5. RESOLVE — Confirm service is healthy
6. POSTMORTEM — Within 24h: what happened? why? how to prevent?
```

---

## Changelog

### 1.0.0 — Initial release. Alert rules, incident response.
