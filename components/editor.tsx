"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Track } from "@/lib/types";
import { useUploadStore } from "@/lib/stores/upload";

function errorMessage(xhr: XMLHttpRequest) {
  try {
    const payload = JSON.parse(xhr.responseText);
    return typeof payload?.error === "string"
      ? payload.error
      : "Unable to save this upload.";
  } catch {
    return "Unable to save this upload.";
  }
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
  const xhr = useRef<XMLHttpRequest | null>(null);
  const router = useRouter();

  useEffect(() => {
    useUploadStore.getState().reset();
  }, []);

  return (
    <form
      className="panel narrow"
      onSubmit={(event) => {
        event.preventDefault();
        if (xhr.current) return;
        const form = new FormData(event.currentTarget);
        const request = new XMLHttpRequest();
        xhr.current = request;
        start();
        request.open("POST", "/api/admin/music/upload");
        request.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable)
            update(
              Math.round(
                (progressEvent.loaded / progressEvent.total) * 100,
              ),
            );
        };
        request.onload = () => {
          if (request.status === 200 || request.status === 201) {
            toast.success(t ? "Track updated" : "Track uploaded");
            router.push("/admin/dashboard/music");
            router.refresh();
          } else {
            setMessage(errorMessage(request));
            toast.error(errorMessage(request));
          }
        };
        request.onerror = () => {
          setMessage("Upload failed. Check your connection and try again.");
          toast.error("Upload failed. Please retry.");
        };
        request.onabort = () =>
          setMessage(
            "Upload cancelled. Refresh the library to check whether processing finished.",
          );
        request.onloadend = () => {
          xhr.current = null;
          finish();
        };
        request.send(form);
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
                : "MP3 only. The file signature and audio stream are validated on the server.")}
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
          <button type="button" onClick={() => xhr.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
