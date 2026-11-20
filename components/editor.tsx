"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Track } from "@/lib/types";
export function Editor({ t, release = "" }: { t?: Track; release?: string }) {
  const [progress, P] = useState<number | null>(null),
    [files, F] = useState<Record<string, string>>({}),
    [msg, M] = useState(""),
    xhr = useRef<XMLHttpRequest | null>(null),
    router = useRouter();
  return (
    <form
      className="panel narrow"
      onSubmit={(e) => {
        e.preventDefault();
        if (xhr.current) return;
        const f = new FormData(e.currentTarget),
          r = new XMLHttpRequest();
        xhr.current = r;
        r.open("POST", "/api/admin/music");
        P(0);
        M("");
        r.upload.onprogress = (v) =>
          P(v.lengthComputable ? Math.round((v.loaded / v.total) * 100) : 0);
        r.onload = () => {
          if (r.status === 200) {
            toast.success("Track saved");
            router.push("/admin/music");
            router.refresh();
          } else
            M(
              (() => {
                try {
                  return JSON.parse(r.responseText).error;
                } catch {
                  return "Unable to save this upload.";
                }
              })(),
            );
        };
        r.onerror = () => M("Upload failed. Please retry.");
        r.onabort = () =>
          M(
            "Upload cancelled. Refresh the library to check whether processing finished.",
          );
        r.onloadend = () => {
          xhr.current = null;
          P(null);
        };
        r.send(f);
      }}
    >
      {t && <input type="hidden" name="id" value={t.id} />}
      <fieldset disabled={progress !== null}>
        {(["title", "artist", "genre"] as const).map((k) => (
          <label className="field" key={k}>
            {k[0].toUpperCase() + k.slice(1)}
            {k !== "genre" ? " *" : ""}
            <input
              required={k !== "genre"}
              name={k}
              defaultValue={t?.[k]}
              maxLength={k === "title" ? 180 : k === "artist" ? 150 : 80}
            />
          </label>
        ))}
        <label className="field">
          Release date
          <input type="date" name="release" defaultValue={release} />
        </label>
        <label className="field">
          Release notes
          <textarea
            name="description"
            defaultValue={t?.description}
            maxLength={4000}
          />
        </label>
        {["audio", "cover"].map((k) => (
          <label className="field" key={k}>
            {k === "audio"
              ? "Recording (MP3, up to 32 MiB)"
              : "Cover (JPEG, PNG or WebP, up to 5 MiB)"}
            <input
              name={k}
              type="file"
              required={!t && k === "audio"}
              accept={
                k === "audio"
                  ? ".mp3,audio/mpeg"
                  : "image/jpeg,image/png,image/webp"
              }
              onChange={(e) => {
                const v = e.target.files?.[0];
                F({
                  ...files,
                  [k]: v
                    ? `${v.name} · ${(v.size / 1048576).toFixed(2)} MiB`
                    : "",
                });
              }}
            />
            <small>
              {files[k] || (t ? "Leave empty to keep the current file." : "")}
            </small>
          </label>
        ))}
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
        <button className="primary">Save track</button>
      </fieldset>
      {progress !== null && (
        <div className="actions">
          <progress max="100" value={progress} />
          {progress}%{" "}
          <button type="button" onClick={() => xhr.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      <p role="status">{msg}</p>
    </form>
  );
}
