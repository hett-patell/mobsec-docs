# Quickstart (/docs/quickstart)

Two paths: the device already exists (this laptop), or you are rebuilding it on a fresh machine.

## Path A — the device already exists [#path-a--the-device-already-exists]

```bash
# 1. health check (start the emulator first if it is not running)
~/Android/Sdk/emulator/emulator -avd pentest16 -no-snapshot -no-boot-anim &
pentestctl status

# 2. repair the two things a reboot always breaks
pentestctl fix

# 3. capture traffic
nettap on
# ... use the app ...
ls -t /tmp/mtflows/*.txt | head

# 4. instrument the app (Frida + pinning bypass + CA injection)
fspawn com.example.app intercept

# 5. WebView console/DOM/storage
fdp com.example.app      # forwards :9222, prints the DevTools target
cdp url                  # what page is loaded
cdp eval "document.title"
```

<Callout type="idea" title="Fastest possible daily start">
```bash
snap load logged-in      # ~25 s instead of ~90 s cold boot
pentestctl fix
```
`snap load` restores apps, sessions and cookies exactly as you left them. See [Snapshots](/docs/snapshots).
</Callout>

## Path B — rebuild from zero [#path-b--rebuild-from-zero]

The full beginner walkthrough (SDK install, AVD tuning, rootAVD/Magisk UI clicks, module URLs, CA install, verification) lives in `GUIDE-from-scratch.md` in the repo root (open it directly, it is not part of this site). Short version:

```bash
cd ~/mobsec
./bootstrap.sh --sdk        # host deps + SDK + AVD  (needs your sudo password once, for udev)
emulator -avd pentest16 -no-snapshot &
./fetch-deps.sh             # frida-server, jadx, apktool, scrcpy, rootAVD
./rootAVD.sh …              # see GUIDE step 4 — interactive, Magisk UI driven over adb
./install-device.sh         # modules, frida-server, zygisk policy
./setup-keybox.sh           # fetch + validate a keybox, install to TrickyStore
./setup-net.sh              # CA into the system store, proxy + tunnel
pentestctl status
```

Order matters: `install-device.sh` reboots the device, `setup-net.sh` must run **after** the first boot with modules installed, and `setup-keybox.sh` last (it validates against the live device's TrickyStore path).

<Callout type="warn" title="One interactive step cannot be scripted">
Magisk's "install → patch image → additional setup → reboot" flow is UI-driven. `rootAVD.sh` pauses for it; the `GUIDE-from-scratch.md` section 4 walks the exact taps, and `uitap` can drive most of them by text.
</Callout>

## First real verification (5 minutes) [#first-real-verification-5-minutes]

Do not trust a green `pentestctl status` alone — prove each layer with a request:

| Layer | Command | Expected |
|---|---|---|
| Interception | `curl -s -x 127.0.0.1:18080 -o /dev/null -w '%{http_code}' https://example.org` | `200`, plus a new flow file |
| System trust (GMS) | open Play Store, check `/tmp/mitm.log` | no `does not trust the proxy's certificate` |
| Pinning bypass | `fspawn tech.httptoolkit.pinning_demo intercept` → tap "OkHTTP pinned request" | label says **Success**, request appears in flows |
| Frida | `fspawn com.android.settings web` | `[fspawn] … scripts=2`, no exception spam |
| WebView CDP | `fdp && cdp url` | the app's page URL |
| Attestation | `KeyAttestation` app → "Attest key" | leaf issuer `O=TEE,CN=<deviceid>`, "Bootloader is locked" |

## Sharing this site [#sharing-this-site]

The site is served by MkDocs on the host. By default it listens on loopback only:

```bash
docs serve                 # http://127.0.0.1:8000/
docs serve --lan           # http://<this-host-ip>:8000/ — phone, second laptop, whatever
docs status                # what it is bound to, and every URL that answers
```

Two things have to be true for another device to load it:

1. **It is bound to `0.0.0.0`**, not `127.0.0.1` (`docs serve --lan` does that; `docs status` shows the bind).
2. **The host firewall lets the port in.** On a box with `ufw` enabled the default inbound policy is
   `DROP`, so once:

   ```bash
   sudo ufw allow 8000/tcp
   # narrower: sudo ufw allow from 192.168.0.0/24 to any port 8000 proto tcp
   ```

To keep it up permanently (survives logout/reboot, restarts on failure):

```bash
systemctl --user enable --now mobsec-docs        # unit in ~/.config/systemd/user/
journalctl --user -u mobsec-docs -f
```

It is a plain MkDocs site: no auth, no TLS. Anyone on that network can read the whole rig, including
which target you are testing — put it behind Tailscale or an SSH tunnel
(`ssh -L 8000:127.0.0.1:8000 host`) if the network is not yours.

## Where to go next [#where-to-go-next]

- [Daily workflow](/docs/workflow) — the loop on a real engagement.
- [Interception](/docs/interception) — why pinning bypass works, and what still fails.
- [Troubleshooting](/docs/troubleshooting) — the eight traps, in the order they usually hit.