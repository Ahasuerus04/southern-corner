import { and, eq } from "drizzle-orm";
import { db } from "@/lib/catalog";
import { tracks } from "@/lib/schema";
import { demo } from "@/lib/demo";
import { exists, signed } from "@/lib/storage";
import { isUuid } from "@/lib/downloads";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (demo)
    return Response.redirect(new URL(`/api/media/${id}`, request.url), 307);
  if (!isUuid(id) || !process.env.DATABASE_URL)
    return Response.json({ error: "Track not found." }, { status: 404 });
  try {
    const [track] = await db
      .select()
      .from(tracks)
      .where(and(eq(tracks.id, id), eq(tracks.published, true)));
    if (!track)
      return Response.json({ error: "Track not found." }, { status: 404 });
    if (!(await exists(track.audio)))
      return Response.json({ error: "Track not found." }, { status: 404 });
    const url = await signed(track.audio, {
      contentType: track.mime,
      verify: false,
    });
    return new Response(null, {
      status: 307,
      headers: {
        Location: url,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Audio stream unavailable", { track: id, error });
    return Response.json(
      { error: "Audio temporarily unavailable." },
      { status: 503 },
    );
  }
}
