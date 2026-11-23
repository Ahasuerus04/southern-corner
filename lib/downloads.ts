import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./catalog";
import { events, tracks } from "./schema";
import { exists } from "./storage";

const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

/**
 * Atomically accept a download request. A missing or unpublished record, or
 * a missing storage object, must never increase the public counter.
 */
export async function recordDownload(id: string) {
  if (!isUuid(id)) return null;
  const visible = and(eq(tracks.id, id), eq(tracks.published, true));
  const [track] = await db.select().from(tracks).where(visible);
  if (!track) return null;
  if (!(await exists(track.audio))) return null;
  const accepted = await db.transaction(async (tx) => {
    const changed = await tx
      .update(tracks)
      .set({ downloads: sql`${tracks.downloads} + 1` })
      .where(and(visible, eq(tracks.audio, track.audio)))
      .returning({ id: tracks.id });
    if (!changed.length) return false;
    await tx.insert(events).values({ track: id });
    return true;
  });
  return accepted ? track : null;
}

export function downloadFilename(track: { artist: string; title: string }) {
  return `${track.artist} - ${track.title}.mp3`.replace(/[\r\n/\\"]/g, "_");
}
