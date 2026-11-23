import { demo, samples } from "@/lib/demo";
import { downloadFilename, recordDownload } from "@/lib/downloads";
import { signed } from "@/lib/storage";
import { allow, clientKey, sameOrigin } from "@/lib/limits";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fail = (status: number, error = "Download unavailable") =>
    Response.json({ error }, { status });
  if (!sameOrigin(request)) return fail(403);
  const identity = clientKey(request);
  if (
    !allow("download:" + identity, 30, 60_000) ||
    !allow("duplicate:" + identity + id, 1, 1800)
  )
    return fail(429, "Please wait before downloading this track again.");
  if (demo)
    return samples.some((track) => track.id === id)
      ? Response.json({ url: `/api/media/${id}?file=1` })
      : fail(404);
  try {
    const track = await recordDownload(id);
    if (!track) return fail(404);
    const url = await signed(track.audio, {
      filename: downloadFilename(track),
      contentType: track.mime,
      verify: false,
    });
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail(503);
  }
}
