import "server-only";
import { z } from "zod";
import { administrator } from "./providers";
import { allow, clientKey, sameOrigin } from "./limits";
import {
  createMusic,
  createMusicFromUploads,
  deleteMusic,
  MusicError,
  togglePublished,
  updateMusic,
  updateMusicFromUploads,
} from "./music-service";
import {
  audioLimit,
  coverLimit,
  musicUploadSchema,
} from "./validation";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status });

async function finalize(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = musicUploadSchema.safeParse(json);
  if (!parsed.success) return fail(400, "Check the submitted music details.");
  const { id, metadata, audio, artwork } = parsed.data;
  if (!id && !audio) return fail(400, "An MP3 recording is required.");
  if (id && !audio && !artwork)
    return fail(400, "Choose a new audio or artwork file.");
  try {
    if (id) {
      await updateMusicFromUploads(id, metadata, audio?.key, artwork?.key);
      return Response.json({ ok: true, id });
    }
    if (!audio) return fail(400, "An MP3 recording is required.");
    const created = await createMusicFromUploads(
      metadata,
      audio.key,
      artwork?.key,
    );
    return Response.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof MusicError)
      return fail(error.status, error.message);
    console.error("Finalize upload failed", { error });
    return fail(
      503,
      "Could not save this change. Check object storage and database configuration.",
    );
  }
}

export async function handleMusicPost(request: Request) {
  if (!sameOrigin(request) || !(await administrator(request.headers)))
    return fail(403, "Administrator access required.");
  if (!allow("upload:" + clientKey(request), 20, 60_000))
    return fail(429, "Too many changes. Try again shortly.");

  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return finalize(request);

  const size = Number(request.headers.get("content-length"));
  if (!size || size > audioLimit + coverLimit + 131_072)
    return fail(413, "Upload exceeds the allowed size.");

  try {
    const form = await request.formData();
    const rawId = form.get("id");
    if (rawId !== null && (typeof rawId !== "string" || !z.uuid().safeParse(rawId).success))
      return fail(400, "Invalid track.");
    const id = typeof rawId === "string" ? rawId : "";
    const action = form.get("action");
    if (id) {
      if (action === "delete") {
        await deleteMusic(id);
        return Response.json({ ok: true });
      }
      if (action === "publish") {
        await togglePublished(id);
        return Response.json({ ok: true });
      }
      await updateMusic(id, form);
      return Response.json({ ok: true, id });
    }
    const created = await createMusic(form);
    return Response.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof MusicError)
      return fail(error.status, error.message);
    return fail(
      503,
      "Could not save this change. Check object storage and database configuration.",
    );
  }
}
