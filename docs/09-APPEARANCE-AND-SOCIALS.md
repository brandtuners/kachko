# kachko — Appearance, templates and social profiles

**Backend implemented:** six system themes, validated page appearance, three templates, social CRUD/reorder, public output, cache invalidation and Swagger. Rohan owns the API/config; Girish owns the theme picker, appearance controls, template confirmation UX, social editor/icons and matching preview/public renderer. Step 6 remains open until they verify the real frontend journey.

## Local setup

From the root, run `pnpm db:deploy`, then restart `pnpm dev`. The additive `20260916030000_appearance_socials` migration creates Theme, PageTemplate and SocialProfile, seeds the catalog, and adds Page.appearanceOverrides plus a foreign key from Page.themeKey to Theme.slug. Existing pages retain minimal theme and get empty overrides. It does not replace page content or user data. Catalog seed data is versioned in the migration, so no separate `db:seed` command is needed.

Open **http://localhost:4000/api/docs**. Catalog routes appear under **Themes and templates**; owner routes under **Appearance and social profiles**. Login first for owner operations. Mutations require the existing session cookie and `X-Kachko-CSRF: 1` (CORS_ORIGINS must include the local Swagger origin).

## Endpoints

Paths are under `/api/v1`.

| Method | Path | Result |
|---|---|---|
| GET | `/themes` | Public, 200 `{data:SystemTheme[]}` |
| GET | `/themes/:key` | Public, 200 `{data:SystemTheme}` |
| GET | `/templates` | Public, 200 `{data:PageTemplate[]}` |
| GET | `/templates/:key` | Public, 200 `{data:PageTemplate}` |
| GET | `/pages/:pageId/appearance` | Owner, 200 `{data:{themeKey,appearance,overrides}}` |
| PATCH | `/pages/:pageId/appearance` | Owner, 200 `{data:OwnerPage}` |
| POST | `/pages/:pageId/template` | Owner, 200 `{data:OwnerPage}` |
| GET | `/pages/:pageId/socials` | Owner, 200 `{data:SocialProfile[]}` |
| POST | `/pages/:pageId/socials` | Owner, 201 `{data:SocialProfile}` |
| PATCH | `/pages/:pageId/socials/:socialId` | Owner, 200 `{data:SocialProfile}` |
| DELETE | `/pages/:pageId/socials/:socialId` | Owner, 200 `{data:{deleted:true}}` |
| POST | `/pages/:pageId/socials/reorder` | Owner, 200 `{data:SocialProfile[]}` |

Use theme **keys** (e.g. `dark`) in these APIs, not the catalog UUID. Theme management endpoints are not exposed to users. Nested social paths and POST reorder supersede the shorter LLD social paths and PATCH reorder example. All owner lookups verify page ownership; a missing/foreign page or social returns the same 404. Catalog reads need no session. Owner routes share the existing 120/minute/IP page limit.

## Themes and appearance

Seeded keys: `minimal`, `dark`, `gradient`, `professional`, `elegant`, `nature`. The API returns structured config with background, typography, buttons and cards. Girish builds CSS from these allowlisted options. Font tokens `system`, `sans`, `serif`, `mono` map to controlled local/system font stacks; they are not URLs or arbitrary CSS/font imports.

Choose a theme:

```json
{"themeKey":"dark"}
```

Customize the current theme:

```json
{
  "overrides": {
    "background": {"type":"gradient","from":"#111827","to":"#312E81","angle":135},
    "typography": {"fontFamily":"sans","titleSize":36,"color":"#FFFFFF"},
    "buttons": {"radius":20,"variant":"filled","background":"#FFFFFF","color":"#111827","shadow":true},
    "cards": {"radius":20,"background":"#111827","blur":8}
  }
}
```

Colors require six-digit hex. Background is either `{type:"solid",color}` or `{type:"gradient",from,to,angle}` with integer angle 0–360. Title size is integer 20–48, button/card radius 0–32, card blur 0–24, button variant filled/outline/glass, shadow boolean. Arbitrary CSS, style tags, URLs, image backgrounds and unknown fields are rejected. Color-contrast/accessibility checks remain part of the frontend acceptance gate; arbitrary valid custom colors are not guaranteed to be accessible.

