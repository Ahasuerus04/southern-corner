import { copyFile } from "node:fs/promises";
if (
  !process.env.DATABASE_URL ||
  (process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32
)
  throw Error(
    "Set DATABASE_URL and a random BETTER_AUTH_SECRET of at least 32 characters in .env.local first.",
  );
await copyFile(
  new URL("./providers.ts.template", import.meta.url),
  new URL("../lib/providers.ts", import.meta.url),
);
console.log("Local Better Auth adapter enabled. No database changes made.");
export {};
