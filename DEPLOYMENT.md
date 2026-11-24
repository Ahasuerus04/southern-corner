# Deploying Sidewave

## Vercel environment variables

`.env.local` is intentionally gitignored, so a Vercel deployment needs its own
copy of the server-side configuration. Add these in **Project → Settings →
Environment Variables** for **Production** (and Preview if used), then
**redeploy** — Vercel does not apply environment changes to existing
deployments.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL URL (`sslmode=require`) |
| `BETTER_AUTH_SECRET` | At least 32 random characters |
| `BETTER_AUTH_URL` | Canonical HTTPS URL, e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Same canonical HTTPS URL |
| `AWS_ACCESS_KEY_ID` | Neon Object Storage credential (`token_id`) |
| `AWS_SECRET_ACCESS_KEY` | Neon Object Storage secret |
| `AWS_ENDPOINT_URL_S3` | Neon branch storage endpoint |
| `AWS_REGION` | `auto` (Neon uses `auto`; set it explicitly — see below) |
| `NEON_STORAGE_BUCKET` | Private bucket name |
| `S3_FORCE_PATH_STYLE` | `true` for Neon Object Storage |

Vercel sets `AWS_REGION` to the function's own region when it is not configured.
Set it explicitly, or use the `S3_*` aliases (`S3_ENDPOINT`, `S3_REGION`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). The application
prefers `S3_*` values so Vercel's ambient AWS credentials cannot shadow the
Neon credentials.

Check the deployment after redeploying:

```
GET https://your-app.vercel.app/api/health
```

`ok`, `database`, and `storage.reachable` must all be true.

## Bucket CORS for direct uploads

The admin upload screen sends audio and artwork **directly from the browser to
object storage** using short-lived presigned URLs. This bypasses Vercel's
4.5 MB function request-body limit. The bucket must allow the site's origin:

```sh
bun run storage:cors -- https://your-app.vercel.app
```

You can also set a comma-separated `APP_ORIGINS` in `.env.local` and run
`bun run storage:cors`. Localhost is always included. The command uses the
storage credentials in `.env.local`, so run it from your computer.

Without this rule the browser's preflight request fails and uploads report a
direct-upload/CORS error.

## Upload flow

1. The editor asks `POST /api/admin/music/presign` for one short-lived URL per
   file.
2. The browser PUTs the bytes straight to Neon Object Storage.
3. The editor sends the metadata and object keys to
   `POST /api/admin/music/upload` as JSON.
4. The server reads the uploaded object back, validates the MP3 signature and
   audio stream (or re-encodes the artwork with Sharp), then writes the
   database row. Invalid objects are deleted.

The multipart upload endpoints remain available for local/non-Vercel
deployments and existing clients.
