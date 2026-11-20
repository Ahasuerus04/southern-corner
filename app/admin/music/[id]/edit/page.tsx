import { requireAdmin } from "@/lib/admin";
import { Editor } from "@/components/editor";
import { AdminNav } from "@/components/admin-nav";
import { db, present } from "@/lib/catalog";
import { tracks } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [t] = await db.select().from(tracks).where(eq(tracks.id, id));
  if (!t) notFound();
  return (
    <main className="wrap page">
      <span className="kicker">ADMIN / CATALOG</span>
      <h1>Edit recording</h1>
      <AdminNav />
      <Editor t={present(t)} release={t.release || ""} />
    </main>
  );
}
