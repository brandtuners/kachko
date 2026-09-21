# kachko — Page and LINK API

**Status:** multi-page and block CRUD, publish/unpublish, both public lookup forms, shared contracts and revision-based Redis caching are implemented and available in Swagger.

## Data and scope decisions

- V1 supports multiple Pages per User. If an owner has pages, exactly one is primary. The first page is primary and derives its internal slug from the owner's normalized username. Every later page requires a client-supplied slug. Slugs are lowercase, 2–40 characters, and unique per owner; two owners may use the same slug.
- The primary frontend/API route is `/[username]` and `/public/:username`. Additional pages use `/[username]/[pageSlug]` and `/public/:username/:pageSlug`. A username change moves all of the owner's public URLs but does not rewrite page slugs. Deleting the primary page transactionally promotes the oldest remaining page; deleting the final page leaves the owner with no page.
- Page contains id, userId, owner-scoped slug, isPrimary, nullable title/description, isPublished=false, publishedAt=null, themeKey="minimal", internal revision=0, and timestamps. Page deletion cascades to blocks; user deletion cascades to every owned page and its blocks. No page is automatically created during signup.
- PageBlock contains id, pageId, type=LINK or TEXT, nonnegative position, isVisible=true, JSON content and timestamps. Ordering indexes support owner/public reads. Position uniqueness/contiguous order is maintained by owner-row locks and transactional append/delete; the DB currently checks nonnegativity, not uniqueness. JSON content is validated by the shared schema at API boundaries.
- LINK and TEXT are allowed in the database enum and shared contracts; see [TEXT and reorder](08-TEXT-AND-REORDER.md). Other documented block types will be added with their implementations. No media IDs, icons or custom styles are accepted in this slice; thumbnails require the later verified media flow.
- `minimal` remains the default, with six system themes now available. Page.themeKey references Theme.slug; validated appearance overrides and social profiles are implemented. See [09-APPEARANCE-AND-SOCIALS.md](09-APPEARANCE-AND-SOCIALS.md).
- Existing profile username changes update User.username and increment every owned page revision in one transaction. Every page, block or profile edit increments the affected revision in the same transaction. Public cache keys include the public route, page ID and revision, making previous entries unreachable. Unpublish, page deletion and account suspension/deletion are checked against PostgreSQL before serving cached content.

These are the current blueprint resolutions of the broader LLD examples: multiple pages with one primary page, a themeKey foreign key to the Theme catalog, and validated block content.

## Shared packages

`@kachko/validation` exports createPageSchema, updatePageSchema, createLinkBlockSchema, updateLinkBlockSchema, linkContentSchema, linkUrlSchema, pageIdSchema, blockIdSchema, publicPageSchema and their input types.

`@kachko/types` exports PageSummary, OwnerPage, LinkBlock, LinkBlockContent, PublicPage, PageResponse, PageListResponse, LinkBlockResponse, PublicPageResponse, DeleteResponse and PageErrorCode. Timestamps in JSON are ISO 8601 strings. Public data uses an explicit allowlist rather than a database-model spread.

Page title: null or 1–120 trimmed characters. Description: null or at most 300 trimmed characters. First-page creation accepts an empty object; later creation requires `slug`. PATCH requires at least one permitted field and may change the owner-scoped slug. Null clears nullable fields. Owner, primary state, publish state, IDs and timestamps are server-managed. Appearance is changed through the dedicated appearance endpoint; create also accepts optional templateKey.

LINK content: title (1–120 trimmed characters), url (absolute HTTP(S), maximum 2048 input characters), openInNewTab (boolean, default true). URL normalization uses URL.href. Reject credentials, relative URLs, other protocols, whitespace, control characters and backslashes. The API must not fetch destinations. This is scheme validation, not a promise that a destination is trustworthy. Render user text as text and links opening new tabs with `rel="noopener noreferrer"`.

Block create accepts type="LINK", content, and optional isVisible (default true). Block PATCH accepts content and/or isVisible. Content is a complete replacement, so an update of content must include both title and url. The client cannot set position, pageId, type on update, or IDs. The server appends new blocks under an owner-row transaction/lock, and reads order by position then id.

## Implemented endpoints

All protected routes require the existing session; mutations require X-Kachko-CSRF: 1 and an allowed Origin. Every lookup must scope page ownership, including nested block operations. Foreign page/block IDs return the same 404 as missing IDs. Public lookup requires no session.

