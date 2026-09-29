import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { setSessionCookie } from "@/lib/session";
import { signIn } from "@/server/auth";

// Login doesn't enforce the signup password rules, it just needs something to compare.
const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Password is required.").max(128),
});

export const POST = route(async (req) => {
  const { email, password } = await readJson(req, loginSchema);
  const session = await signIn(email, password);
  const res = NextResponse.json({ user: { id: session.userId, email: session.email } });
  await setSessionCookie(res, session);
  return res;
});
