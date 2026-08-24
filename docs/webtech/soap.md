---
tags:
  - Web
---

# :material-xml: SOAP / Web Services

<span class="pill pill-medium">XML APIs</span> <span class="pill pill-info">web</span>

SOAP web services are XML-over-HTTP endpoints described by a **WSDL**. The WSDL hands
you the full method list, parameter types, and namespaces for free — then the usual
XML attack surface (XXE, injection, auth gaps) applies to each operation.

!!! abstract "TL;DR"
    Find the `?wsdl` → enumerate operations → build requests with the right
    `SOAPAction` header → test each parameter for injection and the parser for XXE.
    Legacy `.asmx`/`.svc` services often skip authz on individual methods.

## :material-magnify: Discover the service

```text
?wsdl   ?WSDL   ?singleWsdl        # append to the endpoint to get the contract
/service.asmx    /service.asmx?wsdl        # ASP.NET web service
/service.svc     /service.svc?wsdl         # WCF
/_vti_bin/spdisco.aspx                      # SharePoint disco (lists .asmx services)
```

The WSDL lists every `<operation>`, its input/output message schema, and the target
namespace — this is your method inventory.

## :material-send: Crafting requests

SOAP 1.1 needs a `SOAPAction` header; SOAP 1.2 puts the action in the content type:

```http
POST /service.asmx HTTP/1.1
Host: $TARGET
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://schemas.example.com/soap/SomeOperation"

<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SomeOperation xmlns="http://schemas.example.com/soap/">
      <param>value</param>
    </SomeOperation>
  </soap:Body>
</soap:Envelope>
```

## :material-bug: What to test

- **XXE** — SOAP bodies are XML; if the parser resolves entities you get file read /
  SSRF. Inject a `<!DOCTYPE>` with an external entity. See [XXE](../web/xxe.md).
- **Injection** — each operation parameter reaches back-end logic: test SQLi, command
  injection, path traversal per field. See [SQLi](../web/sqli.md).
- **Broken authz** — individual methods are often unprotected even when the app UI is
  authenticated; enumerate operations from the WSDL and call the sensitive ones
  directly (user/group listing, config, admin methods).
- **Info disclosure** — `?wsdl` and SOAP faults leak internal namespaces, types, stack
  traces, and back-end paths.

!!! loot "The WSDL is a free API map"
    Every operation, parameter, and type is documented in the contract — you never
    have to guess. Import it into Burp (WSDLer / Content Discovery) or SoapUI to
    auto-generate test requests for each method.

## :material-tools: Tooling

```text
SoapUI / Postman         # import WSDL → generate + fuzz requests
Burp + Wsdler extension  # parse WSDL, send operations to Repeater/Intruder
```

## :material-link-variant: Related

- Underpins [SharePoint](sharepoint.md) web services and [SAP](sap.md) SOAP endpoints.
- Core primitives: [XXE](../web/xxe.md), [SQLi](../web/sqli.md), [Command Injection](../web/command-injection.md).
- Reference: [PortSwigger XXE](https://portswigger.net/web-security/xxe).
