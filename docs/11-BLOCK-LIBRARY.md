# Block library

Rohan owns API contracts; Girish owns editor/public presentation.
All types use POST `/api/v1/pages/:pageId/blocks` with `{type, content}`.
PATCH `/api/v1/pages/:pageId/blocks/:blockId` replaces complete content for the stored type.
Visibility, deletion, reorder, owner checks and publication use the existing endpoints.

| Type | Content example |
|---|---|
| LINK | `{"title":"Website","url":"https://example.com","openInNewTab":true}` |
| TEXT | `{"text":"Hello","alignment":"left"}` |
| IMAGE | `{"mediaId":"<owned-media-uuid>","alt":"Mountain","href":"https://example.com"}` |
| SOCIAL | `{"platform":"GITHUB","username":"rohan"}` |
| DIVIDER | `{}` |
| YOUTUBE | `{"videoId":"dQw4w9WgXcQ"}` |
| SPOTIFY | `{"url":"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"}` |
| EMAIL | `{"email":"hello@example.com"}` |
| PHONE | `{"number":"+91 9876543210"}` |
| LOCATION | `{"query":"Mumbai, India"}` |

Images use managed, owner-verified media from [12-MEDIA-API.md](12-MEDIA-API.md).
The API resolves `mediaId` to a public URL after enforcing ownership; arbitrary
image URLs, data URLs and user-controlled iframe hosts are rejected. Spotify
accepts track/playlist/album/episode/show/artist URLs. Social blocks use a
platform and handle; separate social profiles retain their URL-based contract.

Run `pnpm db:deploy` before starting the updated API, then `pnpm dev`.
Open Links → Blocks library to add each type, edit content and save. Image creation asks for URL and alt text. Publish and check `/username`; verify hidden blocks disappear and reorder persists. Swagger at `/api/docs` describes all ten request variants. Mutation requests require `X-Kachko-CSRF: 1` and an authenticated session.
