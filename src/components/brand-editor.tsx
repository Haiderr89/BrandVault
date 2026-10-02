"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError, useApi } from "@/lib/api-client";
import { readableOn } from "@/lib/color";
import type { Brand } from "@/lib/types";
import { Button, ErrorState, Field, FormError, Input, Spinner, useToast } from "./ui";

type Form = { name: string; primaryColor: string; secondaryColor: string; logoUrl: string; fontName: string };
const EMPTY: Form = {
  name: "",
  primaryColor: "#6D28D9",
  secondaryColor: "#F59E0B",
  logoUrl: "",
  fontName: "",
};
const HEX = /^#[0-9A-Fa-f]{6}$/;

const toForm = (b: Brand): Form => ({
  name: b.name,
  primaryColor: b.primaryColor,
  secondaryColor: b.secondaryColor,
  logoUrl: b.logoUrl ?? "",
  fontName: b.fontName ?? "",
});

export function BrandEditor() {
  const { data, error, loading, reload, setData } = useApi<{ brand: Brand | null }>("/api/brand");

  if (loading && !data) return <Spinner label="Loading brand kit…" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const brand = data?.brand ?? null;
  // Re-seed the form whenever a save returns a newer brand.
  return <BrandForm key={brand?.updatedAt ?? "new"} brand={brand} onSaved={(b) => setData({ brand: b })} />;
}

function BrandForm({ brand, onSaved }: { brand: Brand | null; onSaved: (b: Brand) => void }) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState<Form>(brand ? toForm(brand) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = brand ? JSON.stringify(toForm(brand)) !== JSON.stringify(form) : true;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res = await api<{ brand: Brand }>("/api/brand", { method: brand ? "PATCH" : "POST", body: form });
      onSaved(res.brand);
      router.refresh(); // re-theme the app shell with the new colors
      toast({ tone: "success", message: brand ? "Brand kit updated" : "Brand kit created" });
    } catch (err) {
      const e = err as ApiError;
      setFormError(e.message);
      setFieldErrors(e.details ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Brand kit</h1>
        <p className="text-muted mt-1 text-sm">
          {brand
            ? "Your brand's name, colors, logo and type. The whole app wears these colors."
            : "Set up your brand. You can change it any time."}
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <form
          onSubmit={submit}
          className="border-line bg-surface space-y-5 rounded-2xl border p-5 sm:p-6"
          noValidate
        >
          <FormError message={formError} />
          <Field label="Brand name" error={fieldErrors.name?.[0]}>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!fieldErrors.name}
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Northwind Coffee"
                maxLength={120}
                required
              />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField
              label="Primary color"
              value={form.primaryColor}
              onChange={set("primaryColor")}
              error={fieldErrors.primaryColor?.[0]}
            />
            <ColorField
              label="Secondary color"
              value={form.secondaryColor}
              onChange={set("secondaryColor")}
              error={fieldErrors.secondaryColor?.[0]}
            />
          </div>

          <Field
            label="Logo URL"
            error={fieldErrors.logoUrl?.[0]}
            hint="Optional. An https:// link to your logo image."
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!fieldErrors.logoUrl}
                type="url"
                value={form.logoUrl}
                onChange={(e) => set("logoUrl")(e.target.value)}
                placeholder="https://…/logo.png"
              />
            )}
          </Field>
          <Field
            label="Default font"
            error={fieldErrors.fontName?.[0]}
            hint="Optional, e.g. Inter or Playfair Display."
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                value={form.fontName}
                onChange={(e) => set("fontName")(e.target.value)}
                placeholder="Inter"
                maxLength={120}
              />
            )}
          </Field>

          <div className="border-line flex items-center justify-end gap-2 border-t pt-5">
            {brand && dirty && (
              <Button type="button" variant="ghost" onClick={() => setForm(toForm(brand))}>
                Discard changes
              </Button>
            )}
            <Button type="submit" loading={saving} disabled={!dirty}>
              {brand ? "Save changes" : "Create brand kit"}
            </Button>
          </div>
        </form>

        <BrandPreview form={form} />
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const valid = HEX.test(value);
  return (
    <Field label={label} error={error ?? (valid ? undefined : "Use a 6-digit hex like #1A2B3C")}>
      {(id, d) => (
        <div className="flex gap-2">
          <input
            type="color"
            aria-label={`${label} picker`}
            value={valid ? value : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="border-line bg-surface h-10 w-12 shrink-0 cursor-pointer rounded-lg border p-1"
          />
          <Input
            id={id}
            aria-describedby={d}
            aria-invalid={!valid || !!error}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono uppercase"
            maxLength={7}
          />
        </div>
      )}
    </Field>
  );
}

