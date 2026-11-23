import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { Editor } from "@/components/editor";
import { AdminNav } from "@/components/admin-nav";
import { db, genres, present } from "@/lib/catalog";
import { tracks } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function EditMusic({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [track, categories] = await Promise.all([
    db.select().from(tracks).where(eq(tracks.id, id)),
    genres({ admin: true }),
  ]);
  if (!track[0]) notFound();
  return (
    <main className="wrap page">
      <span className="kicker">ADMINISTRATOR / EDIT</span>
      <h1>Edit music</h1>
      <AdminNav />
      <Editor
        t={present(track[0], true)}
        release={track[0].release || ""}
        categories={categories}
      />
    </main>
  );
}
