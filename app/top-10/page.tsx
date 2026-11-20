import { catalog } from "@/lib/catalog";
import { Rows } from "@/components/tracks";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Top 10 downloads",
  alternates: { canonical: "/top-10" },
};
export default async function Top() {
  return (
    <main className="wrap page">
      <span className="kicker">SIDEWAVE / THE CHART</span>
      <h1>Top 10 downloads</h1>
      <p>
        The most downloaded tracks in the archive, ranked by accepted download
        requests.
      </p>
      <div className="actions" />
      <Rows list={await catalog({ sort: "popular", limit: 10 })} ranked />
    </main>
  );
}
