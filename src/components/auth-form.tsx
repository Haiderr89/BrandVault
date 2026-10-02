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
    <main className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo className="text-lg" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="animate-rise">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {isLogin ? "Welcome back" : "Create your vault"}
            </h1>
            <p className="text-muted mt-1 text-sm">
              {isLogin ? "Sign in to your brand workspace." : "One home for your brand kit and every asset."}
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
            <p className="text-muted mt-8 text-center text-sm">
              {isLogin ? "New here? " : "Already have an account? "}
              <Link
                href={isLogin ? "/signup" : "/login"}
                className="text-accent-ink font-medium hover:underline"
              >
                {isLogin ? "Create an account" : "Sign in"}
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Showcase />
    </main>
  );
}

/** Decorative right-hand panel: a collage of the things BrandVault holds. */
function Showcase() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden lg:block"
      style={{ background: "linear-gradient(150deg, #2e1065 0%, #6d28d9 45%, #f59e0b 120%)" }}
    >
      <div className="dot-grid absolute inset-0 opacity-25 mix-blend-overlay" />
      <div className="absolute -bottom-24 -left-16 size-96 rounded-full bg-amber-400/40 blur-3xl" />
      <div className="absolute -top-20 right-0 size-80 rounded-full bg-fuchsia-400/30 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between p-12 text-white">
        <div className="max-w-md">
          <p className="text-sm font-medium tracking-wider text-white/70 uppercase">
            Brand kit · Asset library
          </p>
          <p className="font-display mt-3 text-4xl leading-tight font-semibold xl:text-5xl">
            Every logo, color and campaign file. One vault.
          </p>
        </div>

        <div className="relative h-80">
          {/* Palette card */}
          <div
            className="animate-float absolute top-0 left-0 w-56 rounded-2xl bg-white/95 p-4 text-zinc-900 shadow-2xl"
            style={{ ["--tilt" as string]: "-2deg", rotate: "-4deg" }}
          >
            <p className="text-xs font-semibold">Northwind Coffee</p>
            <div className="mt-3 flex gap-2">
              {["#7C3AED", "#F59E0B", "#18181B", "#FAFAF9"].map((c) => (
                <span key={c} className="size-9 rounded-lg ring-1 ring-black/10" style={{ background: c }} />
              ))}
            </div>
            <p className="font-display mt-3 text-2xl font-semibold">Aa</p>
            <p className="text-[11px] text-zinc-500">Inter · Bricolage</p>
          </div>

          {/* Asset card */}
          <div
            className="animate-float absolute top-6 right-4 w-60 overflow-hidden rounded-2xl bg-white/95 text-zinc-900 shadow-2xl [animation-delay:-2s] xl:right-16"
            style={{ ["--tilt" as string]: "3deg", rotate: "3deg" }}
          >
            <div className="h-28 bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500" />
            <div className="p-3">
              <p className="text-xs font-semibold">Autumn hero banner</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {["campaign", "autumn", "hero"].map((t) => (
                  <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* AI chip */}
          <div className="animate-float absolute bottom-2 left-24 flex items-center gap-2 rounded-full bg-zinc-900/90 px-4 py-2 text-sm shadow-2xl ring-1 ring-white/10 [animation-delay:-4s]">
            <span className="text-amber-300">✦</span> AI suggested 5 tags
          </div>
        </div>
      </div>
    </aside>
  );
}
