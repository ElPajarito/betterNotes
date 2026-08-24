---
tags:
  - Reference
---

# :material-file-search: Code Review

<span class="pill pill-medium">whitebox</span> <span class="pill pill-info">cheatsheet</span>

Reading source is faster than fuzzing it. The trick is to grep straight for the dangerous sinks, then trace user input backwards to see if anything actually sanitizes it before it lands there.

!!! abstract "TL;DR"
    Grep for each language's dangerous sinks (exec, deserialize, file open, raw SQL, template render), then walk the taint path from request → sink. If nothing normalizes/validates on that path, you have a bug.

## :material-language-go: Go

Grep for: `exec.Command` `os.Open`/`os.OpenFile` `template.HTML` `html/template` vs `text/template` `Sprintf`+SQL `ioutil.TempFile` `hmac`.

```text
os.Open("/base/"+userInput)     # path traversal if user controls the tail
exec.Command("sh","-c", user)   # command injection
text/template                   # NO auto-escaping (html/template does escape)
db.Query(fmt.Sprintf(...))      # SQLi — use parameterized queries
```

!!! danger "Filter/sink parameter mismatch"
    A validator that reads the param one way while the sink reads it another way is a bypass. Example: `filter()` checks `r.URL.Query().Get("path")` for `..`, but `serveFile()` reads `r.FormValue("path")` — a POST body param sails past the query-string check straight into `os.Open`.

!!! danger "TempFile with attacker filename"
    `ioutil.TempFile("/tmp", header.Filename)` puts the uploaded filename into the temp path suffix. Attacker controls part of the path/extension.

!!! danger "HMAC with no field delimiter"
    Concatenating fields before signing (`user+strconv.Itoa(amount)` → `"alice"+"20"`) is ambiguous: `("alice","20")` and `("alice2","0")` both hash `"alice20"` and produce the same signature. Always delimit fields before MAC-ing.

## :material-language-javascript: JavaScript / TypeScript

Grep for: `eval` `Function(` `child_process` `exec(` `res.send(`/`res.write(` `dangerouslySetInnerHTML` `require(` with a variable `vm.runInContext` `new RegExp(`.

```text
eval(userInput) / new Function(userInput)   # RCE
child_process.exec(user)                     # command injection (use execFile)
res.send(fetchContent(req.query.domain))     # SSRF / injection if unvalidated
element.innerHTML = user                     # DOM XSS
```

!!! danger "Log injection"
    `console.log("Access to fetch: " + req.query.path)` with no sanitization lets an attacker inject newlines and forge extra log lines (log forging / poisoning).

!!! danger "ReDoS via nested quantifiers"
    A regex like `^dev-(\w+)+\d+\.example\.com$` has nested quantifiers `(\w+)+` plus a trailing `\d+`. Input such as `dev-aaaaa11111.example.com` forces catastrophic backtracking — the engine tries exponentially many ways to split the string, spiking CPU and hanging the server. Grep for `(...+)+`, `(...*)*`, and `(a|a)*` patterns fed with user input.

## :material-language-php: PHP

Grep for: `eval` `system`/`exec`/`shell_exec`/`passthru`/`popen` `include`/`require` with a variable `unserialize` `assert` `preg_replace` with `/e` `extract` `$$` (variable variables) `==` on hashes/tokens.

```text
include($_GET['page'])          # LFI/RFI
unserialize($_POST['data'])     # object injection
system($_GET['cmd'])            # command injection
if ($hash == $known)            # type-juggling — use === (and hash_equals)
```

!!! danger "Signature bypass via missing param"
    ```php
    if (isset($_GET["data"]) && sign($_GET["data"]) === $_GET["signature"]) { ... }
    ```
    O código só verifica que `data` existe. Se `data` for `null`, a `signature` calculada também é `null` — retira-se o parâmetro `signature` da request e `null === null` passa. Loose typing + missing-parameter = auth/signature bypass.

## :material-language-python: Python

Grep for: `eval`/`exec` `os.system`/`subprocess` with `shell=True` `pickle.loads` `yaml.load` (non-safe) `open(` with user input `subprocess.call([... user ...])` `__import__` `input()` (py2) `format`/f-strings into SQL or templates.

```text
open(userControlledPath)        # path traversal
pickle.loads(user)              # RCE
yaml.load(user)                 # RCE — use yaml.safe_load
subprocess.call(cmd, shell=True)# command injection
```

!!! danger "open() on a cookie value"
    ```python
    username = open(cookies.get('session_id').value).readlines()[0]
    ```
    Sem restrição de diretoria: `session_id=../../../etc/passwd` faz `open()` ler ficheiros arbitrários (path traversal → arbitrary file read).

## :material-language-ruby: Ruby

Grep for: `eval`/`instance_eval`/`class_eval` `system`/`` ` `` (backticks)/`%x` `exec` `open(` (Kernel#open pipe trick) `Marshal.load` `YAML.load` `send`/`public_send` with user input `constantize` `render inline:`.

```text
system("... #{params[:x]} ...")  # command injection
open("| #{user}")                # Kernel#open runs commands on leading '|'
Marshal.load(user) / YAML.load   # deserialization RCE
obj.send(params[:method])        # arbitrary method invocation
eval(params[:code])              # RCE
```

## :material-magnify: Review workflow

- Enumerate every entry point (routes, handlers, `req.query`/`$_GET`/`params`/`r.FormValue`).
- Grep the sink list above; for each hit, trace the argument back to input.
- Flag anything where validation and the sink read input differently, or where types can be coerced (`==`, `null`, loose comparisons).
- Note secrets, hardcoded keys, and MAC/signature construction — delimiter and comparison bugs are common and high-impact.

## :material-link-variant: Related

- Confirm findings dynamically → [Command Injection](../web/command-injection.md), [SQLi](../web/sqli.md), [Deserialization](../web/deserialization.md), [SSTI](../web/ssti.md).
- Grep tooling for large codebases → [Text Processing](text.md).
