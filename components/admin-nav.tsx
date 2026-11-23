"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

const links = [
  ["/admin/dashboard", "Overview"],
  ["/admin/dashboard/music", "Manage music"],
  ["/admin/dashboard/music/new", "Upload music"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="actions admin-nav">
      {links.map(([href, label]) => {
        const active =
          href === "/admin/dashboard"
            ? pathname === href
            : href === "/admin/dashboard/music"
              ? pathname === href ||
                (pathname.startsWith(href + "/") &&
                  !pathname.startsWith("/admin/dashboard/music/new"))
              : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={active ? "primary" : "secondary"}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        className="secondary"
        onClick={async () => {
          try {
            const response = await fetch("/api/admin/logout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) throw new Error();
            router.replace("/admin/login");
            router.refresh();
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
