---
tags:
  - Cloud
---

# :material-pipe: CI/CD & Supply Chain

<span class="pill pill-hard">keys to prod</span> <span class="pill pill-info">cloud</span>

Build pipelines hold cloud credentials, sign releases, and deploy to prod — and they run *your* code by design. Control the pipeline, control everything downstream.

!!! abstract "TL;DR"
    A writable pipeline definition or a `pull_request_target`-style trigger lets attacker code run with the pipeline's secrets. Dump env vars and the cloud role, then pivot.

## :material-target: Common footholds

- **Poisoned pipeline execution (PPE)** — edit `.github/workflows/*.yml`, `Jenkinsfile`, `.gitlab-ci.yml` in a branch/PR the runner executes.
- **Self-hosted runner takeover** — non-ephemeral runners keep secrets/caches between jobs.
- **Dependency confusion / typosquat** — publish a higher-version internal package name to a public registry.
- **Leaked tokens** in build logs, artifacts, or `git` history.

## :material-key: Steal the secrets

```bash
env | sort                                   # CI injects secrets as env vars
cat $GITHUB_ENV 2>/dev/null
# GitHub Actions OIDC → cloud role assumption
curl -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com"
```

!!! loot "Pipeline env = crown jewels"
    Registry creds, cloud deploy roles, signing keys, kubeconfigs — all commonly present in a single job's environment.

## :material-shield-check: Remediation

- Ephemeral, isolated runners; least-privilege OIDC (no long-lived cloud keys).
- Protect default branches; require review on workflow files; pin actions by SHA.

## :material-link-variant: Related

- Stolen cloud role → [AWS](aws.md) / [Azure](azure.md) / [GCP](gcp.md) escalation.
- Deploys into clusters → [Kubernetes](kubernetes.md).
- Reference: [OWASP CI/CD Top 10](https://owasp.org/www-project-top-10-ci-cd-security-risks/).
