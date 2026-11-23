"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AudioLines, Sun, Moon } from "lucide-react";
export function Logo() {
  return (
    <Link className="logo" href="/">
      <span>
        <AudioLines size={23} strokeWidth={2.8} />
      </span>
      Sidewave
    </Link>
  );
}
export function Nav() {
  const path = usePathname(),
    [light, S] = useState(false);
  return (
    <header>
      <div className="navwrap">
        <Logo />
        <nav aria-label="Main navigation">
          {[
            ["/", "Home"],
            ["/music", "Library"],
            ["/top-10", "Top 10"],
            ["/about", "About"],
          ].map(([url, title]) => (
            <Link
              key={url}
              aria-current={
                (url === "/" ? path === url : path.startsWith(url))
                  ? "page"
                  : undefined
              }
              href={url}
            >
              {title}
            </Link>
          ))}
        </nav>
        <span className="open-tag">
          <i /> MIHAG CREATIONS
        </span>
        <button
          className="theme-switch"
          aria-label={`Switch to ${light ? "dark" : "light"} theme`}
          onClick={() => {
            document.documentElement.classList.toggle("light", !light);
            S(!light);
          }}
        >
          {light ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
}