`overrides` is a **complete replacement of stored overrides**, not a deep PATCH of prior overrides. Its provided section fields merge with the selected system theme. Background, if supplied, must be a complete solid/gradient definition. `{overrides:{}}` clears customizations. Selecting a theme resets previous overrides unless you also supply overrides in the same request. The API returns fully resolved `appearance` for direct preview/public use and `appearanceOverrides` on OwnerPage for editing. Save these semantics consistently in the client.

Theme/config changes increment Page.revision transactionally. Catalog entries are read-only through this API; any future administrative/migration change to a theme must bump affected pages' revisions so cached resolved appearance cannot outlive the change.

## Templates

Seeded keys: `starter` (minimal theme, intro + link), `creator` (gradient, intro + two links), `professional` (professional theme, intro + link). Templates contain only validated LINK/TEXT data. Example links point to example.com and are labeled for replacement.

Create a draft page from a template using the existing POST `/pages`:

```json
{"title":"My portfolio","templateKey":"professional"}
```

This atomically creates the page, theme assignment and ordered blocks, while preserving the single-page-per-user constraint. Existing pages can apply a template:

```json
{"templateKey":"creator","replaceExistingBlocks":false}
```

An existing nonempty block list returns 409 TEMPLATE_REPLACE_REQUIRED. After the user confirms replacement in the UI, send `replaceExistingBlocks:true`. The operation atomically replaces blocks with fresh IDs, selects the template theme, clears overrides and increments revision. It preserves title, description, social profiles and publication state. Applying to a published page changes public content immediately on success. Applying to an empty page needs no replacement confirmation. Template application stores independent page blocks, not a live link to template content; subsequent edits do not change the catalog. Reapplying creates fresh blocks again.

## Social profiles

Create example:

```json
{
  "platform":"GITHUB",
  "username":"rohan",
  "url":"https://github.com/rohan",
  "isVisible":true
}
```

Supported platforms and URL-host policy:

| Platform | Allowed domain(s), including their subdomains |
|---|---|
| INSTAGRAM | instagram.com |
| YOUTUBE | youtube.com, youtu.be |
| X | x.com, twitter.com |
| LINKEDIN | linkedin.com |
| FACEBOOK | facebook.com, fb.com |
| TIKTOK | tiktok.com |
| GITHUB | github.com |
| DISCORD | discord.com, discord.gg |
| TWITCH | twitch.tv |
| SPOTIFY | spotify.com |

URLs must be absolute HTTP(S), at most 2048 input characters, without credentials, whitespace/control characters, backslashes or custom ports. Host matching uses a domain boundary, so github.com.evil.example is rejected. URLs normalize through URL.href. This validates platform destination syntax, not account ownership; the API does not fetch social URLs. Username is optional display metadata, trimmed to 1–100 characters; null clears it. It is not inferred from the URL. The URL is authoritative for navigation. Duplicate platforms are permitted (for multiple accounts).

Visibility defaults to true. New entries append; server controls IDs/page/position/timestamps. PATCH accepts any nonempty subset of platform, url, username, isVisible, and validates the merged result against the stored profile. A platform change may require a new URL in the same request. Icons come from Girish's controlled platform registry, not from user-provided SVG/HTML/icon URLs.

Reorder uses `{items:[{id,position},...]}` with the complete current social list, including hidden entries, and positions exactly 0..N-1. Duplicate/malformed/gapped input is 400. A stale/missing/foreign ID set is 409 SOCIAL_ORDER_CONFLICT. Reload the owner list before retrying. Updates serialize with all other page mutations and bump revision; deletion compacts remaining positions. Reorder returns the ordered owner social list. Text-block reorder remains a separate endpoint and cannot reorder social IDs.

## Public data and compatibility

