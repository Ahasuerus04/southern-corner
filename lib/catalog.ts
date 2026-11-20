import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { tracks } from "./schema";
import { samples, demo } from "./demo";
import { rank, type Track } from "./types";
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
});
export const db = drizzle(pool);
export function present(r: typeof tracks.$inferSelect): Track {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    artist: r.artist,
    genre: r.genre,
    description: r.description,
    cover: r.cover ? `/api/media/${r.id}?cover=1` : "/fallback.svg",
    duration: r.duration,
    downloads: r.downloads,
    created: r.created.toISOString(),
    featured: r.featured,
    published: r.published,
  };
}
export async function catalog(
  o: {
    q?: string;
    genre?: string;
    sort?: string;
    limit?: number;
    offset?: number;
    slug?: string;
    featured?: boolean;
    admin?: boolean;
  } = {},
) {
  const n = o.limit ?? 20,
    offset = o.offset ?? 0,
    q = o.q?.slice(0, 120) || "";
  if (demo) {
    return samples
      .filter(
        (t) =>
          (!o.slug || o.slug === t.slug) &&
          (!o.genre || o.genre === t.genre) &&
          [t.title, t.artist, t.genre].some((v) =>
            v.toLowerCase().includes(q.toLowerCase()),
          ),
      )
      .sort(
        o.sort === "popular"
          ? rank
          : o.sort === "title"
            ? (a, b) => a.title.localeCompare(b.title)
            : o.sort === "oldest"
              ? (a, b) => a.created.localeCompare(b.created)
              : (a, b) => b.created.localeCompare(a.created),
      )
      .slice(offset, offset + n);
  }
  if (!process.env.DATABASE_URL) return [];
  const search = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await db
    .select()
    .from(tracks)
    .where(
      and(
        o.admin ? undefined : eq(tracks.published, true),
        o.slug ? eq(tracks.slug, o.slug) : undefined,
        o.genre ? eq(tracks.genre, o.genre) : undefined,
        o.featured ? eq(tracks.featured, true) : undefined,
        q
          ? or(
              ilike(tracks.title, search),
              ilike(tracks.artist, search),
              ilike(tracks.genre, search),
            )
          : undefined,
      ),
    )
    .orderBy(
      ...(o.sort === "popular"
        ? [desc(tracks.downloads), desc(tracks.created)]
        : o.sort === "title"
          ? [asc(tracks.title)]
          : o.sort === "oldest"
            ? [asc(tracks.created)]
            : [desc(tracks.created)]),
      asc(tracks.id),
    )
    .limit(n)
    .offset(offset);
  return rows.map(present);
}
export async function genres() {
  if (demo) return samples.map((t) => t.genre);
  if (!process.env.DATABASE_URL) return [];
  return (
    await db
      .selectDistinct({ genre: tracks.genre })
      .from(tracks)
      .where(eq(tracks.published, true))
      .orderBy(tracks.genre)
  ).map((x) => x.genre);
}
