import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { administrator } from "./providers";
export async function requireAdmin() {
  if (!(await administrator(await headers()))) redirect("/admin/login");
}
