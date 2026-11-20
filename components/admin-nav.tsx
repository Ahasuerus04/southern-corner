"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
export function AdminNav() {
  const r = useRouter();
  return (
    <div className="actions">
      <Link href="/admin" className="secondary">
        Overview
      </Link>
      <Link href="/admin/music" className="secondary">
        Manage music
      </Link>
      <Link href="/admin/music/new" className="primary">
        Add track
      </Link>
      <button
        className="secondary"
        onClick={async () => {
          try {
            const res = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!res.ok) throw Error();
            r.replace("/admin/login");
            r.refresh();
          } catch {
            toast.error("Could not sign out. Try again.");
          }
        }}
      >
        Sign out
      </button>
    </div>
  );
}
