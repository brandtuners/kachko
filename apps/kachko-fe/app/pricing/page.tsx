import type { Metadata } from "next";
import { PricingScreen } from "../../features/billing/pricing-screen";

export const metadata: Metadata = { title: "Pricing — Kachko", description: "Kachko plans for creators at every stage." };

export default function PricingPage() { return <PricingScreen />; }

