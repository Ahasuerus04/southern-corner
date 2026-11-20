import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin-nav";
import { Manage } from "@/components/manage";
import { catalog } from "@/lib/catalog";
import Link from "next/link";
export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  await requireAdmin();
  const p = await searchParams,
    pg = Math.max(1, parseInt(p.page || "") || 1),
    list = await catalog({
      admin: true,
      q: p.q,
      sort: p.sort,
      limit: 21,
      offset: (pg - 1) * 20,
    });
  const url = (page: number) =>
    "/admin/music?" +
    new URLSearchParams({
      q: p.q || "",
      sort: p.sort || "",
      page: String(page),
    });
  return (
    <main className="wrap page">
      <span className="kicker">ADMIN / CATALOG</span>
      <h1>Manage music</h1>
      <AdminNav />
      <form className="filters">
        <input
          name="q"
          defaultValue={p.q}
          aria-label="Search tracks"
          placeholder="Title, artist, or genre"
        />
        <select name="sort" defaultValue={p.sort} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="popular">Most downloaded</option>
          <option value="title">Title A–Z</option>
        </select>
        <button className="secondary">Filter</button>
      </form>
      <Manage list={list.slice(0, 20)} />
      <div className="pager">
        {pg > 1 && <Link href={url(pg - 1)}>Previous</Link>}
        {list.length > 20 && <Link href={url(pg + 1)}>Next</Link>}
      </div>
    </main>
  );
}
