"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Logo } from "./logo";
import { Button, Field, FormError, Input } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [busy, setBusy] = useState<"form" | "demo" | null>(null);

  async function run(kind: "form" | "demo", fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    setFieldErrors({});
    try {
      await fn();
      router.replace("/library");
      router.refresh();
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      setFieldErrors(e.details ?? {});
      setBusy(null);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run("form", () =>
      api(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        body: { email, password },
      }),
    );
  };

  const isLogin = mode === "login";
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="text-lg" />
        </div>
        <div className="border-line bg-surface rounded-2xl border p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{isLogin ? "Welcome back" : "Create your vault"}</h1>
          <p className="text-muted mt-1 text-sm">
            {isLogin ? "Sign in to your brand workspace." : "One workspace for your brand kit and assets."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <FormError message={error} />
            <Field label="Email" error={fieldErrors.email?.[0]}>
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  aria-invalid={!!fieldErrors.email}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field
              label="Password"
              error={fieldErrors.password?.[0]}
              hint={isLogin ? undefined : "At least 8 characters."}
            >
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  aria-invalid={!!fieldErrors.password}
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}
            </Field>
            <Button type="submit" className="w-full" loading={busy === "form"} disabled={!!busy}>
              {isLogin ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="text-muted my-5 flex items-center gap-3 text-xs">
            <span className="bg-line h-px flex-1" /> or <span className="bg-line h-px flex-1" />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            loading={busy === "demo"}
            disabled={!!busy}
            onClick={() => run("demo", () => api("/api/auth/demo", { method: "POST" }))}
          >
            Continue as demo
          </Button>
          <p className="text-muted mt-3 text-center text-xs">Demo login: demo@brandvault.dev / Demo1234!</p>
        </div>
        <p className="text-muted mt-6 text-center text-sm">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link href={isLogin ? "/signup" : "/login"} className="text-accent font-medium hover:underline">
            {isLogin ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
