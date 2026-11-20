import type { MetadataRoute } from "next";
import { catalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const routes = ["", "/music", "/top-10", "/about"].map((path) => ({
    url: base + path,
  }));
  for (let offset = 0; offset < 49000; offset += 500) {
    const batch = await catalog({ offset, limit: 500 });
    routes.push(...batch.map((t) => ({ url: `${base}/music/${t.slug}` })));
    if (batch.length < 500) break;
  }
  return routes;
}
