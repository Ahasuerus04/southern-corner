import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  Download,
  Disc3,
  Star,
  TrendingUp,
  Layers,
} from "lucide-react";
import { PlayTrack } from "./player";
import { DownloadButton } from "./download";
import { clock, type Track } from "@/lib/types";
export function SectionHead({
  type,
  title,
  href,
  more,
}: {
  type: "featured" | "chart" | "new";
  title: string;
  href: string;
  more: string;
}) {
  const I = { featured: Star, chart: TrendingUp, new: Layers }[type];
  return (
    <div className="section-head">
      <h2>
        <I size={22} />
        {title}
      </h2>
      <Link href={href}>
        {more}
        <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}
export function Empty() {
  return (
    <div className="empty">
      <Disc3 />
      <h3>No tracks here yet</h3>
      <p>Try a different search or check back for a new release.</p>
    </div>
  );
}
export function Cards({ list }: { list: Track[] }) {
  if (!list.length) return <Empty />;
  return (
    <div className="cards">
      {list.map((t, i) => (
        <article className="track-card" key={t.id}>
          <div className="art">
            <Link href={`/music/${t.slug}`} aria-label={`Open ${t.title}`}>
              <img src={t.cover} alt={`${t.title} cover artwork`} />
            </Link>
            <span className="timing">{clock(t.duration)}</span>
            <PlayTrack list={list} index={i} />
          </div>
          <div className="card-info">
            <span className="micro genre">{t.genre}</span>
            <h3>
              <Link href={`/music/${t.slug}`}>{t.title}</Link>
            </h3>
            <p>{t.artist}</p>
            <div className="card-foot">
              <small>
                <Download size={12} />
                {t.downloads} downloads
              </small>
              <DownloadButton id={t.id} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
export function Rows({
  list,
  ranked = false,
}: {
  list: Track[];
  ranked?: boolean;
}) {
  if (!list.length) return <Empty />;
  return (
    <div className="rows">
      {list.map((t, i) => (
        <article className="track-row" key={t.id}>
          {ranked && (
            <span className={`rank r${i}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
          )}
          <img src={t.cover} alt="" />
          <div className="row-name">
            <Link href={`/music/${t.slug}`}>{t.title}</Link>
            <small>{t.artist}</small>
          </div>
          <small className="row-genre">{t.genre}</small>
          <small>
            <Clock3 size={12} />
            {clock(t.duration)}
          </small>
          <small>
            <Download size={12} />
            {t.downloads}
          </small>
          <PlayTrack list={list} index={i} />
          <DownloadButton id={t.id} />
        </article>
      ))}
    </div>
  );
}
