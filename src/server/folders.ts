import { and, asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { assets, folders, type Folder } from "@/db/schema";
import { badRequest, conflict, notFound } from "@/lib/http";
import { MAX_FOLDER_DEPTH } from "@/lib/validation";

/** Fetch a folder only if it belongs to the workspace. Cross-workspace ids 404. */
export async function getFolder(workspaceId: string, id: string) {
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.workspaceId, workspaceId)));
  if (!folder) throw notFound("Folder");
  return folder;
}

export async function listFolders(workspaceId: string, parentId: string | null) {
  if (parentId) await getFolder(workspaceId, parentId);
  return db
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.workspaceId, workspaceId),
        parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId),
      ),
    )
    .orderBy(asc(folders.name));
}

/** Every folder in the workspace, for "move to…" pickers. */
export async function listAllFolders(workspaceId: string) {
  return db
    .select()
    .from(folders)
    .where(eq(folders.workspaceId, workspaceId))
    .orderBy(asc(folders.depth), asc(folders.name));
}

/** The folder plus its ancestors, root first — used for breadcrumbs. */
export async function getFolderPath(workspaceId: string, id: string) {
  const path: Folder[] = [];
  let current: Folder | null = await getFolder(workspaceId, id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? await getFolder(workspaceId, current.parentId) : null;
  }
  return path;
}

export async function createFolder(workspaceId: string, name: string, parentId: string | null) {
  let depth = 1;
  if (parentId) {
    const parent = await getFolder(workspaceId, parentId);
    depth = parent.depth + 1;
    if (depth > MAX_FOLDER_DEPTH) {
      throw badRequest(`Folders can be nested at most ${MAX_FOLDER_DEPTH} levels deep.`);
    }
  }
  const [folder] = await db.insert(folders).values({ workspaceId, name, parentId, depth }).returning();
  return folder;
}

export async function renameFolder(workspaceId: string, id: string, name: string) {
  const [folder] = await db
    .update(folders)
    .set({ name })
    .where(and(eq(folders.id, id), eq(folders.workspaceId, workspaceId)))
    .returning();
  if (!folder) throw notFound("Folder");
  return folder;
}

/**
 * Deletion is blocked while the folder has subfolders or live assets.
 * Trashed assets don't block it: the FK sets their folder to NULL, so a later
 * restore puts them at the library root.
 */
export async function deleteFolder(workspaceId: string, id: string) {
  await getFolder(workspaceId, id);
  const [[{ subfolders }], [{ liveAssets }]] = await Promise.all([
    db.select({ subfolders: count() }).from(folders).where(eq(folders.parentId, id)),
    db
      .select({ liveAssets: count() })
      .from(assets)
      .where(and(eq(assets.folderId, id), isNull(assets.deletedAt))),
  ]);
  if (subfolders > 0 || liveAssets > 0) {
    throw conflict("Folder is not empty. Move or trash its assets and subfolders first.");
  }
  await db.delete(folders).where(and(eq(folders.id, id), eq(folders.workspaceId, workspaceId)));
}
