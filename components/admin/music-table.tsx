"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Play, Square, Trash2 } from "lucide-react";
import type { Track } from "@/lib/types";

export function MusicTable({ list }: { list: Track[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [target, setTarget] = useState<Track | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function togglePublished(track: Track) {
    setBusy(track.id);
    try {
      const response = await fetch(`/api/admin/music/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !track.published }),
      });
      if (!response.ok) throw new Error();
      toast.success(track.published ? "Track unpublished" : "Track published");
      router.refresh();
    } catch {
      toast.error("Could not update publication state.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!target) return;
    setBusy(target.id);
    try {
      const response = await fetch(`/api/admin/music/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      toast.success("Track deleted");
      setTarget(null);
      setPreview((current) => (current === target.id ? null : current));
      router.refresh();
    } catch {
      toast.error("Track could not be deleted. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!list.length)
    return (
      <div className="empty">
        <h3>No music matches this view</h3>
        <p>Try a different search or category, or upload a new recording.</p>
        <Link className="primary" href="/admin/dashboard/music/new">
          Upload music
        </Link>
      </div>
    );

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Artwork</th>
              <th scope="col">Title</th>
              <th scope="col">Artist</th>
              <th scope="col">Category</th>
              <th scope="col">Uploaded</th>
              <th scope="col">Downloads</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((track) => (
              <tr key={track.id}>
                <td>
                  <img
                    className="admin-thumb"
                    src={track.cover}
                    alt={`${track.title} artwork`}
                  />
                </td>
                <td>
                  <b>{track.title}</b>
                  <small className={track.published ? "pill live" : "pill"}>
                    {track.published ? "Published" : "Draft"}
                  </small>
                </td>
                <td>{track.artist}</td>
                <td>
                  <span className="pill">{track.genre}</span>
                </td>
                <td>{track.created.slice(0, 10)}</td>
                <td>{track.downloads}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={
                        preview === track.id
                          ? `Stop previewing ${track.title}`
                          : `Preview ${track.title}`
                      }
                      onClick={() =>
                        setPreview(preview === track.id ? null : track.id)
                      }
                    >
                      {preview === track.id ? (
                        <Square size={15} />
                      ) : (
                        <Play size={15} />
                      )}
                    </button>
                    <Link
                      className="icon-btn"
                      href={`/admin/dashboard/music/${track.id}/edit`}
                      aria-label={`Edit ${track.title}`}
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      type="button"
                      className="text-btn"
                      disabled={busy === track.id}
                      onClick={() => togglePublished(track)}
                    >
                      {track.published ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`Delete ${track.title}`}
                      onClick={() => setTarget(track)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="panel preview-panel">
          <div className="section-head">
            <h2>Preview</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => setPreview(null)}
            >
              Close
            </button>
          </div>
          <audio
            key={preview}
            controls
            autoPlay
            src={`/api/media/${preview}?preview=1`}
          />
        </div>
      )}

      {target && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => setTarget(null)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-music-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="kicker">CONFIRM DELETION</span>
            <h2 id="delete-music-title">Delete “{target.title}”?</h2>
            <p>
              This permanently removes the database record, MP3, artwork and
              download history for <b>{target.artist}</b>. This action cannot
              be undone.
            </p>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setTarget(null)}
                disabled={busy === target.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger solid"
                onClick={remove}
                disabled={busy === target.id}
              >
                {busy === target.id ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
