import { catalog } from "@/lib/catalog";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PlayTrack } from "@/components/player";
import { DownloadButton } from "@/components/download";
import { Cards, SectionHead } from "@/components/tracks";
import { clock } from "@/lib/types";
type P = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: P) {
  const { slug } = await params,
    [t] = await catalog({ slug });
  if (!t) return { title: "Track not found" };
  return {
    title: `${t.title} — ${t.artist}`,
    description: t.description,
    alternates: { canonical: `/music/${slug}` },
    openGraph: {
      title: t.title,
      description: t.description,
      images: [t.cover],
    },
  };
}
export default async function Detail({ params }: P) {
  const { slug } = await params,
    [t] = await catalog({ slug });
  if (!t) notFound();
  const related = (await catalog({ genre: t.genre, limit: 5 }))
    .filter((x) => x.id !== t.id)
    .slice(0, 4);
  return (
    <main className="wrap page">
      <Link className="link" href="/music">
        ← Back to library
      </Link>
      <div className="detail" style={{ marginTop: 24 }}>
        <img src={t.cover} alt={`${t.title} cover`} />
        <div>
          <span className="kicker">TRACK / {t.genre.toUpperCase()}</span>
          <h1>{t.title}</h1>
          <h2>{t.artist}</h2>
          <p>{t.description}</p>
          <p>
            {clock(t.duration)} · {t.downloads} downloads · Added{" "}
            {t.created.slice(0, 10)}
          </p>
          <div className="actions">
            <PlayTrack list={[t, ...related]} label />
            <DownloadButton id={t.id} label />
          </div>
        </div>
      </div>
      {!!related.length && (
        <section>
          <SectionHead
            title="Related tracks"
            type="new"
            href="/music"
            more="Browse library"
          />
          <Cards list={related} />
        </section>
      )}
    </main>
  );
}
