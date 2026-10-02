"use client";

import { useState } from "react";
import { IconCheck } from "../../components/icons";

export function PublicShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard access can be denied by the browser. */
    }
  };

  return <button type="button" onClick={share} aria-label={copied ? "Page link copied" : "Share this page"} title={copied ? "Link copied" : "Share this page"}
    className="hidden h-11 w-11 place-items-center rounded-full bg-white/70 text-[#111312] shadow-sm backdrop-blur-md transition hover:scale-105 hover:bg-white active:scale-95 md:grid">
    {copied ? <IconCheck className="h-5 w-5" /> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 16V3m0 0L7 8m5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>}
  </button>;
}
