export default function Loading() {
  return (
    <main className="wrap page" aria-busy="true">
      <p role="status">Loading the archive…</p>
      <div className="skeleton" />
    </main>
  );
}
