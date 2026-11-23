import "server-only";
import { z } from "zod";
import { administrator } from "./providers";
import { allow, clientKey, sameOrigin } from "./limits";
import {
  createMusic,
  deleteMusic,
  MusicError,
  togglePublished,
  updateMusic,
} from "./music-service";
import { audioLimit, coverLimit } from "./validation";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status });

export async function handleMusicPost(request: Request) {
  if (!sameOrigin(request) || !(await administrator(request.headers)))
    return fail(403, "Administrator access required.");
  if (!allow("upload:" + clientKey(request), 20, 60_000))
    return fail(429, "Too many changes. Try again shortly.");

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
