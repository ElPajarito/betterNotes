---
tags:
  - Linux
  - Reference
---

# :material-console-line: Bash Tips & Shortcuts

<span class="pill pill-medium">speed</span> <span class="pill pill-info">quality of life</span>

The shell tricks that make you fast: redirection, history, loops, and the keyboard shortcuts that stop you retyping lines.

!!! abstract "TL;DR"
    `>`/`>>`/`2>&1` redirect, `|` pipe, `$(...)` capture output, `Ctrl-R` search history, `!!`/`!$` reuse the last command/arg, `for` loops for repetition.

## :material-arrow-right-bold: Redirection

```bash
cmd > out.txt          # stdout → file (overwrite)
cmd >> out.txt         # stdout → file (append)
cmd 2> err.txt         # stderr → file
cmd > all.txt 2>&1     # stdout AND stderr → one file
cmd 2>/dev/null        # discard errors
cmd | tee out.txt      # see output AND save it
```

## :material-history: History reuse

```bash
history                # numbered list of past commands
!!                     # the entire last command
sudo !!                # re-run it with sudo
!$                     # last argument of the previous command
!123                   # run history item 123
Ctrl-R                 # reverse-search history as you type
```

## :material-variable: Variables & substitution

```bash
name="world"; echo "hi $name"    # use "double quotes" to expand
echo '$name is literal'          # 'single quotes' = no expansion
files=$(ls *.txt)                # capture command output
echo "today is $(date +%F)"      # inline a command
export API_KEY=xyz               # pass to child processes
```

## :material-repeat: Loops & xargs

```bash
for i in 1 2 3; do echo "host$i"; done
for f in *.log; do gzip "$f"; done
seq 1 5 | while read n; do echo "n=$n"; done
cat urls.txt | xargs -n1 curl -sI   # run a command per line
find . -name '*.tmp' | xargs rm     # feed results into a command
```

## :material-keyboard: Keyboard shortcuts

| Keys | Does |
| --- | --- |
| ++ctrl+a++ / ++ctrl+e++ | Jump to start / end of line |
| ++ctrl+u++ / ++ctrl+k++ | Delete to start / end of line |
| ++ctrl+w++ | Delete the word before the cursor |
| ++ctrl+l++ | Clear the screen (like `clear`) |
| ++ctrl+r++ | Search command history |
| ++ctrl+c++ / ++ctrl+d++ | Cancel command / send EOF (logout) |
| ++alt+"."++ | Insert last argument of previous command |

!!! tip "Chaining commands"
    `a && b` runs `b` only if `a` succeeded. `a || b` runs `b` only if `a` failed. `a ; b` runs both regardless. Great for `make && ./run || echo FAILED`.

## :material-link-variant: Related

- Feeding output into filters → [Text Processing](text.md).
- Persistent aliases live in `~/.bashrc` / `~/.zshrc`.
