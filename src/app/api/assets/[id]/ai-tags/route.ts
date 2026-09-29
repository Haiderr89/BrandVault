import { NextResponse } from "next/server";
import { authedRoute, parseId } from "@/lib/http";
import { suggestAssetTags } from "@/server/ai";

export const maxDuration = 60;

// Returns a suggestion only. Nothing is written until the user saves it
// via PATCH /api/assets/:id/ai-tags/save.
export const POST = authedRoute(async (_req, { params, session }) => {
  const suggestion = await suggestAssetTags(session.workspaceId, parseId(params.id, "Asset"));
  return NextResponse.json({ suggestion });
});
