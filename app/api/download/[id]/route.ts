import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/catalog";
import { tracks, events } from "@/lib/schema";
import { demo, samples } from "@/lib/demo";
import { signed } from "@/lib/storage";
import { allow, clientKey, sameOrigin } from "@/lib/limits";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fail = (status: number) =>
    Response.json({ error: "Download unavailable" }, { status });
  if (!sameOrigin(req)) return fail(403);
  const identity = clientKey(req);
  if (
    !allow("download:" + identity, 30, 60000) ||
    !allow("duplicate:" + identity + id, 1, 1800)
  )
    return fail(429);
  if (demo)
    return samples.some((t) => t.id === id)
      ? Response.json({ url: `/api/media/${id}?file=1` })
      : fail(404);
  if (
    !process.env.DATABASE_URL ||
    !/^([0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(id)
  )
    return fail(404);
  try {
    const visible = and(eq(tracks.id, id), eq(tracks.published, true)),
      [t] = await db.select().from(tracks).where(visible);
    if (!t) return fail(404);
    const url = await signed(t.audio, `${t.artist} - ${t.title}.mp3`);
    const accepted = await db.transaction(async (tx) => {
      const changed = await tx
        .update(tracks)
        .set({ downloads: sql`${tracks.downloads} + 1` })
        .where(and(visible, eq(tracks.audio, t.audio)))
        .returning({ id: tracks.id });
      if (!changed.length) return false;
      await tx.insert(events).values({ track: id });
      return true;
    });
    return accepted
      ? Response.json({ url }, { headers: { "Cache-Control": "no-store" } })
      : fail(404);
  } catch {
    return fail(503);
  }
}
