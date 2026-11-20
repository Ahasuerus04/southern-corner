import "server-only";
// Local setup replaces this fail-closed adapter only after credentials are supplied.
export const authReady = false;
export async function administrator(_headers: Headers): Promise<boolean> {
  return false;
}
export async function authRequest(_request: Request): Promise<Response> {
  return Response.json(
    { error: "Administrator access is not configured." },
    { status: 503 },
  );
}
