import { administrator } from "@/lib/providers";
import { catalog, catalogCount } from "@/lib/catalog";
import { apiTrack } from "@/lib/serialize";

export { handleMusicPost as POST } from "@/lib/music-actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await administrator(request.headers)))
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  const params = new URL(request.url).searchParams;
  const page = Math.min(
    100_000,
    Math.max(1, Number.parseInt(params.get("page") || "", 10) || 1),
  );
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get("limit") || "", 10) || 20),
  );
  const filters = {
    q: params.get("q")?.slice(0, 120) || "",
    genre:
      params.get("category")?.slice(0, 80) ||
      params.get("genre")?.slice(0, 80) ||
      "",
    sort: params.get("sort") || "newest",
  };
  try {
    const [items, total] = await Promise.all([
      catalog({
        ...filters,
        admin: true,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      catalogCount({ ...filters, admin: true }),
    ]);
    return Response.json(
      {
        items: items.map(apiTrack),
        page,
        pageSize,
        total,
        hasMore: (page - 1) * pageSize + items.length < total,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Music list temporarily unavailable." },
      { status: 503 },
    );
  }
}
