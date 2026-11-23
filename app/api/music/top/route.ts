import { catalog } from "@/lib/catalog";
import { apiTrack } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await catalog({ sort: "popular", limit: 10 });
    return Response.json(
      { items: items.map(apiTrack) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Chart temporarily unavailable." },
      { status: 503 },
    );
  }
}
