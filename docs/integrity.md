# Play Integrity (the other attestation)

Two different things get called "attestation" in Android pentests, and confusing them wastes days:

| | What it proves | Who checks it | Can this rig fake it? |
|---|---|---|---|
| **Key attestation** (Android Keystore / RKP) | "this key lives in a TEE on a device whose boot state is X" | your target's backend, per-request | **Yes** — TrickyStore + keybox, see [Attestation](attestation.md) |
| **Play Integrity** (`IntegrityManager.requestIntegrityToken`) | "this APK, installed from Play, on a Google-approved device, right now" | Google evaluates, your backend reads the verdict JSON | **No**, not on an emulator |

Play Integrity is Google's own server-side verdict. You cannot compute it locally, and the request only works for a Play-distributed, Play-signed app with a Play Console project — which is why pentest tooling ships its own checker APK.

## Measuring it on this rig

```bash
integrity          # taps the button in SPIC, scrapes the verdict JSON from logcat
integrity --json          # raw verdict
```

`integrity` drives **SPIC** (`com.henrikherzig.playintegritychecker`, in `apks/`): force-stops it, launches it, finds the "Make Play Integrity Request" button via `uiautomator dump`, taps it, and parses the JSON block SPIC prints to `I/System.out` (that is where the library dumps the token payload).

Measured on this AVD, twice, before and after PlayIntegrityFix:

```text
package           : com.henrikherzig.playintegritychecker
app recognition   : UNEVALUATED
device verdict    : —
recent activity   : UNEVALUATED
app licensing     : UNEVALUATED
play protect      : UNEVALUATED
```

`UNEVALUATED` (and a *missing* `deviceRecognitionVerdict`) is not an error in the rig. Logcat shows the request itself succeeding:

```text
I/Finsky: Integrity key attestation record generated successfully
I/Integrity: requestIntegrityToken() finished for com.henrikherzig.playintegritychecker
```

Google receives the request and declines to grade it: the device is an emulator and **no Google account is signed in**. Both conditions must be satisfied for a verdict to exist at all — and even with an account, a Play Store emulator image still cannot return `MEETS_DEVICE_INTEGRITY`.

!!! note "Creating a Google account on the AVD is not worth it"
    It removes the `UNEVALUATED` state and replaces it with a clean `MEETS_BASIC_INTEGRITY` / no `DEVICE` result. It does not unlock anything, and it puts a real account on a rooted emulator.

## The modules, and why they do not help here

- **PlayIntegrityFix 4.9** (`playintegrityfix`) patches device props in GMS's process so DroidGuard is less likely to notice the emulator. It is installed and loading (`zygiskd status` lists it) — it just cannot manufacture a device verdict that Google refuses to issue.
- **PlayIntegrityFork v19** is parked in `modules/archive/`: it ships **only** `arm64-v8a` and `armeabi-v7a` Zygisk libs, so on this x86_64 image it silently never loads. Watch for that class of bug with `zygiskd status` after every module change — the module staying absent from `modules64:` is the tell.
- **TrickyStore** fakes the keystore chain. Play Integrity's `STRONG_INTEGRITY` needs a hardware-backed signature over the *app signing key* by a Google-trusted root — key attestation spoofing gets you partway, then Google's own evaluation of the resulting record is the wall.
- **TEESimulator** (JingMatrix, GPL-3.0) is the current community answer: a software KeyMint that needs a keybox, designed for exactly this "make a non-device look like a device" problem. It is a candidate upgrade for this rig; it is not installed, and it would still be fighting Play's verdict rather than key attestation.

## When your target actually gates on Play Integrity

In order of cost:

1. **Check it is really PI.** If the app also sends a key-attestation chain (Tauri/Rust/native apps often do), the keybox path already covers you — Target is exactly this case.
2. **Frida-hook the client side.** `IntegrityManager.requestIntegrityToken` / the verdict parser in the app: hook the callback and hand back a verdict the app likes. Works only when the backend trusts the *client* to inspect the verdict, which is a bug worth reporting in itself.
3. **Replay with a good token.** `session` + `replay` let you re-issue the request with a token minted on a clean device — that is the same thing a real attacker does, and it demonstrates the missing server-side binding.
4. **Use a physical device.** No emulator configuration passes `MEETS_DEVICE_INTEGRITY`; that is the point of the product.

## Related traps

!!! warning "`integrity` needs the screen awake and unlocked"
    `uiautomator dump` returns nothing useful on a locked screen, and the tap lands nowhere. `adb shell input keyevent KEYCODE_WAKEUP` first if the AVD has been idle.

!!! warning "SPIC's JSON block ends at an *unindented* `}`"
    The verdict is a multi-line pretty-printed document in logcat. Closing braces of nested objects are indented; only the final one is flush left. Any scraper that stops at the first `}` truncates the JSON and reports "no verdict" — a bug that cost an hour here.
