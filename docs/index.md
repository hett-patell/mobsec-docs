# mobsec — an Android pentest rig that actually works

A rooted Android 16 emulator on this laptop, wired end to end: **HTTPS decrypted**, **Frida attached from the first instruction**, **root hidden**, and **hardware-backed key attestation spoofed** well enough that a real bank-grade server accepts the login.

Everything here runs locally. No cloud, no extra hardware, ~20 GB of disk.

!!! warning "Authorised testing only"
    The attestation layer makes this device claim to be a different physical phone, and the keybox in use is not ours. Use it against apps you are permitted to test. Nothing in this rig is anonymous: traffic goes out from your own IP.

## What you get

| Capability | How | Page |
|---|---|---|
| Android 16 x86_64 emulator, Play Store image | `pentest16` AVD (pixel_7, 6 GB RAM, 16 GB data) | [Quickstart](quickstart.md) |
| Root + Magisk modules | rootAVD + Magisk 31.1, Zygisk Next, TrickyStore, PIF 4.9, Cert-Fixer | [Architecture](architecture.md) |
| HTTPS interception for *every* app | mitmproxy + system CA bind-mounted into `conscrypt` | [Interception](interception.md) |
| Certificate pinning bypass | HTTP Toolkit script set via `fspawn … intercept` | [Interception](interception.md#pinning) |
| Frida, ready in one command | `frida-server` as a Magisk module + script profiles | [Frida](frida.md) |
| WebView DOM, console, storage access | Chrome DevTools Protocol over `adb forward` | [Frida](frida.md#webview) |
| Capture → edit → replay any request | `nettap` + `replay` harness | [Flows](flows.md) |
| Hardware key attestation spoofing | TrickyStore + a valid RKP keybox | [Attestation](attestation.md) |
| Root/emulator hiding | Zygisk denylist policy, anonymous memory, HMA-OSS scoped per target | [Root hiding](stealth.md) |
| Play Integrity verdicts, measured | `integrity` (drives SPIC, scrapes logcat) | [Play Integrity](integrity.md) |
| Exported components → ready-to-run adb commands | `entry` (manifest → attack sheet) | [Command reference](tooling.md#entry) |
| App private storage off the device | `pull-data` (root tar + sqlite/prefs summary) | [Command reference](tooling.md#pull-data) |
| A checklist that maps to these commands | HackTricks/MASTG in rig terms | [Pentest checklist](checklist.md) |
| Static APK recon in one command | `recon` (apkid + apkleaks + mobsfscan + jadx) | [Static recon](recon.md) |
| Instant return to a logged-in state | AVD snapshots | [Snapshots](snapshots.md) |

## 30-second health check

```bash
pentestctl status
```

```text
device        ok   emulator-5554  sdk_gphone64_x86_64  android 16 sdk 36
root          ok   uid=0(root) ... context=u:r:magisk:s0
zygisk        ok   inject_state=1  denylist_policy=0  enforce=1  memory=1
attestation   --   keybox DeviceID="RKP keybox. Join my group: …" (cosmetic)   ok   leaf valid until 2026-12-04 (8d left)
frida         ok   frida-server running pid=2180 listen=127.0.0.1:27042
interception  ok   mitmdump up   adb reverse ok   proxy 127.0.0.1:18080
```

If something is red, `pentestctl fix` repairs the two things that break on every reboot (`adb reverse` and the mitm addon), then see [Troubleshooting](troubleshooting.md).

## The one-paragraph mental model

The emulator boots a **Magisk-patched ramdisk**, so `su` works from the first second. Magisk loads three Zygisk modules that matter: **TrickyStore** fakes the hardware keystore's attestation chain for packages listed in `target.txt`, **PlayIntegrityFix** tries (and fails, on an emulator) to satisfy Play Integrity, and **Zygisk Next** does the injecting in anonymous memory. **Cert-Fixer** bind-mounts our mitmproxy CA into every process's trust store, including system ones. **frida-server** runs renamed as `hluda` under a small custom module, listening on loopback only. On the host, `nettap` keeps mitmproxy and the `adb reverse` tunnel alive, `fspawn` starts an app under Frida with a chosen script profile, and `replay` re-issues anything you captured.

## Where things live

```text
~/mobsec/                  the rig (this repo of scripts + docs)
├── bin/                   pentestctl, nettap, fspawn, fdp, cdp, session, replay, recon,
│                        entry, pull-data, integrity, hma, keybox-refresh, docs, snap, uitap, asu
├── frida/                 instrumentation scripts (+ httptoolkit/, medusa/)
├── mitm/                  dump.py addon (flow capture)
├── modules/               Magisk module zips
├── tools/                 frida-server, jadx, apktool, kbcheck.py, keybox roots
├── docs/                  this site
└── build/                 fsrv module (frida autostart)

~/Android/Sdk/             Android SDK (patched system image lives here)
~/.android/avd/pentest16*  the emulator
/tmp/mtflows/              captured flows (txt + _index.jsonl)
~/.mobsec/session/         harvested cookies/tokens
~/.mobsec/recon/           static analysis reports
```

## Start reading here

1. [Quickstart](quickstart.md) — a device that is already built, or build it from zero.
2. [Daily workflow](workflow.md) — the loop you will actually repeat.
3. [Architecture](architecture.md) — why each layer exists, and what breaks without it.
