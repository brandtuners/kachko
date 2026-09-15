// Inline SVG icon set (no icon library installed). 24x24, stroke-based,
// currentColor — matches the reference's thin-line aesthetic.

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Svg>
);
export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.42 1.41" />
    <path d="M14 10a5 5 0 0 0-7.07 0L4.1 12.83a5 5 0 0 0 7.07 7.07l1.41-1.41" />
  </Svg>
);
export const IconGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
  </Svg>
);
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 20h16" />
  </Svg>
);
export const IconClipboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="3" width="8" height="4" rx="1" />
    <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 13l4 4L19 7" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconQr = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3M21 21v.01M17 21h.01M21 17h.01M14 21h.01" />
  </Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.8 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.8a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 13.6a6.5 6.5 0 0 1 3.5 5.8" />
  </Svg>
);
export const IconLayout = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </Svg>
);
export const IconPalette = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2.5 2.5 0 0 0-1.8 4.2A2 2 0 0 1 12 21Z" />
    <circle cx="7.5" cy="11" r="0.5" fill="currentColor" />
    <circle cx="9.5" cy="7" r="0.5" fill="currentColor" />
    <circle cx="14" cy="6.5" r="0.5" fill="currentColor" />
    <circle cx="17.5" cy="9.5" r="0.5" fill="currentColor" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconGrip = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconKebab = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L20 8a2.5 2.5 0 0 0-4-4L4 16v4Z" />
    <path d="M14 6l4 4" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M4 20h16" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);
export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12Z" />
    <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </Svg>
);
export const IconType = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7V5h16v2M12 5v14M9 19h6" />
  </Svg>
);
export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m6 17 4.5-4.5 3 3L17 12l3.5 3.5" />
  </Svg>
);
export const IconDivider = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h18M7 7h10M7 17h10" />
  </Svg>
);
export const IconPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </Svg>
);
export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
export const IconRobot = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="8" width="14" height="10" rx="3" />
    <path d="M12 8V5M12 5h.01" />
    <circle cx="9.5" cy="13" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="13" r="0.6" fill="currentColor" stroke="none" />
    <path d="M9.5 16h5" />
  </Svg>
);

// Social brand glyphs (simplified monograms, filled paths).
function Glyph({ className, d }: IconProps & { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "h-5 w-5"} aria-hidden>
      <path d={d} />
    </svg>
  );
}
export const IconInstagram = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.7" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconYoutube = (p: IconProps) => (
  <Glyph
    {...p}
    d="M23 12s0-3.3-.4-4.9a2.6 2.6 0 0 0-1.9-1.9C19 4.8 12 4.8 12 4.8s-7 0-8.7.4A2.6 2.6 0 0 0 1.4 7.1C1 8.7 1 12 1 12s0 3.3.4 4.9a2.6 2.6 0 0 0 1.9 1.9c1.7.4 8.7.4 8.7.4s7 0 8.7-.4a2.6 2.6 0 0 0 1.9-1.9c.4-1.6.4-4.9.4-4.9ZM9.8 15.1V8.9L15.5 12l-5.7 3.1Z"
  />
);
export const IconX = (p: IconProps) => (
  <Glyph {...p} d="M17.8 3h3.1l-6.8 7.7L22 21h-6.3l-4.9-6.3L5.1 21H2l7.3-8.3L1.7 3H8l4.4 5.8L17.8 3Zm-1.1 16.1h1.7L7.6 4.8H5.8l10.9 14.3Z" />
);
export const IconLinkedin = (p: IconProps) => (
  <Glyph
    {...p}
    d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1A4.2 4.2 0 0 1 17.7 9c3 0 4.3 1.9 4.3 5.4V21h-4v-6c0-1.8-.6-2.8-2-2.8-1.6 0-2.3 1.1-2.3 2.8v6h-4V9Z"
  />
);
export const IconFacebook = (p: IconProps) => (
  <Glyph
    {...p}
    d="M14 9h3l-.5 3.5H14V21H9.8v-8.5H7V9h2.8V7.1A4.9 4.9 0 0 1 15 2.5h3.2V6H16c-1.3 0-2 .5-2 1.7V9Z"
  />
);
export const IconTiktok = (p: IconProps) => (
  <Glyph
    {...p}
    d="M16.5 3c.4 2.3 1.8 3.8 4 4v3.2a8.7 8.7 0 0 1-4-1.1v6.2A6.3 6.3 0 1 1 6 9v3.3a3 3 0 1 0 3.5 3V3h7Z"
  />
);
export const IconGithub = (p: IconProps) => (
  <Glyph
    {...p}
    d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.1-3.4-1.1-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"
  />
);
export const IconDiscord = (p: IconProps) => (
  <Glyph
    {...p}
    d="M19.5 5.6A16 16 0 0 0 15.6 4.4l-.3.5a13.5 13.5 0 0 1 3.4 1.4A15 15 0 0 0 5.3 6.3 13.5 13.5 0 0 1 8.7 4.9l-.3-.5A16 16 0 0 0 4.5 5.6C2 9.4 1.4 13.1 1.7 16.8a16.2 16.2 0 0 0 4.9 2.5l.9-1.5-1.6-.8.4-.3a11.4 11.4 0 0 0 9.8 0l.4.3-1.6.8.9 1.5a16.2 16.2 0 0 0 4.9-2.5c.4-4.3-.6-8-2.6-11.2ZM8.7 14.5c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9Zm6.6 0c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.7 1.9-1.7 1.9Z"
  />
);
export const IconTwitch = (p: IconProps) => (
  <Glyph
    {...p}
    d="M4.3 2 2 6.5V20h5v3h3l3-3h4L22 17V2H4.3Zm15.4 14-2.7 2.7h-4.3L9.7 21v-2.3H5.6V4h14.1v12ZM18 7.4v5.5h-2.2V7.4h2.2Zm-5.7 0v5.5H10V7.4h2.3Z"
  />
);
export const IconSpotify = (p: IconProps) => (
  <Glyph
    {...p}
    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.1 15.5a.8.8 0 0 1-1 .3c-2.3-.9-5.1-1-8.2-.3a.8.8 0 1 1-.3-1.5c3.4-.8 6.5-.6 9 .4.4.1.6.6.5 1Zm1-3.7a1 1 0 0 1-1.3.3c-2.5-1.1-6.2-1.4-9-.5a1 1 0 1 1-.6-1.9c3.3-1 7.3-.7 10.2.6.5.2.7.8.7 1.5Zm.1-3.8A1.2 1.2 0 0 1 16 9.8C12.9 8.6 8.2 8.4 5.3 9.3a1.2 1.2 0 1 1-.7-2.3c3.3-1 8.5-.8 12 .5a1.2 1.2 0 0 1 .6 2.5Z"
  />
);

export const SOCIAL_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  INSTAGRAM: IconInstagram,
  YOUTUBE: IconYoutube,
  X: IconX,
  LINKEDIN: IconLinkedin,
  FACEBOOK: IconFacebook,
  TIKTOK: IconTiktok,
  GITHUB: IconGithub,
  DISCORD: IconDiscord,
  TWITCH: IconTwitch,
  SPOTIFY: IconSpotify,
};
