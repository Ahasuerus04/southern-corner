import { AdminLogin } from "@/components/admin-login";
import { authReady, administrator } from "@/lib/providers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Administrator sign in",
  robots: { index: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await administrator(await headers())) redirect("/admin/dashboard");
  const { token } = await searchParams;
  return (
    <main className="wrap page narrow">
      <span className="kicker">SIDEWAVE / PRIVATE ACCESS</span>
      <h1>Administrator sign in</h1>
      <AdminLogin
        ready={authReady}
        reset={!!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL}
        token={token}
      />
    </main>
  );
}
