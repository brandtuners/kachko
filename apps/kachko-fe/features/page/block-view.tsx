import { themeButtonStyle } from "./theme";
import type { PublicBlock, PublicSocial } from "./public-page";
import { SOCIAL_ICONS } from "../../components/icons";

// Profile URL per platform for SOCIAL blocks (username → full link).
const SOCIAL_BASE_URLS: Record<string, string> = {
  INSTAGRAM: "https://instagram.com/",
  YOUTUBE: "https://youtube.com/@",
  X: "https://x.com/",
  LINKEDIN: "https://linkedin.com/in/",
  FACEBOOK: "https://facebook.com/",
  TIKTOK: "https://tiktok.com/@",
  GITHUB: "https://github.com/",
  DISCORD: "https://discord.com/users/",
  TWITCH: "https://twitch.tv/",
  SPOTIFY: "https://open.spotify.com/user/",
};

export function socialUrl(platform: string, username: string): string {
  const base = SOCIAL_BASE_URLS[platform] ?? "https://";
  const handle = username.replace(/^@/, "");
  // Custom hosts: allow a full URL to be pasted as the username.
  if (/^https?:\/\//i.test(username)) return username;
  return `${base}${encodeURIComponent(handle)}`;
}

// Block base styles driven by theme CSS vars (M5). Fall back to the default neon
// tokens when a theme hasn't overridden them.
const blockBase =
  "group flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99]";
const blockNeutral =
  "border-[color:var(--blk-card-border)] bg-[color:var(--blk-card-bg)] hover:bg-white/10";
const blockAccentText = "text-[color:var(--blk-accent)]";
const blockAccentBorder = "hover:border-[color:var(--blk-accent)]/60";

// Renders a single PageBlock based on its type (§6.3). Bright, tappable cards.
export function BlockView({ block }: { block: PublicBlock }) {
  if (!block.isVisible) return null;
  const c = block.content as Record<string, any>;

  switch (block.type) {
    case "LINK": {
      const url = String(c.url ?? "#");
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          data-event="LINK_CLICK"
          data-block-id={block.id}
          style={themeButtonStyle()}
          className={`${blockBase} ${blockNeutral} ${blockAccentBorder}`}
        >
          <span className="font-semibold">
            {c.title ?? url}
          </span>
          <span className={`${blockAccentText} transition group-hover:translate-x-0.5`}>↗</span>
        </a>
      );
    }
    case "TEXT":
      return (
        <p className={`px-1 text-base text-[color:var(--page-text,white)] ${c.alignment === "center" ? "text-center" : c.alignment === "right" ? "text-right" : ""}`}>
          {c.text}
        </p>
      );
    case "DIVIDER":
      return <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />;
    case "YOUTUBE":
      return (
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${String(c.videoId ?? "")}`}
            title="YouTube video"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      );
    case "SPOTIFY":
      return <iframe title="Spotify player" loading="lazy" className="w-full rounded-2xl" height="352"
        src={`https://open.spotify.com/embed${new URL(String(c.url)).pathname}`}
        allow="encrypted-media; fullscreen; picture-in-picture" />;
    case "EMAIL":
      return (
        <a href={`mailto:${String(c.email ?? "")}`} style={themeButtonStyle()} className="flex w-full justify-center border p-4">
          ✉ {String(c.email ?? "Email me")}
        </a>
      );
    case "PHONE":
      return (
        <a href={`tel:${String(c.number ?? "")}`} style={themeButtonStyle()} className="flex w-full justify-center border p-4">
          ☎ {String(c.number ?? "Call me")}
        </a>
      );
    case "LOCATION":
      return (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(String(c.query ?? ""))}`}
          target="_blank"
          rel="noopener noreferrer"
          style={themeButtonStyle()} className="flex w-full justify-center border p-4"
        >
          📍 {String(c.query ?? "Find me")}
        </a>
      );
    case "SOCIAL": {
      const platform = String(c.platform ?? "");
      const username = String(c.username ?? "");
      const Icon = SOCIAL_ICONS[platform];
      return (
        <a
          href={socialUrl(platform, username)}
          target="_blank"
          rel="noopener noreferrer"
          data-event="SOCIAL_CLICK"
          data-block-id={block.id}
          style={themeButtonStyle()}
          className={`${blockBase} ${blockNeutral} ${blockAccentBorder}`}
        >
          <span className="flex min-w-0 items-center gap-3">
            {Icon ? (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white">
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <span className="truncate font-semibold">@{username.replace(/^@/, "")}</span>
          </span>
          <span className={`${blockAccentText} transition group-hover:translate-x-0.5`}>↗</span>
        </a>
      );
    }
    case "IMAGE": {
      const href = c.href ? String(c.href) : undefined;
      const img = (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={String(c.url ?? "")} alt={String(c.alt ?? "")} className="w-full rounded-2xl" />
      );
      return href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {img}
        </a>
      ) : (
        img
      );
    }
    default:
      return null;
  }
}

export function SocialRow({ socials }: { socials: PublicSocial[] }) {
  const visible = socials.filter((s) => s.isVisible);
  if (visible.length === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      {visible.map((s) => (
        <a
          key={s.id}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          data-event="SOCIAL_CLICK"
          data-platform={s.platform}
          style={themeButtonStyle()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-magenta/60 hover:text-magenta"
        >
          {s.platform}
        </a>
      ))}
    </div>
  );
}
