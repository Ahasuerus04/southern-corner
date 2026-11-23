import Form from "next/form";
import { Search, ArrowRight, Disc3 } from "lucide-react";
import Link from "next/link";
import { Cards, Rows, SectionHead } from "@/components/tracks";
import { catalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [featured, top, recent] = await Promise.all([
    catalog({ featured: true, limit: 4 }),
    catalog({ sort: "popular", limit: 10 }),
    catalog({ limit: 4 }),
  ]);
  return (
    <main className="wrap home">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> THE OPEN MUSIC ARCHIVE
          </span>
          <h1>
            Find your favorite
            <br />
            <em>songs here!.</em>
          </h1>
          <p>
            This platform has been sponsored by mihag creations team with single and strong agenda, Helping all the Upcoming artists by exposing their talents and skills to the world
              
          </p>
          <Form className="hero-search" action="/music">
            <Search size={18} />
            <input
              name="q"
              aria-label="Search tracks, artists, or genres"
              placeholder="Search tracks, artists, or genres…"
              maxLength={120}
            />
            <button aria-label="Search library">
              <ArrowRight size={18} />
            </button>
          </Form>
        </div>
        <span className="hero-catalog">
          <Disc3 size={13} /> SIDEWAVE PRESSING &nbsp;/&nbsp; VOL. 001
        </span>
      </section>
      <section>
        <SectionHead
          type="featured"
          title="Featured tracks"
          href="/music"
          more="Browse library"
        />
        <Cards list={featured.length ? featured : recent} />
      </section>
      <section>
        <SectionHead
          type="chart"
          title="Top 10 downloads"
          href="/top-10"
          more="View chart"
        />
        <Rows list={top} ranked />
      </section>
      <section>
        <SectionHead
          type="new"
          title="Recently added"
          href="/music?sort=newest"
          more="View all"
        />
        <Rows list={recent} />
      </section>
    </main>
  );
}
