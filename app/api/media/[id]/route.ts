import { and, eq } from "drizzle-orm";
import { db } from "@/lib/catalog";
import { tracks } from "@/lib/schema";
import { demo, sampleAudio, samples } from "@/lib/demo";
import { signed } from "@/lib/storage";
import { administrator } from "@/lib/providers";
import { isUuid } from "@/lib/downloads";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const missing = () => new Response("Media unavailable", { status: 404 });
  if (demo) {
    const index = samples.findIndex((track) => track.id === id);
    if (index < 0) return missing();
    const bytes = sampleAudio(index);
    const range = request.headers.get("range");
    const match = range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end =
      match && match[2]
        ? Math.min(bytes.length - 1, Number(match[2]))
        : bytes.length - 1;
    if (start > end || start >= bytes.length)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${bytes.length}` },
      });
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
      status: match ? 206 : 200,
      headers: {
        "Accept-Ranges": "bytes",
        ...(match
          ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
          : {}),
        "Content-Type": "audio/wav",
        "Content-Length": String(end - start + 1),
        "Content-Disposition": query.has("file")
          ? `attachment; filename="${samples[index].slug}.wav"`
          : "inline",
      },
    });
  }
  if (!isUuid(id) || !process.env.DATABASE_URL) return missing();
  try {
    const preview =
      query.has("preview") && (await administrator(request.headers));
    const [track] = await db
      .select()
      .from(tracks)
      .where(
        and(
          eq(tracks.id, id),
          preview ? undefined : eq(tracks.published, true),
        ),
      );
    if (!track) return missing();
    const cover = query.has("cover");
    const key = cover ? track.cover : track.audio;
    if (!key) return missing();
    const filename =
      query.has("file") && !cover
        ? `${track.artist} - ${track.title}.mp3`.replace(/[\r\n/\\"]/g, "_")
        : undefined;
    return new Response(null, {
      status: 307,
      headers: {
        Location: await signed(key, { filename }),
        "Cache-Control": preview ? "private, no-store" : "public, max-age=60",
      },
    });
  } catch {
    return new Response("Media temporarily unavailable", { status: 503 });
  }
}
