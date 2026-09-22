import Link from "next/link";
import { ObLogo } from "../../../features/onboarding/ob-shell";

// Privacy Policy (M10, §14 legal; §17 policy). Plain-language and honest about
// our minimal, first-party analytics (no IPs stored, AD-14). Cream + lime scheme.
export default function PrivacyPage() {
  return (
    <main className="ob-shell relative min-h-screen overflow-hidden">
      <header className="dash relative z-10 flex items-center py-5">
        <ObLogo />
      </header>
      <div className="container-app relative z-10 max-w-2xl pb-20 pt-8">
        <p className="k-eyebrow !mb-2">Legal</p>
        <h1 className="text-3xl font-extrabold tracking-[-1px] text-[var(--k-ink)]">Privacy Policy</h1>
        <p className="mt-1 text-sm text-[var(--k-muted)]">Last updated 2026-09-13</p>

        <div className="k-panel mt-8 space-y-4 p-6 text-[15px] leading-relaxed text-[var(--k-text)] sm:p-8">
          <p>
            KACHKO collects the minimum needed to run your page. We do not sell your data and we do
            not store IP addresses.
          </p>
          <h2 className="text-lg font-extrabold text-[var(--k-ink)]">What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your account email and username (to identify you and your page).</li>
            <li>The content you choose to publish (links, bio, avatar).</li>
            <li>
              First-party analytics: a rotating visitor cookie, coarse country (from Cloudflare
              headers), and parsed browser/device — never your IP (AD-14).
            </li>
          </ul>
          <h2 className="text-lg font-extrabold text-[var(--k-ink)]">Your rights (GDPR / CCPA)</h2>
          <p>
            You can export or delete your account at any time from settings. Deletion cascades to
            your page and blocks. Analytics are retained 12 months then purged. To exercise your
            rights, email privacy@kachko.in.
          </p>
          <h2 className="text-lg font-extrabold text-[var(--k-ink)]">Cookies</h2>
          <p>
            We use one essential session cookie (HttpOnly, Secure, SameSite=Lax) to keep you signed
            in, and a separate first-party analytics cookie for anonymous visit counts. No
            third-party ad or tracking cookies are used.
          </p>
          <h2 className="text-lg font-extrabold text-[var(--k-ink)]">Contact</h2>
          <p>
            Questions? Reach us at privacy@kachko.in or via the abuse contact on any public page.
          </p>
        </div>

        <div className="mt-12 border-t border-[var(--k-line)] pt-6 text-sm">
          <Link href="/" className="font-bold text-[var(--k-lime-dark)] hover:underline">
            ← Back to KACHKO
          </Link>
        </div>
      </div>
    </main>
  );
}
