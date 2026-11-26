# Command reference (/docs/tooling)

Everything is in `~/mobsec/bin` (already on `PATH`). All commands assume the emulator is running.

## Health & control [#health--control]

### `pentestctl` [#pentestctl]
```bash
pentestctl status     # device, root, zygisk, attestation (keybox expiry!), frida, interception
pentestctl fix        # nettap on + restart frida-server; repairs reboot damage
```
Sections and what they read:

| Section | Source of truth |
|---|---|
| device | `adb shell getprop` |
| root | `su -c id`, `su -c magisk -v` |
| zygisk | `zygiskd status` |
| attestation | `/data/adb/tricky_store/{keybox.xml,target.txt}` + `kbcheck.py` |
| frida | `/data/adb/fsrv/ctl status` |
| interception | `/tmp/mitm.pid`, `adb reverse --list`, `settings get global http_proxy`, flow count, cert-fixer log |

### `nettap` [#nettap]
```bash
nettap on [port]      # mitmdump (idempotent) + adb reverse + global proxy
nettap off            # kill mitmdump, remove proxy/reverse
nettap status         # proxy, reverse, pid, addon path, flow count
```
Env: `ADDON` (dump.py), `FLOWDIR`, `INTEREST`, `PORT`. `nettap on` refuses to start if the addon or `mitmdump` is missing instead of dying silently.

### `snap` [#snap]
```bash
snap list             # snapshots + size + newest file mtime
snap save [name]      # default 'logged-in'
snap load [name]      # boots with -snapshot -no-snapshot-save (~25 s)
snap rm [name]
snap boot             # cold boot the AVD
```

## Frida [#frida]

