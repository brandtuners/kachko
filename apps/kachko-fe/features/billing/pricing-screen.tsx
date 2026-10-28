"use client";

import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";

export function PricingScreen({ dashboard = false }: { dashboard?: boolean }) {
  return (
    <section className={dashboard ? "min-w-0" : "min-h-dvh bg-[#fbfaf6] px-5 py-12 sm:px-8"}>
      <div className={dashboard ? "mx-auto max-w-5xl" : "mx-auto max-w-6xl"}>
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#718c1b]">Kachko plans</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-1.2px] text-[#111312] sm:text-5xl">Grow when you’re ready.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#697069] sm:text-base">Start free, then upgrade for a brand-free page and creator data exports. Prices and plan contents below come directly from billing configuration.</p>
          </div>
          {!dashboard ? <Link href="/" className="k-btn-line !rounded-full">Back home</Link> : null}
        </div>
        <div className="rounded-[28px] border border-[#e1e5dc] bg-white p-3 shadow-[0_18px_60px_rgba(28,34,25,.08)] sm:p-7">
          <PricingTable />
        </div>
        <p className="mt-5 text-center text-xs text-[#7b817a]">Secure checkout and subscription management are provided by Clerk Billing.</p>
      </div>
    </section>
  );
}

