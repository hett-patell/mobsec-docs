# Live status

Snapshot taken **2026-11-24 20:10 IST** on the working rig. `pentestctl status` is the live truth — this page records what "green" looked like so you can tell drift from breakage.

## Platform

| Item | Value |
|---|---|
| Device | `emulator-5554`, `sdk_gphone64_x86_64`, Android **16** (API 36), Play Store image |
| AVD | `pentest16` — pixel_7 profile, 6 GB RAM, 4 vCPU, 16 GB data, KVM |
| Fingerprint | `google/sdk_gphone64_x86_64/emu64xa:16/BE2A.250530.026.D1/13818094:user/release-keys` |
| Root | Magisk **31.1** (`31.1:MAGISK:R`), `su` context `u:r:magisk:s0` |

## Modules

| Module | Id | State |
|---|---|---|
| Zygisk Next 1.5.3 | `zygisksu` | inject_state=1, policy=default, enforce=1, memory=anonymous |
| TrickyStore 1.4.1 | `tricky_store` | keybox from `RED-TEAM-KEYBOX` (DeviceID is a cosmetic upstream label), leaf valid until **2026-12-04** |
| PlayIntegrityFix 4.9 | `playintegrityfix` | loaded (x86_64-safe build) — verdict still NO_INTEGRITY |
| HMA-OSS | `hma_oss_zygisk` | loaded, **hide list empty** |
| Cert-Fixer 1.1 | `cert-fixer` | CA mounted this boot (GMS + Play Store trust mitm) |
| fsrv (ours) | `fsrv` | frida-server running as `hluda`, `127.0.0.1:27042` |
| LSPosed (Vector) | `zygisk_vector` | loaded, no Xposed modules in use |

## Host tools

| Tool | Version |
|---|---|
| frida / frida-tools | 17.27.5 |
| mitmproxy | 12.3.1 (`:18080`, `connection_strategy=lazy`) |
| jadx | 1.5.7 |
| apktool | 3.0.3 (jar wrapper) |
| apkid / apkleaks / mobsfscan | 3.2.0 / 2.6.3 / current |
| objection | 1.12.5 |
| scrcpy | 5.0.1 |
| Android SDK | cmdline-tools latest, platform-tools, build-tools 36.0.0, platforms;android-36 |

## Coverage at a glance

| Capability | State | Note |
|---|---|---|
| HTTPS interception, user apps | <span class="pill pill-ok">working</span> | 680+ flows captured |
| HTTPS interception, GMS/Play Store | <span class="pill pill-ok">working</span> | fixed by Cert-Fixer (post-fs-data mount) |
| Certificate pinning bypass | <span class="pill pill-ok">working</span> | verified against the OkHttp pinning demo |
| Frida spawn + hooking | <span class="pill pill-ok">working</span> | 7 profiles, Java + native hooks |
| WebView CDP | <span class="pill pill-ok">working</span> | `fdp` + `cdp` + `session` |
| Key attestation spoofing | <span class="pill pill-ok">working</span> | server accepted login with a 5-cert RKP chain |
| Root hiding (paths, memory, ports) | <span class="pill pill-ok">working</span> | anonymous memory, renamed agent |
| Package-list hiding (HMA-OSS) | <span class="pill pill-warn">not configured</span> | hide list empty |
| Play Integrity device verdict | <span class="pill pill-bad">not possible here</span> | emulator limitation; needs a physical device |
| Certificate transparency-pinned apps | <span class="pill pill-bad">unsupported</span> | known gap |

## Known-good invariants

```text
adb reverse --list               → host-16 tcp:18080 tcp:18080
settings get global http_proxy   → 127.0.0.1:18080
/data/adb/fsrv/ctl status        → running pid=<n> listen=127.0.0.1:27042
zygiskd status                   → modules64: 3,zygisk_vector,hma_oss_zygisk,playintegrityfix
magisk --denylist ls             → empty
```

If any of those drift, run `pentestctl fix` and read [Troubleshooting](troubleshooting.md).
