---
tags:
  - Reference
---

# :material-file-document-multiple: Research Papers

<span class="pill pill-info">curated</span> <span class="pill pill-medium">distilled</span>

Papers worth your time — each distilled to **what it means on an engagement**, not
the academic abstract. Grouped by area. Read the one-liner; open the PDF when it's
relevant to what you're testing.

!!! abstract "Format"
    **Title** *(venue/year)* — the offensive-security relevance in one or two lines. `link`

## :material-robot: AI / LLM security

- **Universal and Transferable Adversarial Attacks on Aligned LMs (GCG)** *(2023)* —
  gradient-optimized suffixes that jailbreak across models; the basis of automated
  jailbreak tooling. [arXiv:2307.15043](https://arxiv.org/abs/2307.15043) · [AI Jailbreaks](../ai/jailbreaks.md)
- **Many-shot Jailbreaking** *(Anthropic, 2024)* — stuffing many fake Q&A pairs
  scales bypass rate with context length. Why long-context models need more, not
  less, guarding. [Anthropic research](https://www.anthropic.com/research/many-shot-jailbreaking)
- **Not what you've signed up for: Indirect Prompt Injection** *(2023)* — formalizes
  indirect injection via retrieved/tool content; the theoretical root of [Agent Abuse](../ai/agent-abuse.md). [arXiv:2302.12173](https://arxiv.org/abs/2302.12173)
- **Extracting Training Data from LLMs** *(2021)* — memorized-secret regurgitation;
  membership-inference and privacy impact. [arXiv:2012.07805](https://arxiv.org/abs/2012.07805)
- **OWASP Top 10 for LLM Applications** *(living)* — the field checklist; every
  [AI Hacking](../ai/index.md) page maps to it. [genai.owasp.org](https://genai.owasp.org/llm-top-10/)

## :material-web: Web & protocol

- **HTTP Request Smuggling Reborn / Browser-Powered Desync** *(Kettle, 2019/2022)* —
  the modern smuggling playbook. Direct input to [Request Smuggling](../web/request-smuggling.md). [PortSwigger research](https://portswigger.net/research/http-desync-attacks-request-smuggling-reborn)
- **Practical Web Cache Poisoning** *(Kettle, 2018)* — unkeyed inputs poison shared
  caches. [Web Cache Poisoning](../web/web-cache-poisoning.md). [PortSwigger](https://portswigger.net/research/practical-web-cache-poisoning)
- **Server-Side Template Injection** *(Kettle, 2015)* — the paper that defined
  [SSTI](../web/ssti.md) methodology. [PortSwigger](https://portswigger.net/research/server-side-template-injection)
- **Hidden OAuth Attack Vectors** *(2021)* — SSRF/ATO via OAuth flows → [OAuth & SAML](../web/oauth-saml.md). [PortSwigger](https://portswigger.net/research/hidden-oauth-attack-vectors)

## :material-microsoft-windows: Active Directory & Windows

- **Kerberoasting / "Attacking Kerberos"** *(Medin/Metcalf)* — SPN cracking; the
  basis of [Kerberos](../network/kerberos.md) attacks. [adsecurity.org](https://adsecurity.org/?p=2293)
- **Certified Pre-Owned (AD CS)** *(SpecterOps, 2021)* — the ESC1–ESC8 template
  abuses; essential for [AD CS](../network/adcs.md). [SpecterOps paper](https://specterops.io/wp-content/uploads/sites/3/2022/06/Certified_Pre-Owned.pdf)
- **A Guide to Attacking Domain Trusts** *(Schroeder, 2018)* — cross-trust
  escalation logic behind [BloodHound](../network/bloodhound.md). [blog.harmj0y](https://blog.harmj0y.net/redteaming/a-guide-to-attacking-domain-trusts/)

## :material-cloud: Cloud & container

- **A Security Analysis of AWS IMDS / SSRF-to-metadata** — why IMDSv2 exists; the
  [SSRF](../web/ssrf.md) → cloud pivot. [AWS IMDSv2 announcement](https://aws.amazon.com/blogs/security/defense-in-depth-open-firewalls-reverse-proxies-ssrf-vulnerabilities-ec2-instance-metadata-service/)
- **Container escape research (Leaky Vessels, etc.)** *(Snyk, 2024)* — runc/container
  breakout classes → [Container Escape](../cloud/containers.md). [Snyk research](https://snyk.io/blog/leaky-vessels-docker-runc-container-breakout-vulnerabilities/)

## :material-post-outline: Blogs & writeup collections

Not papers, but the practitioner writeups worth stealing technique from. Curated,
regularly-updated sources over one-off links.

- **[Beyond XSS / Web Frontend Security Universe](https://aszx87410.github.io/beyond-xss/en/)** —
  in-depth encyclopedia of client-side web attacks (`javascript:` URIs, mutation XSS,
  CSP bypasses). The reference for browser-side bugs → [XSS](../web/xss.md).
- **[CSPT → account takeover + 2FA bypass](https://whoareme.com/blog/cspt-account-takeover-2fa-bypass/)** —
  client-side path traversal chained into full ATO; a great worked example of the CSPT class.
- **[pac4j JWT auth bypass via public key](https://www.codeant.ai/security-research/pac4j-jwt-authentication-bypass-public-key)** —
  key-confusion in JWT verification → auth bypass → [OAuth & SAML](../web/oauth-saml.md).
- **[Grafana filter-bypass deep dive (CVE-2025-6023)](https://blog.ethiack.com/blog/grafana-cve-2025-6023-bypass-a-technical-deep-dive)** —
  how an n-day patch was bypassed; good template for variant analysis.
- **[Practical Android pentest — TikTok XSS→RCE](https://dphoeniixx.medium.com/practical-android-pentesting-a-case-study-on-tiktok-rce-4a82e79cc7c6)** —
  case study chaining a WebView XSS to remote code execution on mobile.
- **[HTB CWEE review & recommended boxes](https://almounah.github.io/posts/cwee-review/)** —
  the web-expert cert path with the boxes/labs to grind for advanced web.
- **[secengai labs](https://labs.secengai.com/)** — practical notes on using LLMs/AI in a
  pentest workflow → [AI Hacking](../ai/index.md).

## :material-book-open-page-variant: Where to find more

- [arXiv cs.CR](https://arxiv.org/list/cs.CR/recent) — cryptography & security preprints.
- [USENIX Security / IEEE S&P / ACM CCS](https://www.usenix.org/conferences) — top venues.
- [PortSwigger Research](https://portswigger.net/research) — practical web research.
- [Google Project Zero](https://googleprojectzero.blogspot.com/) — deep vuln research.
- [tl;dr sec](https://tldrsec.com/) — weekly digest that surfaces the good ones.

## :material-link-variant: Related

- These papers are the *why* behind pages in [Exploitation](../web/index.md), [AD](../network/active-directory.md), and [AI Hacking](../ai/index.md).
- Seen in the wild → [Bug Bounty Writeups](bug-bounty.md).
