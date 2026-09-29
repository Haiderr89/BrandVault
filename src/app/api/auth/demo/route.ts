import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { setSessionCookie } from "@/lib/session";
import { ensureDemoAccount } from "@/server/demo";

export const POST = route(async () => {
  const session = await ensureDemoAccount();
  const res = NextResponse.json({ user: { id: session.userId, email: session.email } });
  await setSessionCookie(res, session);
  return res;
});
