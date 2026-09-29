import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// Optimistic page redirects only. Real authorization happens in every API
// route (authedRoute) and in the app layout.
const APP_PAGES = ["/library", "/brand", "/trash"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? "/library" : "/login", req.url));
  }
  if (!session && APP_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/library", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/library/:path*", "/brand/:path*", "/trash/:path*", "/login", "/signup"],
};
