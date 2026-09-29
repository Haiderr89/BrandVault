import { NextResponse } from "next/server";
import { authedRoute, readJson } from "@/lib/http";
import { assetCreateSchema, assetListQuerySchema } from "@/lib/validation";
import { createAsset, listAssets } from "@/server/assets";

// GET /api/assets?folderId=&q=&sort=updated_desc|name_asc
export const GET = authedRoute(async (req, { session }) => {
  const query = assetListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json({ assets: await listAssets(session.workspaceId, query) });
});

export const POST = authedRoute(async (req, { session }) => {
  const input = await readJson(req, assetCreateSchema);
  return NextResponse.json({ asset: await createAsset(session.workspaceId, input) }, { status: 201 });
});