### `fspawn <pkg> [profile] [frida args…]` [#fspawn-pkg-profile-frida-args]
Profiles: `trace` (default), `web`, `attest`, `spy`, `intercept`, `full`, `raw`. See [Frida](/docs/frida#profiles).
```bash
fspawn com.example.app intercept
fspawn com.example.app raw -l ~/hooks.js
```

### `fdp [pkg] [port]` [#fdp-pkg-port]
Finds `webview_devtools_remote_<pid>` in `/proc/net/unix` (auto-detects the foreground app when `pkg` is omitted), forwards `:9222`, prints the target list.

### `cdp url|eval "<js>"|watch [secs]` [#cdp-urleval-jswatch-secs]
Minimal CDP client (python3 + `websockets`). `eval` awaits promises; `watch` streams console/network events.

### `session` [#session]
```bash
session            # harvest -> ~/.mobsec/session/<ts>.json + latest.json
session show       # pretty-print
session cookie     # just the Cookie header value
```
Merges `document.cookie`, `localStorage`, `sessionStorage` from the WebView with the newest flow's cookie header (httpOnly cookies are invisible to JS). `TARGET=target session` restricts the page match.

### `medusa-export` [#medusa-export]
```bash
medusa-export list [filter]
medusa-export export NAME... | --set core|web|dump
medusa-export path NAME
```

## Traffic [#traffic]

### `replay` [#replay]
```bash
replay --grep 'chat/loadInitialData' --session
replay --grep X --patch 'a.b=42' --patch 'items[0].id=1' --dry
replay --grep X --method POST --path /other --body '{"q":"x"}'
replay --grep X --header 'x-test: 1' --remove-header cookie -x --full --save out.json
```
Defaults to exactly what the app sent (same headers, cookie, body). `-x` sends through mitmproxy (captured as evidence). `--save` writes the response body.

### `recon` [#recon]
```bash
recon <apk|package> [--deep] [-o DIR]
```
Writes `~/.mobsec/recon/<pkg>-<ts>/report.md` + `raw/`. See [Static recon](/docs/recon).

### `entry` [#entry]
Turns the manifest into copy-paste attack commands — one `adb shell am start|broadcast|content` line per exported component and deep link.
```bash
entry com.example.app                 # attack sheet
entry com.example.app --run            # and fire every probe
entry com.example.app --only links -o /tmp/sheet.txt
```
The sheet lists exported activities/services/receivers with their required permissions, content providers (including `exported=false` + `grantUriPermissions=true`), every `scheme://host` deep link, and `pm get-app-links` state.

### `pull-data` [#pull-data]
The honest replacement for `adb backup` (blocked on API 31+): root-tars the app's private dir, pulls it, and summarises.
```bash
pull-data com.example.app                 # -> ~/.mobsec/data/<pkg>/
pull-data com.example.app --sql           # + row counts for every sqlite db
pull-data com.example.app --grep token    # grep the pull
pull-data com.example.app --no-pull       # re-summarise only
```
Reports the biggest files, every SQLite database with tables/row counts, `shared_prefs` and JSON lines that look like secrets, and pulls `/sdcard/Android/data/<pkg>` too. Writes `summary.txt` next to the extracted tree.

## Attestation, integrity and hiding [#attestation-integrity-and-hiding]

### `setup-keybox.sh` / `keybox-refresh` [#setup-keyboxsh--keybox-refresh]
```bash
setup-keybox.sh --check                 # validate the installed keybox only
setup-keybox.sh --file my-keybox.xml    # install a local one
keybox-refresh [--force] [--min-days 7] [--dry-run]
```
`keybox-refresh` refreshes automatically only when the leaf is close to expiry or revoked, validates candidates with `kbcheck.py --strict`, and backs up the old keybox. It is wired to a systemd user timer. See [Attestation](/docs/attestation).

### `hma` [#hma]
Root-hiding scope editor for HMA-OSS (writes `config.json` over `su`, reloads live).
```bash
hma show
hma hide com.example.app [--presets root_apps,sus_apps] [--settings dev_options]
hma unhide com.example.app               # takes effect after a reboot
hma backup / hma restore
hma targets / hma presets
```
Un-hiding needs a reboot (uid cache); a `config.json` created *after* boot needs one reboot before it is watched. See [Root hiding](/docs/stealth).

### `integrity` [#integrity]
Play Integrity verdict from SPIC, scraped out of logcat.
```bash
integrity     # human-readable verdict
integrity --json     # raw JSON
```
Expect `UNEVALUATED` on this AVD — it is Google declining to grade an emulator with no account, not a rig failure. See [Play Integrity](/docs/integrity).

## Device helpers [#device-helpers]

### `asu` [#asu]
Runs a root shell snippet without the `adb shell su -c "…"` quoting nightmare:
```bash
asu 'for p in /data/adb/modules/*; do echo $p; done'
```

### `uitap` [#uitap]
Text-driven UI automation (`uiautomator dump` under the hood) — survives layout changes that break fixed coordinates:
```bash
uitap dump
uitap click "Login"
uitap click "^Allow$" --exact
uitap wait "Logged in" --timeout 20
```

### `apktool` [#apktool]
Wrapper around the pinned `apktool_3.0.3.jar` (`apktool d app.apk -o out`).

### `docs` [#docs]
The documentation site you are reading, served locally.
```bash
docs serve            # mkdocs serve on 127.0.0.1:8000 (background, pid in /tmp/mkdocs.pid)
docs serve --lan      # bind 0.0.0.0 so other machines can read it (needs a firewall rule, see below)
docs build            # mkdocs build --strict
docs status           # running? bound where? which URLs answer? firewall reminder
docs open | docs stop
```

For permanent LAN sharing there is a user unit, `mobsec-docs.service`
(`systemctl --user enable --now mobsec-docs`), and `sudo ufw allow 8000/tcp` once — `ufw`'s default
inbound policy is `DROP`, so a bound port is not a reachable port.

## Host environment [#host-environment]

```bash
java -version          # 21 (jadx/apktool/apkanalyzer)
frida --version        # 17.27.5
mitmdump --version     # 12.3.1
apkid / apkleaks / mobsfscan / objection / scrcpy / adb / emulator
python3 --version      # 3.12
```

## Cheat sheet [#cheat-sheet]

```bash
# the whole loop, one line each
snap load logged-in && pentestctl fix
nettap on
recon com.example.app --deep
fspawn com.example.app intercept
fdp && cdp url
session && replay --grep 'api/' --session --dry
```