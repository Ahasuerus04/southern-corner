import { createHmac, randomBytes } from "node:crypto";
const secret = randomBytes(32),
  hits = new Map<string, { count: number; until: number }>();
export function allow(
  key: string,
  limit: number,
  ms: number,
  now = Date.now(),
) {
  const k = createHmac("sha256", secret).update(key).digest("hex");
  if (hits.size > 5000)
    for (const [id, v] of hits) if (v.until <= now) hits.delete(id);
  const v = hits.get(k);
  if (!v || v.until <= now) {
    if (hits.size > 10000 && !v) return false;
    hits.set(k, { count: 1, until: now + ms });
    return true;
  }
  return ++v.count <= limit;
}
export const clientKey = (r: Request) =>
  process.env.TRUST_PROXY === "1"
    ? r.headers.get("x-real-ip") || "local"
    : "local";
export function sameOrigin(r: Request) {
  const origin = r.headers.get("origin");
  return (
    !origin ||
    [
      new URL(r.url).origin,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.V0_RUNTIME_URL,
      process.env.V0_BUILD_URL,
      process.env.V0_DEV_APP_URL,
    ].includes(origin)
  );
}