OwnerPage now includes `appearance`, `appearanceOverrides` and ordered `socials`, in addition to blocks. PageSummary still includes themeKey. Public lookup returns resolved config at `data.page.appearance` and visible social profiles at `data.socials`. Public socials contain only id, platform, username and url; no pageId, visibility, positions or timestamps. Array order defines public display order. Profile/block fields retain their existing meaning.

Girish should use the same resolved appearance and social registry in preview and public rendering. Shared types live in `@kachko/types`; appearance/social validation and resolveAppearance live in `@kachko/validation`. Update frontend fixtures to include appearance and socials. Old Redis entries missing these fields fail strict parsing and reload from PostgreSQL. Normal edits select new revision keys; public responses remain no-store and always check publication/account state first.

Errors use the existing envelope. Added codes: 404 THEME_NOT_FOUND, TEMPLATE_NOT_FOUND, SOCIAL_NOT_FOUND; 409 TEMPLATE_REPLACE_REQUIRED, SOCIAL_ORDER_CONFLICT. Existing VALIDATION_ERROR, CSRF_REJECTED, UNAUTHENTICATED, PAGE_NOT_FOUND and RATE_LIMITED remain in use. Unknown enum keys in mutation bodies are validation errors (400); unknown catalog lookup keys are 404.

## Local test sequence

1. GET `/themes` and `/templates` without authentication; expect six themes and three templates.
2. Login, GET `/pages`, and copy your page ID (or POST a draft page from a template).
3. PATCH `/pages/{pageId}/appearance` with `{"themeKey":"dark"}`. Reload GET appearance/page; verify persistence.
4. Save the override example, publish if needed, and GET `/public/{username}`; verify the resolved settings. Try an arbitrary CSS/URL color: expect 400.
5. POST `/pages/{pageId}/socials` twice using supported platform URLs. PATCH visibility, reorder with real IDs, and verify owner versus public output.
6. Apply a template without replacement confirmation to a page containing blocks; expect 409 and no changes. Apply with explicit confirmation only when ready to replace those blocks.
7. Verify another account receives 404 when editing your appearance, template or socials.

Automated checks:

```bash
pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:pages
```

The isolated PostgreSQL/Redis test applies seeds/migrations twice, validates catalog configs, and exercises persistence/cache changes, unsafe-input rejection, ownership, social ordering/concurrency, template conflict rollback, confirmed replacement and template-based page creation. Existing page/block/TEXT/reorder journeys run too. Frontend rendering/accessibility and browser integration still need joint verification.

### Additional system themes

Aurora (`aurora`), Neon Pop (`neon-pop`), Cyan Pulse (`cyan-pulse`), Sunset Lime
(`sunset-lime`) and Coral Drift (`coral-drift`) are included in the system catalog.
Their legacy design objects are normalized to the current contract: two-stop
160-degree gradients, sans typography, 24px radius, named accent colors mapped to
hex, solid → filled, and opaque cards. Legacy `via`, glow effects, alpha card
colors, Inter and Clash Display are not represented by this contract.

The inserts are present in `20260916030000_appearance_socials` as requested.
`20260916110000_add_neon_system_themes` uses `ON CONFLICT (slug) DO NOTHING` so
existing databases also receive them with `pnpm db:deploy`, without replacing
existing catalog values. Editing an already-applied migration can trigger a
checksum warning in `prisma migrate dev`; do not reset a database containing data
to clear it. For shared environments, preserve the original migration file and
use only the follow-up migration.

### Neon presentation refinement

Migration `20260916120000_refine_neon_theme_presentation` restores the reference
three-stop gradients, top glow, translucent cards and subtle borders for the five
neon presets. Their headings are 20px and buttons use the glass variant.
`background.via` and `background.glow` are optional; `cards.border` is optional.
Glow/card colors accept validated six- or eight-digit hex values, never arbitrary
CSS. Custom font loading remains separate. The shared frontend theme helpers apply
these settings to catalog cards, editor previews and public pages. Existing page
revisions increment during migration to invalidate public caches; saved overrides
remain intact.
