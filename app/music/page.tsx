import Link from "next/link";
import Form from "next/form";
import { Search, ArrowRight } from "lucide-react";
import { catalog, genres } from "@/lib/catalog";
import { Cards } from "@/components/tracks";
export const metadata = {
  title: "Music library",
  alternates: { canonical: "/music" },
};
export default async function Music({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams,
    pg = Math.min(100000, Math.max(1, parseInt(p.page) || 1));
  const category =
    typeof p.category === "string"
      ? p.category
      : typeof p.genre === "string"
        ? p.genre
        : "";
  const [all, gs] = await Promise.all([
    catalog({
      q: typeof p.q === "string" ? p.q : "",
      genre: category,
      sort: p.sort,
      limit: 17,
      offset: (pg - 1) * 16,
    }),
    genres(),
  ]);
  const link = (n: number) =>
    "/music?" + new URLSearchParams({ ...p, page: String(n) });
  return (
    <main className="wrap page">
      <span className="kicker">SIDEWAVE / CATALOG</span>
      <h1>Music library</h1>
      <p>Find a sound to make your own.</p>
      <Form className="filters" action="/music">
        <label className="search-box">
          <Search size={16} />
          <input
            name="q"
            aria-label="Search library"
            defaultValue={p.q}
            placeholder="Search tracks, artists, or genres…"
            maxLength={120}
          />
        </label>
        <select name="category" aria-label="Category" defaultValue={category}>
          <option value="">All categories</option>
          {gs.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select name="sort" aria-label="Sort tracks" defaultValue={p.sort}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="popular">Most downloaded</option>
          <option value="title">Title A–Z</option>
        </select>
        <button className="primary">
          Apply <ArrowRight size={14} />
        </button>
      </Form>
      <Cards list={all.slice(0, 16)} />
      <div className="pager">
        {pg > 1 && <Link href={link(pg - 1)}>Previous page</Link>}
        {all.length > 16 && <Link href={link(pg + 1)}>Next page</Link>}
        {(p.q || p.genre || p.category) && (
          <Link href="/music">Clear filters</Link>
        )}
      </div>
    </main>
  );
}
