import { NextResponse } from "next/server";
import { authedRoute, parseId, readJson } from "@/lib/http";
import { folderCreateSchema } from "@/lib/validation";
import { createFolder, listAllFolders, listFolders } from "@/server/folders";

// GET /api/folders?parentId=<id>  -> children of a folder (root when omitted)
// GET /api/folders?all=true       -> every folder, for move pickers
export const GET = authedRoute(async (req, { session }) => {
  const params = req.nextUrl.searchParams;
  if (params.get("all") === "true") {
    return NextResponse.json({ folders: await listAllFolders(session.workspaceId) });
  }
  const parentId = params.get("parentId");
  const folders = await listFolders(session.workspaceId, parentId ? parseId(parentId, "Folder") : null);
  return NextResponse.json({ folders });
});

export const POST = authedRoute(async (req, { session }) => {
  const { name, parentId } = await readJson(req, folderCreateSchema);
  const folder = await createFolder(session.workspaceId, name, parentId ?? null);
  return NextResponse.json({ folder }, { status: 201 });
});
