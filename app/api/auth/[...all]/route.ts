import { authRequest } from "@/lib/providers";
import { allow, clientKey } from "@/lib/limits";
async function handle(req: Request) {
  const path = new URL(req.url).pathname.replace("/api/auth/", "");
  // Sign-in and sign-out are intentionally only reachable through the
  // administrator routes, which add username support, role checks and
  // dedicated rate limiting.
  if (
    !["request-password-reset", "reset-password"].includes(path) &&
    !/^reset-password\/[\w-]+$/.test(path)
  )
    return new Response(null, { status: 404 });
  if (!allow("auth:" + clientKey(req), 15, 60000))
    return new Response(null, { status: 429 });
  try {
    return await authRequest(req);
  } catch {
    return Response.json(
      { error: "Authentication unavailable" },
      { status: 503 },
    );
  }
}
export { handle as POST, handle as GET };
