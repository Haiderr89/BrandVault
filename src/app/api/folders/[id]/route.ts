import { NextResponse } from "next/server";
import { authedRoute, parseId, readJson } from "@/lib/http";
import { folderUpdateSchema } from "@/lib/validation";
import { deleteFolder, getFolderPath, renameFolder } from "@/server/folders";

// Returns the folder with its ancestor path (for breadcrumbs).
export const GET = authedRoute(async (_req, { params, session }) => {
  const path = await getFolderPath(session.workspaceId, parseId(params.id, "Folder"));
  return NextResponse.json({ folder: path.at(-1), path });
});

export const PATCH = authedRoute(async (req, { params, session }) => {
  const id = parseId(params.id, "Folder");
  const { name } = await readJson(req, folderUpdateSchema);
  return NextResponse.json({ folder: await renameFolder(session.workspaceId, id, name) });
});

export const DELETE = authedRoute(async (_req, { params, session }) => {
  await deleteFolder(session.workspaceId, parseId(params.id, "Folder"));
  return new NextResponse(null, { status: 204 });
});
