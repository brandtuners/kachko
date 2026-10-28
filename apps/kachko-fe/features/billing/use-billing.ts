"use client";

import { useQuery } from "@tanstack/react-query";
import { KACHKO_FEATURES, type BillingEntitlements, type KachkoFeature } from "@kachko/types";
import { apiFetch } from "../../lib/api";

export const billingQueryKey = ["auth", "billing"] as const;

export function useBilling() {
  const query = useQuery({
    queryKey: billingQueryKey,
    queryFn: () => apiFetch<BillingEntitlements>("/auth/billing"),
    staleTime: 60_000,
  });
  const has = (feature: KachkoFeature) => query.data?.features.includes(feature) ?? false;
  return { ...query, has };
}

export { KACHKO_FEATURES };

