import { z } from "zod";
import { administrator } from "@/lib/providers";
import { allow, clientKey, sameOrigin } from "@/lib/limits";
import {
  deleteMusic,
  MusicError,
  patchMusic,
  updateMusic,
} from "@/lib/music-service";
import {
  audioLimit,
  coverLimit,
  musicPatchSchema,
} from "@/lib/validation";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status });

async function authorize(request: Request) {
  if (!sameOrigin(request) || !(await administrator(request.headers)))
    return fail(403, "Administrator access required.");
  if (!allow("admin-music:" + clientKey(request), 60, 60_000))
    return fail(429, "Too many changes. Try again shortly.");
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "Invalid track.");
  try {
    const type = request.headers.get("content-type") || "";
    if (type.includes("multipart/form-data")) {
      const size = Number(request.headers.get("content-length"));
      if (!size || size > audioLimit + coverLimit + 131_072)
        return fail(413, "Upload exceeds the allowed size.");
      await updateMusic(id, await request.formData());
    } else {
      const json = await request.json().catch(() => null);
      const parsed = musicPatchSchema.safeParse(json);
      if (!parsed.success)
        return fail(400, "Check the submitted music details.");
      await patchMusic(id, parsed.data);
    }
    return Response.json({ ok: true, id });
  } catch (error) {
    if (error instanceof MusicError) return fail(error.status, error.message);
    return fail(
      503,
      "Could not save this change. Check object storage and database configuration.",
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "Invalid track.");
  try {
    await deleteMusic(id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MusicError) return fail(error.status, error.message);
    return fail(
      503,
      "Could not delete this track. Check object storage and database configuration.",
    );
  }
}
