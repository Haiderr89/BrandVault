import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, brands, folders, users, workspaces } from "@/db/schema";
import { HttpError } from "@/lib/http";
import type { Session } from "@/lib/session";
import { signIn, signUp } from "./auth";

export const DEMO_EMAIL = "demo@brandvault.dev";
export const demoPassword = () => process.env.DEMO_PASSWORD || "Demo1234!";

/**
 * Makes sure the demo account exists with sample data and returns its session.
 * Idempotent: used by `npm run db:seed` and by the "Continue as demo" button,
 * so the demo works on first visit even if the seed was never run.
 */
export async function ensureDemoAccount(): Promise<Session> {
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing) return signIn(DEMO_EMAIL, demoPassword());

  let session: Session;
  try {
    session = await signUp(DEMO_EMAIL, demoPassword());
  } catch (err) {
    // Two first-time visitors raced to create the account; the other one won.
    if (err instanceof HttpError && err.status === 409) return signIn(DEMO_EMAIL, demoPassword());
    throw err;
  }
  const wid = session.workspaceId;

  await db.transaction(async (tx) => {
    await tx.update(workspaces).set({ name: "Demo workspace" }).where(eq(workspaces.id, wid));
    await tx.insert(brands).values({
      workspaceId: wid,
      name: "Northwind Coffee",
      primaryColor: "#7C3AED",
      secondaryColor: "#F59E0B",
      logoUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400",
      fontName: "Inter",
    });

    const [campaigns, logos] = await tx
      .insert(folders)
      .values([
        { workspaceId: wid, name: "Campaigns" },
        { workspaceId: wid, name: "Logos" },
      ])
      .returning();
    const [autumn] = await tx
      .insert(folders)
      .values({ workspaceId: wid, name: "Autumn 2026", parentId: campaigns.id, depth: 2 })
      .returning();

    await tx.insert(assets).values([
      {
        workspaceId: wid,
        folderId: logos.id,
        name: "Primary logo (dark)",
        type: "logo",
        url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800",
      },
      {
        workspaceId: wid,
        folderId: autumn.id,
        name: "Pumpkin latte hero banner",
        type: "image",
        url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=1200",
        tags: ["campaign", "autumn", "hero"],
        description: "Hero banner image for the autumn seasonal drink campaign.",
        usageSuggestion: "Use as the website homepage hero or email header during the autumn campaign.",
      },
      {
        workspaceId: wid,
        folderId: autumn.id,
        name: "Autumn promo reel",
        type: "video",
        url: "https://example.com/videos/autumn-promo.mp4",
      },
      {
        workspaceId: wid,
        folderId: null,
        name: "Brand guidelines",
        type: "document",
        url: "https://example.com/docs/brand-guidelines.pdf",
      },
      {
        workspaceId: wid,
        folderId: null,
        name: "Old menu board",
        type: "image",
        url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
        deletedAt: new Date(),
      },
    ]);
  });

  return session;
}
