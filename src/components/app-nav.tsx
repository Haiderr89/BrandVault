"use client";

import clsx from "clsx";
import { FolderOpen, LogOut, Palette, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Logo } from "./logo";

const links = [
  { href: "/library", label: "Library", icon: FolderOpen },
  { href: "/brand", label: "Brand kit", icon: Palette },
  { href: "/trash", label: "Trash", icon: Trash2 },
];

export function AppNav({ email }: { email: string }) {
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
      <aside className="border-line bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-5 md:flex">
        <Link href="/library" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                  active
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-line mt-auto border-t pt-4">
          <p className="text-muted truncate px-2.5 text-xs" title={email}>
            {email}
          </p>
          <button
            onClick={logout}
            className="text-muted hover:bg-surface-2 hover:text-fg mt-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
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
                active ? "text-accent" : "text-muted",
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
