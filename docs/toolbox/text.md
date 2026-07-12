---
tags:
  - Linux
  - Reference
---

# :material-text-search: Text Processing

<span class="pill pill-medium">high leverage</span> <span class="pill pill-info">pipes</span>

Reading, filtering, and reshaping text is the core Unix superpower. Chain small tools with `|` and you can carve any output into exactly what you need.

!!! abstract "TL;DR"
    `grep` find lines, `sed` edit lines, `awk` work with columns, `cut` split by delimiter, `sort | uniq -c` count, `tail -f` follow a file live.

## :material-eye: Viewing

```bash
cat file            # dump whole file
less file           # page through (q to quit, / to search)
head -n 20 file     # first 20 lines
tail -n 50 file     # last 50 lines
tail -f app.log     # follow live as it grows
```

## :material-filter: grep — find lines

```bash
grep "error" app.log            # matching lines
grep -i "error" app.log         # case-insensitive
grep -rn "TODO" src/            # recursive + line numbers
grep -v "debug" app.log         # INVERT: lines NOT matching
grep -E "warn|error" app.log    # regex alternation
grep -o "[0-9]\{1,3\}\.[0-9...]" # -o = print only the match
grep -A3 -B1 "panic" app.log    # 3 lines after, 1 before context
```

## :material-swap-horizontal: sed & awk

=== "sed — substitute / edit"

    ```bash
    sed 's/foo/bar/g' file        # replace all foo with bar
    sed -i 's/foo/bar/g' file     # edit the file in place
    sed -n '10,20p' file          # print only lines 10-20
    sed '/^#/d' file              # delete comment lines
    ```

=== "awk — columns"

    ```bash
    awk '{print $1}' file           # first whitespace column
    awk -F: '{print $1}' /etc/passwd  # split on ':'
    awk '$3 > 1000' data            # rows where col 3 > 1000
    awk '{sum+=$1} END{print sum}'  # sum a column
    ```

## :material-sort: Slice, sort, count

```bash
cut -d: -f1 /etc/passwd       # field 1, delimiter ':'
sort file | uniq              # dedupe (must sort first)
sort file | uniq -c | sort -rn  # count + rank most common
tr 'a-z' 'A-Z' < file         # transliterate to uppercase
wc -l file                    # count lines
```

!!! tip "The pattern"
    Most real work is a pipeline: `cat access.log | grep 404 | awk '{print $1}' | sort | uniq -c | sort -rn`  → "which IPs hit missing pages the most."

## :material-link-variant: Related

- Parsing recon/scan output → [Network Recon](../network/recon.md).
- Redirection and `xargs` that feed these tools → [Bash Tips](bash.md).
