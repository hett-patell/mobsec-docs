# Daily workflow

The loop that matters: **restore → verify → instrument → capture → replay → document.**

## 1. Restore a known-good state

```bash
snap load logged-in     # AVD snapshot: apps + logged-in session (~25 s)
pentestctl fix          # adb reverse dies on reboot; mitm addon may be down
pentestctl status       # read it, don't assume
```

If you changed anything device-wide (new module, new CA, new keybox), `snap save` a **new** snapshot name instead of overwriting `logged-in` — snapshots carry the mount state, and a stale snapshot can bring back a broken CA mount.

## 2. Start the capture

```bash
nettap on               # mitmdump + adb reverse + global proxy
```

`nettap on` is idempotent. For pinned apps you can even drop the global proxy afterwards (`adb shell settings put global http_proxy :0`) — `fspawn … intercept` redirects connections in-process, so capture continues.

## 3. Instrument, don't guess

```bash
fspawn com.example.app intercept    # pinning + CA injection + root-detect off
fspawn com.example.app trace        # core + rootcheck + TLS + WebView debug
fspawn com.example.app spy          # stolen Medusa modules (anti-root, okhttp, sqlite)
```

Rules of thumb:

- **WebView/Tauri/Cordova app?** You get 80% of the answer from `fdp` + `cdp eval` — DOM, storage, fetch wrappers, console. Do that before native hooking.
- **Native pinning / keystore work?** `intercept` first, then `trace`, then `full`.
- **Frida REPL needs a tty.** Backgrounded `frida` dies instantly if stdin is `/dev/null`; use a fifo (see [Frida](frida.md#background)).

## 4. Capture what the app sends

```bash
ls -t /tmp/mtflows/*.txt | head -5
cat "/tmp/mtflows/$(ls -t /tmp/mtflows | head -1)"
python3 - <<'PY'
import json
rows=[json.loads(l) for l in open('/tmp/mtflows/_index.jsonl')]
for r in rows[-12:]:
    print(r['status'], r['method'], r['host']+r['path'][:70])
PY
```

Flows are `<HHMMSS>_<host>_<path>.txt` with request headers/body and response headers/body, plus a machine-readable `_index.jsonl`. Full format: [Flows](flows.md).

## 5. Replay with intent

```bash
session                                   # harvest cookies + localStorage from the WebView
replay --grep 'chat/loadInitialData' --session
replay --grep 'chat/loadInitialData' --session --patch 'conversationId="other-user"' --dry
replay --grep 'auth/session' --patch 'userName="victim@corp"' -x
```

`--dry` prints the exact request without sending — use it every time before a `--patch`. `-x` sends through mitmproxy so the attempt is captured as evidence.

## 6. Document as you go

```bash
recon com.example.app --deep      # static report first, before dynamic testing
```

Then write findings with the evidence pointer (`flow file`, `timestamp`, `endpoint`, `repro command`). A finding without a repro command is a rumour.

## Session hygiene

- **One app at a time** on the emulator: `fdp` binds `:9222` and `fspawn` force-stops the package.
- Check `pentestctl status` after any reboot; `adb reverse` is always the first casualty.
- Long captures: `nettap status` prints flow count and the addon path, so you can tell "no traffic" from "addon not loaded".
- Credentials and tokens: keep them in `~/.mobsec/session/` (never in the repo, never in a screenshot).
