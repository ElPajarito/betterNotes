"""
highlight_flags.py — MkDocs hook.

Pygments' bash lexer leaves command names, flags and arguments as *plain
unstyled text*, so shell code blocks look under-highlighted. This hook runs
after each page renders and colours those bare tokens:

    command            -> left neutral (the one thing that stays uncoloured)
    -l / --long / +x   -> <span class="pwn-flag">   (flags)
    file.txt / src/    -> <span class="pwn-arg">    (arguments, paths, …)

Only shell code blocks are processed (bash/sh/shell/zsh) so plaintext output
and other languages are untouched. A span stack tracks what's already inside a
Pygments token span, so tokens Pygments *did* colour (keywords, strings,
numbers, comments, command output) are never re-wrapped. Only text that is
directly inside a line span (`id="__span…"`) — i.e. genuinely bare — is styled.
"""

import re

# Shell block wrapper pymdownx emits (line_spans: __span). Captures the language.
_BLOCK_RE = re.compile(
    r'(?P<pre><div class="language-(?P<lang>[\w.+-]+)[^"]*highlight">\s*'
    r"<pre[^>]*><span></span><code[^>]*>)(?P<body>.*?)(?P<post></code></pre>)",
    re.S,
)
_SHELL = {"bash", "sh", "shell", "zsh"}

_TOKEN_RE = re.compile(r"<[^>]+>|[^<]+")
_ENT_RE = re.compile(r"&[a-z]+;")


def _wordish(text):
    """True if the token has a real alphanumeric (not just entities/punctuation)."""
    return bool(re.search(r"[A-Za-z0-9]", _ENT_RE.sub("", text)))


def _is_flag(word):
    return len(word) >= 2 and word[0] in "-+" and word[1].isalpha()


def _process(body):
    out = []
    stack = []          # open span kinds: "class" (Pygments token) | "line" | "other"
    expect_cmd = True   # next bare word begins a command -> stays neutral
    for tok in _TOKEN_RE.findall(body):
        if tok[0] == "<":
            if tok.startswith("</span"):
                if stack:
                    stack.pop()
            elif tok.startswith("<span"):
                if 'id="__span' in tok:
                    stack.append("line")
                elif "class=" in tok:
                    stack.append("class")
                else:
                    stack.append("other")
            elif tok.startswith("<a ") and "codelineno" in tok:
                expect_cmd = True   # a new source line starts here
            out.append(tok)
            continue

        # Text node. Leave it alone if it's inside a Pygments token span.
        if "class" in stack:
            out.append(tok)
            continue
        if tok.strip() == "":                    # whitespace / newline
            if "\n" in tok:
                expect_cmd = True
            out.append(tok)
            continue
        if not _wordish(tok):                    # bare punctuation: >  |  &&  ;
            out.append(tok)
            continue
        if expect_cmd:                           # first real word = command
            expect_cmd = False
            if not _is_flag(tok):                # (a leading flag isn't a command)
                out.append(tok)
                continue
        cls = "pwn-flag" if _is_flag(tok) else "pwn-arg"
        out.append('<span class="%s">%s</span>' % (cls, tok))
    return "".join(out)


def on_page_content(html, page, config, files):
    def repl(m):
        if m.group("lang") not in _SHELL:
            return m.group(0)
        return m.group("pre") + _process(m.group("body")) + m.group("post")

    return _BLOCK_RE.sub(repl, html)
