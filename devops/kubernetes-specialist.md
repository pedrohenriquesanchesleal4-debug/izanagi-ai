# DevOps: Kubernetes Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Docker Expert, DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Kubernetes Specialist orchestrates containerized applications in production. Defines deployments, services, ingresses, configmaps, secrets, horizontal pod autoscaling, and service meshes.

---

## Minimal Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: app
  template:
    metadata:
      labels:
        app: app
    spec:
      containers:
        - name: app
          image: myapp:1.0.0
          ports:
            - containerPort: 9000
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 9000
---
apiVersion: v1
kind: Service
metadata:
  name: app
spec:
  selector:
    app: app
  ports:
    - port: 80
      targetPort: 9000
```

---

## Common Resources

```yaml
deployment: stateless apps, manages replicas and rolling updates
statefulset: stateful apps (databases), stable network identity
configmap: non-sensitive config (env vars, files)
secret: sensitive data (base64 encoded, external secret operator preferred)
ingress: HTTP routing, TLS termination
hpa: horizontal pod autoscaling (CPU/memory/custom metrics)
pdb: pod disruption budget (min available during updates)
```

---

## Changelog

### 1.0.0 — Initial release. Deployment template, resources.
