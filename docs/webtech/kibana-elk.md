---
tags:
  - Web
---

# :material-elasticsearch: Kibana / ELK

<span class="pill pill-medium">log stack</span> <span class="pill pill-info">web</span>

The Elastic stack (Elasticsearch + Kibana + Logstash) often runs **unauthenticated**
on internal networks, exposing all indexed data — which frequently includes creds,
tokens, and PII from logs.

!!! abstract "TL;DR"
    Hit Elasticsearch (9200) unauth → dump indices → grep logs for secrets. Kibana
    (5601) → check version for the prototype-pollution/Timelion RCE CVEs.

## :material-magnify: Elasticsearch — 9200

```bash
curl -s http://$TARGET:9200                       # version + cluster (unauth = open)
curl -s http://$TARGET:9200/_cat/indices?v        # list all indices
curl -s "http://$TARGET:9200/<index>/_search?pretty&size=100"   # dump docs
curl -s "http://$TARGET:9200/_search?q=password&pretty"         # grep for secrets
```

!!! loot "Logs are full of secrets"
    Indexed request logs, app logs, and audit trails commonly contain passwords,
    API keys, session tokens, and internal hostnames. Search across indices for
    `password`, `authorization`, `token`, `secret`.

## :material-magnify: Kibana — 5601

```bash
curl -s http://$TARGET:5601/api/status | jq .version.number   # version
# unauth Kibana = read all the Elasticsearch data through the UI
```

## :material-fire: Kibana RCE CVEs

```text
# CVE-2019-7609 — Timelion prototype pollution → RCE (< 6.6.1 / 5.6.15)
# CVE-2018-17246 — Console plugin LFI → RCE via Canvas
# match version, then use the public PoC (spawns a reverse shell as kibana)
```

## :material-shield-check: Remediation

- Enable Elastic security (auth + TLS); never expose 9200/5601 to untrusted nets;
  patch Kibana; scrub secrets from logs before indexing.

## :material-link-variant: Related

- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md) (9200/5601).
- Looted creds → [Password Spraying](../network/password-spraying.md), [Credential Hunting](../privesc/credential-hunting.md).
- Reference: [HackTricks Elasticsearch](https://book.hacktricks.wiki/en/network-services-pentesting/9200-pentesting-elasticsearch.html).
