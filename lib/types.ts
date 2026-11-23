export type Track = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  description: string;
  cover: string;
  duration: number;
  downloads: number;
  created: string;
  featured: boolean;
  published: boolean;
};
export const clock = (s: number) =>
  `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, "0")}`;
export function isAdmin(s: { user?: { role?: string | null } } | null) {
  return s?.user?.role === "admin";
}
export const rank = (a: Track, b: Track) =>
  b.downloads - a.downloads ||
  b.created.localeCompare(a.created) ||
  a.id.localeCompare(b.id);
