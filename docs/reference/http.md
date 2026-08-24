---
tags:
  - Reference
  - Web
---

# :material-web: HTTP Reference

<span class="pill pill-info">reference</span>

## :material-file-code: Standard HTTP headers

<https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers>

## :material-swap-horizontal: Methods

| Method | Description |
| --- | --- |
| `GET` | Requests a specific resource. Additional data can be passed to the server via query strings in the URL (e.g. `?param=value`). |
| `POST` | Sends data to the server. It can handle multiple types of input, such as text, PDFs, and other forms of binary data. This data is appended in the request body present after the headers. The POST method is commonly used when sending information (e.g. forms/logins) or uploading data to a website, such as images or documents. |
| `HEAD` | Requests the headers that would be returned if a GET request was made to the server. It doesn't return the request body and is usually made to check the response length before downloading resources. |
| `PUT` | Creates new resources on the server. Allowing this method without proper controls can lead to uploading malicious resources. |
| `DELETE` | Deletes an existing resource on the webserver. If not properly secured, can lead to Denial of Service (DoS) by deleting critical files on the web server. |
| `OPTIONS` | Returns information about the server, such as the methods accepted by it. |
| `PATCH` | Applies partial modifications to the resource at the specified location. |

## :material-numeric: Response codes

| Type | Description |
| --- | --- |
| `1xx` | Provides information and does not affect the processing of the request. |
| `2xx` | Returned when a request succeeds. |
| `3xx` | Returned when the server redirects the client. |
| `4xx` | Signifies improper requests `from the client`. For example, requesting a resource that doesn't exist or requesting a bad format. |
| `5xx` | Returned when there is some problem `with the HTTP server` itself. |

## :material-link-variant-plus: URL structure

```text
http://admin:password@inlanefreight.com:80/dashboard.php?login=true#status
└──┬──┘└──────┬──────┘└───────┬───────┘└┬┘└─────┬──────┘└────┬────┘└──┬──┘
scheme    user info         host      port    path         query  fragment
```

| Component | Example | Description |
| --- | --- | --- |
| `Scheme` | `http://` `https://` | This is used to identify the protocol being accessed by the client, and ends with a colon and a double slash (`://`) |
| `User Info` | `admin:password@` | This is an optional component that contains the credentials (separated by a colon `:`) used to authenticate to the host, and is separated from the host with an at sign (`@`) |
| `Host` | `inlanefreight.com` | The host signifies the resource location. This can be a hostname or an IP address |
| `Port` | `:80` | The `Port` is separated from the `Host` by a colon (`:`). If no port is specified, `http` schemes default to port `80` and `https` default to port `443` |
| `Path` | `/dashboard.php` | This points to the resource being accessed, which can be a file or a folder. If there is no path specified, the server returns the default index (e.g. `index.html`). |
| `Query String` | `?login=true` | The query string starts with a question mark (`?`), and consists of a parameter (e.g. `login`) and a value (e.g. `true`). Multiple parameters can be separated by an ampersand (`&`). |
| `Fragments` | `#status` | Fragments are processed by the browsers on the client-side to locate sections within the primary resource (e.g. a header or section on the page). |

## :material-link-variant: Related

- Cookie flags and `SameSite` values → [CSRF](../web/csrf.md#cookie-flags).
- Attack surface built on all of this → [Web Apps](../web/index.md).
