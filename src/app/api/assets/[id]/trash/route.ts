import { NextResponse } from "next/server";
import { authedRoute, parseId } from "@/lib/http";
import { trashAsset } from "@/server/assets";

export const POST = authedRoute(async (_req, { params, session }) =>
  NextResponse.json({ asset: await trashAsset(session.workspaceId, parseId(params.id, "Asset")) }),
);
