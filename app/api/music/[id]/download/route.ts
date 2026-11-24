import { demo } from "@/lib/demo";
import { downloadFilename, recordDownload } from "@/lib/downloads";
import { signed } from "@/lib/storage";
import { allow, clientKey, sameOrigin } from "@/lib/limits";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!sameOrigin(request))
    return Response.json({ error: "Request rejected." }, { status: 403 });
  if (demo)
    return Response.redirect(
      new URL(`/api/media/${id}?file=1`, request.url),
      307,
    );
  const identity = clientKey(request);
  if (
    !allow("download:" + identity, 30, 60_000) ||
    !allow("download-once:" + identity + id, 1, 1800)
  )
    return Response.json(
      { error: "Please wait before downloading this track again." },
      { status: 429 },
    );
  try {
    const track = await recordDownload(id);
    if (!track)
      return Response.json({ error: "Track not found." }, { status: 404 });
    const url = await signed(track.audio, {
      filename: downloadFilename(track),
      verify: false,
    });
    return new Response(null, {
      status: 307,
      headers: {
        Location: url,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Track download unavailable", { track: id, error });
    return Response.json(
      { error: "Download temporarily unavailable." },
      { status: 503 },
    );
  }
}
