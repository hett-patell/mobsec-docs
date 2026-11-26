import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Cpu,
  Lock,
  ShieldAlert,
  Terminal,
  Wifi,
} from 'lucide-react';

const highlights = [
  {
    title: 'Quickstart',
    description: 'Boot the AVD, attach mitmproxy, and spawn your first target in 60 seconds.',
    href: '/docs/quickstart',
    icon: Terminal,
  },
  {
    title: 'Architecture',
    description: 'How Magisk 31.1, Zygisk Next, Cert-Fixer, and Frida fit together.',
    href: '/docs/architecture',
    icon: Cpu,
  },
  {
    title: 'HTTPS Interception',
    description: 'APEX Conscrypt CA mounting + OkHttp/TrustManager pinning bypass.',
    href: '/docs/interception',
    icon: Wifi,
  },
  {
    title: 'Attestation & Keyboxes',
    description: 'TrickyStore hardware RKP keybox spoofing and expiry monitoring.',
    href: '/docs/attestation',
    icon: Lock,
  },
  {
    title: 'Frida & Instrumentation',
    description: 'Renamed hluda server, anonymous memory, and 7 exported Medusa profiles.',
    href: '/docs/frida',
    icon: ShieldAlert,
  },
  {
    title: 'Command Reference',
    description: 'All 21 host wrappers: entry, recon, replay, session, snap, pentestctl.',
    href: '/docs/tooling',
    icon: BookOpen,
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 md:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-secondary/60 px-3.5 py-1 text-xs font-medium text-fd-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-500" />
          Android 16 (API 36) · Magisk 31.1 · Frida 17.27.5
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl">
          mobsec — Android pentest rig
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base text-fd-muted-foreground sm:text-lg">
          A rooted, Frida-wired Android 16 emulator with working HTTPS interception,
          hardware keybox attestation spoofing, and 21 host-side automation wrappers.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Read the Docs
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-5 py-2.5 text-sm font-medium text-fd-card-foreground transition-colors hover:bg-fd-accent"
          >
            Quickstart
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-16 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-fd-border bg-fd-card p-5 text-left transition-colors hover:border-fd-primary/40 hover:bg-fd-accent/40"
            >
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg border border-fd-border bg-fd-secondary text-fd-foreground">
                <Icon className="size-4" />
              </div>
              <h2 className="text-sm font-semibold text-fd-card-foreground group-hover:text-fd-primary">
                {item.title}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-fd-muted-foreground">
                {item.description}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
