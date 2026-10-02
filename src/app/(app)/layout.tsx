import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { AppNav } from "@/components/app-nav";
import { ToastProvider } from "@/components/ui";
import { readableOn } from "@/lib/color";
import { readSession, SESSION_COOKIE } from "@/lib/session";
import { getBrand } from "@/server/brand";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  // The whole app takes on the workspace's brand colors.
  const brand = await getBrand(session.workspaceId);
  const theme = brand
    ? ({
        "--accent": brand.primaryColor,
        "--accent-2": brand.secondaryColor,
        "--accent-fg": readableOn(brand.primaryColor),
      } as CSSProperties)
    : undefined;

  return (
    <div className="brand-theme flex min-h-dvh flex-1 flex-col md:flex-row" style={theme}>
      <ToastProvider>
        <AppNav
          email={session.email}
          brand={
            brand && {
              name: brand.name,
              primaryColor: brand.primaryColor,
              secondaryColor: brand.secondaryColor,
              logoUrl: brand.logoUrl,
            }
          }
        />
        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </ToastProvider>
    </div>
  );
}
