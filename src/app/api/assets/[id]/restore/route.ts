import { NextResponse } from "next/server";
import { authedRoute, parseId } from "@/lib/http";
import { restoreAsset } from "@/server/assets";
import { emitEvent } from "@/server/webhooks";

export const POST = authedRoute(async (_req, { params, session }) => {
  const asset = await restoreAsset(session.workspaceId, parseId(params.id, "Asset"));
  emitEvent("asset.restored", session, { assetId: asset.id });
  return NextResponse.json({ asset });
});
