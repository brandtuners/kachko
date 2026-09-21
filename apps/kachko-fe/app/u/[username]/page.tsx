import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPage } from "../../../features/page/public-page";
import { PublicPageRenderer } from "../../../features/page/public-page-renderer";
import { AnalyticsBeacon } from "./analytics-beacon";
import { themeVars, themeBackground, type ThemeJson } from "../../../features/page/theme";
import { absoluteAssetUrl, publicPageUrl } from "../../../lib/public-url";
import { ReportPage } from "../../../features/moderation/report-page";

// Public profile page (§8.1, §6.3, AD-08). Server-rendered for SEO + speed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return publicPageMetadata(username);
}

export async function publicPageMetadata(username: string, pageSlug?: string): Promise<Metadata> {
  const page = await getPublicPage(username, pageSlug);
  if (!page) return { title: "Not found · KACHKO" };
  const displayName = page.user.displayName ?? page.user.username;
  const title = page.title ?? `${displayName} · KACHKO`;
  const description =
    page.description ?? `All of ${displayName}'s links in one place — claim your corner of the internet on KACHKO.`;
  const shareUrl = publicPageUrl(page.user.username, undefined, page.isPrimary ? undefined : page.slug);
  const ogImage = page.user.avatarUrl ? absoluteAssetUrl(page.user.avatarUrl) : undefined;
  return {
    title,
    description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    openGraph: {
      title,
      description,
      type: "profile",
      url: shareUrl,
      images: ogImage ? [{ url: ogImage, alt: `${displayName} on KACHKO` }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: { canonical: shareUrl },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicPageRoute username={decodeURIComponent(username)} />;
}

export async function PublicPageRoute({ username, pageSlug }: { username: string; pageSlug?: string }) {
  const page = await getPublicPage(username, pageSlug);
  if (!page) notFound();

  // M5: theme-driven styling. Falls back to default neon look when no theme is set.
  const themeJson = page.theme?.background || page.theme?.cards || page.theme?.buttons
    ? (page.theme as unknown as ThemeJson)
    : null;
  const vars = themeVars(themeJson);
  const background = themeBackground(themeJson);

  return (
    <main className="relative min-h-dvh overflow-hidden" style={{ ...vars, color: "var(--page-text, white)", fontFamily: "var(--page-font, inherit)", background }}>
      <div className="container-app flex flex-col items-center pb-16 pt-10 sm:pt-16">
        <PublicPageRenderer page={page} reportAction={<ReportPage pageId={page.id} />} />
      </div>

      <AnalyticsBeacon pageId={page.id} />
    </main>
  );
}
