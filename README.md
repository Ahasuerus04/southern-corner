# Sidewave

A public independent music archive. Listeners need no accounts. Bun, Next.js App Router, strict TypeScript, Zustand, Drizzle, Neon PostgreSQL, Better Auth and private S3-compatible media. No GitHub connection is needed.

## Listen locally without credentials

Download and extract the source, install Bun 1.4 or newer, and open a terminal **on your own computer** in the extracted project:

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3000. Without `DATABASE_URL`, development serves four explicitly identified demo recordings with generated PCM audio. Search, genre filters, sorting, release links, playback and WAV downloads work without a database. Demo counts stay at zero; nothing is seeded or written to Neon. Production never substitutes demo releases. No schema changes, account creation, or paid-service provisioning occur on install or startup.

## Enable the real catalog on your computer

1. Copy `.env.example` to `.env.local`. Keep it private. Set `DATABASE_URL` to the pooled PostgreSQL URL from your Neon project with TLS enabled (`sslmode=require`). Choose a fresh development branch/database for initial testing. Do not use database-owner credentials for public client code; only the server receives this URL.
2. Set `BETTER_AUTH_SECRET` to a locally generated random secret of at least 32 characters (e.g. `openssl rand -base64 32`). Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `http://localhost:3000`. Set `CONTACT_EMAIL` to display your public contact on About.
3. Create a **private** R2 bucket. Create scoped object read/write/delete credentials for just that bucket. Set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. For another S3-compatible service, substitute its endpoint and region. No public bucket URL or browser storage credentials are needed. Audio is MP3 up to 32 MiB; covers are JPEG/PNG/WebP up to 5 MiB and are re-encoded as WebP. Uploads are server mediated.
4. Review `lib/schema.ts` and `db/migrations/0000_initial_catalog.sql`. When ready, run the following **locally and explicitly**:

```sh
bun run auth:enable
bun run db:migrate
```

`auth:enable` checks for the database URL and secret, then installs `setup/providers.ts.template` as `lib/providers.ts`. The shipped adapter otherwise denies every administrative request. `db:migrate` applies the bundled Drizzle migration to the database in `.env.local`. Back up existing data before migrations. The database starts empty: publish your own recordings, not the development fixtures.

5. Temporarily set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 16 characters in `.env.local`. Run `bun run admin:create` once. It hashes the password using Better Auth's password utility and creates the user and credential account together in a transaction. An existing email is never silently upgraded or overwritten. Remove both bootstrap variables immediately afterward.
6. Restart `bun run dev`, open `/admin/login`, and sign in. Upload an MP3, add its metadata and artwork, and save it as a draft or mark it published. Every administrative page and mutation checks the server-side session and role. No public registration endpoint or role-input field is exposed.

### Optional Resend password resets

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to a sender on your verified Resend domain. Restart the server. The login page shows a recovery action only when configured; reset responses do not disclose account existence. Reset links point to the configured canonical origin. No credentials are sent to browsers.

## Counts, ranking, and playback

The client POSTs to `/api/download/[id]`. The server checks publication, checks object existence, and signs a short-lived attachment URL. A PostgreSQL transaction atomically increments the cached counter and inserts one event; it rechecks publication and the audio key. Failed storage checks or rolled-back transactions do not increment counts. The metric is **accepted download requests**, not completed browser transfers. Plays and cover loads never call the download endpoint. Existing signed links expire after 120 seconds; unpublishing prevents new links, not copies already downloaded.

Both chart views use the same query: published only, `download_count DESC, created_at DESC, id ASC LIMIT 10`. Public data is read per request; the UI refreshes after an accepted download. A single public audio player survives in-app navigation. Playback, seeks and volume are session-only.

The single-process limiter stores HMAC'd keys and expiring counters in memory; no IP or fingerprint is stored in download events. Expired entries are reusable and swept under pressure. Without a trusted reverse proxy, requests share one local bucket. Only enable `TRUST_PROXY=1` behind a proxy that **overwrites** `X-Real-IP`. For multiple instances, replace the local limiter with a shared atomic limit store. Media replacement writes new keys first, commits metadata, then deletes old keys. Cleanup failures log the key for operator retry; periodically reconcile bucket keys with database references after crashes.

## Checks and deployment

```sh
bun test
bun run typecheck
bun run lint
bun run build
bun run start
```

Production requires the same server-only configuration, the enabled auth adapter, migrated Neon schema and HTTPS canonical URLs. Deploy to a Bun/Node-compatible server with sufficient multipart body and timeout limits (at least 38 MiB for this implementation). Platforms with smaller ingress caps need presigned multipart uploads or a smaller file limit. Run migrations as a separate release step, never per request. Back up Neon and configure object versioning/lifecycle policies as appropriate. GitHub is optional.

### Live acceptance checklist

These steps need your own credentials and were not run against live services here. Sign in, reload a protected page, sign out and confirm it is inaccessible. Upload a real MP3 as draft; confirm its public slug, media and download endpoints reject access. Publish it; play and seek without any count change. Download once and confirm exactly one event and increment. Test concurrent requests from distinct allowed clients. Verify rankings, edit metadata, replace audio/art, unpublish and delete. Verify missing objects do not increment counts; test optional password recovery with your verified sender. Unit tests do not replace these live checks.
