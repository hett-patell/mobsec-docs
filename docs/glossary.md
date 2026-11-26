# Glossary

**adb reverse** — forwards a port on the *device* to the host. Used so the app can reach mitmproxy on `127.0.0.1:18080` without a LAN proxy. Dies on every reboot.

**Attestation chain** — certificate chain returned by the Android keystore for a generated key: leaf (app key) → TEE intermediate → Droid CA → Google root. Encodes device identity, lock state and verified-boot status.

**AVD** — Android Virtual Device. Here: `pentest16`, pixel_7 profile, API 36 Play Store image.

**Bootloader locked / verified boot** — properties the server can read from the attestation extension. TrickyStore's keybox decides what the server sees.

**CDP** — Chrome DevTools Protocol. Over `adb forward :9222` it gives DOM, console, storage and network for any debuggable WebView.

**Cert-Fixer** — Magisk module that bind-mounts user CAs into `/apex/com.android.conscrypt/cacerts` at `post-fs-data`, so system apps (GMS, Play Store) trust mitmproxy.

**conscrypt** — Android's TLS provider and the place the system trust store lives since Android 14 (moved out of `/system/etc/security/cacerts`).

**denylist (Magisk)** — packages that get *no* module injection. Empty in this rig on purpose: TrickyStore/PIF must reach the target app.

**denylist policy (Zygisk Next)** — `default` (inject everywhere except denylisted) or `whitelist` (inject only listed). Whitelist breaks WebView renderer sandboxes.

**frida-server** — the on-device agent. Here renamed `hluda`, autostarted by the `fsrv` Magisk module, listening on loopback only.

**gadget** — Frida's injectable library for non-rooted devices; requires patching and re-signing the APK, which changes its signature. Not used here.

**HMA-OSS** — "Hide My Applist" fork: hides installed packages from a target app's enumeration. Installed, hide list empty.

**keybox.xml** — TrickyStore's replacement cert+key material: EC and/or RSA chains plus private keys. Must be hardware (RKP), unexpired and unrevoked.

**keybox revocation list** — Google's published serial blacklist at `android.googleapis.com/attestation/status`. Server-side check; cannot be spoofed locally.

**KVM** — kernel virtual machine; `/dev/kvm` + `kvm` group membership makes the emulator usable.

**Magisk** — systemless root. Version 31.1 here, applied to the system image's ramdisk via rootAVD.

**mitmproxy / mitmdump** — the intercepting proxy. `mitm/dump.py` addon writes one file per flow.

**Play Integrity (PI)** — Google's app-level integrity API (device/app/account verdicts). Emulator → `NO_INTEGRITY`; not solvable here.

**PIF (PlayIntegrityFix)** — module that tries to satisfy PI by spoofing props; on an emulator it still fails.

**post-fs-data** — earliest Magisk boot stage; where Cert-Fixer mounts CAs.

**RKP** — Remote Key Provisioning. Modern hardware attestation where keys/certs are provisioned by Google per device.

**rootAVD** — script that patches an AVD's `ramdisk.img` with Magisk; modifies the system image, not the AVD config.

**snapshot (AVD)** — full VM state save/restore (`adb emu avd snapshot save`). ~5 GB, ~25 s restore.

**TrickyStore** — Zygisk module that substitutes keystore attestation chains for packages in `target.txt` using `keybox.xml`.

**TEE** — Trusted Execution Environment; hardware side that produces attestation. Emulators fake it (`teeBroken=true`).

**Zygisk** — Magisk's code-injection mechanism into zygote-spawned apps. Disabled in Magisk itself here; **Zygisk Next** provides it.

**zygiskd** — Zygisk Next's control CLI (`status`, `enforce-denylist`, `denylist-policy`, `memory-type`).

**`Zygisk-Assistant`** — popular root-hiding module. Not used: it requires targets in Magisk's denylist, which strips our spoofing modules from those same apps.
