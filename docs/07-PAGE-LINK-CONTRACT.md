# kachko — Page and LINK API

**Status:** page and LINK CRUD, publish/unpublish, public lookup, shared contracts and revision-based Redis caching are implemented and available in Swagger. Girish can integrate the real endpoints. The Step 4 completion gate remains open until both verify the frontend/public renderer journey.

## Data and scope decisions

- V1 has zero or one Page per User, enforced by unique Page.userId. Creating a page derives slug from the authenticated owner's normalized username. Neither owner ID nor slug is accepted from the client.
- Page contains id, userId, unique slug, nullable title/description, isPublished=false, publishedAt=null, themeKey="minimal", internal revision=0, and timestamps. Page deletion cascades to blocks; user deletion cascades to the page and blocks. No page is automatically created during signup.
- PageBlock contains id, pageId, type=LINK, nonnegative position, isVisible=true, JSON content and timestamps. Ordering indexes support owner/public reads. Position uniqueness/contiguous order is maintained by owner-row locks and transactional append/delete; the DB currently checks nonnegativity, not uniqueness. JSON content is validated by the shared schema at API boundaries.
- Only LINK is currently allowed in the database enum and shared contracts. Other documented block types will be added with their implementations. No media IDs, icons or custom styles are accepted in this slice; thumbnails require the later verified media flow.
- `minimal` is the sole default theme key. No custom theme input is accepted. The Theme catalog/relation from the LLD is deferred to appearance work; the public renderer must recognize this key. Future theme migration must preserve existing pages' minimal appearance.
- Existing profile username changes update User.username and Page.slug in one Prisma transaction. A failure rolls back both. Every page, block or profile edit increments the page revision in the same transaction. Public cache keys include username, page ID and revision, making previous entries unreachable. Unpublish, page deletion and account suspension/deletion are checked against PostgreSQL before serving cached content.

These are the current blueprint resolutions of the broader LLD examples: one page per user, a minimal theme key instead of an unimplemented Theme relation, and LINK-only block content. They do not mark later block/theme features complete.

## Shared packages

`@kachko/validation` exports createPageSchema, updatePageSchema, createLinkBlockSchema, updateLinkBlockSchema, linkContentSchema, linkUrlSchema, pageIdSchema, blockIdSchema, publicPageSchema and their input types.

`@kachko/types` exports PageSummary, OwnerPage, LinkBlock, LinkBlockContent, PublicPage, PageResponse, PageListResponse, LinkBlockResponse, PublicPageResponse, DeleteResponse and PageErrorCode. Timestamps in JSON are ISO 8601 strings. Public data uses an explicit allowlist rather than a database-model spread.

Page title: null or 1–120 trimmed characters. Description: null or at most 300 trimmed characters. Create accepts an empty object; PATCH requires at least one permitted field. Null clears a field. Slug, owner, theme, publish state, IDs and timestamps are server-managed.

LINK content: title (1–120 trimmed characters), url (absolute HTTP(S), maximum 2048 input characters), openInNewTab (boolean, default true). URL normalization uses URL.href. Reject credentials, relative URLs, other protocols, whitespace, control characters and backslashes. The API must not fetch destinations. This is scheme validation, not a promise that a destination is trustworthy. Render user text as text and links opening new tabs with `rel="noopener noreferrer"`.

Block create accepts type="LINK", content, and optional isVisible (default true). Block PATCH accepts content and/or isVisible. Content is a complete replacement, so an update of content must include both title and url. The client cannot set position, pageId, type on update, or IDs. The server appends new blocks under an owner-row transaction/lock, and reads order by position then id.

## Implemented endpoints

All protected routes require the existing session; mutations require X-Kachko-CSRF: 1 and an allowed Origin. Every lookup must scope page ownership, including nested block operations. Foreign page/block IDs return the same 404 as missing IDs. Public lookup requires no session.