| Method | Path under `/api/v1` | Request | Success |
|---|---|---|---|
| GET | `/pages` | none | 200 PageListResponse, primary first, then creation order |
| POST | `/pages` | `{slug?,title?,description?,templateKey?}` | 201 PageResponse; slug required after the first page |
| GET | `/pages/:id` | none | 200 PageResponse with ordered blocks |
| PATCH | `/pages/:id` | `{slug?,title?,description?}` | 200 PageResponse |
| DELETE | `/pages/:id` | none | 200 `{data:{deleted:true}}` |
| POST | `/pages/:pageId/blocks` | `{type:"LINK"|"TEXT",content,isVisible?}` | 201 BlockResponse |
| PATCH | `/pages/:pageId/blocks/:blockId` | `{content?,isVisible?}` | 200 BlockResponse |
| DELETE | `/pages/:pageId/blocks/:blockId` | none | 200 `{data:{deleted:true}}` |
| POST | `/pages/:id/publish` | none | 200 PageResponse |
| POST | `/pages/:id/unpublish` | none | 200 PageResponse |
| GET | `/public/:username` | none | 200 PublicPageResponse |
| GET | `/public/:username/:pageSlug` | none | 200 PublicPageResponse |

Reorder is implemented as POST `/pages/:pageId/blocks/reorder`; see [the complete-list contract](08-TEXT-AND-REORDER.md). Publishing an empty page is allowed (profile-only page); publication sets publishedAt, repeated publish preserves it, and unpublish clears it. Owner reads include hidden blocks; public reads exclude them and exclude email/userId/roles/session data/private timestamps. Draft, missing, inactive-owner or deleted-owner pages return 404 on public lookup. Edits to published pages appear publicly after saving; this slice does not keep a separate draft snapshot of published content.

Error envelope is `{error:{code,message}}`: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 CSRF_REJECTED, 404 PAGE_NOT_FOUND or BLOCK_NOT_FOUND, 409 PAGE_SLUG_UNAVAILABLE, 429 RATE_LIMITED. Protected page endpoints share a limit of 120 requests/minute/IP and fail closed with 503 DEPENDENCIES_UNAVAILABLE if Redis rate limiting is unavailable. Public GET has no application Redis rate limiter and falls back to PostgreSQL during cache outages. Database failures follow the existing sanitized 500 error envelope. Concurrent creation is serialized on the owner row so exactly one first page becomes primary.

## Example LINK request and public fixture for Girish

```json
{
  "type": "LINK",
  "content": {
    "title": "My website",
    "url": "https://example.com/",
    "openInNewTab": true
  },
  "isVisible": true
}
```

Public response fixture (all values are example data):

```json
{
  "data": {
    "profile": {
      "username": "rohan",
      "displayName": "Rohan",
      "bio": "Building kachko",
      "avatarUrl": null
    },
    "page": {
      "slug": "rohan",
      "isPrimary": true,
      "title": "Rohan's links",
      "description": null,
      "themeKey": "minimal",
      "appearance": {
        "background": {
          "type": "solid",
          "color": "#FFFFFF"
        },
        "typography": {
          "fontFamily": "system",
          "titleSize": 32,
          "color": "#111827"
        },
        "buttons": {
          "variant": "filled",
          "radius": 12,
          "background": "#111827",
          "color": "#FFFFFF",
          "shadow": false
        },
        "cards": {
          "radius": 12,
          "background": "#FFFFFF",
          "blur": 0
        }
      }
    },
    "blocks": [
      {
        "id": "d6f0b953-461d-43b7-8e16-dbd98c10c1a1",
        "type": "LINK",
        "content": {
          "title": "My website",
          "url": "https://example.com/",
          "openInNewTab": true
        }
      }
    ],
    "socials": []
  }
}
```

## Local validation and next work

Apply migrations to the configured local database with `pnpm db:deploy`. The foundation migration adds tables; the subsequent page_revision migration adds revision=0 to existing pages. Neither creates pages for users nor changes identity data. The migration includes the PageBlock_position_nonnegative CHECK constraint, which Prisma schema syntax cannot express. Preserve it in future migrations.

```bash
pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:pages
```

`test:pages` uses uniquely named temporary PostgreSQL/Redis containers and applies all migrations twice. It verifies DB constraints/cascades/rollback, the real HTTP journey, ownership, concurrent create/append/rename, safe output, hidden links, publish/unpublish, profile/cache changes, deletion, moderation gates, Redis outage fallback and Swagger paths. It never targets development data. Unit tests verify strict request boundaries and dangerous-URL rejection.

