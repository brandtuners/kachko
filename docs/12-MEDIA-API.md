# Managed media API

Managed image uploads are implemented for avatars and IMAGE blocks. PostgreSQL
stores ownership and metadata. Local development stores bytes under `tmp/media`;
deployed environments can use Cloudflare R2 through its S3-compatible API.

## Limits and security

- Authentication is required for authorization, completion, listing and deletion.
- Browser mutations require `X-Kachko-CSRF: 1`.
- Allowed types: JPEG, PNG, WebP and GIF.
- Maximum stored size: 5 MiB. Maximum decoded width/height: 4096px.
- Completion decodes the stored bytes with Sharp and checks the real format,
  dimensions and byte count. Client MIME, extension and dimensions are hints only.
- Upload authorizations live in Redis for 15 minutes and are bound to the owner,
  declared MIME, byte size and avatar purpose.
- IMAGE creation/update verifies that `mediaId` belongs to the page owner.
- Attached media returns `MEDIA_IN_USE` on deletion. Detach it first.
- API responses never expose the storage key or R2 credentials.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/media/upload-url` | Authorize an upload |
| PUT | returned `uploadUrl` | Upload exact bytes (local API or presigned R2) |
| POST | `/api/v1/media/complete` | Inspect bytes and create metadata |
| GET | `/api/v1/media` | List the current owner's media |
| GET | `/api/v1/media/:mediaId` | Read owned metadata |
| DELETE | `/api/v1/media/:mediaId` | Delete unused owned media |
| DELETE | `/api/v1/media/avatar` | Remove the current avatar and delete unused storage |
| GET | `/api/v1/media/files/:mediaId` | Serve completed local media publicly |

Authorize:

```json
{"mimeType":"image/png","size":12345,"forAvatar":false}
```

Complete after uploading to the returned target:

```json
{"storageKey":"00000000-0000-4000-8000-000000000001","width":800,"height":600,"forAvatar":false}
```

Create an IMAGE block with the returned media ID:

```json
{"type":"IMAGE","content":{"mediaId":"00000000-0000-4000-8000-000000000002","alt":"Mountain at sunrise"}}
```

Owner and public page responses resolve the managed media to a safe `url` in the
IMAGE content. The browser never sends that URL back when editing the block.

## Configuration

Local defaults:

```dotenv
MEDIA_STORAGE=local
MEDIA_LOCAL_DIR=./tmp/media
```

R2 requires `MEDIA_STORAGE=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and a clean HTTPS `R2_PUBLIC_URL`. Configure
bucket CORS to permit PUT from the frontend origins with `Content-Type`. Configure
an R2 lifecycle rule to remove incomplete/orphan upload objects.

Removing an avatar also deletes its media row and stored object when no IMAGE
block references that media. If an IMAGE block shares it, the endpoint clears
the avatar while preserving the media required by the block. Replacing an
avatar applies the same cleanup to the previous image.

Run `pnpm db:deploy` before starting the API. Local verification is covered by
`pnpm --filter api test:pages`; it uses isolated PostgreSQL, Redis and storage.
