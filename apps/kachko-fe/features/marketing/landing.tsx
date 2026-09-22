"use client";
/* eslint-disable @next/next/no-img-element -- static reference-design mockups intentionally use raw images */

// Kachko marketing landing — faithful port of kachko-landing-page.html (the
// user's compiled Vite/Tailwind bundle). Every section, component and style
// from the reference design is preserved 1:1; only the dead `<button>` CTAs
// became real navigation: Create → /register, Log in → /login, and in-page
// anchors for Product/Templates/Features/Pricing/Resources.
//
// Bundle-name map (old → here): $→cn, He→Button, Q→Reveal, $A→Container,
// ov→ArchLogo, $i→DoorArch, Qt→PhoneFrame, Pt→PageMock, Zd→EditorPanel,
// kv→ViewsChart, kd→TopLinks, tt→Section, pu→SectionHead.

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";

const AVATAR = "/landing-avatar.jpg";

type IconType = (props: SVGProps<SVGSVGElement>) => ReactNode;

/* ---------------------------------------------------------------- utilities */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver > "u") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView(0.12);
  return (
    <div ref={ref} className={cn("reveal", inView && "reveal-in", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-6 sm:px-8 lg:px-12", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ button */

type ButtonProps = {
  variant?: "primary" | "accent" | "ghost" | "darkPrimary" | "darkGhost";
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
  href?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

function Button({ variant = "primary", size = "md", className, children, href, ...rest }: ButtonProps) {
  const base = cn(
    "group inline-flex items-center justify-center gap-2 rounded-[13px] font-semibold transition-all duration-300 ease-out will-change-transform active:translate-y-0",
    size === "lg" ? "px-6 py-3.5 text-[15px]" : "px-5 py-3 text-[14px]",
    variant === "primary" &&
      "bg-ink text-ivory shadow-[0_1px_2px_rgba(17,19,18,0.14)] hover:-translate-y-[2px] hover:shadow-[0_14px_30px_-14px_rgba(17,19,18,0.55)]",
    variant === "accent" &&
      "bg-lime text-ink shadow-[0_1px_2px_rgba(17,19,18,0.10)] hover:-translate-y-[2px] hover:bg-lime-deep hover:shadow-[0_14px_30px_-14px_rgba(122,140,40,0.7)]",
    variant === "ghost" &&
      "border border-line bg-cream/70 text-ink hover:-translate-y-[2px] hover:border-ink/25 hover:bg-cream",
    variant === "darkPrimary" &&
      "bg-lime text-ink hover:-translate-y-[2px] hover:bg-lime-deep hover:shadow-[0_14px_36px_-14px_rgba(194,220,76,0.55)]",
    variant === "darkGhost" &&
      "border border-ivory/25 text-ivory hover:-translate-y-[2px] hover:border-ivory/60 hover:bg-ivory/5",
  );
  if (href) {
    return (
      <Link href={href} className={cn(base, className)}>
        {children}
      </Link>
    );
  }
  return (
    <button {...rest} className={cn(base, className)}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ typography */

function EyebrowMark({ children, tone = "light", className }: { children: ReactNode; tone?: "light" | "dark"; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className={cn("h-px w-6", tone === "light" ? "bg-lime-deep" : "bg-lime")} />
      <span className={cn("eyebrow", tone === "light" ? "text-olive" : "text-lime")}>{children}</span>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  copy,
  align = "left",
  tone = "light",
  className,
  maxCopy = "max-w-xl",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  copy?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
  maxCopy?: string;
}) {
  return (
    <div className={cn(align === "center" && "flex flex-col items-center text-center", className)}>
      {eyebrow && (
        <Reveal>
          <EyebrowMark tone={tone} className={cn("mb-6", align === "center" && "justify-center")}>
            {eyebrow}
          </EyebrowMark>
        </Reveal>
      )}
      <Reveal delay={60}>
        <h2 className={cn("heading text-[clamp(2.1rem,5.2vw,3.6rem)]", tone === "light" ? "text-ink" : "text-ivory")}>{title}</h2>
      </Reveal>
      {copy && (
        <Reveal delay={130}>
          <p className={cn("mt-6 text-[16.5px] leading-relaxed", tone === "light" ? "text-muted" : "text-ivory/60", maxCopy, align === "center" && "mx-auto")}>
            {copy}
          </p>
        </Reveal>
      )}
    </div>
  );
}

function GridLines({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 hidden justify-between lg:flex", className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-full w-px bg-line/60" />
      ))}
    </div>
  );
}

function Hairline({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("hairline w-full", className)} />;
}

function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("relative py-24 sm:py-28 lg:py-36", className)}>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------- icons */

const iconBase: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const ArrowRight: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);
const ArrowUpRight: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
);
const MenuIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M3.5 8h17" />
    <path d="M3.5 16h17" />
  </svg>
);
const CloseIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </svg>
);
const GlobeIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.6 12h16.8" />
    <path d="M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5s1.1-6.1 3.3-8.5Z" />
  </svg>
);
const InstagramIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);
const LinkedinIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M8 10.5V17" />
    <path d="M8 7.3v.1" />
    <path d="M12 17v-3.6a2.4 2.4 0 0 1 4.8 0V17" />
    <path d="M12 10.5V17" />
  </svg>
);
const YoutubeIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="m10.5 9.5 5 2.5-5 2.5v-5Z" />
  </svg>
);
const FolderIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2a2 2 0 0 1 1.5.7l1 1.3h7.3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9Z" />
  </svg>
);
const MailIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="m4.5 8.5 6.4 4.3a2 2 0 0 0 2.2 0l6.4-4.3" />
  </svg>
);
const MusicIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M9 18V6.5l10-2V16" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);
const PlayIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M9 7.5 17 12l-8 4.5v-9Z" />
  </svg>
);
const PlusIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M12 5.5v13" />
    <path d="M5.5 12h13" />
  </svg>
);
const CheckIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);
const SendIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="m6 4 12.5 6.8-5.4 1.5-2.2 5.2L6 4Z" />
    <path d="m13.6 14.2 4.4 5" />
  </svg>
);
const BoltIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M13.5 3 5.5 13.5h5.2L10 21l8.2-10.8H12.9L13.5 3Z" />
  </svg>
);
const PhoneIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <rect x="7" y="2.8" width="10" height="18.4" rx="3" />
    <path d="M10.8 5.6h2.4" />
  </svg>
);
const GripIcon: IconType = (p) => (
  <svg {...iconBase} {...p}>
    <path d="M9.5 7h.01M14.5 7h.01M9.5 12h.01M14.5 12h.01M9.5 17h.01M14.5 17h.01" strokeWidth={2.2} />
  </svg>
);

/* -------------------------------------------------------------- brand mark */