Next for both: verify the real FE page/link/publish/public-renderer journey. TEXT and reorder support are also implemented; Girish can integrate them into the editor. No frontend files are changed by this API implementation.


## Cache behavior

Public requests first read PostgreSQL to check the current page ID/revision, published state and active/nondeleted owner. Cache keys are `page:{username[/pageSlug]}:{pageId}:{revision}` and expire after 60 seconds. Cache misses load a repeatable-read snapshot and store only the validated public allowlist. Old in-flight reads can populate only their old revision, so they cannot overwrite current content. Old keys expire naturally instead of relying on a Redis delete succeeding during a mutation. Redis failure falls back to the database. Browser/CDN responses use `Cache-Control: no-store`; frontend public loaders must also avoid persistent caching until they have an equivalent invalidation mechanism.

Profile edits (including display name and bio) increment revision, as do page/block edits and publication changes. Page recreation receives a new UUID. Future direct moderation/content writers must increment revision transactionally; active/deleted status changes are already enforced by the database gate. In-flight reads can complete using the snapshot current when they started; requests after a completed mutation see the current revision.

## Local Swagger test — actual endpoints

1. From the project root run `pnpm db:deploy`, then restart `pnpm dev`. Both PostgreSQL and Redis should be running. Apply the revision migration even if you already applied the page foundation migration.
2. Open **http://localhost:4000/api/docs**. Expand **Pages and blocks** and **Public pages**. If missing, restart the API and refresh the Swagger page.
3. Login/register through Swagger first. The browser stores the session cookie. Use `X-Kachko-CSRF: 1` for every POST/PATCH/DELETE. Local CORS_ORIGINS must include `http://localhost:4000`.
4. Execute `POST /api/v1/pages` with `{"title":"My links","description":"Welcome to my page"}`. Expect 201. Copy `data.id` as your page ID. If you already have a page, use `GET /api/v1/pages` to find its ID instead.
5. Execute `POST /api/v1/pages/{pageId}/blocks` with the LINK example above. Expect 201; save `data.id` as the block ID.
6. Execute `GET /api/v1/pages/{id}`: expect the draft and its ordered links. `GET /api/v1/public/{yourUsername}` should return 404 while it is a draft.
7. Execute `POST /api/v1/pages/{id}/publish` without a body. Expect 200. Open `http://localhost:4000/api/v1/public/{yourUsername}` in any browser: expect public JSON with visible links only.
8. Test block updates using PATCH with `{"content":{"title":"Updated website","url":"https://example.org/","openInNewTab":true}}` or `{"isVisible":false}`. Re-fetch public JSON to see the change.
9. Execute `POST /api/v1/pages/{id}/unpublish`: expect 200; public lookup must now return 404.

This implements the public JSON API. The frontend URL `http://localhost:3000/{username}` still depends on Girish's renderer.

## Curl test with an existing account

Use the same terminal. Replace the login credentials with your local account. Curl uses its own cookie jar, separate from your browser.

```bash
API=http://localhost:4000/api/v1
COOKIE_JAR=$(mktemp -t kachko-pages)
curl -i -c "$COOKIE_JAR" "$API/auth/login" \
  -H 'Content-Type: application/json' -H 'X-Kachko-CSRF: 1' \
  -d '{"email":"rohan.local@example.com","password":"Local-test-password-123!"}'

curl -i -b "$COOKIE_JAR" "$API/pages" \
  -H 'Content-Type: application/json' -H 'X-Kachko-CSRF: 1' \
  -d '{"title":"My links"}'

# Copy data.id from the creation response (or GET /pages if it already exists).
PAGE_ID=replace-with-page-uuid
curl -i -b "$COOKIE_JAR" "$API/pages/$PAGE_ID/blocks" \
  -H 'Content-Type: application/json' -H 'X-Kachko-CSRF: 1' \
  -d '{"type":"LINK","content":{"title":"My website","url":"https://example.com/"}}'
curl -i -b "$COOKIE_JAR" -X POST "$API/pages/$PAGE_ID/publish" -H 'X-Kachko-CSRF: 1'

# Replace with your current username.
curl -i "$API/public/rohan_dev"
curl -i -b "$COOKIE_JAR" -X POST "$API/pages/$PAGE_ID/unpublish" -H 'X-Kachko-CSRF: 1'
curl -i "$API/public/rohan_dev"

curl -i -b "$COOKIE_JAR" -X POST "$API/auth/logout" -H 'X-Kachko-CSRF: 1'
rm "$COOKIE_JAR"
```
