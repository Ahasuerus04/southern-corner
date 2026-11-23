# Sidewave

A public independent music archive with a private administrator dashboard. Listeners need no accounts. Bun, Next.js App Router, strict TypeScript, Zustand, Drizzle, Neon PostgreSQL, Better Auth, and Neon Object Storage (S3-compatible).

## Listen locally without credentials

Download and extract the source, install Bun 1.4 or newer, and open a terminal **on your own computer** in the extracted project:

```sh
bun install --frozen-lockfile
bun run dev
```

Open http://localhost:3000. Without `DATABASE_URL`, development serves four explicitly identified demo recordings with generated PCM audio. Search, category filters, sorting, playback and WAV downloads work without a database. Demo counts stay at zero; nothing is seeded or written to Neon. Production never substitutes demo releases. No schema changes, account creation, or paid-service provisioning occur on install or startup.

## Enable the real catalog on your computer

1. Copy `.env.example` to `.env.local`. Keep it private. Set `DATABASE_URL` to the pooled PostgreSQL URL from your Neon project with TLS enabled (`sslmode=require`). Use a fresh development branch/database for initial testing.
2. Set `BETTER_AUTH_SECRET` to a locally generated random secret of at least 32 characters (for example `openssl rand -base64 32`). Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `http://localhost:3000`. Set `CONTACT_EMAIL` to display your public contact on About.
3. Create a **private** Neon Object Storage bucket with S3-compatible read/write/delete credentials for just that bucket. Set:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_ENDPOINT_URL_S3`
   - `AWS_REGION`
   - `NEON_STORAGE_BUCKET`

   These variables are server-only and are never sent to the browser. Uploads use unique keys under `music/` and `artwork/`. Streaming and downloads use short-lived signed URLs. MP3s are limited to 32 MiB and artwork to 5 MiB by default; override with `MAX_AUDIO_SIZE_MB` and `MAX_ARTWORK_SIZE_MB`. Audio is validated by file signature and audio metadata, not by extension alone.
4. Review `lib/schema.ts` and the migrations in `db/migrations`. When ready, run the following **locally and explicitly**:

```sh
bun run auth:enable
bun run db:migrate
```

`auth:enable` checks for the database URL and secret, then installs `setup/providers.ts.template` as `lib/providers.ts`. The shipped adapter otherwise denies every administrative request. `db:migrate` applies the bundled Drizzle migrations to the database in `.env.local`. Back up existing data before migrations. The database starts empty: publish your own recordings, not the development fixtures.

5. Temporarily set `ADMIN_EMAIL`, an optional `ADMIN_USERNAME`, and a unique `ADMIN_PASSWORD` of 16–72 characters in `.env.local`. Run `bun run admin:create` once. It hashes the password with **bcrypt** and creates the user and credential account together in a transaction. An existing email is never silently upgraded or overwritten. Remove the bootstrap variables immediately afterward.
6. Restart `bun run dev`, open `/admin/login`, and sign in with the email or username. The dashboard lives at `/admin/dashboard`. Upload an MP3, add metadata and optional artwork, and save it as a draft or mark it published. Every administrative page and mutation checks the server-side session and `admin` role. No public registration endpoint or role-input field is exposed.

### Optional Resend password resets

Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to a sender on your verified Resend domain. Restart the server. The login page shows a recovery action only when configured; reset responses do not disclose account existence. Reset links point to the configured canonical origin. No credentials are sent to browsers.

## Administrator dashboard

- `/admin/dashboard` — real statistics (songs, downloads, storage objects, most downloaded, recent uploads, 30-day history) and the Top 10.
- `/admin/dashboard/music` — searchable, category-filtered, paginated music table with preview, edit, publish/unpublish and delete actions.
- `/admin/dashboard/music/new` — upload form with progress, validation and duplicate-submit protection.
- `/admin/dashboard/music/[id]/edit` — metadata edits, artwork replacement and optional audio replacement. New objects are written first, the row is updated, then the old objects are removed.

Deletion verifies the database record and only removes object keys owned by Sidewave (`music/`, `artwork/`, and the legacy `audio/`, `covers/` prefixes). A failed object cleanup is logged for operator reconciliation; the database remains the source of truth.

## Public API

All public endpoints expose published music only and never expose storage keys or administrator information.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/music` | Paginated library (`q`, `category`, `sort`, `page`, `limit`) |
| `GET` | `/api/music/top` | Top 10 by downloads |
| `GET` | `/api/music/[id]` | Single published track metadata |
| `GET` | `/api/music/[id]/stream` | Signed audio stream with HTTP Range support |
| `GET` | `/api/music/[id]/download` | Accepted download; increments the counter, then redirects to a signed attachment |

Administrative endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Email/username + password sign-in |
| `POST` | `/api/admin/logout` | Clear the session |
| `GET` | `/api/admin/music` | Paginated list including drafts |
| `POST` | `/api/admin/music/upload` | Multipart create/edit (also `/api/admin/music`) |
| `PATCH` | `/api/admin/music/[id]` | JSON metadata update or multipart replacement |
| `DELETE` | `/api/admin/music/[id]` | Delete record and owned objects |

Every administrative endpoint validates the Better Auth session and `admin` role on the server, checks the request origin, and applies rate limiting.

## Counts, ranking, and playback

The download button POSTs to `/api/download/[id]`. The server checks publication, checks object existence, signs a short-lived attachment URL, and atomically increments the cached counter while inserting one event. The GET download endpoint uses the same logic. Failed storage checks or rolled-back transactions do not increment counts. The metric is **accepted download requests**, not completed browser transfers. Plays, page visits, previews and cover loads never call a download endpoint.

Both chart views use the same query: published only, `download_count DESC, created_at DESC, id ASC LIMIT 10`. Public data is read per request; the UI refreshes after an accepted download. A single public audio player survives in-app navigation. Playback, seeks and volume are session-only. Audio is streamed through signed object-storage URLs rather than loaded into browser memory.

The single-process limiter stores HMAC'd keys and expiring counters in memory; no IP or fingerprint is stored in download events. Without a trusted reverse proxy, requests share one local bucket. Only enable `TRUST_PROXY=1` behind a proxy that **overwrites** `X-Real-IP`. For multiple instances, replace the local limiter with a shared atomic limit store.

## Checks and deployment

```sh
bun test
bun run typecheck
bun run lint
bun run build
bun run start
```

Production requires the same server-only configuration, the enabled auth adapter, migrated Neon schema, a private bucket, and HTTPS canonical URLs. Deploy to a Bun/Node-compatible server with sufficient multipart body and timeout limits (at least 38 MiB for the default limits). Run migrations as a separate release step, never per request. Back up Neon and configure object versioning/lifecycle policies as appropriate.

### Live acceptance checklist

These steps need your own credentials and were not run against live services here. Sign in, reload a protected page, sign out and confirm it is inaccessible. Upload a real MP3 as a draft; confirm its public slug, stream and download endpoints reject access. Publish it; play and seek without any count change. Download once and confirm exactly one event and increment. Test concurrent requests from distinct allowed clients. Verify rankings, edit metadata, replace audio/artwork, unpublish and delete. Verify missing objects do not increment counts; test optional password recovery with your verified sender. Unit tests do not replace these live checks.
