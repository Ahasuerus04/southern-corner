import { authReady, authRequest } from "@/lib/providers";
import { sameOrigin } from "@/lib/limits";

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
  if (!authReady) return fail(503, "Administrator authentication is not configured.");
  try {
    const origin = new URL(request.url).origin;
    const response = await authRequest(
      new Request(new URL("/api/auth/sign-out", origin), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          cookie: request.headers.get("cookie") ?? "",
        },
        body: "{}",
      }),
    );
    if (!response.ok) return fail(401, "Sign out failed.");
    return Response.json({ ok: true }, { headers: forwardCookies(response) });
  } catch {
    return fail(503, "Authentication is temporarily unavailable.");
  }
}
