import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../features/query-provider";

// Manrope — the typeface of the reference design (kachko_dashboard.html).
// next/font self-hosts it from /_next, so the app's CSP (font-src 'self' data:)
// is honoured without whitelisting Google. The variable is set on <html> and
// wired to --font-sans on :root, so the cream + lime scheme is app-wide:
// marketing, auth, onboarding, dashboard, legal, admin. Public /@user pages
// paint their own theme background on top of it (by design).
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KACHKO — your one link",
  description: "A free, fast, mobile-first personal landing page.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
