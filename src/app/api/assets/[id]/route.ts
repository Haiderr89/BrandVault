import { NextResponse } from "next/server";
import { authedRoute, parseId, readJson } from "@/lib/http";
import { assetUpdateSchema } from "@/lib/validation";
import { deleteAssetForever, getAsset, updateAsset } from "@/server/assets";

export const GET = authedRoute(async (_req, { params, session }) =>
  NextResponse.json({ asset: await getAsset(session.workspaceId, parseId(params.id, "Asset")) }),
);

export const PATCH = authedRoute(async (req, { params, session }) => {
  const id = parseId(params.id, "Asset");
  const input = await readJson(req, assetUpdateSchema);
  return NextResponse.json({ asset: await updateAsset(session.workspaceId, id, input) });
});

// Permanent delete — only allowed for assets already in the trash.
export const DELETE = authedRoute(async (_req, { params, session }) => {
  await deleteAssetForever(session.workspaceId, parseId(params.id, "Asset"));
  return new NextResponse(null, { status: 204 });
});
