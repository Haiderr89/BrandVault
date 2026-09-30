import { NextResponse } from "next/server";
import { authedRoute, parseId, readJson } from "@/lib/http";
import { aiSuggestionSchema } from "@/lib/validation";
import { saveAiSuggestion } from "@/server/assets";
import { emitEvent } from "@/server/webhooks";

// Saves the (possibly user-edited) suggestion after review. The body is
// validated with the same schema as the model output.
export const PATCH = authedRoute(async (req, { params, session }) => {
  const id = parseId(params.id, "Asset");
  const suggestion = await readJson(req, aiSuggestionSchema);
  const asset = await saveAiSuggestion(session.workspaceId, id, suggestion);
  emitEvent("asset.ai_tags_saved", session, { assetId: asset.id });
  return NextResponse.json({ asset });
});
