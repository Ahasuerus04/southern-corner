import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import { Nav, Logo } from "@/components/nav";
import { Player } from "@/components/player";
import { demo } from "@/lib/demo";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: {
    default: "Southern corner — The open music archive",
    template: "%s · Southern corner",
  },
  description:
    "This platform has been sponsored by mihag creations team with single and strong agenda, Helping all the Upcoming artists by exposing their talents and skills to the world",
  icons: { icon: "/mark.svg" },
};
export const viewport: Viewport = {
  themeColor: "#101311",
  colorScheme: "dark light",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <footer className="wrap">
          <Logo />
          <small>
            {demo
              ? "Local development collection · original demo recordings"
              : "Sponsored by mihag creations"
  }
          </small>
          <Link href="/admin">Created by Hasuerus </Link>
        </footer>
        <Player />
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
