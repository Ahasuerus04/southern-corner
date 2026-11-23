import { catalog, catalogCount } from "@/lib/catalog";
import { apiTrack } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const CACHE = "public, s-maxage=30, stale-while-revalidate=120";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Math.min(
    100_000,
    Math.max(1, Number.parseInt(params.get("page") || "", 10) || 1),
  );
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get("limit") || "", 10) || 20),
  );
  try {
    const filters = {
      q: params.get("q")?.slice(0, 120) || "",
      genre:
        params.get("category")?.slice(0, 80) ||
        params.get("genre")?.slice(0, 80) ||
        "",
      sort: params.get("sort") || "newest",
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    const [items, total] = await Promise.all([
      catalog(filters),
      catalogCount({
        q: filters.q,
        genre: filters.genre,
      }),
    ]);
    return Response.json(
      {
        items: items.map(apiTrack),
        page,
        pageSize,
        total,
        hasMore: filters.offset + items.length < total,
      },
      { headers: { "Cache-Control": CACHE } },
    );
  } catch {
    return Response.json(
      { error: "Music library temporarily unavailable." },
      { status: 503 },
    );
  }
}
