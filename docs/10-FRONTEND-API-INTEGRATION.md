# Frontend API integration

The browser uses `/api/v1` on the frontend origin. `apps/kachko-fe/next.config.mjs`
proxies this path to NestJS on localhost:4000. The shared client in
`apps/kachko-fe/lib/api.ts` sends cookies and `X-Kachko-CSRF: 1` on mutations.
Custom caller headers are preserved. HTTP errors and malformed responses reject.
Do not remove the backend CSRF guard or fabricate an Origin header.

For local development, use http://localhost:3000 and include that exact origin
in `CORS_ORIGINS` in `apps/api/.env`. Restart the API after environment changes.
A different port or hostname needs its own explicit allowed origin.

## Implemented calls

- Login/register/logout and profile reads/updates use `/auth/*` and `/users/me`.
- The editor lists `/pages`, then reads/writes `/pages/:id`; there is no `/pages/me`.
- Publishing uses POST `/pages/:id/publish` or `/unpublish`.
- Blocks and social profiles use `/pages/:id/blocks` and `/socials`.
- Block reorder sends `{items: [{id, position}]}` and receives the complete page.
- Theme catalog uses `/themes`; selection PATCHes `/pages/:id/appearance` with `themeKey`.
- Public rendering uses `/public/:username` and adapts its public-safe envelope.

## Pending backend features

Media, analytics, moderation and QR endpoints do not exist yet. The frontend
reports unavailable features, does not emit analytics events, and offers copy-link
instead of broken QR downloads. The block selector now offers all ten types; see [11-BLOCK-LIBRARY.md](11-BLOCK-LIBRARY.md).
These features must not be described as integrated until their backend contracts exist.

## Local checks

1. Start PostgreSQL, Redis and `pnpm dev`.
2. Open http://localhost:3000/login and log in with a registered account.
3. In browser Network, verify POST `/api/v1/auth/login` includes `X-Kachko-CSRF: 1`,
   succeeds and establishes the session cookie.
4. Open the dashboard, create/edit LINK or TEXT blocks, reorder, and change theme.
5. Publish, then open `/@yourusername` in a separate browser session.
6. Unpublish and verify the public route returns not found; log out and confirm
   protected API calls return UNAUTHENTICATED.

Automated client checks: `pnpm --filter @kachko/web exec node --test tests/api.test.cjs`.
Type check: `pnpm --filter @kachko/web exec tsc --noEmit`.