| Method | Path under `/api/v1` | Request | Success |
|---|---|---|---|
| GET | `/pages` | none | 200 PageListResponse, array length 0 or 1 |
| POST | `/pages` | `{title?,description?}` | 201 PageResponse, draft with blocks=[] |
| GET | `/pages/:id` | none | 200 PageResponse with ordered blocks |
| PATCH | `/pages/:id` | `{title?,description?}` | 200 PageResponse |
| DELETE | `/pages/:id` | none | 200 `{data:{deleted:true}}` |
| POST | `/pages/:pageId/blocks` | `{type:"LINK",content,isVisible?}` | 201 LinkBlockResponse |
| PATCH | `/pages/:pageId/blocks/:blockId` | `{content?,isVisible?}` | 200 LinkBlockResponse |
| DELETE | `/pages/:pageId/blocks/:blockId` | none | 200 `{data:{deleted:true}}` |
| POST | `/pages/:id/publish` | none | 200 PageResponse |
| POST | `/pages/:id/unpublish` | none | 200 PageResponse |
| GET | `/public/:username` | none | 200 PublicPageResponse |

Reorder remains Step 5, using the blueprint's POST `/pages/:pageId/blocks/reorder` body and transaction rules. Publishing an empty page is allowed (profile-only page); publication sets publishedAt, repeated publish preserves it, and unpublish clears it. Owner reads include hidden blocks; public reads exclude them and exclude email/userId/roles/session data/private timestamps. Draft, missing, inactive-owner or deleted-owner pages return 404 on public lookup. Edits to published pages appear publicly after saving; this slice does not keep a separate draft snapshot of published content.

Error envelope is `{error:{code,message}}`: 400 VALIDATION_ERROR, 401 UNAUTHENTICATED, 403 CSRF_REJECTED, 404 PAGE_NOT_FOUND or BLOCK_NOT_FOUND, 409 PAGE_ALREADY_EXISTS, 429 RATE_LIMITED. Protected page endpoints share a limit of 120 requests/minute/IP and fail closed with 503 DEPENDENCIES_UNAVAILABLE if Redis rate limiting is unavailable. Public GET has no application Redis rate limiter and falls back to PostgreSQL during cache outages. Database failures follow the existing sanitized 500 error envelope. A second page must fail against the DB constraint even for concurrent create requests.

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
      "title": "Rohan's links",
      "description": null,
      "themeKey": "minimal"
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
    ]
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

Next for both: verify the real FE page/link/publish/public-renderer journey. Then Rohan can implement TEXT and reorder support (Step 5), while Girish develops the editor. No frontend files are changed by this API implementation.


## Cache behavior

Public requests first read PostgreSQL to check the current page ID/revision, published state and active/nondeleted owner. Cache keys are `page:{username}:{pageId}:{revision}` and expire after 60 seconds. Cache misses load a repeatable-read snapshot and store only the validated public allowlist. Old in-flight reads can populate only their old revision, so they cannot overwrite current content. Old keys expire naturally instead of relying on a Redis delete succeeding during a mutation. Redis failure falls back to the database. Browser/CDN responses use `Cache-Control: no-store`; frontend public loaders must also avoid persistent caching until they have an equivalent invalidation mechanism.

Profile edits (including display name and bio) increment revision, as do page/block edits and publication changes. Page recreation receives a new UUID. Future direct moderation/content writers must increment revision transactionally; active/deleted status changes are already enforced by the database gate. In-flight reads can complete using the snapshot current when they started; requests after a completed mutation see the current revision.

## Local Swagger test — actual endpoints

1. From the project root run `pnpm db:deploy`, then restart `pnpm dev`. Both PostgreSQL and Redis should be running. Apply the revision migration even if you already applied the page foundation migration.
2. Open **http://localhost:4000/api/docs**. Expand **Pages and links** and **Public pages**. If missing, restart the API and refresh the Swagger page.
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
