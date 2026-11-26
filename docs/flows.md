# Captured flows & replay

Every interesting request on the device ends up as a file in `/tmp/mtflows` (change with `FLOWDIR`). Those files are the raw material for everything else: analysis, replay, fuzzing, evidence.

## Format

One file per flow, named `<HHMMSS>_<host>_<path>.txt`:

```text
POST https://crmbff.example.com/auth/mobile/login

--REQ HEADERS--
Headers[(b'content-type', b'application/json'), (b'cookie', b'mtpo.crm=…'), …]

--REQ BODY--
{"userName":"…","password":"…","attestation":{"chain":[ … ]}}

--RESP 200--
Headers[(b'content-type', b'application/json'), …]

--RESP BODY--
{"code":2000,"data":{…}}
```

Notes:

- The headers block is mitmproxy's `Headers` repr on **one line** — parse with `ast.literal_eval` after stripping the `Headers` prefix (that is what `replay` does).
- Bodies are truncated at `MAXBODY` (20 000 bytes) but the index records the real lengths.
- Two hosts with the same path no longer collide: the host is part of the name, and a `-2`/`-3` suffix is added if the same second produces the same host+path.
- Names carry no date (only `HHMMSS`), so **never sort flows by name across days** — `session`, `replay` and `snap` sort by mtime.

## The index

```bash
tail -3 /tmp/mtflows/_index.jsonl
```

```json
{"ts": 1795530833, "file": "200353_example_com__.txt", "host": "example.com", "method": "GET", "path": "/s.js", "status": 200, "req_len": 0, "resp_len": 1379}
```

Quick analysis:

```bash
# API surface, most frequent first
jq -r '"\(.method) \(.host)\(.path)"' /tmp/mtflows/_index.jsonl | sed 's/[0-9a-f]\{8,\}/<id>/g' | sort | uniq -c | sort -rn | head -30

# errors only
jq -r 'select(.status >= 400) | "\(.status) \(.method) \(.host)\(.path)"' /tmp/mtflows/_index.jsonl | sort | uniq -c | sort -rn

# what got sent where with a body
jq -r 'select(.req_len > 0) | "\(.req_len) \(.method) \(.host)\(.path)"' /tmp/mtflows/_index.jsonl | sort -rn | head
```

## Replay

`replay` re-issues a captured request from the host, defaulting to *exactly* what the app sent, with explicit overrides:

```bash
replay --grep 'auth/session'                      # newest match
replay --grep 'auth/session' --session            # inject harvested cookie
replay --grep 'auth/session' --dry                # print, do not send
replay --grep 'chat/messages' --patch 'conversationId="<other>"'   # IDOR probe
replay --grep X --remove-header authorization --dry
replay --grep X -x                                # through mitmproxy → new flow
```

Patch syntax is a small JSONPath: `a.b`, `items[0].id`, `a.b[2].c`. Values are parsed as JSON when possible (`42`, `true`, `"str"`), else kept as strings.

Every `--patch` run should start with `--dry`. It prints the method, URL, headers and the first 300 bytes of body — enough to catch a typo before you send something destructive to a production backend.

## Why this beats Burp here

- **Same headers** as the app, including device-specific ones and the cookie jar state at capture time.
- **Attestation-friendly**: capture the login once, replay everything else; you never need a fresh keystore challenge for non-login endpoints.
- **Evidence-friendly**: `-x` re-sends through mitmproxy, so the attempt lands in the same flow corpus with a timestamp.

## Token harvesting

`session` merges the WebView's `document.cookie`, `localStorage` and `sessionStorage` with the newest captured `Cookie` header (httpOnly cookies are invisible to JS):

```bash
session              # writes ~/.mobsec/session/<ts>.json and latest.json
session show
replay --grep 'chat/loadInitialData' --session
```

Storage layout:

```json
{"cdp": {"url": "…", "cookie": "…", "localStorage": {…}, "sessionStorage": {…}},
 "flow": {"file": "…", "cookie": "…"}}
```

## Spotting the interesting things

Patterns worth grepping for in a fresh corpus:

```bash
grep -rlE '"(role|isAdmin|permissions)"' /tmp/mtflows/*.txt | head
grep -rl 'secret\|token\|otp\|mfa' /tmp/mtflows/*.txt | head
grep -rhoE '"https?://[^"]+"' /tmp/mtflows/*.txt | sort -u | head -40      # third-party surface
grep -rh 'set-cookie' /tmp/mtflows/*.txt | sort -u | head                  # flags: HttpOnly? Secure? SameSite?
```

And the classic: compare what a **low-privilege** account gets versus a **high-privilege** one for the same endpoint — same request, two cookies, diff the bodies.