function ArchLogo({ className = "h-7 w-7", accent = "#c2dc4c" }: { className?: string; accent?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M4.5 24V12.4a9.5 9.5 0 0 1 19 0V24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M2.5 24h23" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M10.4 24v-8.1a3.6 3.6 0 0 1 7.2 0V24" fill={accent} />
      <path d="M10.4 24v-8.1a3.6 3.6 0 0 1 7.2 0V24" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

function Wordmark({ className = "", markClass = "h-7 w-7", wordClass = "" }: { className?: string; markClass?: string; wordClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ArchLogo className={markClass} />
      <span className={`text-[15px] font-extrabold uppercase tracking-[0.16em] ${wordClass}`}>Kachko</span>
    </span>
  );
}

/* --------------------------------------------------------------- door arch */

const arch = (left: number, right: number, base: number, top: number) => {
  const r = (right - left) / 2;
  return `M${left} ${base} L${left} ${top} A${r} ${r} 0 0 1 ${right} ${top} L${right} ${base} Z`;
};
const DOOR_MAIN = arch(150, 410, 584, 300);
const DOOR_ECHO_1 = arch(114, 446, 584, 290);
const DOOR_ECHO_2 = arch(78, 482, 584, 280);
const DOOR_INNER = arch(166, 394, 584, 308);

function DoorArch({
  className,
  tone = "light",
  figure = true,
  echoes = true,
}: {
  className?: string;
  tone?: "light" | "dark";
  figure?: boolean;
  echoes?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const glow = `${uid}-glow`;
  const spill = `${uid}-spill`;
  const blur = `${uid}-blur`;
  const clip = `${uid}-clip`;
  const dark = tone === "dark";
  return (
    <svg viewBox="0 0 560 660" className={cn("h-auto w-full", className)} fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={glow} cx="50%" cy="80%" r="72%">
          {dark ? (
            <>
              <stop offset="0%" stopColor="#FBFBEF" stopOpacity="0.95" />
              <stop offset="38%" stopColor="#E4EDBE" stopOpacity="0.62" />
              <stop offset="72%" stopColor="#C2DC4C" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#C2DC4C" stopOpacity="0.04" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#F8F9EA" />
              <stop offset="74%" stopColor="#ECF1D6" />
              <stop offset="100%" stopColor="#DCE5C5" />
            </>
          )}
        </radialGradient>
        <linearGradient id={spill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C2DC4C" stopOpacity={dark ? 0.22 : 0.3} />
          <stop offset="100%" stopColor="#C2DC4C" stopOpacity="0" />
        </linearGradient>
        <filter id={blur} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <clipPath id={clip}>
          <path d={DOOR_MAIN} />
        </clipPath>
      </defs>
      {echoes && (
        <g stroke={dark ? "#F7F5F0" : "#111312"} strokeWidth="1" fill="none" opacity={dark ? 0.16 : 0.14}>
          <path d={DOOR_ECHO_1} />
          <path d={DOOR_ECHO_2} opacity="0.6" />
        </g>
      )}
      <path d="M150 584 L410 584 L512 660 L48 660 Z" fill={`url(#${spill})`} />
      <path d="M14 584 H546" stroke={dark ? "#F7F5F0" : "#111312"} strokeOpacity={dark ? 0.2 : 0.16} strokeWidth="1.25" strokeLinecap="round" />
      <path d={DOOR_MAIN} fill={`url(#${glow})`} />
      <g clipPath={`url(#${clip})`}>
        <g className="animate-glow" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <ellipse cx="280" cy="566" rx="132" ry="164" fill={dark ? "#EAF2C8" : "#FFFFFF"} filter={`url(#${blur})`} opacity={dark ? 0.55 : 0.95} />
        </g>
        <path d="M150 560 H410" stroke={dark ? "#F7F5F0" : "#111312"} strokeOpacity="0.1" strokeWidth="1" />
      </g>
      <path d={DOOR_INNER} stroke={dark ? "#F7F5F0" : "#111312"} strokeOpacity="0.12" strokeWidth="1" />
      <path d={DOOR_MAIN} stroke={dark ? "#F7F5F0" : "#111312"} strokeOpacity={dark ? 0.6 : 1} strokeWidth="2.25" strokeLinejoin="round" />
      {figure && (
        <g>
          <ellipse cx="280" cy="585" rx="33" ry="5" fill="#111312" opacity="0.16" />
          <circle cx="280" cy="493" r="11" fill="#111312" />
          <path d="M269 584 v-57 c0-8.6 4.8-14.6 11-14.6 s11 6 11 14.6 v57 z" fill="#111312" />
        </g>
      )}
    </svg>
  );
}

function MiniArch({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <svg viewBox="0 0 48 56" className={cn("h-12 w-auto", className)} fill="none" aria-hidden="true">
      <path d="M4 54V24a20 20 0 0 1 40 0v30" stroke={tone === "dark" ? "#F7F5F0" : "#111312"} strokeOpacity="0.2" strokeWidth="1.2" />
      <path d="M16 54V30a8 8 0 0 1 16 0v24" fill={tone === "dark" ? "rgba(194,220,76,0.22)" : "rgba(194,220,76,0.5)"} />
    </svg>
  );
}

/* ------------------------------------------------------------------ header */

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Templates", href: "#templates" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "border-b border-line bg-ivory/85 backdrop-blur-[6px]" : "border-b border-transparent",
        menuOpen && "bg-ivory",
      )}
    >
      <Container>
        <nav className="flex h-[72px] items-center justify-between gap-8">
          <a href="#top" className="shrink-0 text-ink transition-opacity hover:opacity-70">
            <Wordmark />
          </a>
          <ul className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="relative text-[14px] font-semibold text-ink/75 transition-colors duration-300 hover:text-ink"
                >
                  <span className="after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-ink after:transition-all after:duration-300 hover:after:w-full">
                    {l.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden items-center gap-5 lg:flex">
            <Link href="/login" className="text-[14px] font-semibold text-ink/75 transition-colors duration-300 hover:text-ink">
              Log in
            </Link>
            <Button href="/register">Create your Kachko</Button>
          </div>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-line bg-cream/70 text-ink transition-colors hover:border-ink/25 lg:hidden"
          >
            {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </nav>
      </Container>
      <div
        className={cn(
          "overflow-hidden border-t border-line bg-ivory transition-[max-height,opacity] duration-500 ease-out lg:hidden",
          menuOpen ? "max-h-[520px] opacity-100" : "max-h-0 border-transparent opacity-0",
        )}
      >
        <Container className="py-8">
          <ul className="space-y-1">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href} onClick={() => setMenuOpen(false)} className="block border-b border-line py-4 text-[20px] font-bold tracking-tight text-ink">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/login" onClick={() => setMenuOpen(false)} className="block py-4 text-[20px] font-bold tracking-tight text-muted">
                Log in
              </Link>
            </li>
          </ul>
          <Button href="/register" size="lg" className="mt-4 w-full">
            Create your Kachko
          </Button>
        </Container>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-[124px] sm:pt-[140px] lg:pt-[168px]">
      <Container className="pointer-events-none absolute inset-0">
        <div className="relative h-full">
          <GridLines />
        </div>
      </Container>
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full bg-sage/35 blur-[120px]" />
      <Container className="relative">
        <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-6 xl:col-span-6">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-lime-deep" />
                <span className="eyebrow text-olive">One link for a brighter you</span>
              </div>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="heading mt-8 text-[clamp(2.75rem,8.2vw,4.75rem)]">
                Everything you are.
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">One simple link.</span>
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-[0.1em] z-0 h-[0.16em] bg-lime/60" />
                </span>
              </h1>
            </Reveal>
            <Reveal delay={170}>
              <p className="mt-8 max-w-[30rem] text-[17px] leading-[1.65] text-muted">
                Share your work, your world and everything that matters to you from one beautiful page.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="/register" size="lg">
                  Create your Kachko
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
                <Button href="#product" variant="ghost" size="lg">
                  Explore Kachko
                </Button>
              </div>
            </Reveal>
            <Reveal delay={300}>
              <p className="mt-6 text-[13px] font-medium text-muted">Kachko is currently free. No credit card required.</p>
            </Reveal>
          </div>
          <div className="lg:col-span-6 xl:col-span-6">
            <Reveal delay={200} className="relative">
              <div className="relative mx-auto max-w-[460px] lg:max-w-[540px] lg:translate-x-6">
                <DoorArch className="w-full" />
              </div>
              <p className="mt-2 text-center text-[12px] font-medium tracking-[0.02em] text-muted lg:text-right">
                You are standing at the entrance to everything that comes next.
              </p>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- audience strip */

const AUDIENCES = ["Creators", "Founders", "Artists", "Freelancers", "Musicians", "Businesses"];

function AudienceStrip() {
  return (
    <section className="relative pt-20 sm:pt-24 lg:pt-28">
      <Container>
        <Hairline />
        <Reveal>
          <div className="flex flex-col gap-8 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
            <p className="max-w-xs text-[13px] font-semibold leading-relaxed text-muted">
              Built for people with something to share.
            </p>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:gap-x-9">
              {AUDIENCES.map((label, i) => (
                <li key={label} className="flex items-center gap-6 sm:gap-9">
                  <span className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-ink/80 transition-colors duration-300 hover:text-ink">
                    {label}
                  </span>
                  {i < AUDIENCES.length - 1 && <span aria-hidden="true" className="hidden h-3.5 w-px bg-line sm:block" />}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Hairline />
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- phone mockup */

function PhoneFrame({
  children,
  className,
  tone = "light",
  width = "md",
  fluid = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
  width?: "sm" | "md" | "lg";
  fluid?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        !fluid && width === "sm" && "max-w-[228px]",
        !fluid && width === "md" && "max-w-[272px]",
        !fluid && width === "lg" && "max-w-[316px]",
        className,
      )}
    >
      <div className="relative rounded-[44px] border border-ink/10 bg-white p-[9px] shadow-[0_60px_100px_-60px_rgba(17,19,18,0.55),0_3px_8px_-2px_rgba(17,19,18,0.06)]">
        <div className="relative aspect-[9/19.2] overflow-hidden rounded-[36px] bg-ivory">
          <div className="absolute left-1/2 top-[9px] z-20 h-[19px] w-[66px] -translate-x-1/2 rounded-full bg-ink" />
          <div
            className={cn(
              "absolute inset-x-0 top-[12px] z-10 flex items-center justify-between px-[18px] text-[8.5px] font-extrabold tracking-tight",
              tone === "dark" ? "text-ivory/80" : "text-ink/70",
            )}
          >
            <span>9:41</span>
            <span className="flex items-end gap-[2px]">
              <i className="block h-[4px] w-[2px] rounded-[1px] bg-current" />
              <i className="block h-[6px] w-[2px] rounded-[1px] bg-current" />
              <i className="block h-[8px] w-[2px] rounded-[1px] bg-current" />
              <i className="ml-[3px] block h-[7px] w-[11px] rounded-[2px] border border-current" />
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-[3px] text-[9px] font-bold tracking-[0.08em]", className)}>{children}</span>;
}

function LinkRow({
  label,
  icon: Icon,
  className,
  iconClass,
  arrowClass,
}: {
  label: string;
  icon: IconType;
  className?: string;
  iconClass?: string;
  arrowClass?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-[12px] px-2.5 py-[9px] transition-transform duration-500 ease-out", className)}>
      <span className={cn("flex h-[22px] w-[22px] items-center justify-center rounded-[7px]", iconClass)}>
        <Icon className="h-[13px] w-[13px]" />
      </span>
      <span className="flex-1 text-[11px] font-bold tracking-tight">{label}</span>
      <ArrowUpRight className={cn("h-[12px] w-[12px]", arrowClass)} />
    </div>
  );
}

function Handle({ className }: { className?: string }) {
  return <div className={cn("mt-auto pt-3 text-center text-[8.5px] font-bold tracking-[0.14em]", className)}>KACHKO.IN/GIRISH</div>;
}

const MOCK_LINKS: { label: string; icon: IconType }[] = [
  { label: "My Website", icon: GlobeIcon },
  { label: "Instagram", icon: InstagramIcon },
  { label: "LinkedIn", icon: LinkedinIcon },
  { label: "YouTube", icon: YoutubeIcon },
  { label: "My Projects", icon: FolderIcon },
  { label: "Contact Me", icon: MailIcon },
];

type ThemeKey = "signature" | "minimal" | "bold" | "editorial" | "playful";

function PageMock({ theme = "signature", variant = "links" }: { theme?: ThemeKey; variant?: "links" | "media" }) {
  if (theme === "minimal") return <MinimalMock />;
  if (theme === "bold") return <BoldMock />;
  if (theme === "editorial") return <EditorialMock />;
  if (theme === "playful") return <PlayfulMock />;
  return <SignatureMock variant={variant} />;
}

function SignatureMock({ variant = "links" }: { variant?: "links" | "media" }) {
  return (
    <div className="relative flex h-full flex-col bg-ivory px-4 pb-4 pt-[38px]">
      <div className="pointer-events-none absolute left-1/2 top-[42px] h-[104px] w-[118px] -translate-x-1/2 rounded-t-full bg-sage/50" />
      <div className="pointer-events-none absolute left-1/2 top-[42px] h-[104px] w-[150px] -translate-x-1/2 rounded-t-full border border-line" />
      <div className="relative flex flex-col items-center">
        <img src={AVATAR} alt="" className="h-[58px] w-[58px] rounded-full object-cover ring-[3px] ring-cream" />
        <p className="mt-2.5 text-[14px] font-extrabold tracking-[-0.02em]">Girish Bennur</p>
        <p className="mt-1 text-[10.5px] font-medium text-muted">Building things for the web.</p>
        <Chip className="mt-2 bg-sage/70 text-olive">@kachko</Chip>
      </div>
      <div className="relative mt-4 space-y-[7px]">
        {variant === "media" ? (
          <>
            <LinkRow
              label="My Website"
              icon={GlobeIcon}
              className="bg-lime text-ink shadow-[0_1px_2px_rgba(17,19,18,0.08)]"
              iconClass="bg-ink/10 text-ink"
              arrowClass="text-ink/50"
            />
            <div className="overflow-hidden rounded-[12px] border border-line bg-cream">
              <div className="relative flex h-[62px] items-center justify-center bg-ink/90">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime text-ink">
                  <PlayIcon className="h-3 w-3" />
                </span>
                <span className="absolute bottom-1.5 right-2 rounded-[4px] bg-ivory/15 px-1.5 py-[1px] text-[7.5px] font-bold text-ivory">4:21</span>
              </div>
              <p className="px-2.5 py-2 text-[10px] font-bold tracking-tight">Latest video — Designing in public</p>
            </div>
            <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-cream px-2.5 py-[9px]">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-sage/70">
                <MusicIcon className="h-[13px] w-[13px]" />
              </span>
              <span className="flex-1">
                <span className="block text-[10px] font-bold tracking-tight">Now playing</span>
                <span className="block text-[8.5px] font-medium text-muted">Slow Mornings — EP</span>
              </span>
              <span className="flex items-end gap-[2px]">
                {[7, 12, 5, 10, 8].map((h, i) => (
                  <i key={i} className="block w-[2px] rounded-full bg-lime-deep" style={{ height: h }} />
                ))}
              </span>
            </div>
            <LinkRow label="My Projects" icon={FolderIcon} className="border border-line bg-cream" iconClass="bg-sage/60" arrowClass="text-muted" />
          </>
        ) : (
          MOCK_LINKS.map(({ label, icon }, i) => (
            <LinkRow
              key={label}
              label={label}
              icon={icon}
              className={cn(i === 0 ? "bg-lime text-ink shadow-[0_1px_2px_rgba(17,19,18,0.08)]" : "border border-line bg-cream")}
              iconClass={i === 0 ? "bg-ink/10 text-ink" : "bg-sage/60 text-ink"}
              arrowClass={i === 0 ? "text-ink/50" : "text-muted"}
            />
          ))
        )}
      </div>
      <Handle className="text-muted/70" />
    </div>
  );
}

function MinimalMock() {
  return (
    <div className="flex h-full flex-col bg-cream px-5 pb-4 pt-[44px]">
      <div className="flex flex-col items-center">
        <img src={AVATAR} alt="" className="h-[50px] w-[50px] rounded-full object-cover grayscale" />
        <p className="mt-3 text-[13px] font-extrabold tracking-[-0.02em]">Girish Bennur</p>
        <p className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted">Product designer</p>
      </div>
      <div className="mt-6">
        {MOCK_LINKS.slice(0, 5).map(({ label }) => (
          <div key={label} className="flex items-center justify-between border-t border-line py-[11px] last:border-b">
            <span className="text-[10.5px] font-bold tracking-tight">{label}</span>
            <ArrowUpRight className="h-3 w-3 text-muted" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-center gap-1.5 pt-3">
        <span className="h-[3px] w-[3px] rounded-full bg-lime-deep" />
        <span className="text-[8px] font-bold tracking-[0.16em] text-muted">MINIMAL</span>
      </div>
    </div>
  );
}

function BoldMock() {
  return (
    <div className="flex h-full flex-col bg-ink px-4 pb-4 pt-[40px] text-ivory">
      <div className="flex items-center gap-3">
        <img src={AVATAR} alt="" className="h-[46px] w-[46px] rounded-[14px] object-cover" />
        <div>
          <p className="text-[15px] font-extrabold uppercase leading-none tracking-[-0.02em]">Girish</p>
          <p className="mt-1.5 text-[9.5px] font-semibold text-ivory/55">Builder &amp; creator</p>
        </div>
      </div>
      <div className="mt-4 space-y-[7px]">
        {MOCK_LINKS.slice(0, 5).map(({ label, icon }, i) => (
          <LinkRow
            key={label}
            label={label}
            icon={icon}
            className={cn(i % 3 === 0 ? "bg-lime text-ink" : "border border-ivory/15 bg-ivory/[0.04] text-ivory")}
            iconClass={i % 3 === 0 ? "bg-ink/10 text-ink" : "bg-ivory/10 text-ivory"}
            arrowClass={i % 3 === 0 ? "text-ink/50" : "text-ivory/40"}
          />
        ))}
      </div>
      <Handle className="text-ivory/35" />
    </div>
  );
}

function EditorialMock() {
  return (
    <div className="flex h-full flex-col bg-sage-soft px-5 pb-4 pt-[42px]">
      <p className="text-[8px] font-bold tracking-[0.22em] text-olive">PORTFOLIO — 2026</p>
      <p className="mt-2 text-[20px] font-extrabold leading-[0.95] tracking-[-0.045em]">
        Girish
        <br />
        Bennur
      </p>
      <div className="mt-3 flex items-center gap-2.5">
        <img src={AVATAR} alt="" className="h-[34px] w-[34px] rounded-[6px] object-cover" />
        <p className="text-[9.5px] font-medium leading-snug text-ink/70">
          Building things
          <br />
          for the web.
        </p>
      </div>
      <div className="mt-5">
        {MOCK_LINKS.slice(0, 5).map(({ label }, i) => (
          <div key={label} className="flex items-baseline gap-2.5 border-t border-ink/12 py-[9px]">
            <span className="text-[8px] font-bold text-olive">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1 text-[11px] font-bold tracking-[-0.01em]">{label}</span>
            <ArrowUpRight className="h-[11px] w-[11px] text-ink/45" />
          </div>
        ))}
        <div className="border-t border-ink/12" />
      </div>
      <Handle className="text-ink/35" />
    </div>
  );
}

function PlayfulMock() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#F2F6E2] px-4 pb-4 pt-[40px]">
      <div className="pointer-events-none absolute -right-8 -top-6 h-28 w-28 rounded-full bg-lime/35" />
      <div className="pointer-events-none absolute -left-10 top-32 h-24 w-24 rounded-full bg-sage/60" />
      <div className="relative flex flex-col items-center">
        <span className="rounded-full bg-lime p-[3px]">
          <img src={AVATAR} alt="" className="h-[52px] w-[52px] rounded-full object-cover" />
        </span>
        <p className="mt-2.5 flex items-center gap-1.5 text-[14px] font-extrabold tracking-[-0.02em]">
          Girish
          <span className="inline-block h-[6px] w-[6px] rounded-full bg-lime-deep" />
        </p>
        <p className="mt-1 text-[10px] font-medium text-ink/60">makes things on the internet</p>
      </div>
      <div className="relative mt-4 space-y-[7px]">
        {MOCK_LINKS.slice(0, 5).map(({ label, icon }, i) => (
          <LinkRow
            key={label}
            label={label}
            icon={icon}
            className={cn("rounded-full border", i % 2 === 0 ? "border-ink/12 bg-white" : "border-ink bg-ink text-ivory")}
            iconClass={i % 2 === 0 ? "rounded-full bg-lime/60 text-ink" : "rounded-full bg-ivory/15 text-ivory"}
            arrowClass={i % 2 === 0 ? "text-ink/40" : "text-ivory/50"}
          />
        ))}
      </div>
      <Handle className="relative text-ink/35" />
    </div>
  );
}

/* ---------------------------------------------------------- product section */

function SideNote({ title, copy, side, className }: { title: string; copy: string; side: "left" | "right"; className?: string }) {
  return (
    <div className={className}>
      <div className={side === "left" ? "text-right" : "text-left"}>
        <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-ink">{title}</p>
        <p className="mt-2 max-w-[210px] text-[13.5px] leading-relaxed text-muted">{copy}</p>
      </div>
      <div className={`mt-4 flex items-center gap-2 ${side === "left" ? "justify-end" : "flex-row-reverse justify-end"}`}>
        <span className="h-px w-16 bg-line" />
        <span className="h-1.5 w-1.5 rounded-full bg-lime-deep" />
      </div>
    </div>
  );
}

function ProductSection() {
  return (
    <Section id="product">
      <Container>
        <SectionHead
          align="center"
          eyebrow="The product"
          title={
            <>
              One link.
              <br />
              Everything that matters.
            </>
          }
          copy="Your Kachko brings your digital world together in one simple, beautiful page."
          maxCopy="max-w-lg"
        />
        <div className="relative mt-20 overflow-hidden lg:mt-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex justify-center">
            <div className="relative h-full w-full max-w-[880px]">
              <div className="absolute bottom-0 left-1/2 h-[78%] w-[300px] -translate-x-1/2 rounded-t-full bg-sage/45 sm:w-[360px]" />
              <div className="absolute bottom-0 left-1/2 h-[88%] w-[420px] -translate-x-1/2 rounded-t-full border border-line sm:w-[500px]" />
              <div className="absolute bottom-0 left-1/2 h-[97%] w-[560px] -translate-x-1/2 rounded-t-full border border-line/70 sm:w-[640px]" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-line" />
            </div>
          </div>
          <div className="relative flex justify-center pb-16 pt-10">
            <SideNote side="left" title="Your identity" copy="A photo, a name and a line that sounds like you." className="absolute left-0 top-16 hidden w-[230px] lg:block" />
            <Reveal className="relative">
              <PhoneFrame width="lg">
                <PageMock theme="signature" />
              </PhoneFrame>
            </Reveal>
            <SideNote side="right" title="Your world" copy="Website, socials, projects, music, video — all in one place." className="absolute right-0 top-56 hidden w-[230px] lg:block" />
          </div>
        </div>
        <Reveal>
          <p className="mt-10 text-center text-[13px] font-semibold tracking-[0.02em] text-muted">
            kachko.in/girish — one page for everything you share.
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------ editor panel */

const EDITOR_LINKS = [
  { label: "My Website", url: "girish.design", icon: GlobeIcon, on: true },
  { label: "Instagram", url: "@girish", icon: InstagramIcon, on: true },
  { label: "YouTube", url: "Designing in public", icon: YoutubeIcon, on: true },
  { label: "My Projects", url: "12 case studies", icon: FolderIcon, on: false },
];

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={cn("relative flex h-[18px] w-[32px] items-center rounded-full transition-colors duration-500", on ? "bg-lime" : "bg-line")}>
      <span
        className={cn(
          "absolute h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(17,19,18,0.2)] transition-all duration-500",
          on ? "left-[16px]" : "left-[2px]",
        )}
      />
    </span>
  );
}

const SWATCHES = [
  { name: "Ivory", className: "bg-ivory border-line" },
  { name: "Sage", className: "bg-sage border-sage" },
  { name: "Lime", className: "bg-lime border-lime-deep" },
  { name: "Ink", className: "bg-ink border-ink" },
];

function EditorPanel({ compact = false, className }: { compact?: boolean; className?: string }) {
  const links = compact ? EDITOR_LINKS.slice(0, 3) : EDITOR_LINKS;
  return (
    <div className={cn("overflow-hidden rounded-[18px] border border-line bg-cream shadow-[0_30px_60px_-45px_rgba(17,19,18,0.4)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <span className="truncate text-[12px] font-semibold text-muted">kachko.in/girish</span>
        <span className="flex items-center gap-2">
          <span className="hidden rounded-[9px] border border-line px-2.5 py-1 text-[11px] font-bold text-ink/70 sm:inline-block">Preview</span>
          <span className="inline-flex items-center gap-1.5 rounded-[9px] bg-ink px-2.5 py-1 text-[11px] font-bold text-ivory">
            <CheckIcon className="h-3 w-3" />
            Publish
          </span>
        </span>
      </div>
      <div className="space-y-6 p-5 sm:p-6">
        <div>
          <p className="eyebrow text-muted">Profile</p>
          <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-line bg-ivory/70 p-3">
            <img src={AVATAR} alt="" className="h-11 w-11 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold tracking-tight">Girish Bennur</p>
              <p className="mt-0.5 truncate text-[11.5px] text-muted">Building things for the web.</p>
            </div>
            <span className="hidden rounded-[9px] border border-line bg-cream px-2.5 py-1 text-[11px] font-semibold text-ink/70 sm:inline-block">Edit</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow text-muted">Links</p>
            <p className="text-[11px] font-semibold text-muted">Drag to reorder</p>
          </div>
          <div className="mt-3 space-y-2">
            {links.map((r) => (
              <div
                key={r.label}
                className="group flex items-center gap-3 rounded-[14px] border border-line bg-white px-3 py-2.5 transition-all duration-300 hover:-translate-y-[1px] hover:border-ink/15 hover:shadow-[0_8px_20px_-14px_rgba(17,19,18,0.4)]"
              >
                <GripIcon className="h-4 w-4 shrink-0 text-line group-hover:text-muted" />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-sage/55">
                  <r.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold tracking-tight">{r.label}</span>
                  <span className="block truncate text-[11px] text-muted">{r.url}</span>
                </span>
                <Toggle on={r.on} />
              </div>
            ))}
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-line py-3 text-[12.5px] font-bold text-muted transition-colors duration-300 hover:border-ink/25 hover:text-ink"
            >
              <PlusIcon className="h-4 w-4" />
              Add link
            </button>
          </div>
        </div>
        {!compact && (
          <div>
            <p className="eyebrow text-muted">Appearance</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-ivory/70 p-3.5">
              <div className="flex items-center gap-2">
                {SWATCHES.map((r, i) => (
                  <span
                    key={r.name}
                    title={r.name}
                    className={cn("h-7 w-7 cursor-pointer rounded-full border transition-transform duration-300 hover:scale-110", r.className, i === 2 && "ring-2 ring-ink ring-offset-2 ring-offset-ivory")}
                  />
                ))}
              </div>
              <span className="h-5 w-px bg-line" />
              <div className="flex items-center gap-1.5">
                {["Manrope", "Serif", "Mono"].map((f, i) => (
                  <span
                    key={f}
                    className={cn(
                      "cursor-pointer rounded-[9px] px-2.5 py-1 text-[11.5px] font-bold transition-colors duration-300",
                      i === 0 ? "bg-ink text-ivory" : "border border-line text-ink/70 hover:border-ink/25",
                    )}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- analytics */

const CHART = [34, 46, 38, 58, 47, 66, 55, 78, 62, 92, 71, 84];
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function ViewsChart({ className, compact = false, showTotal = true }: { className?: string; compact?: boolean; showTotal?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-line bg-cream p-6 shadow-[0_30px_60px_-50px_rgba(17,19,18,0.45)] transition-shadow duration-500 hover:shadow-[0_36px_70px_-48px_rgba(17,19,18,0.5)]",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow text-muted">Views</p>
          {showTotal ? (
            <p className="mt-2 text-[34px] font-extrabold leading-none tracking-[-0.04em]">12,458</p>
          ) : (
            <p className="mt-2 text-[14px] font-semibold text-ink/70">Last 12 months</p>
          )}
        </div>
        <span className="rounded-full bg-sage/60 px-2.5 py-1 text-[11px] font-bold text-olive">+18.4%</span>
      </div>
      <div className="mt-8 flex h-[124px] items-end gap-[6px]">
        {CHART.map((h, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-[3px] transition-colors duration-500 ease-out", i === CHART.length - 3 ? "bg-lime" : "bg-sage hover:bg-sage/70")}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-[6px] border-t border-line pt-2">
        {MONTHS.map((m, i) => (
          <span key={i} className="flex-1 text-center text-[9.5px] font-bold text-muted">
            {m}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5">
          <div>
            <p className="text-[19px] font-extrabold tracking-[-0.03em]">3,842</p>
            <p className="mt-1 text-[11.5px] font-medium text-muted">Unique visitors</p>
          </div>
          <div>
            <p className="text-[19px] font-extrabold tracking-[-0.03em]">64%</p>
            <p className="mt-1 text-[11.5px] font-medium text-muted">Click-through rate</p>
          </div>
        </div>
      )}
    </div>
  );
}

const TOP_LINKS = [
  { label: "My Portfolio", value: 38 },
  { label: "Instagram", value: 26 },
  { label: "YouTube", value: 21 },
  { label: "Contact Me", value: 15 },
];

function TopLinks({ className }: { className?: string }) {
  return (
    <div className={cn("", className)}>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-muted">Top links</p>
        <p className="text-[11px] font-semibold text-muted">Last 30 days</p>
      </div>
      <ul className="mt-5 space-y-4">
        {TOP_LINKS.map((l, i) => (
          <li key={l.label}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[13.5px] font-bold tracking-tight">{l.label}</span>
              <span className="text-[12.5px] font-semibold text-muted">{l.value}%</span>
            </div>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-line/70">
              <span className={cn("block h-full rounded-full", i === 0 ? "bg-lime-deep" : "bg-ink/25")} style={{ width: `${l.value * 2.4}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BigStat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={cn("border-t border-line pt-5", className)}>
      <p className="text-[clamp(1.9rem,4.5vw,2.6rem)] font-extrabold leading-none tracking-[-0.045em]">{value}</p>
      <p className="mt-2.5 text-[12.5px] font-semibold text-muted">{label}</p>
    </div>
  );
}

function ArchBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-end justify-center">
      <div className="relative h-full w-full">
        <div className="absolute bottom-0 left-1/2 h-[72%] w-[260px] -translate-x-1/2 rounded-t-full bg-sage/45" />
        <div className="absolute bottom-0 left-1/2 h-[84%] w-[360px] -translate-x-1/2 rounded-t-full border border-line" />
        <div className="absolute inset-x-6 bottom-0 h-px bg-line" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------ features 01 — 04 */

function FeatureBlock({
  index,
  title,
  copy,
  points,
  visual,
  flip = false,
}: {
  index: string;
  title: string;
  copy: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-16">
      <div className={cn("lg:col-span-5", flip ? "lg:order-2 lg:col-start-8" : "lg:col-start-1")}>
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-extrabold tracking-[0.18em] text-olive">{index}</span>
            <span className="h-px w-10 bg-line" />
          </div>
          <h3 className="heading mt-6 text-[clamp(1.75rem,3.8vw,2.5rem)]">{title}</h3>
          <p className="mt-5 max-w-[26rem] text-[16px] leading-[1.65] text-muted">{copy}</p>
          <ul className="mt-8 max-w-[26rem]">
            {points.map((pt) => (
              <li key={pt} className="flex items-center gap-3 border-t border-line py-3 text-[13.5px] font-semibold text-ink/80">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-deep" />
                {pt}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
      <div className={cn("lg:col-span-6", flip ? "lg:order-1 lg:col-start-1" : "lg:col-start-7")}>
        <Reveal delay={120}>{visual}</Reveal>
      </div>
    </div>
  );
}

function MediaPhoneVisual() {
  return (
    <div className="relative overflow-hidden px-4 pb-12 pt-10">
      <ArchBackdrop />
      <div className="relative">
        <PhoneFrame width="md">
          <PageMock theme="signature" variant="media" />
        </PhoneFrame>
      </div>
    </div>
  );
}

function EditorPhoneVisual() {
  return (
    <div className="relative sm:pb-8 sm:pr-24">
      <EditorPanel compact />
      <div className="mt-10 flex justify-center sm:absolute sm:bottom-0 sm:right-0 sm:mt-0 sm:block sm:w-[172px]">
        <div className="w-[176px] sm:w-full">
          <PhoneFrame fluid>
            <PageMock theme="signature" />
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

function AttentionVisual() {
  return (
    <div className="rounded-[18px] border border-line bg-cream p-6 shadow-[0_30px_60px_-50px_rgba(17,19,18,0.45)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-extrabold tracking-tight">Where attention goes</p>
          <p className="mt-1.5 text-[12.5px] text-muted">Your page, last 30 days</p>
        </div>
        <span className="rounded-full bg-sage/60 px-2.5 py-1 text-[11px] font-bold text-olive">64% CTR</span>
      </div>
      <div className="mt-7 border-t border-line pt-6">
        <TopLinks />
      </div>
      <div className="mt-7 flex items-center gap-2.5 border-t border-line pt-5">
        <SendIcon className="h-4 w-4 text-olive" />
        <p className="text-[13px] font-semibold">
          1,204 clicks this week
          <span className="ml-2 font-medium text-muted">from 3,842 visitors</span>
        </p>
      </div>
    </div>
  );
}

function FastVisual() {
  return (
    <div className="relative sm:pb-14">
      <div className="overflow-hidden rounded-[18px] border border-line bg-cream shadow-[0_30px_60px_-50px_rgba(17,19,18,0.45)]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex gap-1.5">
            <i className="h-2 w-2 rounded-full bg-line" />
            <i className="h-2 w-2 rounded-full bg-line" />
            <i className="h-2 w-2 rounded-full bg-line" />
          </span>
          <span className="flex flex-1 items-center gap-2 rounded-[8px] border border-line bg-ivory/80 px-3 py-1 text-[11px] font-semibold text-muted">
            <GlobeIcon className="h-3 w-3" />
            kachko.in/girish
          </span>
        </div>
        <div className="relative flex min-h-[230px] flex-col items-center justify-center px-6 py-10">
          <div className="absolute bottom-0 left-1/2 h-[70%] w-[220px] -translate-x-1/2 rounded-t-full bg-sage/40" />
          <div className="relative flex flex-col items-center">
            <img src={AVATAR} alt="" className="h-14 w-14 rounded-full object-cover ring-[3px] ring-cream" />
            <p className="mt-3 text-[15px] font-extrabold tracking-tight">Girish Bennur</p>
            <p className="mt-1 text-[11.5px] text-muted">Building things for the web.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {["My Website", "Instagram", "YouTube", "Contact"].map((l, i) => (
                <span
                  key={l}
                  className={cn("rounded-[10px] px-3 py-1.5 text-[11.5px] font-bold", i === 0 ? "bg-lime text-ink" : "border border-line bg-cream text-ink/80")}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-10 flex justify-center sm:absolute sm:bottom-0 sm:right-6 sm:mt-0 sm:block sm:w-[158px]">
        <div className="w-[164px] sm:w-full">
          <PhoneFrame fluid>
            <PageMock theme="signature" />
          </PhoneFrame>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-2 sm:absolute sm:bottom-10 sm:left-0 sm:mt-0 sm:flex-col">
        <span className="inline-flex items-center gap-2 rounded-[11px] border border-line bg-cream px-3 py-1.5 text-[11.5px] font-bold shadow-[0_10px_24px_-18px_rgba(17,19,18,0.5)]">
          <BoltIcon className="h-3.5 w-3.5 text-olive" />
          Fast public pages
        </span>
        <span className="inline-flex items-center gap-2 rounded-[11px] border border-line bg-cream px-3 py-1.5 text-[11.5px] font-bold shadow-[0_10px_24px_-18px_rgba(17,19,18,0.5)]">
          <PhoneIcon className="h-3.5 w-3.5 text-olive" />
          Mobile-first by default
        </span>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <Section id="features" className="pt-8 sm:pt-10 lg:pt-12">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <h2 className="heading text-[clamp(2.1rem,5.4vw,3.6rem)]">
                More than a link.
                <br />A home for your internet.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <Reveal delay={100}>
              <p className="text-[15.5px] leading-relaxed text-muted">Four things Kachko does quietly well, so your page does the talking.</p>
            </Reveal>
          </div>
        </div>
        <div className="mt-20 space-y-24 lg:mt-28 lg:space-y-36">
          <FeatureBlock
            index="01"
            title="Everything in one place."
            copy="Bring your website, social profiles, portfolio, videos, music and more together under one link."
            points={["Links, embeds and media blocks", "Reorder anything in seconds", "Always up to date"]}
            visual={<MediaPhoneVisual />}
          />
          <Hairline />
          <FeatureBlock
            index="02"
            flip
            title="Make it yours."
            copy="Choose your colors, fonts, layouts and personality. Your page should feel like you."
            points={["Curated themes and starter templates", "Fonts, colors and button control", "Wallpaper images with focal positioning"]}
            visual={<EditorPhoneVisual />}
          />
          <Hairline />
          <FeatureBlock
            index="03"
            title="Built for attention."
            copy="Give every link a clear place, make your content easier to discover and turn visitors into followers, customers or fans."
            points={["Feature what matters most", "Clear hierarchy by design", "Understand what gets clicked"]}
            visual={<AttentionVisual />}
          />
          <Hairline />
          <FeatureBlock
            index="04"
            flip
            title="Fast everywhere."
            copy="Beautiful on desktop. Effortless on mobile. Built to load quickly wherever your audience finds you."
            points={["Server-rendered public pages", "Looks right on every screen", "Responsive live preview"]}
            visual={<FastVisual />}
          />
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------- editor hero */

const EDITOR_STEPS = ["Add a link.", "Change the look.", "Publish."];

function EditorSection() {
  return (
    <section className="relative border-y border-line bg-ivory-deep py-24 sm:py-28 lg:py-36">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionHead
              eyebrow="The editor"
              title={
                <>
                  Build your page
                  <br />
                  in minutes.
                </>
              }
              copy="Add a link. Change the look. Publish. That's it."
              maxCopy="max-w-md"
            />
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <Reveal delay={150}>
              <ul className="space-y-3">
                {EDITOR_STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[14px] font-semibold text-ink/80">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-cream text-[11px] font-extrabold text-olive">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
        <div className="mt-16 grid items-end gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-7">
            <EditorPanel />
          </Reveal>
          <Reveal delay={140} className="lg:col-span-4 lg:col-start-9">
            <div className="relative">
              <div aria-hidden="true" className="pointer-events-none absolute -inset-x-6 bottom-0 top-10 rounded-t-full border border-line" />
              <PhoneFrame width="md" className="relative">
                <PageMock theme="signature" />
              </PhoneFrame>
              <p className="mt-6 text-center text-[12px] font-semibold tracking-[0.02em] text-muted">Live preview — exactly what your visitors see.</p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- templates */

const THEMES: { key: ThemeKey; name: string; note: string }[] = [
  { key: "minimal", name: "Minimal", note: "Quiet type, nothing extra." },
  { key: "editorial", name: "Professional", note: "Structured, clear and considered." },
  { key: "playful", name: "Nature", note: "Warm, organic and welcoming." },
  { key: "bold", name: "Neon Pop", note: "High contrast, full presence." },
];

function TemplatesSection() {
  return (
    <Section id="templates">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SectionHead
              eyebrow="Personalisation"
              title={
                <>
                  Your page should
                  <br />
                  look like you.
                </>
              }
            />
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <Reveal delay={120}>
              <p className="text-[15.5px] leading-relaxed text-muted">Choose a curated theme or apply a starter template, then adjust the wallpaper, colors, fonts and buttons to make it yours.</p>
            </Reveal>
          </div>
        </div>
      </Container>
      <div className="mt-16 lg:mt-20">
        <Container className="max-lg:px-0">
          <div className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 sm:px-8 lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:px-0">
            {THEMES.map((t, i) => (
              <Reveal key={t.key} delay={i * 90} className="w-[210px] shrink-0 snap-center sm:w-[240px] lg:w-auto">
                <div className="group">
                  <div className="transition-transform duration-700 ease-out group-hover:-translate-y-2">
                    <PhoneFrame fluid tone={t.key === "bold" ? "dark" : "light"}>
                      <PageMock theme={t.key} />
                    </PhoneFrame>
                  </div>
                  <div className="mt-6 border-t border-line pt-4">
                    <p className="text-[13px] font-extrabold uppercase tracking-[0.16em]">{t.name}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.note}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ analytics */

function AnalyticsSection() {
  return (
    <Section id="analytics" className="border-t border-line">
      <Container>
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <SectionHead
              eyebrow="Analytics"
              title={
                <>
                  Know what people
                  <br />
                  care about.
                </>
              }
              copy="See how your page performs and understand what your audience clicks."
              maxCopy="max-w-sm"
            />
            <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10">
              <Reveal>
                <BigStat value="12,458" label="Total views" />
              </Reveal>
              <Reveal delay={80}>
                <BigStat value="3,842" label="Unique visitors" />
              </Reveal>
              <Reveal delay={160}>
                <BigStat value="64%" label="Click-through rate" />
              </Reveal>
              <Reveal delay={240}>
                <div className="border-t border-line pt-5">
                  <p className="text-[19px] font-extrabold leading-tight tracking-[-0.03em]">My Portfolio</p>
                  <p className="mt-2.5 text-[12.5px] font-semibold text-muted">Top link</p>
                </div>
              </Reveal>
            </div>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal delay={120}>
              <ViewsChart compact showTotal={false} />
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-12 border-t border-line pt-8">
                <TopLinks />
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------ audiences */

const AUDIENCE_CARDS = [
  { label: "For creators", copy: "Turn your audience into a world they can explore." },
  { label: "For freelancers", copy: "Put your work, services and contact details in one place." },
  { label: "For founders", copy: "Give people one destination to discover what you're building." },
  { label: "For artists", copy: "Show your portfolio, your shop and where to see your work next." },
  { label: "For musicians", copy: "Releases, tour dates and every place to listen — together." },
  { label: "For businesses", copy: "Bookings, offers, location and contact, one tap away." },
  { label: "For communities", copy: "Point every member to the same welcoming front door." },
];

function AudiencesSection() {
  return (
    <Section>
      <Container>
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Reveal>
              <h2 className="heading text-[clamp(2.1rem,5.4vw,3.6rem)]">
                One link.
                <br />
                Endless possibilities.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
            <Reveal delay={100}>
              <p className="text-[15.5px] leading-relaxed text-muted">However you show up online, Kachko gives it a single, considered home.</p>
            </Reveal>
          </div>
        </div>
        <div className="mt-16 lg:mt-20">
          <Hairline />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE_CARDS.map((c, i) => (
              <Reveal key={c.label} delay={(i % 3) * 70} className="group border-b border-line">
                <div className="flex h-full cursor-default flex-col justify-between gap-8 py-9 pr-8 transition-transform duration-500 ease-out group-hover:translate-x-1 lg:py-11">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-ink">{c.label}</p>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-line transition-colors duration-500 group-hover:text-olive" />
                    </div>
                    <p className="mt-4 max-w-[22rem] text-[15px] leading-relaxed text-muted">{c.copy}</p>
                  </div>
                  <span className="h-[3px] w-8 rounded-full bg-line transition-all duration-500 group-hover:w-14 group-hover:bg-lime" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------------ idea */

function IdeaSection() {
  return (
    <section className="relative overflow-hidden border-y border-line bg-ivory-deep py-24 sm:py-28 lg:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sage/25 blur-[130px]" />
      <Container className="relative">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <EyebrowMark className="justify-center">The idea</EyebrowMark>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="heading mt-7 max-w-3xl text-[clamp(2.4rem,6.6vw,4.5rem)]">What&apos;s on the other side?</h2>
          </Reveal>
        </div>
        <Reveal delay={140}>
          <div className="relative mx-auto mt-14 max-w-[540px] lg:mt-16">
            <DoorArch />
          </div>
        </Reveal>
        <div className="mx-auto mt-14 flex max-w-xl flex-col items-center text-center lg:mt-16">
          <Reveal>
            <p className="text-[17px] leading-[1.7] text-muted">
              Your audience doesn&apos;t need another complicated website.
              <br className="hidden sm:block" /> They need one place to discover you.
            </p>
          </Reveal>
          <Reveal delay={90}>
            <p className="mt-10 text-[clamp(1.4rem,3.4vw,1.85rem)] font-extrabold tracking-[-0.035em]">Open the door.</p>
          </Reveal>
          <Reveal delay={150}>
            <Button href="/register" size="lg" className="mt-8">
              Create your Kachko
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------- three steps */

const STEPS = [
  { no: "01", title: "Create", copy: "Choose your Kachko username." },
  { no: "02", title: "Build", copy: "Add your links, content and personality." },
  { no: "03", title: "Share", copy: "Put your Kachko link everywhere." },
];

function StepsSection() {
  return (
    <Section>
      <Container>
        <Reveal>
          <MiniArch className="mb-8 h-10" />
          <h2 className="heading max-w-2xl text-[clamp(2.1rem,5.4vw,3.6rem)]">
            Three steps.
            <br />
            One beautiful page.
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-px sm:grid-cols-3 lg:mt-20">
          {STEPS.map((s, i) => (
            <Reveal key={s.no} delay={i * 100}>
              <div className="relative border-t border-line pt-8 sm:pr-10">
                <span aria-hidden="true" className="absolute -top-[3px] left-0 h-[5px] w-10 rounded-full bg-lime" />
                <p className="text-[12px] font-extrabold tracking-[0.2em] text-olive">{s.no}</p>
                <p className="mt-6 text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.035em]">{s.title}</p>
                <p className="mt-3 max-w-[18rem] text-[15px] leading-relaxed text-muted">{s.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="mt-14 flex flex-wrap items-center gap-4 lg:mt-16">
            <span className="inline-flex items-center rounded-[13px] border border-line bg-cream px-5 py-3.5 text-[15px] font-bold tracking-tight">
              kachko.in/
              <span className="text-olive">yourname</span>
            </span>
            <span className="text-[13px] font-medium text-muted">Yours the moment you claim it.</span>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------- pricing */

const PLANS = [
  {
    name: "Kachko",
    price: "$0",
    note: "currently free",
    copy: "Everything currently available, with no paid upgrade required.",
    features: ["Multiple pages and content blocks", "Themes, templates and design controls", "Privacy-safe basic analytics"],
    cta: "Create your Kachko",
    variant: "primary" as const,
    href: "/register",
  },
];

function PricingSection() {
  return (
    <Section id="pricing" className="border-t border-line">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal>
              <h2 className="heading text-[clamp(2rem,4.6vw,3rem)]">
                Start building.
                <br />
                Everything is included.
              </h2>
              <p className="mt-6 max-w-sm text-[15.5px] leading-relaxed text-muted">
                Kachko is currently free. No credit card, trial countdown or unavailable paid tier.
              </p>
            </Reveal>
          </div>
          <div className="grid gap-10 lg:col-span-7 lg:col-start-6 lg:gap-12">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 110}>
                <div className="flex h-full flex-col border-t border-line pt-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-extrabold uppercase tracking-[0.16em]">{plan.name}</p>
                    {i === 0 && (
                      <span className="rounded-full bg-lime px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-ink">Included</span>
                    )}
                  </div>
                  <p className="mt-6 flex items-baseline gap-2">
                    <span className="text-[38px] font-extrabold leading-none tracking-[-0.045em]">{plan.price}</span>
                    <span className="text-[13px] font-semibold text-muted">{plan.note}</span>
                  </p>
                  <p className="mt-4 text-[14.5px] leading-relaxed text-muted">{plan.copy}</p>
                  <ul className="mt-7 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-[14px] font-semibold">
                        <CheckIcon className="h-4 w-4 text-olive" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button href={plan.href} variant={plan.variant} className="mt-9 w-full sm:w-auto sm:self-start">
                    {plan.cta}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------ final CTA */

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-ink py-28 text-ivory sm:py-32 lg:py-40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center opacity-[0.6]">
        <DoorArch className="w-[620px] max-w-none translate-y-[26%]" tone="dark" figure={false} />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/[0.07] blur-[120px]" />
      <Container className="relative">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <div className="flex items-center gap-2.5">
              <span className="h-px w-6 bg-lime" />
              <span className="eyebrow text-lime">Kachko</span>
              <span className="h-px w-6 bg-lime" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="heading mt-8 text-[clamp(2.4rem,6.4vw,4.25rem)] text-ivory">Your corner of the internet starts here.</h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-7 text-[17px] font-medium text-ivory/60">One link for a brighter you.</p>
          </Reveal>
          <Reveal delay={210}>
            <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href="/register" variant="darkPrimary" size="lg">
                Create your Kachko
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
              <Button href="#product" variant="darkGhost" size="lg">
                See an example
              </Button>
            </div>
          </Reveal>
          <Reveal delay={260}>
            <p className="mt-7 text-[13px] font-medium text-ivory/40">Kachko is currently free. No credit card required.</p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- footer */

const FOOTER_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Templates", href: "#templates" },
      { label: "Analytics", href: "#analytics" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Create account", href: "/register" },
      { label: "Log in", href: "/login" },
      { label: "Reset password", href: "/forgot-password" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
    ],
  },
];

function Footer() {
  return (
    <footer id="resources" className="bg-ivory py-20 sm:py-24">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Wordmark markClass="h-8 w-8" wordClass="text-[17px]" />
            <p className="mt-5 max-w-xs text-[14.5px] leading-relaxed text-muted">One link for a brighter you.</p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p className="eyebrow text-muted">{col.title}</p>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-[14.5px] font-semibold text-ink/80 transition-opacity duration-300 hover:text-ink hover:opacity-100 hover:underline hover:underline-offset-4"
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 border-t border-line pt-8">
          <p className="text-[13px] font-medium text-muted">© {new Date().getFullYear()} Kachko. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}

/* ------------------------------------------------------------- the page */

export function Landing() {
  useEffect(() => {
    // The hero CTA "Explore Kachko" scrolls to #product; make sure the fixed
    // header never covers the section title after an anchor jump.
    document.documentElement.style.scrollPaddingTop = "88px";
    return () => {
      document.documentElement.style.scrollPaddingTop = "";
    };
  }, []);
  return (
    <div className="min-h-screen overflow-x-hidden bg-ivory text-ink antialiased">
      <Header />
      <main>
        <Hero />
        <AudienceStrip />
        <ProductSection />
        <FeaturesSection />
        <EditorSection />
        <TemplatesSection />
        <AnalyticsSection />
        <AudiencesSection />
        <IdeaSection />
        <StepsSection />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
