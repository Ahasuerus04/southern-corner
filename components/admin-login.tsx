"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AdminLogin({
  ready,
  reset,
  token,
}: {
  ready: boolean;
  reset: boolean;
  token?: string;
}) {
  const [recover, R] = useState(false),
    [msg, M] = useState(""),
    [busy, B] = useState(false),
    router = useRouter();
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        B(true);
        M("");
        const f = new FormData(e.currentTarget);
        try {
          const path = token
            ? "reset-password"
            : recover
              ? "request-password-reset"
              : "sign-in/email";
          const payload = token
            ? { token, newPassword: f.get("password") }
            : recover
              ? {
                  email: f.get("email"),
                  redirectTo: `${location.origin}/admin/login`,
                }
              : { email: f.get("email"), password: f.get("password") };
          const r = await fetch(`/api/auth/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!r.ok) throw Error();
          if (recover)
            M("If the address is eligible, a reset link will be sent.");
          else if (token) {
            router.replace("/admin/login");
            M("Password updated. Sign in to continue.");
          } else {
            router.replace("/admin");
            router.refresh();
          }
        } catch {
          M("Request unsuccessful. Check your details and try again.");
        } finally {
          B(false);
        }
      }}
    >
      {!ready && (
        <p className="notice">
          Administrator access is offline in this edition. Complete the local
          Neon and Better Auth setup in the README to enable sign-in.
        </p>
      )}
      {!token && (
        <label className="field">
          Email address
          <input name="email" type="email" autoComplete="username" required />
        </label>
      )}
      {!recover && (
        <label className="field">
          {token ? "New password" : "Password"}
          <input
            name="password"
            type="password"
            autoComplete={token ? "new-password" : "current-password"}
            required
            minLength={token ? 12 : 1}
          />
        </label>
      )}
      <button className="primary" disabled={!ready || busy}>
        {busy
          ? "Please wait…"
          : token
            ? "Set new password"
            : recover
              ? "Send reset link"
              : "Sign in"}
      </button>
      {reset && !token && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            R(!recover);
            M("");
          }}
        >
          {recover ? "Back to sign in" : "Forgot password?"}
        </button>
      )}
      <p role="status">{msg}</p>
    </form>
  );
}
