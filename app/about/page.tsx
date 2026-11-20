import Link from "next/link";
import { demo } from "@/lib/demo";
export const metadata = { title: "About the archive" };
export default function About() {
  return (
    <main className="wrap page">
      <div className="about-copy">
        <span className="kicker">SIDEWAVE / LINER NOTES</span>
        <h1>About Southern corner</h1>
        <p>
          Sidewave is an open listening room for independent music. Browse the
          sleeves, play a track, and take a copy with you. There are no listener
          accounts or subscriptions.
        </p>
        <h2>How the chart works</h2>
        <p>
          The Top 10 ranks published recordings by accepted download requests.
          Listening never adds a download. Ties go to the newer recording, then
          to its catalog identifier.
        </p>
        {demo && (
          <div className="notice">
            Local development edition. The four original synthesized recordings
            and their sleeves are demo material. Demo downloads do not update
            live statistics.
          </div>
        )}
        <h2>Listening and reuse</h2>
        <p>
          Downloading a track does not transfer rights. Check its release notes
          or contact the artist before sampling, redistribution, or commercial
          use.
        </p>
        {process.env.CONTACT_EMAIL && (
          <p>
            Archive contact:{" "}
            <a href={`mailto:${process.env.CONTACT_EMAIL}`}>
              {process.env.CONTACT_EMAIL}
            </a>
          </p>
        )}
        <div className="actions">
          <Link className="primary" href="/music">
            Explore the library →
          </Link>
        </div>
      </div>
    </main>
  );
}
