export const KACHKO_FEATURES = {
  REMOVE_BRANDING: 'remove_kachko_branding',
  CUSTOM_DESIGN: 'custom_design',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  DATA_EXPORT: 'data_export',
  SMART_ROUTING: 'smart_routing',
  AUTOMATIONS: 'automations',
} as const;

export type KachkoFeature = (typeof KACHKO_FEATURES)[keyof typeof KACHKO_FEATURES];

export interface BillingEntitlements {
  /** Clerk plan slug, without the `u:`/`o:` scope prefix. */
  plan: string;
  features: KachkoFeature[];
  source: 'clerk' | 'legacy';
}

