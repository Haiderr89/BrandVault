import { and, asc, desc, eq, ilike, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { assets, folders } from "@/db/schema";
import { conflict, notFound } from "@/lib/http";
import type { AiSuggestion, AssetSort, assetCreateSchema, assetUpdateSchema } from "@/lib/validation";
import { getFolder } from "./folders";

const inWorkspace = (workspaceId: string) => eq(assets.workspaceId, workspaceId);
const live = isNull(assets.deletedAt);
const trashed = isNotNull(assets.deletedAt);

const orderFor = (sort: AssetSort) =>
  sort === "name_asc" ? [asc(assets.name), desc(assets.updatedAt)] : [desc(assets.updatedAt)];

// Escape LIKE wildcards so a search for "50%" matches literally.
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const withFolderName = {
  asset: assets,
  folderName: folders.name,
};

type ListOptions = { folderId?: string; q?: string; sort: AssetSort };

/**
 * Library listing. Soft-deleted assets are always excluded.
 * With a search query the whole workspace is searched; otherwise only the
 * current folder (or the root when no folder is given) is listed.
 */
export async function listAssets(workspaceId: string, { folderId, q, sort }: ListOptions) {
  const where: SQL[] = [inWorkspace(workspaceId), live];
  if (q) {
    where.push(ilike(assets.name, likePattern(q)));
  } else if (folderId) {
    await getFolder(workspaceId, folderId);
    where.push(eq(assets.folderId, folderId));
  } else {
    where.push(isNull(assets.folderId));
  }
  const rows = await db
    .select(withFolderName)
    .from(assets)
    .leftJoin(folders, eq(folders.id, assets.folderId))
    .where(and(...where))
    .orderBy(...orderFor(sort));
  return rows.map(({ asset, folderName }) => ({ ...asset, folderName }));
}

export async function listTrash(workspaceId: string) {
  const rows = await db
    .select(withFolderName)
    .from(assets)
    .leftJoin(folders, eq(folders.id, assets.folderId))
    .where(and(inWorkspace(workspaceId), trashed))
    .orderBy(desc(assets.deletedAt));
  return rows.map(({ asset, folderName }) => ({ ...asset, folderName }));
}

/** A live (not trashed) asset in this workspace, or 404. */
export async function getAsset(workspaceId: string, id: string) {
  const [row] = await db
    .select(withFolderName)
    .from(assets)
    .leftJoin(folders, eq(folders.id, assets.folderId))
    .where(and(eq(assets.id, id), inWorkspace(workspaceId), live));
  if (!row) throw notFound("Asset");
  return { ...row.asset, folderName: row.folderName };
}

async function assertFolder(workspaceId: string, folderId: string | null | undefined) {
  if (folderId) await getFolder(workspaceId, folderId);
}

export async function createAsset(workspaceId: string, input: z.infer<typeof assetCreateSchema>) {
  await assertFolder(workspaceId, input.folderId);
  const [asset] = await db
    .insert(assets)
    .values({ ...input, folderId: input.folderId ?? null, workspaceId })
    .returning();
  return asset;
}

export async function updateAsset(workspaceId: string, id: string, input: z.infer<typeof assetUpdateSchema>) {
  await assertFolder(workspaceId, input.folderId);
  const [asset] = await db
    .update(assets)
    .set(input)
    .where(and(eq(assets.id, id), inWorkspace(workspaceId), live))
    .returning();
  if (!asset) throw notFound("Asset");
  return asset;
}

async function findAny(workspaceId: string, id: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), inWorkspace(workspaceId)));
  if (!asset) throw notFound("Asset");
  return asset;
}

export async function trashAsset(workspaceId: string, id: string) {
  const asset = await findAny(workspaceId, id);
  if (asset.deletedAt) throw conflict("Asset is already in the trash.");
  const [updated] = await db
    .update(assets)
    .set({ deletedAt: new Date() })
    .where(and(eq(assets.id, id), inWorkspace(workspaceId)))
    .returning();
  return updated;
}

export async function restoreAsset(workspaceId: string, id: string) {
  const asset = await findAny(workspaceId, id);
  if (!asset.deletedAt) throw conflict("Asset is not in the trash.");
  const [updated] = await db
    .update(assets)
    .set({ deletedAt: null })
    .where(and(eq(assets.id, id), inWorkspace(workspaceId)))
    .returning();
  return updated;
}

/** Permanent delete is only allowed from the trash. */
export async function deleteAssetForever(workspaceId: string, id: string) {
  const asset = await findAny(workspaceId, id);
  if (!asset.deletedAt) throw conflict("Move the asset to the trash before deleting it permanently.");
  await db.delete(assets).where(and(eq(assets.id, id), inWorkspace(workspaceId)));
}

export async function saveAiSuggestion(workspaceId: string, id: string, s: AiSuggestion) {
  const [asset] = await db
    .update(assets)
    .set({ tags: s.tags, description: s.description, usageSuggestion: s.usage_suggestion })
    .where(and(eq(assets.id, id), inWorkspace(workspaceId), live))
    .returning();
  if (!asset) throw notFound("Asset");
  return asset;
}
