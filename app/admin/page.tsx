import { requireAdmin } from "@/lib/admin";
import { db, catalog } from "@/lib/catalog";
import { tracks, events } from "@/lib/schema";
import { count, sum, sql, gte, asc } from "drizzle-orm";
import { Rows } from "@/components/tracks";
import { AdminNav } from "@/components/admin-nav";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  await requireAdmin();
  const day = sql<string>`to_char(${events.time} at time zone 'UTC', 'YYYY-MM-DD')`;
  const [[s], series, top] = await Promise.all([
    db
      .select({
        total: count(),
        published: sql<number>`count(*) filter(where ${tracks.published})::int`,
        downloads: sum(tracks.downloads),
      })
      .from(tracks),
    db
      .select({ day, n: count() })
      .from(events)
      .where(gte(events.time, sql`now() - interval '30 days'`))
      .groupBy(day)
      .orderBy(asc(day)),
    catalog({ sort: "popular", limit: 10 }),
  ]);
  const today =
    series.find((x) => x.day === new Date().toISOString().slice(0, 10))?.n || 0;
  return (
    <main className="wrap page">
      <span className="kicker">ADMINISTRATOR / OVERVIEW</span>
      <h1>Archive dashboard</h1>
      <AdminNav />
      <div className="metrics">
        {Object.entries({
          "Total tracks": s.total,
          Published: s.published,
          Drafts: s.total - s.published,
          "Total downloads": s.downloads || 0,
          "Today (UTC)": today,
          "Top track": top[0]?.title || "—",
        }).map(([k, v]) => (
          <div className="panel" key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="section-head">
        <h2>Last 30 days</h2>
      </div>
      <div className="panel">
        {series.length < 2 ? (
          <p>Not enough download history to chart yet.</p>
        ) : (
          series.map((x) => (
            <div key={x.day}>
              {x.day}{" "}
              <meter
                aria-label={`Downloads on ${x.day}`}
                value={x.n}
                max={Math.max(...series.map((v) => v.n))}
              />{" "}
              {x.n}
            </div>
          ))
        )}
        <small>
          Downloads count accepted requests, not plays or confirmed transfers.
        </small>
      </div>
      <div className="section-head">
        <h2>Top 10 downloads</h2>
      </div>
      <Rows list={top} ranked />
    </main>
  );
}
