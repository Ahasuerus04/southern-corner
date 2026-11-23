import { requireAdmin } from "@/lib/admin";
import { Editor } from "@/components/editor";
import { AdminNav } from "@/components/admin-nav";
import { genres } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function NewMusic() {
  await requireAdmin();
  const categories = await genres({ admin: true });
  return (
    <main className="wrap page">
      <span className="kicker">ADMINISTRATOR / UPLOAD</span>
      <h1>Upload music</h1>
      <AdminNav />
      <Editor categories={categories} />
    </main>
  );
}
