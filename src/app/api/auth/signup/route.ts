import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/http";
import { setSessionCookie } from "@/lib/session";
import { credentialsSchema } from "@/lib/validation";
import { signUp } from "@/server/auth";

export const POST = route(async (req) => {
  const { email, password } = await readJson(req, credentialsSchema);
  const session = await signUp(email, password);
  const res = NextResponse.json({ user: { id: session.userId, email: session.email } }, { status: 201 });
  await setSessionCookie(res, session);
  return res;
});
