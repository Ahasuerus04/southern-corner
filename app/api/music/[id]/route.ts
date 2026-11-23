import { catalog } from "@/lib/catalog";
import { apiTrack } from "@/lib/serialize";
import { isUuid } from "@/lib/downloads";
import { demo } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!demo && !isUuid(id))
    return Response.json({ error: "Track not found." }, { status: 404 });
  try {
    const [track] = await catalog({ id, limit: 1 });
    if (!track)
      return Response.json({ error: "Track not found." }, { status: 404 });
    return Response.json(
      { track: apiTrack(track) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Track temporarily unavailable." },
      { status: 503 },
    );
  }
}
