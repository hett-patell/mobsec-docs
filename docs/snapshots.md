# Snapshots

A cold boot costs ~90 seconds plus a login. A snapshot restore costs ~25 seconds and comes back to whatever state was saved — **including a logged-in app, if that is what you froze**.

## Commands

```bash
snap list                 # name, size, timestamp of newest file
snap save                 # save as 'logged-in' (default)
snap save before-fuzz     # named
snap load                 # restore 'logged-in'
snap load before-fuzz
snap rm before-fuzz
snap boot                 # cold boot, no snapshot
```

Under the hood:

```bash
adb emu avd snapshot save logged-in
emulator -avd pentest16 -snapshot logged-in -no-snapshot-save -no-boot-anim
```

`-no-snapshot-save` is deliberate: when the emulator exits it would otherwise overwrite the snapshot with whatever half-broken state you were in.

## What survives a restore

| Survives | Does not survive |
|---|---|
| installed apps and their data | `adb reverse` tunnel (host-side) |
| logged-in sessions/cookies in app storage | mitmdump process (host-side) |
| Magisk modules + mount state | sometimes frida-server (`pentestctl fix` restarts it) |
| keybox, target.txt | global proxy setting? (survives, but points at a dead tunnel) |

That is why the documented restore sequence is:

```bash
snap load logged-in
pentestctl fix          # re-establishes reverse + frida
pentestctl status
```

## When a snapshot is a trap

Snapshots capture **mount state**, so a snapshot taken while a module was broken keeps restoring the broken mount. Symptoms: Cert-Fixer log says it ran, but GMS still cannot TLS. Fix: cold boot (`snap boot`), verify, then `snap save` again under a new name.

Rules:

- After installing/removing a Magisk module or changing the CA, **cold boot once**, verify `pentestctl status` + a GMS request, then save a new snapshot.
- Keep at most a handful: each is ~5 GB.
- Name by intent (`logged-in`, `pre-fuzz`, `clean-no-modules`), not by date.
- **A snapshot is only as logged-in as the moment you saved it.** After `keybox-refresh` rotates the
  keybox, the device presents a new attestation identity on the next launch and the backend drops the
  session — a snapshot saved before the rotation restores a logged-out app. Re-login (you need the
  TOTP), then `snap save logged-in` again.

!!! warning "`snap save` refuses to work after `snap load`"
    `load`/`boot` start the emulator with `-no-snapshot-save` so a broken session cannot overwrite a
    good snapshot. The emulator reports the refusal as `UNSUPPORTED_VK_APP`, which looks like a GPU
    problem and is not. `snap save <name> --reopen` cold-boots keeping `/data`, then saves.

## Cost

| Action | Time | Disk |
|---|---|---|
| cold boot | ~90 s | — |
| snapshot restore | ~21–25 s | — |
| one snapshot | — | ~5.2 GB |
