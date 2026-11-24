"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Track } from "@/lib/types";
import { useUploadStore } from "@/lib/stores/upload";

function fileFrom(form: FormData, name: string) {
  const value = form.get(name);
  return value instanceof File && value.size > 0 ? value : undefined;
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === "string"
    ? payload.error
    : "Unable to save this upload.";
}

async function presign(kind: "audio" | "artwork", file: File) {
  const response = await fetch("/api/admin/music/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      contentType:
        file.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg"),
      size: file.size,
    }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const payload = await response.json().catch(() => null);
  if (typeof payload?.url !== "string" || typeof payload?.key !== "string")
    throw new Error("Could not prepare the upload.");
  return payload as { url: string; key: string };
}

export function Editor({
  t,
  release = "",
  categories = [],
}: {
  t?: Track;
  release?: string;
  categories?: string[];
}) {
  const { progress, busy, message, start, update, setMessage, finish } =
    useUploadStore();
  const [files, setFiles] = useState<Record<string, string>>({});
  const active = useRef<XMLHttpRequest | null>(null);
  const running = useRef(false);
  const router = useRouter();

  useEffect(() => {
    useUploadStore.getState().reset();
  }, []);

  function put(
    url: string,
    file: File,
    contentType: string,
    onProgress: (loaded: number) => void,
  ) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      active.current = request;
      request.open("PUT", url);
      request.setRequestHeader("Content-Type", contentType);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded);
      };
      request.onload = () => {
        active.current = null;
        if (request.status >= 200 && request.status < 300) resolve();
        else
          reject(
            new Error(
              `The storage service rejected the upload (${request.status}).`,
            ),
          );
      };
      request.onerror = () => {
        active.current = null;
        reject(
          new Error(
            "Direct upload failed. Check the bucket CORS configuration and your connection.",
          ),
        );
      };
      request.onabort = () => {
        active.current = null;
        reject(new DOMException("Upload cancelled", "AbortError"));
      };
      request.send(file);
    });
  }

  return (
    <form
      className="panel narrow"
      onSubmit={async (event) => {
        event.preventDefault();
        if (running.current) return;
        const form = new FormData(event.currentTarget);
        const metadata = {
          title: String(form.get("title") || ""),
          artist: String(form.get("artist") || ""),
          category: String(form.get("category") || ""),
          description: String(form.get("description") || ""),
          release: String(form.get("release") || ""),
          published: form.get("published") === "on",
          featured: form.get("featured") === "on",
        };
        const audioFile = fileFrom(form, "audio");
        const artworkFile = fileFrom(form, "artwork");
        if (!t && !audioFile) {
          toast.error("Choose an MP3 recording.");
          return;
        }

        running.current = true;
        start();
        try {
          if (t && !audioFile && !artworkFile) {
            const response = await fetch(`/api/admin/music/${t.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(metadata),
            });
            if (!response.ok) throw new Error(await responseError(response));
          } else {
            const total =
              (audioFile?.size ?? 0) + (artworkFile?.size ?? 0);
            let completed = 0;
            let audioKey: string | undefined;
            let artworkKey: string | undefined;

            if (audioFile) {
              const upload = await presign("audio", audioFile);
              await put(
                upload.url,
                audioFile,
                audioFile.type || "audio/mpeg",
                (loaded) =>
                  update(
                    total
                      ? Math.round(((completed + loaded) / total) * 100)
                      : 0,
                  ),
              );
              completed += audioFile.size;
              audioKey = upload.key;
              update(total ? Math.round((completed / total) * 100) : 100);
            }

            if (artworkFile) {
              const upload = await presign("artwork", artworkFile);
              await put(
                upload.url,
                artworkFile,
                artworkFile.type || "image/jpeg",
                (loaded) =>
                  update(
                    total
                      ? Math.round(((completed + loaded) / total) * 100)
                      : 0,
                  ),
              );
              artworkKey = upload.key;
            }

            update(100);
            const response = await fetch("/api/admin/music/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: t?.id,
                audio: audioKey ? { key: audioKey } : undefined,
                artwork: artworkKey ? { key: artworkKey } : undefined,
                metadata,
              }),
            });
            if (!response.ok) throw new Error(await responseError(response));
          }

          toast.success(t ? "Track updated" : "Track uploaded");
          router.push("/admin/dashboard/music");
          router.refresh();
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setMessage("Upload cancelled.");
            toast.error("Upload cancelled.");
          } else {
            const text =
              error instanceof Error
                ? error.message
                : "Unable to save this upload.";
            setMessage(text);
            toast.error(text);
          }
        } finally {
          running.current = false;
          active.current = null;
          finish();
        }
      }}
    >
      {t && <input type="hidden" name="id" value={t.id} />}
      <fieldset disabled={busy}>
        <div className="form-grid">
          <label className="field">
            Title *
            <input
              required
              name="title"
              defaultValue={t?.title}
              maxLength={180}
            />
          </label>
          <label className="field">
            Artist *
            <input
              required
              name="artist"
              defaultValue={t?.artist}
              maxLength={150}
            />
          </label>
        </div>
        <label className="field">
          Category *
          <input
            required
            name="category"
            list="music-categories"
            defaultValue={t?.genre}
            maxLength={80}
            placeholder="Ambient, Electronic, Lo-fi…"
          />
          <datalist id="music-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
        <label className="field">
          Release date
          <input type="date" name="release" defaultValue={release} />
        </label>
        <label className="field">
          Description
          <textarea
            name="description"
            defaultValue={t?.description}
            maxLength={4000}
            placeholder="Release notes, credits, licensing…"
          />
        </label>
        <label className="field">
          MP3 recording {t ? "(leave empty to keep the current file)" : "*"}
          <input
            name="audio"
            type="file"
            required={!t}
            accept=".mp3,audio/mpeg"
            onChange={(event) => {
              const value = event.target.files?.[0];
              setFiles({
                ...files,
                audio: value
                  ? `${value.name} · ${(value.size / 1048576).toFixed(2)} MiB`
                  : "",
              });
            }}
          />
          <small>
            {files.audio ||
              (t
                ? "Replace the audio only when you want a new upload."
                : "MP3 only. The file signature and audio stream are validated on the server after upload.")}
          </small>
        </label>
        <label className="field">
          Album artwork (optional, JPEG/PNG/WebP)
          <input
            name="artwork"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const value = event.target.files?.[0];
              setFiles({
                ...files,
                artwork: value
                  ? `${value.name} · ${(value.size / 1048576).toFixed(2)} MiB`
                  : "",
              });
            }}
          />
          <small>
            {files.artwork ||
              (t
                ? "Leave empty to keep the current artwork."
                : "Artwork is resized and re-encoded as WebP.")}
          </small>
        </label>
        {t?.cover && (
          <div className="current-artwork">
            <img src={t.cover} alt={`Current artwork for ${t.title}`} />
            <small>Current artwork</small>
          </div>
        )}
        <div className="actions">
          <label>
            <input
              type="checkbox"
              name="featured"
              defaultChecked={t?.featured}
            />{" "}
            Featured
          </label>
          <label>
            <input
              type="checkbox"
              name="published"
              defaultChecked={t?.published}
            />{" "}
            Published
          </label>
        </div>
        <button className="primary" disabled={busy}>
          {busy ? "Uploading…" : t ? "Save changes" : "Upload track"}
        </button>
      </fieldset>
      {progress !== null && (
        <div className="actions" aria-live="polite">
          <progress max="100" value={progress} />
          <span>{progress}%</span>
          <button type="button" onClick={() => active.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
