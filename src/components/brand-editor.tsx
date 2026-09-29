"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError, useApi } from "@/lib/api-client";
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
        <h1 className="text-2xl font-semibold tracking-tight">Brand kit</h1>
        <p className="text-muted mt-1 text-sm">
          {brand
            ? "Your brand's name, colors, logo and type."
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

// Pick black or white text for legibility on a given background.
function readableOn(hex: string) {
  if (!HEX.test(hex)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#111111" : "#ffffff";
}

function BrandPreview({ form }: { form: Form }) {
  const primary = HEX.test(form.primaryColor) ? form.primaryColor : "#cccccc";
  const secondary = HEX.test(form.secondaryColor) ? form.secondaryColor : "#eeeeee";
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const logoOk = failedLogo !== form.logoUrl;

  return (
    <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
      <GoogleFont family={form.fontName} />
      <p className="text-muted text-xs font-medium tracking-wider uppercase">Live preview</p>
      <div className="border-line bg-surface overflow-hidden rounded-2xl border">
        <div
          className="flex items-center gap-3 p-5"
          style={{ background: primary, color: readableOn(primary) }}
        >
          {form.logoUrl && logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logoUrl}
              alt=""
              onError={() => setFailedLogo(form.logoUrl)}
              className="size-12 rounded-xl bg-white/20 object-cover"
            />
          ) : (
            <div className="grid size-12 place-items-center rounded-xl bg-white/20 text-lg font-bold">
              {(form.name || "B").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold" style={{ fontFamily: previewFont(form.fontName) }}>
              {form.name || "Your brand"}
            </p>
            <p className="text-xs opacity-80">{form.fontName || "Default font"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          {[
            ["Primary", primary, form.primaryColor],
            ["Secondary", secondary, form.secondaryColor],
          ].map(([label, color, raw]) => (
            <div key={label}>
              <div
                className="flex h-20 items-end rounded-xl p-2 text-xs font-medium"
                style={{ background: color, color: readableOn(color) }}
              >
                {label}
              </div>
              <p className="text-muted mt-1.5 font-mono text-xs">{raw.toUpperCase()}</p>
            </div>
          ))}
        </div>
        <div className="border-line border-t p-5">
          <button
            type="button"
            tabIndex={-1}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: secondary, color: readableOn(secondary) }}
          >
            Sample button
          </button>
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
