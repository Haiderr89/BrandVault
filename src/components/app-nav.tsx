"use client";

import clsx from "clsx";
import { ArrowRight, FolderOpen, LogOut, Palette, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { readableOn } from "@/lib/color";
import { Logo } from "./logo";

const links = [
  { href: "/library", label: "Library", icon: FolderOpen },
  { href: "/brand", label: "Brand kit", icon: Palette },
  { href: "/trash", label: "Trash", icon: Trash2 },
];

type NavBrand = { name: string; primaryColor: string; secondaryColor: string; logoUrl: string | null };

export function AppNav({ email, brand }: { email: string; brand: NavBrand | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="border-line bg-surface sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r px-3 py-5 md:flex">
        <Link href="/library" className="px-2">
          <Logo />
        </Link>

        <div className="mt-6 px-1">
          <BrandCard brand={brand} />
        </div>

        <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-accent-soft text-accent-ink font-medium"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {active && <span className="bg-accent absolute top-2 bottom-2 left-0 w-0.5 rounded-full" />}
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-line mt-auto flex items-center gap-2.5 border-t px-1 pt-4">
          <span className="bg-surface-2 text-fg grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase">
            {email.charAt(0)}
          </span>
          <p className="text-muted min-w-0 flex-1 truncate text-xs" title={email}>
            {email}
          </p>
          <button
            onClick={logout}
            className="text-muted hover:bg-surface-2 hover:text-fg rounded-lg p-2"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar + bottom tabs */}
      <header className="border-line bg-surface flex items-center justify-between border-b px-4 py-3 md:hidden">
        <Logo />
        <button
          onClick={logout}
          className="text-muted hover:bg-surface-2 rounded-lg p-2"
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </header>
      <nav
        aria-label="Main"
        className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t backdrop-blur md:hidden"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex flex-col items-center gap-1 py-2.5 text-xs",
                active ? "text-accent-ink" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function BrandCard({ brand }: { brand: NavBrand | null }) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (!brand) {
    return (
      <Link
        href="/brand"
        className="border-line hover:border-accent group block rounded-xl border border-dashed p-3 transition"
      >
        <p className="text-sm font-medium">Set up your brand</p>
        <p className="text-muted mt-0.5 flex items-center gap-1 text-xs">
          Colors, logo &amp; font <ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
        </p>
      </Link>
    );
  }

  return (
    <Link
      href="/brand"
      className="border-line group block overflow-hidden rounded-xl border transition hover:shadow-md"
      title="Edit brand kit"
    >
      <div
        className="relative h-14"
        style={{ background: `linear-gradient(120deg, ${brand.primaryColor}, ${brand.secondaryColor})` }}
      >
        <div className="dot-grid absolute inset-0 opacity-40 mix-blend-overlay" />
      </div>
      <div className="bg-surface flex items-end gap-2.5 px-3 pb-3">
        <span
          className="border-surface -mt-5 grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border-2 text-sm font-bold shadow-sm"
          style={{ background: brand.primaryColor, color: readableOn(brand.primaryColor) }}
        >
          {brand.logoUrl && !logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt=""
              className="size-full object-cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            brand.name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1 pt-2">
          <p className="truncate text-sm font-semibold">{brand.name}</p>
          <div className="mt-1 flex gap-1">
            {[brand.primaryColor, brand.secondaryColor].map((c) => (
              <span key={c} className="ring-line size-3 rounded-full ring-1" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
