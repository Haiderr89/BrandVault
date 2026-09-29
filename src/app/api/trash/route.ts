import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/http";
import { listTrash } from "@/server/assets";

// Only soft-deleted assets.
export const GET = authedRoute(async (_req, { session }) =>
  NextResponse.json({ assets: await listTrash(session.workspaceId) }),
);
