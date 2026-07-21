import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <main className="legal-shell">
    <header className="legal-header"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /></span><span>License<span>Resizer</span></span></Link><nav aria-label="Trust center"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/subprocessors">Subprocessors</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></nav></header>
    <article className="legal-document">
      <div className="legal-hero"><span className="step-kicker">{eyebrow}</span><h1>{title}</h1><p>{intro}</p><small>Effective July 19, 2026</small></div>
      <div className="legal-content">{children}</div>
    </article>
    <footer className="legal-footer"><p>LicenseResizer prepares documents locally. It does not verify identity, authenticate licenses, choose recipients, or confirm delivery.</p><Link href="/">Return home</Link></footer>
  </main>;
}
