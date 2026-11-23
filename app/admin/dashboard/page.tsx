import Link from "next/link";
import { asc, desc, gte, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { catalog, db, present } from "@/lib/catalog";
import { events, tracks } from "@/lib/schema";
import { Rows } from "@/components/tracks";
import { AdminNav } from "@/components/admin-nav";
import { countManagedObjects, storageConfigured } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requireAdmin();
  const day = sql<string>`to_char(${events.time} at time zone 'UTC', 'YYYY-MM-DD')`;
  const [statsRows, recentRows, top, series] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${tracks.published})::int`,
        drafts: sql<number>`count(*) filter (where not ${tracks.published})::int`,
        downloads: sql<number>`coalesce(sum(${tracks.downloads}), 0)::int`,
        bytes: sql<string>`coalesce(sum(${tracks.bytes}), 0)::bigint`,
        covers: sql<number>`count(${tracks.cover})::int`,
      })
      .from(tracks),
    db.select().from(tracks).orderBy(desc(tracks.created)).limit(5),
    catalog({ sort: "popular", limit: 10 }),
    db
      .select({ day, n: sql<number>`count(*)::int` })
      .from(events)
      .where(gte(events.time, sql`now() - interval '30 days'`))
      .groupBy(day)
      .orderBy(asc(day)),
  ]);
  const stats = statsRows[0] ?? {
    total: 0,
    published: 0,
    drafts: 0,
    downloads: 0,
    bytes: "0",
    covers: 0,
  };
  const recent = recentRows.map((row) => present(row, true));
  const today =
    series.find((row) => row.day === new Date().toISOString().slice(0, 10))
      ?.n || 0;

  // Prefer the live bucket count; fall back to database references when
  // object storage is not configured or temporarily unreachable.
  let storageObjects = stats.total + stats.covers;
  let liveStorage = false;
  if (storageConfigured) {
    try {
      storageObjects = await countManagedObjects();
      liveStorage = true;
    } catch {
      liveStorage = false;
    }
  }

  return (
    <main className="wrap page">
      <span className="kicker">ADMINISTRATOR / OVERVIEW</span>
      <h1>Dashboard</h1>
      <AdminNav />

      {!storageConfigured && (
        <div className="notice warn" role="status">
          Object storage is not configured. Uploads are disabled until
          <code>AWS_ACCESS_KEY_ID</code>, <code>AWS_SECRET_ACCESS_KEY</code>,{" "}
          <code>AWS_ENDPOINT_URL_S3</code>, <code>AWS_REGION</code> and{" "}
          <code>NEON_STORAGE_BUCKET</code> are set in <code>.env.local</code>.
        </div>
      )}

      <div className="metrics">
        {[
          ["Total songs", stats.total],
          ["Published", stats.published],
          ["Drafts", stats.drafts],
          ["Total downloads", stats.downloads],
          ["Storage objects", storageObjects],
          ["Audio size", formatBytes(Number(stats.bytes))],
        ].map(([label, value]) => (
          <div className="panel" key={String(label)}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="admin-grid">
        <section className="panel">
          <div className="section-head">
            <h2>Most downloaded</h2>
            <Link href="/top-10">Public chart</Link>
          </div>
          {top[0] ? (
            <div className="admin-top">
              <img src={top[0].cover} alt="" />
              <div>
                <b>{top[0].title}</b>
                <small>
                  {top[0].artist} · {top[0].downloads} downloads
                </small>
              </div>
            </div>
          ) : (
            <p>No downloads yet. Publish a track to start the chart.</p>
          )}
          <p className="micro">
            {liveStorage
              ? "Storage object count read from the configured bucket."
              : "Storage object count derived from database references."}
          </p>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>Recently uploaded</h2>
            <Link href="/admin/dashboard/music">Manage music</Link>
          </div>
          {!recent.length && (
            <p>No music yet. Upload your first MP3 to get started.</p>
          )}
          <div className="recent-list">
            {recent.map((track) => (
              <Link
                className="recent-item"
                href={`/admin/dashboard/music/${track.id}/edit`}
                key={track.id}
              >
                <img src={track.cover} alt="" />
                <span>
                  <b>{track.title}</b>
                  <small>
                    {track.artist} · {track.genre} ·{" "}
                    {track.created.slice(0, 10)}
                  </small>
                </span>
                <em className={track.published ? "pill live" : "pill"}>
                  {track.published ? "Published" : "Draft"}
                </em>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="section-head">
        <h2>Last 30 days</h2>
      </div>
      <div className="panel">
        {series.length < 2 ? (
          <p>Not enough download history to chart yet.</p>
        ) : (
          series.map((row) => (
            <div key={row.day} className="chart-row">
              <span>{row.day}</span>
              <meter
                aria-label={`Downloads on ${row.day}`}
                value={row.n}
                max={Math.max(...series.map((value) => value.n))}
              />
              <span>{row.n}</span>
            </div>
          ))
        )}
        <small>
          Downloads count accepted requests, not plays or confirmed transfers.
          Today: {today}.
        </small>
      </div>

      <div className="section-head">
        <h2>Top 10 downloads</h2>
        <Link href="/admin/dashboard/music">All music</Link>
      </div>
      <Rows list={top} ranked />
    </main>
  );
}
