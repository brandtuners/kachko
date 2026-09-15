// Marketing home (§8.1, `/`) — faithful port of kachko-landing-page.html (the
// user's reference design, now the live landing). The page itself is a thin
// server component so the document <title>/description are metadata; all
// interactivity (reveal-on-scroll, fixed header, mobile menu) lives in the
// client <Landing /> under features/marketing.
import type { Metadata } from "next";
import { Landing } from "../../features/marketing/landing";

export const metadata: Metadata = {
  title: "Kachko — One link for a brighter you.",
  description:
    "Kachko — one link for a brighter you. A free, fast, mobile-first personal landing page for everything you are.",
};

export default function MarketingHomePage() {
  return <Landing />;
}