function BrandPreview({ form }: { form: Form }) {
  const primary = HEX.test(form.primaryColor) ? form.primaryColor : "#cccccc";
  const secondary = HEX.test(form.secondaryColor) ? form.secondaryColor : "#eeeeee";
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logoOk = failedLogo !== form.logoUrl;
  const font = previewFont(form.fontName);
  const name = form.name || "Your brand";

  const mark = (size: string) =>
    form.logoUrl && logoOk ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={form.logoUrl}
        alt=""
        onError={() => setFailedLogo(form.logoUrl)}
        className={`${size} rounded-xl object-cover ring-2 ring-white/30`}
      />
    ) : (
      <div
        className={`${size} grid place-items-center rounded-xl bg-white/20 text-lg font-bold ring-2 ring-white/30`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );

  return (
    <aside className="space-y-3 xl:sticky xl:top-8 xl:self-start">
      <GoogleFont family={form.fontName} />
      <p className="text-muted text-xs font-medium tracking-wider uppercase">Live preview</p>

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${primary} 55%, ${secondary} 130%)`,
          color: readableOn(primary),
        }}
      >
        <div className="dot-grid absolute inset-0 opacity-30 mix-blend-overlay" />
        <div
          className="absolute -top-10 -right-10 size-36 rounded-full opacity-60 blur-2xl"
          style={{ background: secondary }}
        />
        <div className="relative flex items-center gap-3">
          {mark("size-12")}
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold" style={{ fontFamily: font }}>
              {name}
            </p>
            <p className="text-xs opacity-80">Brand kit</p>
          </div>
        </div>
        <p className="relative mt-8 text-4xl leading-none font-semibold" style={{ fontFamily: font }}>
          Aa Bb Cc
        </p>
        <p className="relative mt-2 text-xs opacity-80">{form.fontName || "Default font"} · 0123456789</p>
      </div>

      {/* Swatches */}
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Primary", primary, form.primaryColor],
          ["Secondary", secondary, form.secondaryColor],
        ].map(([label, color, raw]) => (
          <div key={label} className="border-line bg-surface overflow-hidden rounded-xl border">
            <div className="h-16" style={{ background: color }} />
            <div className="px-3 py-2">
              <p className="text-xs font-medium">{label}</p>
              <p className="text-muted font-mono text-[11px]">{raw.toUpperCase()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* In context */}
      <div className="border-line bg-surface rounded-xl border p-3">
        <p className="text-muted mb-2 text-[11px] font-medium tracking-wider uppercase">In use</p>
        <div className="flex items-center gap-3">
          <div
            className="grid aspect-square w-20 shrink-0 place-items-center rounded-lg p-2 text-center text-[10px] leading-tight font-semibold"
            style={{ background: secondary, color: readableOn(secondary), fontFamily: font }}
          >
            New season. New {name.split(" ")[0]}.
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold" style={{ fontFamily: font }}>
              Social post
            </p>
            <span
              className="inline-block rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: primary, color: readableOn(primary) }}
            >
              Shop now
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

const previewFont = (name: string) =>
  name.trim() ? `"${name.trim().replace(/"/g, "")}", var(--font-sans), sans-serif` : undefined;

// Best-effort: load the named font from Google Fonts so the preview renders it.
// Unknown names just fall back to the app font.
function GoogleFont({ family }: { family: string }) {
  const name = family.trim();
  if (!name || !/^[\w \-]{1,60}$/.test(name)) return null;
  return (
    <link
      rel="stylesheet"
      href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600&display=swap`}
    />
  );
}
