"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="wrap page">
      <h1>Archive unavailable</h1>
      <p>
        The library could not be loaded. Check the database connection or try
        again.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
