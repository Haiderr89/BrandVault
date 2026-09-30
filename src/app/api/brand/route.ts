import { NextResponse } from "next/server";
import { authedRoute, readJson } from "@/lib/http";
import { brandCreateSchema, brandUpdateSchema } from "@/lib/validation";
import { createBrand, getBrand, updateBrand } from "@/server/brand";
import { emitEvent } from "@/server/webhooks";

export const GET = authedRoute(async (_req, { session }) =>
  NextResponse.json({ brand: await getBrand(session.workspaceId) }),
);

export const POST = authedRoute(async (req, { session }) => {
  const input = await readJson(req, brandCreateSchema);
  return NextResponse.json({ brand: await createBrand(session.workspaceId, input) }, { status: 201 });
});

export const PATCH = authedRoute(async (req, { session }) => {
  const input = await readJson(req, brandUpdateSchema);
  const brand = await updateBrand(session.workspaceId, input);
  emitEvent("brand.updated", session, { brandId: brand.id });
  return NextResponse.json({ brand });
});
