# Billing and premium entitlements

Kachko uses Clerk Billing as the payment and subscription source of truth. The application never decides access from a displayed price or a client-side plan name. Nest verifies the Clerk session token, reads its active feature entitlements, and enforces paid capabilities again on the API.

## Revenue model

The launch model follows the useful part of Linktree's funnel without copying its brand or exact prices:

1. **Free acquisition** — unlimited links and blocks, themes, forms, and basic analytics.
2. **Creator subscription** — removal of Kachko branding and audience CSV export.
3. **Pro subscription** — extended analytics history and device/country/referrer smart routing.
4. **Premium subscription** — scheduled links and page-level redirect automations. External social auto-replies are intentionally separate because they require provider OAuth permissions and review.

Monthly billing lowers the commitment barrier. Annual billing can be discounted to improve cash flow and retention. Pricing, currency, annual discounts, trials, and the plan-to-feature mapping belong in Clerk Dashboard, not application code.

## Clerk Dashboard setup

Enable Billing for the correct Clerk instance, connect the payment provider, then create these features exactly:

- `remove_kachko_branding`
- `data_export`
- `advanced_analytics`
- `smart_routing`
- `automations`

Create public user plans and attach features as follows (the names and prices can be changed later):

- `creator`: `remove_kachko_branding`, `data_export`
- `pro`: everything in Creator plus `advanced_analytics`, `smart_routing`
- `premium`: everything in Pro plus `automations`

`custom_design` remains reserved for a future capability.

To change prices later, edit the Clerk plan. To move a capability between tiers, move its feature in Clerk. The application continues to check the feature slug, so no code change is needed.

## Enforcement flow

1. The Next.js BFF obtains the signed Clerk session token and forwards it to Nest as a bearer token.
2. Nest verifies the token and reads Clerk's `pla` (plan) and `fea` (features) claims.
3. `/api/v1/auth/billing` exposes a browser-safe plan and feature summary for UI gates.
4. The API rejects unauthorized exports, advanced history, routing rules, automations, and branding removal with `FEATURE_REQUIRED`, even if a caller bypasses the UI.
5. Clerk's pricing table owns checkout and subscription management. After a plan change, Clerk refreshes the session claims; the UI query is intentionally short-lived and the API is authoritative.
6. Verified Clerk billing webhooks persist plan/features for public-page requests, where no owner session token exists. Subscribe `/api/v1/webhooks/clerk` to `subscription.*` and `subscriptionItem.*` lifecycle events and configure `CLERK_WEBHOOK_SIGNING_SECRET`.

Legacy password sessions are treated as Free. This is fail-closed and prevents an old cookie from acquiring paid access.

## Operations

- Session claims remain authoritative for owner requests; the verified webhook projection powers public routing and scheduled behavior and is refreshed on every owner session as a reconciliation path.
- Track conversion from pricing view → checkout started → subscription active, plus churn and annual-plan share.
- Test in Clerk development mode before enabling production plans.
- If a new premium capability is added, define its slug in `packages/types/src/billing.ts`, gate its Nest endpoint, then add the matching Clerk feature.

## Implemented behavior

- **Advanced analytics:** Free retains Today/7-day/30-day views. `advanced_analytics` unlocks 90-day, 365-day, all retained history, and CSV download. Existing views, clicks, CTR, top links, geography, devices, and source breakdowns remain available. Exports contain up to the latest 50,000 events in the selected range, omit IP hashes, and escape spreadsheet formulas. The existing retention job deletes records older than 12 months; “All time” means all retained data.
- **Smart routing:** Up to ten ordered rules per LINK block match device (`mobile`, `tablet`, `desktop`), two-letter country, or referrer hostname. The first match wins; the original URL is the fallback. Country requires geo headers supplied by the trusted deployment proxy. Referrer depends on the visitor's browser exposing the original referring site. It is personalization input, not an authorization mechanism.
- **Automations:** A LINK may have an optional start and end time. The editor displays local time and stores UTC. A single link per page may redirect the page while active; an ended redirect restores the page. Automation-enabled pages bypass the public snapshot cache so boundaries apply on the next request. Direct resolver requests also respect the schedule. Page visits still send the normal analytics beacon.
- **Downgrades:** Stored rules remain editable after downgrade, but changing premium configuration requires its entitlement. Public routing falls back to the original URL and scheduling/redirect behavior stops. Canceled subscriptions keep access through the paid period. Webhooks fetch current Clerk subscription state, making duplicate deliveries safe; timestamp-conditional writes prevent older token snapshots overwriting newer webhook state. Public changes remain subject to webhook delivery delay.

Run `pnpm db:deploy` before starting the updated API. In Clerk Dashboard, create the features and public user plans above, configure the billing webhook, and put its signing secret in the API environment. The API webhook URL is `/api/v1/webhooks/clerk` on the API host (direct delivery preserves the signed request body).

## Linktree research and scope

REA browser observations and Linktree's public help pages informed this reconstruction of observable behavior. Linktree's private backend architecture was not available for inspection.

- [Understanding your Insights](https://linktr.ee/help/en/articles/5434178-understanding-your-insights): plan-based history, activity, visitor/source breakdowns, and CSV export.
- [Redirect your Linktree to one link](https://linktr.ee/help/en/articles/5434176-redirect-linktree-one-link): one prioritized link, an end time, automatic page restoration, and continued visit reporting.
- [Instagram auto-reply](https://linktr.ee/help/en/articles/9758234-set-up-instagram-auto-reply-linktree): connected Instagram account, comment triggers, DM actions, usage limits, and counters. This external-provider workflow is not included in Kachko's scheduling/redirect automations.
- [Clerk Billing webhooks](https://clerk.com/docs/nextjs/guides/development/webhooks/billing): subscription lifecycle and cancellation access through period end.

Kachko's ordered destination rules are its own implementation. Social account analytics and comment-triggered Instagram replies are now implemented in the [social integration extension](20-SOCIAL-INTEGRATIONS-AND-SHORT-LINKS.md), with separate provider setup. AI insights and social publishing integrations remain outside the current scope.
