import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { clearSessionCookie } from "@/lib/session";

export const POST = route(async () => {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
