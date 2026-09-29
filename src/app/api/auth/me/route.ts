import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/http";

export const GET = authedRoute(async (_req, { session }) =>
  NextResponse.json({ user: { id: session.userId, email: session.email } }),
);
