# mobsec — documentation site

Documentation for **mobsec**, a rooted, Frida-wired Android 16 emulator rig with working HTTPS
interception and hardware-attestation spoofing. This repository holds **only the docs**
(MkDocs Material); the rig's binaries, third-party modules and any engagement-specific material are
kept out of version control.

**Live site:** <https://mobsec.networkshard.com/>

## Build locally

```bash
pip install --user mkdocs-material
mkdocs serve          # http://127.0.0.1:8000/
mkdocs build          # static copy in ./site/
```

## Deploy

The site is published to the `gh-pages` branch and served by GitHub Pages:

```bash
mkdocs gh-deploy --force
```

The custom domain is pinned by `docs/CNAME`.

## Scope / ethics

Root, attestation spoofing and TLS interception are for **authorized testing only**. A keybox makes a
device claim a hardware-backed identity it does not have — use it on test devices you are engaged to
assess, never against systems you are not permitted to touch. These docs describe technique; they
contain no client data, credentials or key material.
