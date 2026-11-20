"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Track } from "@/lib/types";
export function Manage({ list }: { list: Track[] }) {
  const router = useRouter(),
    [preview, P] = useState(""),
    [busy, B] = useState(false);
  async function change(t: Track, action: string) {
    if (
      action === "delete" &&
      !confirm(`Permanently delete ${t.title} and its download history?`)
    )
      return;
    B(true);
    try {
      const f = new FormData();
      f.set("id", t.id);
      f.set("action", action);
      const r = await fetch("/api/admin/music", { method: "POST", body: f });
      if (!r.ok) throw Error();
      toast.success("Catalog updated");
      router.refresh();
    } catch {
      toast.error("Change not saved. Please try again.");
    } finally {
      B(false);
    }
  }
  return (
    <div className="panel">
      {!list.length && <p>No tracks match this view.</p>}
      {list.map((t) => (
        <div className="admin-item" key={t.id}>
          <img
            src={t.cover + (t.cover.includes("?") ? "&preview=1" : "")}
            alt=""
          />
          <b>
            {t.title}
            <br />
            <small>
              {t.artist} · {t.genre} · {t.created.slice(0, 10)} · {t.downloads}{" "}
              downloads
            </small>
          </b>
          <small>{t.published ? "Published" : "Draft"}</small>
          <button onClick={() => P(preview === t.id ? "" : t.id)}>
            Preview
          </button>
          <Link href={`/admin/music/${t.id}/edit`}>Edit</Link>
          <button disabled={busy} onClick={() => change(t, "publish")}>
            {t.published ? "Unpublish" : "Publish"}
          </button>
          <button disabled={busy} onClick={() => change(t, "delete")}>
            Delete
          </button>
        </div>
      ))}
      {preview && (
        <audio controls autoPlay src={`/api/media/${preview}?preview=1`} />
      )}
    </div>
  );
}
