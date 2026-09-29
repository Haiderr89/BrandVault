import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { ToastProvider } from "@/components/ui";
import { readSession, SESSION_COOKIE } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
        <AppNav email={session.email} />
        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
