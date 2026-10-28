"use client";

import { useState } from "react";
import { IconCheck } from "../../components/icons";

export function BlockShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Sharing may be cancelled or unavailable. */
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? `${title} link copied` : `Share ${title}`}
      title={copied ? "Link copied" : "Share link"}
      className="absolute right-3 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-[color:var(--page-text,white)] backdrop-blur transition hover:bg-white/25 active:scale-95"
    >
      {copied ? <IconCheck className="h-4 w-4" /> : <span aria-hidden className="text-lg leading-none">•••</span>}
    </button>
  );
}
