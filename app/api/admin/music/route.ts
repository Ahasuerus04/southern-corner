import { administrator } from "@/lib/providers";
import { db } from "@/lib/catalog";
import { tracks } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { upload, remove } from "@/lib/storage";
import { allow, clientKey, sameOrigin } from "@/lib/limits";
import {
  audioLimit,
  coverLimit,
  fits,
  metadataSchema,
  slug,
} from "@/lib/validation";
import { parseBuffer } from "music-metadata";
import sharp from "sharp";
import { z } from "zod";
const fail = (status: number, error: string) =>
  Response.json({ error }, { status });
async function clean(keys: (string | null | undefined)[]) {
  await Promise.all(
    keys
      .filter((k): k is string => !!k)
      .map((k) =>
        remove(k).catch(() => console.warn("Pending storage cleanup:", k)),
      ),
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req) || !(await administrator(req.headers)))
    return fail(403, "Administrator access required.");
  if (!allow("upload:" + clientKey(req), 20, 60000))
    return fail(429, "Too many changes. Try again shortly.");
  const size = Number(req.headers.get("content-length"));
  if (!size || size > audioLimit + coverLimit + 131072)
    return fail(413, "Upload exceeds the allowed size.");
  const staged: string[] = [];
  let committed = false;
  try {
    const form = await req.formData(),
      id = form.get("id"),
      mode = form.get("action");
    if (id && !z.uuid().safeParse(id).success)
      return fail(400, "Invalid track.");
    const old =
      typeof id === "string" && id
        ? (await db.select().from(tracks).where(eq(tracks.id, id)))[0]
        : null;
    if (id && !old) return fail(404, "Track not found.");
    if (mode === "delete" && old) {
      const [deleted] = await db
        .delete(tracks)
        .where(eq(tracks.id, old.id))
        .returning();
      if (deleted) await clean([deleted.audio, deleted.cover]);
      return Response.json({ ok: true });
    }
    if (mode === "publish" && old) {
      await db
        .update(tracks)
        .set({
          published: !old.published,
          publishedAt: old.published ? null : new Date(),
          updated: new Date(),
        })
        .where(eq(tracks.id, old.id));
      return Response.json({ ok: true });
    }
    const parsed = metadataSchema.safeParse(
      Object.fromEntries(
        [
          "title",
          "artist",
          "genre",
          "description",
          "release",
          "published",
          "featured",
        ].map((k) => [k, form.get(k) || ""]),
      ),
    );
    if (!parsed.success)
      return fail(
        400,
        "Check the title, artist, release date and text lengths.",
      );
    const data = parsed.data;
    let audio = old?.audio,
      cover = old?.cover,
      bytes = old?.bytes || 0,
      duration = old?.duration || 0;
    const a = form.get("audio"),
      c = form.get("cover");
    let audioBuffer: Buffer | undefined, coverBuffer: Buffer | undefined;
    if (a instanceof File && a.size) {
      if (!fits(a.size, audioLimit))
        return fail(400, "Choose an MP3 smaller than 32 MiB.");
      audioBuffer = Buffer.from(await a.arrayBuffer());
      const meta = await parseBuffer(audioBuffer, undefined, {
        duration: true,
      }).catch(() => null);
      if (
        !meta?.format.codec?.includes("Layer 3") ||
        !meta.format.duration ||
        !Number.isFinite(meta.format.duration)
      )
        return fail(400, "Choose a valid MP3 recording.");
      audio = `audio/${crypto.randomUUID()}.mp3`;
      bytes = a.size;
      duration = Math.round(meta.format.duration);
    }
    if (!audio) return fail(400, "An MP3 recording is required.");
    if (c instanceof File && c.size) {
      if (!fits(c.size, coverLimit))
        return fail(400, "Cover images must be smaller than 5 MiB.");
      const img = sharp(Buffer.from(await c.arrayBuffer()), {
        limitInputPixels: 24e6,
      });
      const info = await img.metadata().catch(() => null);
      if (!info || !["jpeg", "png", "webp"].includes(info.format || ""))
        return fail(400, "Choose a JPEG, PNG or WebP cover.");
      coverBuffer = await img
        .rotate()
        .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
        .webp()
        .toBuffer();
      cover = `covers/${crypto.randomUUID()}.webp`;
    }
    if (audioBuffer) {
      staged.push(audio);
      await upload(audio, audioBuffer, "audio/mpeg");
    }
    if (coverBuffer && cover) {
      staged.push(cover);
      await upload(cover, coverBuffer, "image/webp");
    }
    const values = {
      ...data,
      audio,
      cover,
      bytes,
      duration,
      mime: "audio/mpeg",
      updated: new Date(),
      publishedAt: data.published ? old?.publishedAt || new Date() : null,
    };
    if (old) {
      const updated = await db
        .update(tracks)
        .set(values)
        .where(
          and(
            eq(tracks.id, old.id),
            eq(tracks.audio, old.audio),
            old.cover ? eq(tracks.cover, old.cover) : undefined,
          ),
        )
        .returning({ id: tracks.id });
      if (!updated.length) throw Error("Changed concurrently");
    } else
      await db.insert(tracks).values({ ...values, slug: slug(data.title) });
    committed = true;
    if (old)
      await clean([
        old.audio !== audio ? old.audio : null,
        old.cover !== cover ? old.cover : null,
      ]);
    return Response.json({ ok: true });
  } catch {
    return fail(
      503,
      "Could not save this change. Check storage and database configuration.",
    );
  } finally {
    if (!committed) await clean(staged);
  }
}
