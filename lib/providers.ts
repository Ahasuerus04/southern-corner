import "server-only";
import { betterAuth } from "better-auth";
import { compare, hash } from "bcryptjs";
import { verifyPassword as verifyLegacyPassword } from "better-auth/crypto";
import { pool } from "./catalog";
import { isAdmin } from "./types";

const env = process.env;
const dev = env.NODE_ENV === "development";

export const authReady = Boolean(
  env.DATABASE_URL && (env.BETTER_AUTH_SECRET?.length ?? 0) >= 32,
);

const optionalOrigins = (values: (string | undefined)[]) =>
  values.filter((value): value is string => Boolean(value));

const baseURL =
  env.BETTER_AUTH_URL ??
  (env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : env.V0_RUNTIME_URL);

const trustedOrigins = dev
  ? optionalOrigins([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      env.V0_RUNTIME_URL,
      env.V0_DEV_APP_URL,
      env.V0_BUILD_URL,
      env.V0_SANDBOX_URL,
    ])
  : optionalOrigins([
      env.BETTER_AUTH_URL,
      env.VERCEL_URL && `https://${env.VERCEL_URL}`,
      env.VERCEL_PROJECT_PRODUCTION_URL &&
        `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
    ]);

function auth() {
  if (!authReady) throw new Error("Administrator configuration required");
  return betterAuth({
    database: pool,
    baseURL,
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 72,
      revokeSessionsOnPasswordReset: true,
      // Better Auth defaults to scrypt. Sidewave uses bcrypt as required by
      // the deployment policy; the same functions verify existing hashes.
      password: {
        hash: (password) => hash(password, 12),
        verify: ({ hash: stored, password }) =>
          /^\$2[aby]\$/.test(stored)
            ? compare(password, stored)
            : // Accounts created by earlier Sidewave versions used Better
              // Auth's scrypt format. Keep them usable; new hashes are bcrypt.
              verifyLegacyPassword({ hash: stored, password }),
      },
      ...(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL
        ? {
            sendResetPassword: async ({
              user,
              url,
            }: {
              user: { email: string };
              url: string;
            }) => {
              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: env.RESEND_FROM_EMAIL,
                  to: [user.email],
                  subject: "Reset your Sidewave administrator password",
                  text: `Use this one-time link to reset your password: ${url}`,
                }),
              });
              if (!response.ok)
                throw new Error("Password reset email unavailable");
            },
          }
        : {}),
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "none",
          input: false,
        },
      },
    },
    session: { expiresIn: 604800, updateAge: 86400 },
    rateLimit: { enabled: true, window: 60, max: 15 },
    advanced: {
      ipAddress: { disableIpTracking: true },
      ...(dev
        ? {
            defaultCookieAttributes: {
              sameSite: "none" as const,
              secure: true,
            },
          }
        : {}),
    },
  });
}

let instance: ReturnType<typeof auth> | undefined;
const get = () => (instance ??= auth());

export async function sessionFor(headers: Headers) {
  if (!authReady) return null;
  try {
    return await get().api.getSession({ headers });
  } catch {
    return null;
  }
}

export async function administrator(headers: Headers) {
  return isAdmin(await sessionFor(headers));
}

export async function authRequest(request: Request) {
  if (!authReady)
    return Response.json({ error: "Not configured" }, { status: 503 });
  return get().handler(request);
}
