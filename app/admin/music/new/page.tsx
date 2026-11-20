import { requireAdmin } from "@/lib/admin";
import { Editor } from "@/components/editor";
import { AdminNav } from "@/components/admin-nav";
export default async function Add() {
  await requireAdmin();
  return (
    <main className="wrap page">
      <span className="kicker">ADMIN / CATALOG</span>
      <h1>Add a recording</h1>
      <AdminNav />
      <Editor />
    </main>
  );
}
