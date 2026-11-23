import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { hash } from "bcryptjs";
import { z } from "zod";
import { account, user } from "../lib/schema";

const email = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_USERNAME?.trim() || "Archive administrator";

if (!process.env.DATABASE_URL || !password || password.length < 16)
  throw Error(
    "Provide a Neon connection, ADMIN_EMAIL, and ADMIN_PASSWORD of at least 16 characters.",
  );
if (password.length > 72)
  throw Error("ADMIN_PASSWORD must be 72 characters or fewer (bcrypt limit).");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const passwordHash = await hash(password, 12);
  const id = crypto.randomUUID();
  await drizzle(pool).transaction(async (tx) => {
    await tx.insert(user).values({
      id,
      email,
      name,
      emailVerified: true,
      role: "admin",
    });
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      password: passwordHash,
    });
  });
  console.log(
    "Administrator created. Remove ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD from your local environment.",
  );
} finally {
  await pool.end();
}
