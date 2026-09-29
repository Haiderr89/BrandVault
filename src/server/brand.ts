import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { conflict, notFound } from "@/lib/http";
import type { brandCreateSchema, brandUpdateSchema } from "@/lib/validation";

export async function getBrand(workspaceId: string) {
  const [brand] = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId));
  return brand ?? null;
}

export async function createBrand(workspaceId: string, input: z.infer<typeof brandCreateSchema>) {
  // One brand per workspace (also enforced by a unique index).
  if (await getBrand(workspaceId)) throw conflict("This workspace already has a brand. Use PATCH to update it.");
  const [brand] = await db.insert(brands).values({ ...input, workspaceId }).returning();
  return brand;
}

export async function updateBrand(workspaceId: string, input: z.infer<typeof brandUpdateSchema>) {
  const [brand] = await db
    .update(brands)
    .set(input)
    .where(eq(brands.workspaceId, workspaceId))
    .returning();
  if (!brand) throw notFound("Brand");
  return brand;
}
