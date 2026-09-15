# kachko — TEXT blocks and editor ordering

**Implemented:** TEXT create/update/delete/visibility, mixed LINK/TEXT owner/public responses, atomic reorder, cache revision changes, Swagger examples and automated tests. Rohan owns the backend; Girish still owns the text renderer/editor, drag-and-drop/manual controls, autosave/retry and browser integration. This does not mark the complete Step 5 FE/editor gate finished.

## Local setup

Run `pnpm db:deploy` from the root to apply `20260916020000_text_blocks`, then restart `pnpm dev`. The migration adds TEXT to the existing PostgreSQL BlockType enum; existing LINK rows are unchanged. Rebuilding/generating Prisma alone does not update the database. Both PostgreSQL and Redis are needed for protected API requests.

Open **http://localhost:4000/api/docs** and expand **Pages and blocks**. Login through Swagger first to obtain the session cookie. All POST/PATCH/DELETE requests require `X-Kachko-CSRF: 1`. See [page API setup](07-PAGE-LINK-CONTRACT.md) if you do not have a page yet.

## Endpoints

| Method | Path under `/api/v1` | Behavior |
|---|---|---|
| POST | `/pages/:pageId/blocks` | Create LINK or TEXT; append at the end |
| PATCH | `/pages/:pageId/blocks/:blockId` | Replace content or change visibility for the stored block type |
| DELETE | `/pages/:pageId/blocks/:blockId` | Delete either type and compact positions |
| POST | `/pages/:pageId/blocks/reorder` | Atomically reorder all blocks; return 200 `{data:OwnerPage}` |
| GET | `/pages/:id` | Owner page with all blocks in order |
| GET | `/public/:username` | Published page with visible blocks in order |

Create TEXT (201):

```json
{
  "type": "TEXT",
  "content": {
    "text": "Welcome to my page!\nHere are my latest updates.",
    "alignment": "left"
  },
  "isVisible": true
}
```

Text is plain text: 1–5000 characters, cannot be only whitespace, and preserves leading/trailing whitespace and newlines. Alignment accepts `left`, `center`, `right`; omitted alignment defaults to `left`. Visibility defaults to true. No HTML, Markdown, styles, media or format flags are accepted as fields. A text value containing HTML-like characters remains literal text; the frontend must render it as text, never dangerouslySetInnerHTML. Use whitespace-preserving rendering such as `white-space: pre-wrap`.

Update TEXT (200):

```json
{"content":{"text":"Updated text","alignment":"center"}}
```

Hide/show either type (200):

```json
{"isVisible":false}
```

Content is a full replacement. Omitting alignment while replacing TEXT resets it to left. Existing LINK updates still require title and url and retain their existing default/validation rules. The stored type is immutable; a TEXT-shaped payload cannot overwrite LINK content, nor vice versa. Unknown/type fields on PATCH are rejected. Type-specific validation occurs against the owned stored block while holding the mutation lock.

## Reorder contract

Use real IDs from GET `/pages/:id`. Send every current block, including hidden ones, exactly once:

```json
{
  "items": [
    {"id":"d6f0b953-461d-43b7-8e16-dbd98c10c1a1","position":1},
    {"id":"d6f0b953-461d-43b7-8e16-dbd98c10c1a2","position":0}
  ]
}
```

The position values define the order, regardless of array order. They must be unique integers covering exactly `0..N-1`. Duplicate IDs/positions, negative/fractional/gapped positions, malformed UUIDs or unknown fields return 400 VALIDATION_ERROR. An owned page with no blocks accepts `{items:[]}`.

The API locks the same owner row used by block creation/deletion, checks the complete current ID set, bulk-updates positions and timestamps, and increments the page cache revision in a single transaction. It returns the full ordered owner page. Missing/foreign page returns 404 PAGE_NOT_FOUND. Missing/extra/foreign block IDs, or a block set changed by another request, return 409 BLOCK_ORDER_CONFLICT with no changes; reload the page and retry using the current complete list. Authentication/CSRF/rate-limit responses are unchanged (401/403/429; page routes share 120/min/IP).

Concurrent operations serialize: content edits do not get overwritten by reorder; a create/delete that commits first can make an older reorder request stale. Two valid reorders of the same block set use last-committed ordering. This is not optimistic conflict detection for simultaneous content edits. Do not replay stale autosave payloads blindly; show failures and reload/reconcile on conflict.

Public output preserves relative order while omitting hidden blocks. A reorder, text edit or visibility change increments the same revision used by public caching. Only public fields and type-specific content are serialized. Existing page publication, username updates, owner checks and Redis-outage fallback continue to apply.

## Girish's contracts and handoff

- Shared response types: `PageBlock = LinkBlock | TextBlock`, `PublicBlock`, `TextBlockContent`, `BlockResponse`, `ReorderBlocksResponse` and `OwnerPage.blocks`. Narrow on `block.type` before reading content fields. Existing LINK-only types remain exported.
- Shared schemas: createBlockSchema, updateBlockSchema, createTextBlockSchema, updateTextBlockSchema, textContentSchema, reorderBlocksSchema and publicBlockSchema. Existing LINK-only schemas remain exported. Use input types for form values and parsed output for defaults.
- Build the TEXT form and matching preview/public renderer. Preserve plain text/newlines and implement alignment consistently.
- Send the full block list, including hidden blocks, from drag-and-drop or keyboard/manual move controls. On success replace ordering with the returned page. On errors retain edits, show retry, and handle BLOCK_ORDER_CONFLICT by refreshing/reconciling.
- Verify responsive layouts, accessibility, save loading/failure/retry, and reload persistence against the real API before closing Step 5.

## Swagger test sequence

1. GET `/pages` and copy your page ID.
2. POST `/pages/{pageId}/blocks` using the TEXT example. Add a LINK too if the page does not already have one.
3. PATCH the TEXT block with different text/alignment. Try a LINK-shaped content body on it: expect 400 and unchanged data.
4. GET `/pages/{id}` and collect all block IDs, including hidden blocks. POST `/pages/{pageId}/blocks/reorder` with reversed positions. Expect 200 with the new order.
5. Publish the page if needed, then GET `/public/{username}`. Verify mixed blocks, correct text/alignment and new order. Hide a TEXT block and verify it disappears publicly but remains in owner GET.
6. Send duplicate positions (400), omit a block (409), or use a different account on the page (404). Verify the previous order remains intact after each failure.
7. Delete a TEXT block and reload: positions are compacted and public output reflects deletion.

## Automated verification

```bash
pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:pages
```

The real PostgreSQL/Redis page integration test covers existing LINK behavior, TEXT defaults/editing/type mismatch/deletion, public caching/visibility, invalid/stale/foreign-page reorders, rollback invariants, empty pages, concurrent content edits and concurrent create/delete/reorder. Google/password behavior is unchanged. No frontend/browser rendering tests are claimed.
