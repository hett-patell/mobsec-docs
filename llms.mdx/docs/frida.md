# Frida & instrumentation (/docs/frida)

Frida is not "installed" here, it is **wired**: the agent autostarts as a Magisk module under a different name, listens on loopback only, and the host side is a set of script profiles that answer specific questions.

## The device side [#the-device-side]

| Piece | Path |
|---|---|
| Binary | `/data/adb/fsrv/hluda` (renamed `frida-server`, 17.27.5, x86_64) |
| Config | `/data/adb/fsrv/conf` → `AUTOSTART=1`, `LISTEN=127.0.0.1:27042` |
| Control | `/data/adb/fsrv/ctl start\|stop\|status` |
| Module | `/data/adb/modules/fsrv` (starts it from `service.sh`) |

```bash
adb shell su -c '/data/adb/fsrv/ctl status'     # running pid=2180 listen=127.0.0.1:27042
frida-ps -U | head
```

Renaming matters: the string `frida-server` and the default port `27042` are what most detectors grep for in `/proc/net/tcp`, process lists and file paths. `hluda` is what a heavily-used public build calls itself; on loopback it is also invisible to the LAN.

## The host side [#the-host-side]

`frida` + `frida-tools` 17.27.5 (pipx), `objection` available for quick jobs, and these wrappers:

```bash
fspawn <pkg> [profile] [frida args…]   # force-stop, spawn under frida with a script set
fdp [pkg] [port]                       # discover webview_devtools_remote_<pid>, adb forward
cdp url | eval "<js>" | watch [secs]   # Chrome DevTools Protocol client for the WebView
session                                # harvest cookies/localStorage/sessionStorage
```

### Profiles [#profiles]

| Profile | Scripts | Use it for |
|---|---|---|
| `trace` | core, webview-debug, rootcheck, tls | first look: what does this app touch, what does it check |
| `web` | core, webview-debug | WebView/Tauri/Cordova apps — enables CDP |
| `attest` | core, keystore | key generation, attestation challenge, chain dump |
| `spy` | core, webview-debug + 3 Medusa modules | anti-root bypass, OkHttp logging, SQLite queries |
| `intercept` | 9 HTTP Toolkit scripts | pinning bypass + proxy override + CA injection + root-detect off |
| `full` | everything local | kitchen sink; expect noise |
| `raw` | none | isolate whether a script is the problem |

### The local script set [#the-local-script-set]

| File | What it hooks |
|---|---|
| `00-core.js` | logging helpers on `globalThis`, process/arch info, a **filtered** exception handler (only reports faults in app-owned libs, capped at 5 — Frida 17 removed `global`; use `globalThis`) |
| `05-webview-debug.js` | `WebView.setWebContentsDebuggingEnabled(true)`, console messages, URL loads |
| `10-jni.js` | scans loaded classes for `tauri`/`plugin` classes, wraps methods, lists `libapp_lib.so` symbols matching `permanent_login|attest|secure_storage|plugin` |
| `20-keystore.js` | `KeyGenParameterSpec.setAttestationChallenge` / `setIsStrongBoxBacked`, `KeyStore.getCertificateChain` subject/issuer dump |
| `30-rootcheck.js` | `File.exists/canRead/canExecute/isFile/isDirectory` on su/magisk/frida/xposed paths, `Runtime.exec`, `getPackageInfo`, `Debug.isDebuggerConnected`, `Build` fields |
| `40-tls.js` | `SSLContext.init` trust managers, `NetworkSecurityPolicy`; `--bypass` = trust-all |

```bash
# with extra args, everything after the profile is passed to frida
fspawn com.example.app trace --runtime=v8
fspawn com.example.app raw -l ~/my-script.js
```

## Background runs [#background-runs]

Frida's REPL needs a tty. `frida -U -f pkg < /dev/null` exits immediately, and `pkill -f 'frida -U -f pkg'` can kill the shell that issued it. Use a fifo:

```bash
mkfifo /tmp/f; sleep 900 > /tmp/f &
fspawn com.example.app intercept < /tmp/f > /tmp/frida.log 2>&1 &
tail -f /tmp/frida.log
```

## WebView = CDP [#webview--cdp]

For hybrid apps this is the highest-value tool in the rig: no hooks, full DOM, console, network view and storage.

```bash
fspawn com.example.app web
fdp com.example.app          # pid=9918 socket=webview_devtools_remote_9918 -> http://127.0.0.1:9222
cdp url                      # {"id":…, "url":"https://app.example.com/chat", "title":"App"}
cdp eval "JSON.stringify(Object.keys(localStorage))"
cdp eval "document.cookie"
cdp watch 15                 # stream console + network events for 15 s
```

`session` uses the same channel to merge `document.cookie`, `localStorage` and `sessionStorage` with the newest captured `cookie` header (httpOnly cookies never show up in JS).

## Stolen modules (Medusa) [#stolen-modules-medusa]

`tools/medusa` is a vendored copy; `bin/medusa-export` converts its JSON modules into standalone JS:

```bash
medusa-export list
medusa-export export --set core      # writes frida/medusa/*.js
medusa-export export http_communications__okhttp3_retrofit
```

Medusa's modules assume the framework's helpers (`colorLog`, `Module.findExportByName`). The exporter injects a shim: `Color`, `colorLog`, `Options` defaults, `__mod('libc.so', …)`, plus Frida-17 polyfills for `Module.findExportByName` / `getExportByName`.

<Callout type="error" title="`file_system__shared_preferences` crashes WebView apps">
It replaces `getSharedPreferences()` globally and Chromium then dies with
`NullPointerException: … SharedPreferences$Editor.apply() on a null object reference`.
Keep it out of profiles for any app with a WebView; load it by hand only for native-only apps.
</Callout>

## When Frida itself is the problem [#when-frida-itself-is-the-problem]

| Symptom | Cause | Fix |
|---|---|---|
| `Failed to spawn: unable to find process` | package not installed / wrong user | `adb shell pm list packages \| grep name` |
| spawns then instantly detaches | script threw at load | run profile `raw`, then add scripts one by one |
| `access-violation` spam | the exception handler reporting ART's own SIGSEGVs | already filtered in `00-core.js`; check the PC is in an app lib |
| `frida-ps` hangs | server died (OOM, or killed by a detector) | `/data/adb/fsrv/ctl start` |