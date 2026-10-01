import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportPage } from "../moderation/report-page";
import { absoluteAssetUrl, publicPageUrl } from "../../lib/public-url";
import { AnalyticsBeacon } from "./analytics-beacon";
import { getPublicPage } from "./public-page";
import { PublicPageRenderer } from "./public-page-renderer";
import { themeBackground, themeVars, type ThemeJson } from "./theme";

export async function publicPageMetadata(
  username: string,
  pageSlug?: string,
): Promise<Metadata> {
  const page = await getPublicPage(username, pageSlug);
  if (!page) return { title: "Not found · KACHKO" };
  const displayName = page.user.displayName ?? page.user.username;
  const title = page.title ?? `${displayName} · KACHKO`;
  const description =
    page.description ??
    `All of ${displayName}'s links in one place — claim your corner of the internet on KACHKO.`;
  const shareUrl = publicPageUrl(
    page.user.username,
    undefined,
    page.isPrimary ? undefined : page.slug,
  );
  const ogImage = page.user.avatarUrl
    ? absoluteAssetUrl(page.user.avatarUrl)
    : undefined;
  return {
    title,
    description,
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
    openGraph: {
      title,
      description,
      type: "profile",
      url: shareUrl,
      images: ogImage
        ? [{ url: ogImage, alt: `${displayName} on KACHKO` }]
        : undefined,
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

export async function PublicPageRoute({
  username,
  pageSlug,
}: {
  username: string;
  pageSlug?: string;
}) {
  const page = await getPublicPage(username, pageSlug);
  if (!page) notFound();

  const themeJson =
    page.theme?.background || page.theme?.cards || page.theme?.buttons
      ? (page.theme as unknown as ThemeJson)
      : null;

  return (
    <main
      className="relative min-h-dvh overflow-hidden"
      style={{
        ...themeVars(themeJson),
        color: "var(--page-text, white)",
        fontFamily: "var(--page-font, inherit)",
        background: themeBackground(themeJson),
      }}
    >
      <div className="container-app flex flex-col items-center pb-16 pt-10 sm:pt-16">
        <PublicPageRenderer
          page={page}
          reportAction={<ReportPage pageId={page.id} />}
        />
      </div>
      <AnalyticsBeacon pageId={page.id} />
    </main>
  );
}
