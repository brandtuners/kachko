import Link from "next/link";
import { ObLogo } from "../../../features/onboarding/ob-shell";

// Legal page shell (M10, §14 legal) — cream + lime scheme. Renders a single
// policy document. Two instances share this file: /legal/terms and
// /legal/privacy. Bright, readable, same footer.
function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="ob-shell relative min-h-screen overflow-hidden">
      <header className="dash relative z-10 flex items-center py-5">
        <ObLogo />
      </header>
      <div className="container-app relative z-10 max-w-2xl pb-20 pt-8">
        <p className="k-eyebrow !mb-2">Legal</p>
        <h1 className="text-3xl font-extrabold tracking-[-1px] text-[var(--k-ink)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--k-muted)]">Last updated {updated}</p>
        <div className="k-panel mt-8 space-y-4 p-6 text-[15px] leading-relaxed text-[var(--k-text)] sm:p-8">{children}</div>
        <div className="mt-12 border-t border-[var(--k-line)] pt-6 text-sm">
          <Link href="/" className="font-bold text-[var(--k-lime-dark)] hover:underline">
            ← Back to KACHKO
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="2026-09-13">
      <p>
        KACHKO is a free personal landing page platform. By creating an account you agree to use
        the service lawfully and respectfully. You are responsible for the content you publish.
      </p>
      <h2 className="text-lg font-extrabold text-[var(--k-ink)]">Acceptable use</h2>
      <p>
        Do not publish illegal content, malware, phishing pages, or anything that infringes
        others&apos; rights. We may remove content and suspend accounts that violate this. Report
        abuse from any public page — every report is reviewed by a human.
      </p>
      <h2 className="text-lg font-extrabold text-[var(--k-ink)]">Your data</h2>
      <p>
        We store only what we need to run your page. Analytics are first-party, privacy-safe, and
        contain no IP addresses (see our Privacy Policy). You can delete your account at any time.
      </p>
      <h2 className="text-lg font-extrabold text-[var(--k-ink)]">Changes</h2>
      <p>We may update these terms; material changes will be announced in-app.</p>
    </LegalPage>
  );
}
