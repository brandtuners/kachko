# Basic analytics API

Rohan's Step 8 backend slice records privacy-minimized events for published pages and returns bounded, owner-only aggregates. The frontend now sends nonblocking public events and renders the owner dashboard from these contracts. The joint Step 8 gate remains open until the deployed browser journey is verified with the real API.

## Setup

Add a random secret of at least 32 characters to `apps/api/.env` and to the deployed API environment:

```env
ANALYTICS_HASH_SALT=replace-with-a-random-secret-of-at-least-32-characters
```

Generate one with `openssl rand -base64 32`. Keep it server-side. Changing it breaks unique-visitor continuity because IP addresses are HMAC-hashed before storage.

Apply the migration:

```bash
pnpm db:deploy
```

V1 retains raw analytics events for 12 months. The repository schedules this
command daily through `.github/workflows/analytics-retention.yml`; configure its
protected production environment and `DATABASE_URL` secret before release. It
can also be run manually from a trusted environment:

```bash
pnpm db:analytics:prune
```

## Public event ingestion

`POST /api/v1/analytics/events` is public, limited to 120 requests per minute per source IP, and returns `202`. It accepts events only for an active owner's published page. Click targets must be visible and belong to that page.

```json
{ "pageId": "page-uuid", "eventType": "PAGE_VIEW" }
```

```json
{ "pageId": "page-uuid", "blockId": "link-block-uuid", "eventType": "LINK_CLICK" }
```

```json
{ "pageId": "page-uuid", "socialProfileId": "social-profile-uuid", "eventType": "SOCIAL_CLICK" }
```

A `SOCIAL_CLICK` may instead use `blockId` when the clicked target is a `SOCIAL` page block. It must provide exactly one target ID. A `PAGE_VIEW` cannot provide a target ID.

The public page response now exposes `data.page.id`, which supplies `pageId`. It already exposes public block and social-profile IDs. The client must call the same-origin `/api/v1/analytics/events` path and must never delay navigation for the response. Use `navigator.sendBeacon()` with an `application/json` Blob where supported, then fall back to `fetch` with `keepalive: true`. This endpoint is exempt from the session mutation CSRF header because it has no authenticated authority; strict body validation, public-resource checks, and Redis rate limiting remain enforced.

The API derives and minimizes metadata. It stores an HMAC of the network address, the referrer origin without its path/query, coarse user-agent classifications, and validated platform geo headers. It never stores the raw IP address or client-submitted analytics metadata.

Local development has no Vercel geo headers, so local events appear as `Unknown` in the location breakdown. Deployed Vercel requests supply `x-vercel-ip-country` and usually `x-vercel-ip-city`; previously stored events are not retroactively enriched.

## Owner queries

The following endpoints require the owner's session cookie. A foreign page ID returns `PAGE_NOT_FOUND`:

```text
GET /api/v1/pages/:pageId/analytics/summary?range=7d
GET /api/v1/pages/:pageId/analytics/timeseries?range=7d
GET /api/v1/pages/:pageId/analytics/top-links?range=7d
GET /api/v1/pages/:pageId/analytics/top-socials?range=7d
GET /api/v1/pages/:pageId/analytics/referrers?range=7d
GET /api/v1/pages/:pageId/analytics/geo?range=7d
GET /api/v1/pages/:pageId/analytics/devices?range=7d
```

Supported ranges are `today`, `7d`, and `30d`; omitted range defaults to `7d`. Responses never return individual events. The summary includes total views, unique visitors, link/social clicks, and link click-through rate. Timeseries fills empty UTC dates with zeroes. `top-links` ranks regular link blocks, while `top-socials` ranks social profiles and `SOCIAL` blocks. Each breakdown is bounded in SQL.

## Local checks

Open `http://localhost:4000/api/docs` for request examples. A published page and visible click target are required. For example:

```bash
curl -i -X POST http://localhost:4000/api/v1/analytics/events \
  -H 'Content-Type: application/json' \
  -d '{"pageId":"PAGE_UUID","eventType":"PAGE_VIEW"}'
```

The successful response is:

```json
{ "data": { "accepted": true } }
```

Run the backend checks with:

```bash
pnpm --filter api test
```

Run the frontend contract and transport checks with:

```bash
pnpm --filter kachko-fe test
pnpm --filter kachko-fe typecheck
```
