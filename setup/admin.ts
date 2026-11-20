import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { account, user } from "../lib/schema";
const email = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!process.env.DATABASE_URL || !password || password.length < 16)
  throw Error(
    "Provide a Neon connection, email, and a password of at least 16 characters.",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const hash = await hashPassword(password),
    id = crypto.randomUUID();
  await drizzle(pool).transaction(async (tx) => {
    await tx
      .insert(user)
      .values({
        id,
        email,
        name: "Archive administrator",
        emailVerified: true,
        role: "admin",
      });
    await tx
      .insert(account)
      .values({
        id: crypto.randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: hash,
      });
  });
  console.log(
    "Administrator created. Remove bootstrap credentials from your local environment.",
  );
} finally {
  await pool.end();
}
