import { z } from "zod";
import { administrator } from "@/lib/providers";
import { allow, clientKey, sameOrigin } from "@/lib/limits";
import { uploadUrl } from "@/lib/storage";
import { artworkSourceKey, musicObjectKey } from "@/lib/storage-keys";
import { audioLimit, coverLimit } from "@/lib/validation";

export const dynamic = "force-dynamic";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status });

const requestSchema = z.object({
  kind: z.enum(["audio", "artwork"]),
  contentType: z.string().trim().max(100),
  size: z.number().int().positive(),
});

/**
 * Sign a short-lived URL for one direct browser upload. Audio and artwork
 * bytes go straight to object storage, bypassing Vercel's 4.5 MB function
 * request-body limit. Nothing is written to the database until the upload is
 * validated by the finalize request.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await administrator(request.headers)))
    return fail(403, "Administrator access required.");
  if (!allow("presign:" + clientKey(request), 60, 60_000))
    return fail(429, "Too many uploads. Try again shortly.");

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return fail(400, "Invalid upload request.");

  const { kind, contentType, size } = parsed.data;
  const audio = kind === "audio";
  if (
    audio &&
    !["audio/mpeg", "audio/mp3", "audio/mpeg3", "audio/x-mpeg-3"].includes(
      contentType,
    )
  )
    return fail(400, "Choose a valid MP3 recording.");
  if (
    !audio &&
    !["image/jpeg", "image/png", "image/webp"].includes(contentType)
  )
    return fail(400, "Choose a JPEG, PNG or WebP artwork file.");
  if (size > (audio ? audioLimit : coverLimit))
    return fail(
      413,
      audio
        ? `Choose an MP3 smaller than ${Math.round(audioLimit / 1048576)} MiB.`
        : `Artwork must be smaller than ${Math.round(coverLimit / 1048576)} MiB.`,
    );

  try {
    const key = audio ? musicObjectKey() : artworkSourceKey();
    const url = await uploadUrl(key, contentType, 600);
    return Response.json(
      { url, key },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Presign upload failed", { kind, error });
    return fail(503, "Upload storage is unavailable.");
  }
}
