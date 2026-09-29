import { jwtVerify, SignJWT } from "jose";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "bv_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type Session = { userId: string; workspaceId: string; email: string };

// Read directly from process.env (not the zod env proxy) so this module stays
// safe to import from the proxy/edge bundle.
function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set (min 32 chars).");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(session: Session) {
  return new SignJWT({ wid: session.workspaceId, email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.wid !== "string") return null;
    return { userId: payload.sub, workspaceId: payload.wid, email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export async function setSessionCookie(res: NextResponse, session: Session) {
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
