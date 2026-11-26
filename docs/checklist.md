# Pentest checklist (mapped to this rig)

This is the HackTricks/OWASP-MASTG Android checklist, rewritten as *"which command in this rig does that, and where does it stop working"*. Use it so you do not reinvent steps — and so you do not claim coverage the emulator cannot give you.

Legend: **✔** a command does it · **~** partial, read the note · **✘** impossible or pointless here.

## 1. Before you install anything (static)

| Check | Command | |
|---|---|---|
| What is it, who signed it, which SDKs | `recon app.apk` | ✔ |
| Obfuscation / packer / anti-VM hints | `recon` → Packers section (`apkid`) | ✔ |
| `APKiD` says `anti_vm` / `anti_debug` | verify by hand in jadx — it fires on Google/Firebase/Material library code | ~ |
| Secrets, API keys, endpoints in DEX/resources | `recon --deep`, then `apkleaks` section | ✔ |
| Rule-based SAST (Weak crypto, WebView, backup flags…) | `recon` → `mobsfscan` | ✔ |
| Manifest triage: exported components, deep links, `allowBackup`, `dataExtractionRules`, `networkSecurityConfig`, `usesCleartextTraffic`, `debuggable` | `recon` (summary) + `entry` (attack sheet) | ✔ |
| App Links / `assetlinks.json` | `entry` → "App links on this device" | ✔ |
| Native libs + CVEs | `apkanalyzer apk summary`, `unzip -l`; CVE mapping by hand | ~ |
| Cross-platform framework (Flutter/RN/Tauri/Cordova) | `find lib/ -name '*.so'`; Tauri = `libapp_lib.so` + remote web UI | ✔ |
| Decompile for source review | `jadx-gui app.apk` (or `apktool d`) | ✔ |
| Sideloaded/store differences | compare APKs from Play vs vendor — Play App Signing changes the signing key | ~ |

## 2. Install and get it running

| Check | Command | |
|---|---|---|
| Get past root/emulator detection | `fspawn <pkg> intercept` (HTTP Toolkit set: root detection off, pinning off, proxy overridden) | ✔ |
| Get past key attestation | `setup-keybox.sh` / `keybox-refresh`, target listed in `/data/adb/tricky_store/target.txt` | ✔ |
| Get past Play Integrity | see [Play Integrity](integrity.md) — not passable on an emulator | ✘ |
| Force the app to talk to you | `nettap on` (proxy + reverse + addon), then use the app | ✔ |
| Launch an exported activity/service/receiver | `entry <pkg> --run` | ✔ |
| See what it does with a URL | `entry <pkg> --only links` | ✔ |

## 3. Runtime: storage

| Check | Command | |
|---|---|---|
| Private dir, sqlite, prefs, webview store | `pull-data <pkg>` (`--sql`, `--grep`) | ✔ |
| What is *actually* in the databases | `sqlite3 ~/.mobsec/data/<pkg>/…/foo.db .dump` | ✔ |
| Session/refresh tokens at rest | `pull-data --grep token` → then decrypt by hand if needed | ✔ |
| Keystore-backed keys | `fspawn <pkg> attest` (`20-keystore.js` dumps subject/issuer of generated chains) | ✔ |
| "Keystore is hardware-backed" claim | KeyAttestation app → see [Attestation](attestation.md) | ✔ |
| `adb backup` extraction | blocked on API 31+ unless the app opts in; use `pull-data` instead | ~ |
| External storage / shared prefs | `pull-data` also pulls `/sdcard/Android/data/<pkg>` | ✔ |

## 4. Runtime: network

| Check | Command | |
|---|---|---|
| Full request set, decrypted | `nettap on` + `flows` (files in `/tmp/mtflows`, index in `_index.jsonl`) | ✔ |
| Pinning | `fspawn <pkg> intercept` | ✔ |
| Proxy-unaware / native traffic | same profile (in-process proxy override) | ✔ |
| WebSocket / GraphQL over WS | flows capture the handshake; `cdp watch` shows app-side messages | ~ |
| Edit and re-send a request | `replay --grep PATH --patch 'field=value'` | ✔ |
| IDOR / authz testing | `snap list` → clone the AVD, log in as user B (`ANDROID_SERIAL`), replay user A's requests | ~ |
| MQTT/gRPC/QUIC/bluetooth | nothing here terminates those; check the app's protocol first | ✘ |

## 5. Runtime: WebView / hybrid apps

| Check | Command | |
|---|---|---|
| DOM, localStorage, sessionStorage, cookies | `fdp` then `cdp eval 'location.href'` / `session harvest` | ✔ |
| Console + network of the web layer | `cdp watch 30` | ✔ |
| `addJavascriptInterface` bridges | `fspawn <pkg> web` shows console; grep the bundle for the bridge name | ~ |
| Client-side authz enforced in JS | read the bundle: `grep -o 'plugin:[^"]*' *.js` finds Tauri/Electron IPC commands | ✔ |
| Deep links into the web layer | `entry` + `cdp eval 'location.href="/route"'` | ✔ |

## 6. Runtime: components and injection

| Check | Command | |
|---|---|---|
| Exported components reachable, permission NOT enforced | `entry <pkg> --run`, watch logcat | ✔ |
| Content provider data leak | `entry` provider lines (`content query --uri …`) — note `exported=false` + `grantUriPermissions=true` needs a grant | ~ |
| Task hijacking / StrandHogg | needs a real launcher and a second malicious app — out of scope for this rig | ✘ |
| Tapjacking / overlay attacks | needs overlay permissions and a real UI; emulator OK but no template here | ✘ |
| Dynamic instrumentation | `fspawn <pkg> trace|attest|web|spy` | ✔ |
| Root/emulator checks firing | `fspawn <pkg> trace` → `30-rootcheck.js` prints each path/API queried | ✔ |

## 7. Server side (where the money usually is)

| Check | Command | |
|---|---|---|
| Endpoint inventory | `flows` index + `recon --deep` endpoints, diffed | ✔ |
| Authz: object ownership | `replay` with another user's ids | ✔ |
| Mass assignment / field injection | `replay --patch` | ✔ |
| Rate limits / lockout | `replay` in a loop, watch status codes | ✔ |
| MFA weaknesses | `session harvest` → inspect `/auth/session`-style endpoints for seeds/tokens | ✔ |
| Logout / session invalidation | `replay` the logout, then reuse the cookie | ✔ |

## 8. What this rig cannot tell you

- Anything hardware-backed that you did not spoof: sensors, Secure Element, StrongBox, real TEE behaviour.
- Play Integrity verdicts ([why](integrity.md)).
- Bluetooth, NFC, USB, SIM/telephony behaviour.
- OEM-specific bugs (the emulator is AOSP + Google image, no vendor blobs).
- Performance/timing side channels that depend on real CPU and memory pressure.
- Whether a leaked key matters — that is a server-side validation question, and the answer changes per target.

## Reporting habit

For every finding, keep the evidence triple: **the flow file** (`/tmp/mtflows/…txt`), **the replay command** that reproduces it, and **the app state** (which `snap` image, which user, which Frida profile). `_index.jsonl` plus a one-line `replay` command is the cheapest possible repro packet.
