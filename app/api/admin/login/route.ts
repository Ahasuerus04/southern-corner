import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/catalog";
import { user } from "@/lib/schema";
import { authReady, authRequest } from "@/lib/providers";
import { allow, clientKey, sameOrigin } from "@/lib/limits";
import { loginSchema } from "@/lib/validation";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status });

function forwardCookies(response: Response) {
  const headers = new Headers({ "cache-control": "no-store" });
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(
          (value): value is string => Boolean(value),
        );
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return headers;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "Request rejected.");
  if (!authReady)
    return fail(503, "Administrator authentication is not configured.");
  if (!allow("admin-login:" + clientKey(request), 10, 60_000))
    return fail(429, "Too many attempts. Try again in a minute.");

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success)
    return fail(400, "Enter a valid email or username and password.");

  const identifier = (parsed.data.identifier ?? parsed.data.email ?? "").trim();
  let email: string;
  try {
    const [candidate] = await db
      .select({ email: user.email })
      .from(user)
      .where(
        and(
          eq(user.role, "admin"),
          identifier.includes("@")
            ? sql`lower(${user.email}) = ${identifier.toLowerCase()}`
            : sql`lower(${user.name}) = ${identifier.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (!candidate) return fail(401, "Invalid email, username or password.");
    email = candidate.email;
  } catch {
    return fail(503, "Authentication is temporarily unavailable.");
  }

  try {
    const origin = new URL(request.url).origin;
    const response = await authRequest(
      new Request(new URL("/api/auth/sign-in/email", origin), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          email,
          password: parsed.data.password,
        }),
      }),
    );
    if (!response.ok) return fail(401, "Invalid email, username or password.");
    return Response.json({ ok: true }, { headers: forwardCookies(response) });
  } catch {
    return fail(503, "Authentication is temporarily unavailable.");
  }
}
