import { NextResponse } from "next/server";
import { authedRoute, parseId, readJson } from "@/lib/http";
import { aiSuggestionSchema } from "@/lib/validation";
import { saveAiSuggestion } from "@/server/assets";

// Saves the (possibly user-edited) suggestion after review. The body is
// validated with the same schema as the model output.
export const PATCH = authedRoute(async (req, { params, session }) => {
  const id = parseId(params.id, "Asset");
  const suggestion = await readJson(req, aiSuggestionSchema);
  return NextResponse.json({ asset: await saveAiSuggestion(session.workspaceId, id, suggestion) });
});
