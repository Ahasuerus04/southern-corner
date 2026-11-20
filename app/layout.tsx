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
    "Discover independent music. Stream and download tracks from the Sidewave open music library.",
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
              : "Independent music. Open to everyone."}
          </small>
          <Link href="/admin">Created by Hasuerus</Link>
        </footer>
        <Player />
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
