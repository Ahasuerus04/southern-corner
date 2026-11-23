import type { Track } from "./types";

/**
 * Public API representation. Storage keys and administrator details are
 * intentionally never included.
 */
export function apiTrack(t: Track) {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    artist: t.artist,
    category: t.genre,
    genre: t.genre,
    description: t.description,
    artworkUrl: t.cover,
    duration: t.duration,
    downloads: t.downloads,
    featured: t.featured,
    published: t.published,
    createdAt: t.created,
    streamUrl: `/api/music/${t.id}/stream`,
    downloadUrl: `/api/music/${t.id}/download`,
  };
}
