import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin-nav";
import { MusicTable } from "@/components/admin/music-table";
import { catalog, catalogCount, genres } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    genre?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = params.q?.slice(0, 120) || "";
  const category = (params.category || params.genre || "").slice(0, 80);
  const sort = params.sort || "newest";
  const requestedPage = Math.max(
    1,
    Number.parseInt(params.page || "", 10) || 1,
  );
  const filters = { q, genre: category };
  const [total, categories] = await Promise.all([
    catalogCount({ ...filters, admin: true }),
    genres({ admin: true }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const list = await catalog({
    ...filters,
    admin: true,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const link = (next: number) =>
    "/admin/dashboard/music?" +
    new URLSearchParams({
      q,
      category,
      sort,
      page: String(next),
    });

  return (
    <main className="wrap page">
      <span className="kicker">ADMINISTRATOR / MUSIC</span>
      <div className="admin-heading">
        <div>
          <h1>Manage music</h1>
          <p>
            {total} {total === 1 ? "track" : "tracks"} in the archive.
          </p>
        </div>
        <Link className="primary" href="/admin/dashboard/music/new">
          Upload music
        </Link>
      </div>
      <AdminNav />

      <form className="filters" action="/admin/dashboard/music">
        <input
          name="q"
          defaultValue={q}
          aria-label="Search music"
          placeholder="Search title, artist or category"
          maxLength={120}
        />
        <select name="category" defaultValue={category} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort music">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="popular">Most downloaded</option>
          <option value="title">Title A–Z</option>
        </select>
        <button className="primary">Apply</button>
        <Link className="secondary" href="/admin/dashboard/music">
          Clear
        </Link>
      </form>

      <MusicTable list={list} />

      <div className="pager">
        {page > 1 && <Link href={link(page - 1)}>Previous page</Link>}
        <span>
          Page {page} of {totalPages}
        </span>
        {page < totalPages && <Link href={link(page + 1)}>Next page</Link>}
      </div>
    </main>
  );
}
