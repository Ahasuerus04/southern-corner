import { redirect } from "next/navigation";

export default function LegacyNewMusic() {
  redirect("/admin/dashboard/music/new");
}
