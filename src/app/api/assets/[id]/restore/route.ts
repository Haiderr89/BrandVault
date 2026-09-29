import { NextResponse } from "next/server";
import { authedRoute, parseId } from "@/lib/http";
import { restoreAsset } from "@/server/assets";

export const POST = authedRoute(async (_req, { params, session }) =>
  NextResponse.json({ asset: await restoreAsset(session.workspaceId, parseId(params.id, "Asset")) }),
);
