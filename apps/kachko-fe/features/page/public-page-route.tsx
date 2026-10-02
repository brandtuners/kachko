import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportPage } from "../moderation/report-page";
import { absoluteAssetUrl, publicPageUrl } from "../../lib/public-url";
import { AnalyticsBeacon } from "./analytics-beacon";
import { getPublicPage } from "./public-page";
import { PublicPageRenderer } from "./public-page-renderer";
import { themeBackground, themeVars, type ThemeJson } from "./theme";
import { PageQr } from "../share/page-qr";
import { PublicShareButton } from "./public-share-button";

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
  const url = publicPageUrl(page.user.username, undefined, page.isPrimary ? undefined : page.slug);
  const name = page.user.displayName ?? page.user.username;
  const background = themeBackground(themeJson);

  return (
    <main
      className="relative min-h-dvh overflow-x-hidden md:px-6 md:py-7"
      style={{
        ...themeVars(themeJson),
        color: "var(--page-text, white)",
        fontFamily: "var(--page-font, inherit)",
        background,
      }}
    >
      <div aria-hidden className="absolute inset-0 hidden bg-black/25 backdrop-blur-[2px] md:block" />
      <section data-public-profile-shell className="relative z-10 mx-auto min-h-dvh w-full overflow-hidden md:min-h-[calc(100dvh-3.5rem)] md:max-w-[680px] md:rounded-[32px] md:border md:border-white/20 md:shadow-[0_28px_90px_rgba(0,0,0,.28)]" style={{ background }}>
        <div className="absolute right-5 top-5 z-20"><PublicShareButton url={url} title={`${name} on Kachko`} /></div>
        <div className="container-app flex min-h-dvh flex-col items-center pb-16 pt-10 sm:pt-16 md:min-h-[calc(100dvh-3.5rem)] md:pt-24">
          <PublicPageRenderer page={page} reportAction={<ReportPage pageId={page.id} />} />
        </div>
      </section>
      <aside data-desktop-qr className="fixed bottom-8 right-7 z-10 hidden flex-col items-center gap-2 text-center xl:flex">
        <p className="text-sm font-extrabold text-white drop-shadow">View on mobile</p>
        <PageQr url={url} username={page.user.username} size={132} showDownload={false} />
      </aside>
      <AnalyticsBeacon pageId={page.id} />
    </main>
  );
}
