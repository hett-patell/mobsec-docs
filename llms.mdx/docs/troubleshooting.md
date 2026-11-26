# Troubleshooting (/docs/troubleshooting)

Ordered by how often each one actually happens.

## The five-minute triage [#the-five-minute-triage]

```bash
pentestctl status            # which section is red?
pentestctl fix               # repairs reverse + frida
adb devices                  # is the emulator even up?
curl -s -x 127.0.0.1:18080 -o /dev/null -w '%{http_code}\n' https://example.org
tail -20 /tmp/mitm.log
```

If `pentestctl status` is green but the app is silent, the problem is almost always **inside the app** (dead proxy in a cached connection, app not restarted, wrong package).

## Symptom → cause [#symptom--cause]

| Symptom | Most likely cause | Fix |
|---|---|---|
| App spins forever, zero flows | `adb reverse` died on reboot | `nettap on` |
| Zero flows but `nettap status` says up | app cached a dead connection | force-stop + relaunch; `fspawn … intercept` |
| GMS/Play Store TLS errors in `/tmp/mitm.log` | Cert-Fixer didn't run this boot | reboot, then `pentestctl status \| grep Cert-Fixer` |
| `frida-ps` hangs or "unable to connect" | frida-server died | `adb shell su -c '/data/adb/fsrv/ctl start'` |
| `Failed to spawn` but package installed | wrong package name / user profile | `adb shell pm list packages \| grep -i name` |
| App crashes at startup under Frida | a script broke it | `fspawn <pkg> raw`, add scripts one at a time |
| `net_error -202` on every WebView page | whitelist denylist policy | `zygiskd denylist-policy default` (see below) |
| Attestation rejected (`4202`) after a keybox change | `target.txt` missing the package, or keybox revoked/expired | `pentestctl status \| grep keybox`, add package, force-stop app |
| `magisk -v` → `Cannot connect to daemon` | daemon segfaulted by a two-arg `--denylist rm` | reboot |
| Emulator won't boot after a bad snapshot | snapshot captured a broken mount | `snap boot` (cold), verify, `snap save <newname>` |
| A command you rely on suddenly behaves differently | a `~/mobsec/bin` helper shadows it (PATH order) | `pentestctl status` → *host commands*; rename the helper |

## Trap list (all hit for real here) [#trap-list-all-hit-for-real-here]

### 1. `adb reverse` does not survive a reboot [#1-adb-reverse-does-not-survive-a-reboot]
`settings put global http_proxy` **does**. Result: the app points at `127.0.0.1:18080` where nothing listens, and every request hangs with no error. `pentestctl fix` handles it.

### 2. `frida … < /dev/null` exits instantly [#2-frida---devnull-exits-instantly]
No tty → REPL dies. Use a fifo:
```bash
mkfifo /tmp/f; sleep 900 > /tmp/f &
fspawn <pkg> intercept < /tmp/f > /tmp/frida.log 2>&1 &
```

### 3. `pkill -f` kills your own shell [#3-pkill--f-kills-your-own-shell]
`pkill -f qemu-system` or `pkill -f 'frida -U -f pkg'` matches the `bash -c "<that command>"` wrapper and kills the invoking shell (exit 143). Record the PID and `kill <pid>`.

### 4. `magisk --denylist rm <pkg> <process>` segfaults magiskd [#4-magisk---denylist-rm-pkg-process-segfaults-magiskd]
Always one argument: `magisk --denylist rm <pkg>`. Recovery from the crash requires a reboot.

### 5. Whitelist denylist policy breaks WebView renderers [#5-whitelist-denylist-policy-breaks-webview-renderers]
`zygiskd denylist-policy whitelist` avoids injecting into non-listed apps, but renderer sandbox processes (`…:sandboxed_process0`, isolated uid) never match the package, so the CA and unpinning hooks are missing inside WebView → `SSL handshake failed; net_error -202`. Keep `default`.

### 6. `adb shell su -c '…'` mangles quotes and loops [#6-adb-shell-su--c--mangles-quotes-and-loops]
Multi-line snippets with `for`/`while` fail with `syntax error: unexpected 'do'`. Use `asu '…'`, which writes a script and runs it.

### 7. Don't grep `/data/adb/modules/zygisksu/` recursively [#7-dont-grep-dataadbmoduleszygisksu-recursively]
Its webroot has megabytes of i18n JSON and floods your terminal (and your context). Read specific files.

### 8. mitmproxy does not hot-reload addons [#8-mitmproxy-does-not-hot-reload-addons]
Edited `mitm/dump.py`? `nettap off && nettap on`, otherwise you keep the old behaviour (this is how a "fixed" filename bug appears unfixed).

### 9. PlayIntegrityFork v19 is arm-only [#9-playintegrityfork-v19-is-arm-only]
On x86_64 it silently never loads (`zygiskd status` stops listing `playintegrityfix`). Use the 4.9 x86_64 build.

### 10. Medusa's `shared_preferences` module kills WebView apps [#10-medusas-shared_preferences-module-kills-webview-apps]
`java.lang.NullPointerException … SharedPreferences$Editor.apply() on a null object reference` inside `WebViewChromiumFactoryProvider`. Not in any default profile.

## Recovery runbook [#recovery-runbook]

```bash
# 1. device
snap boot                     # or: snap load logged-in
adb wait-for-device
pentestctl status

# 2. root/modules
adb shell su -c 'zygiskd status'
adb shell su -c 'cat /data/adb/tricky_store/target.txt'
adb shell su -c 'grep -o "DeviceID=\"[^\"]*\"" /data/adb/tricky_store/keybox.xml'

# 3. frida
adb shell su -c '/data/adb/fsrv/ctl status' || adb shell su -c '/data/adb/fsrv/ctl start'
frida-ps -U | head -3

# 4. interception
nettap on
ls -t /tmp/mtflows/*.txt | head -2

# 5. CA trust for system apps
adb shell su -c 'tail -1 /data/local/tmp/cert-fixer.log'   # want "execution completed"
```

If step 5 is stale, reboot once — Cert-Fixer only mounts at `post-fs-data`.

## Logs worth knowing [#logs-worth-knowing]

| Log | What |
|---|---|
| `/tmp/mitm.log` | mitmdump stdout (`-v`), TLS failures, addon exceptions |
| `/tmp/mtflows/_err.log` | addon write failures |
| `/tmp/frida.log` | your `fspawn` output when run in background |
| `/data/local/tmp/cert-fixer.log` | CA mount result per boot |
| `adb logcat` | app crashes: `adb logcat -v time \| grep -iE 'AndroidRuntime\|FATAL'` |

## When nothing makes sense [#when-nothing-makes-sense]

Compare against a state you know worked:

```bash
snap load logged-in
pentestctl fix
fspawn tech.httptoolkit.pinning_demo intercept    # known-good pinning target
```

If the demo app also fails, the rig is broken. If only your target fails, the target has an additional defence — collect `fspawn … trace` output and read the `rootcheck`/`tls` lines before guessing.