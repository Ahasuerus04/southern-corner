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
  const [recover, setRecover] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="panel"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const form = new FormData(event.currentTarget);
        try {
          if (token) {
            const response = await fetch("/api/auth/reset-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                newPassword: form.get("password"),
              }),
            });
            if (!response.ok) throw new Error();
            router.replace("/admin/login");
            setMessage("Password updated. Sign in to continue.");
          } else if (recover) {
            const response = await fetch(
              "/api/auth/request-password-reset",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: form.get("identifier"),
                  redirectTo: `${location.origin}/admin/login`,
                }),
              },
            );
            if (!response.ok) throw new Error();
            setMessage(
              "If the address is eligible, a reset link will be sent.",
            );
          } else {
            const response = await fetch("/api/admin/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identifier: form.get("identifier"),
                password: form.get("password"),
              }),
            });
            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              throw new Error(
                typeof payload?.error === "string"
                  ? payload.error
                  : "Invalid email, username or password.",
              );
            }
            router.replace("/admin/dashboard");
            router.refresh();
          }
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Request unsuccessful. Check your details and try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {!ready && (
        <p className="notice warn">
          Administrator access is offline. Configure <code>DATABASE_URL</code>,{" "}
          <code>BETTER_AUTH_SECRET</code> and run <code>bun run admin:create</code>{" "}
          to enable sign-in.
        </p>
      )}
      {!token && (
        <label className="field">
          Email or username
          <input
            name="identifier"
            type={recover ? "email" : "text"}
            autoComplete="username"
            required
            maxLength={320}
          />
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
            maxLength={72}
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
            setRecover(!recover);
            setMessage("");
          }}
        >
          {recover ? "Back to sign in" : "Forgot password?"}
        </button>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
