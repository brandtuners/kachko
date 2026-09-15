import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockView, SocialRow } from "../../../features/page/block-view";
import { getPublicPage } from "../../../features/page/public-page";
import { AnalyticsBeacon } from "./analytics-beacon";
import { themeVars, themeBackground, type ThemeJson } from "../../../features/page/theme";

// Public profile page (§8.1, §6.3, AD-08). Server-rendered for SEO + speed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const page = await getPublicPage(username);
  if (!page) return { title: "Not found · KACHKO" };
  const displayName = page.user.displayName ?? page.user.username;
  const title = page.title ?? `${displayName} · KACHKO`;
  const description =
    page.description ?? `All of ${displayName}'s links in one place — claim your corner of the internet on KACHKO.`;
  const shareUrl = `https://kachko.app/${page.user.username}`;
  const ogImage = page.user.avatarUrl ? `https://kachko.app${page.user.avatarUrl}` : undefined;
  return {
    title,
    description,
    metadataBase: new URL("https://kachko.app"),
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/${page.user.username}`,
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
  const page = await getPublicPage(decodeURIComponent(username));
  if (!page) notFound();

  const displayName = page.user.displayName ?? page.user.username;

  // M5: theme-driven styling. Falls back to default neon look when no theme is set.
  const themeJson = page.theme?.background || page.theme?.cards || page.theme?.buttons
    ? (page.theme as unknown as ThemeJson)
    : null;
  const vars = themeVars(themeJson);
  const background = themeBackground(themeJson);

  return (
    <main className="relative min-h-dvh overflow-hidden" style={{ ...vars, color: "var(--page-text, white)", fontFamily: "var(--page-font, inherit)", background }}>
      {/* Block rows + socials pick up the theme via --blk-* CSS vars (M5). */}
      <div className="container-app flex flex-col items-center pb-16 pt-10 sm:pt-16">
        {/* Avatar — uploaded photo when present, else a soft monogram (§6.1).
            Chrome here is deliberately theme-neutral (white washes): public
            pages paint their OWN theme background, only the blocks follow it. */}
        <div className="relative mb-5">
          {page.user.avatarUrl ? (
            <img
              src={page.user.avatarUrl}
              alt={`${displayName} avatar`}
              className="relative h-24 w-24 rounded-full object-cover shadow-[0_0_0_3px_rgba(255,255,255,0.18)]"
            />
          ) : (
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-3xl font-bold text-[color:var(--page-text,white)] ring-2 ring-white/20">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + handle */}
        <h1 style={{ fontSize: "var(--page-title-size, 32px)" }} className="text-center text-2xl font-bold text-[color:var(--page-text,white)] sm:text-3xl">{displayName}</h1>
        <p className="mt-1 text-center text-sm text-[color:var(--page-text,white)] opacity-70">@{page.user.username}</p>

        {page.description ? (
          <p className="mt-4 max-w-md text-center text-base text-[color:var(--page-text,white)] opacity-70">{page.description}</p>
        ) : null}

        {/* Blocks (sorted by position so the public page reflects the editor order, M3) */}
        <div className="mt-8 flex w-full max-w-md flex-col gap-3">
          {[...page.blocks]
            .sort((a, b) => a.position - b.position)
            .map((block) => (
              <BlockView key={block.id} block={block} />
            ))}
        </div>

        {/* Socials */}
        <SocialRow socials={page.socials} />

        {/* Footer — brand mark + wordmark, theme-neutral (the logo PNG is
            cream-filled, so on the user's theme we use the SVG arch instead). */}
        <footer className="mt-12 flex items-center justify-center gap-1.5 text-xs text-[color:var(--page-text,white)] opacity-70">
          <svg viewBox="0 0 48 48" className="h-3.5 w-3.5" aria-hidden>
            <path d="M8 40V18c0-8.3 6.7-15 15-15s15 6.7 15 15v22h-7V18c0-4.4-3.6-8-8-8s-8 3.6-8 8v22H8Z" fill="currentColor" />
          </svg>
          Made with <span className="font-bold text-[color:var(--page-text,white)] opacity-70">KACHKO</span>
        </footer>
      </div>

      <AnalyticsBeacon pageId={page.id} />
    </main>
  );
}
