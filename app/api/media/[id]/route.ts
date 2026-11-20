import { eq, and } from "drizzle-orm";
import { db } from "@/lib/catalog";
import { tracks } from "@/lib/schema";
import { demo, sampleAudio, samples } from "@/lib/demo";
import { signed } from "@/lib/storage";
import { administrator } from "@/lib/providers";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    q = new URL(req.url).searchParams;
  const missing = () => new Response("Media unavailable", { status: 404 });
  if (demo) {
    const i = samples.findIndex((t) => t.id === id);
    if (i < 0) return missing();
    const b = sampleAudio(i);
    const range = req.headers.get("range"),
      m = range?.match(/^bytes=(\d+)-(\d*)$/),
      start = m ? Number(m[1]) : 0,
      end = m && m[2] ? Math.min(b.length - 1, Number(m[2])) : b.length - 1;
    if (start > end || start >= b.length)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${b.length}` },
      });
    return new Response(new Uint8Array(b.subarray(start, end + 1)), {
      status: m ? 206 : 200,
      headers: {
        "Accept-Ranges": "bytes",
        ...(m ? { "Content-Range": `bytes ${start}-${end}/${b.length}` } : {}),
        "Content-Type": "audio/wav",
        "Content-Length": String(end - start + 1),
        "Content-Disposition": q.has("file")
          ? `attachment; filename="${samples[i].slug}.wav"`
          : "inline",
      },
    });
  }
  if (!/^[\da-f-]{36}$/i.test(id) || !process.env.DATABASE_URL)
    return missing();
  try {
    const priv = q.has("preview") && (await administrator(req.headers));
    const [t] = await db
      .select()
      .from(tracks)
      .where(
        and(eq(tracks.id, id), priv ? undefined : eq(tracks.published, true)),
      );
    const key = t && (q.has("cover") ? t.cover : t.audio);
    if (!key) return missing();
    return new Response(null, {
      status: 307,
      headers: {
        Location: await signed(key),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Media temporarily unavailable", { status: 503 });
  }
}
