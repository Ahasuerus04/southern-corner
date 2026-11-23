import { redirect } from "next/navigation";

export default async function LegacyEditMusic({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/dashboard/music/${encodeURIComponent(id)}/edit`);
}
