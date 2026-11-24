import { pool } from "@/lib/catalog";
import { storageHealth } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics. Returns only booleans, environment variable names
 * that are missing, and an object-storage error code. No credentials, object
 * keys or signed URLs are exposed.
 */
export async function GET() {
  let database = false;
  if (process.env.DATABASE_URL) {
    // A cold Neon pool can lose its first connection; retry once before
    // reporting the database as unavailable.
    for (let attempt = 0; attempt < 2 && !database; attempt++) {
      try {
        await pool.query("select 1");
        database = true;
      } catch (error) {
        if (attempt === 1)
          console.error("Health check: database unavailable", {
            error: error instanceof Error ? error.message : String(error),
          });
      }
    }
  }

  const storage = await storageHealth();
  const ok = database && storage.reachable;

  return Response.json(
    { ok, database, storage },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
