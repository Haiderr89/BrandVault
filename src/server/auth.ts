import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, workspaces } from "@/db/schema";
import { conflict, HttpError } from "@/lib/http";
import type { Session } from "@/lib/session";

// Compared against when the email doesn't exist so response timing doesn't
// reveal which emails are registered.
const DUMMY_HASH = "$2b$10$uiM.z5Q0vvT5Vvp0AexE4ei6qdegXj/S5BlcedHi2dvmAZ6t5vBbW";

export async function signUp(email: string, password: string): Promise<Session> {
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email, passwordHash }).returning();
      const [workspace] = await tx
        .insert(workspaces)
        .values({ ownerId: user.id, name: `${email.split("@")[0]}'s workspace` })
        .returning();
      return { userId: user.id, workspaceId: workspace.id, email: user.email };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("An account with this email already exists.");
    throw err;
  }
}

export async function signIn(email: string, password: string): Promise<Session> {
  const [row] = await db
    .select({ user: users, workspaceId: workspaces.id })
    .from(users)
    .innerJoin(workspaces, eq(workspaces.ownerId, users.id))
    .where(eq(users.email, email))
    .limit(1);

  const ok = await bcrypt.compare(password, row?.user.passwordHash ?? DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, "invalid_credentials", "Incorrect email or password.");
  return { userId: row.user.id, workspaceId: row.workspaceId, email: row.user.email };
}

function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  while (e && typeof e === "object") {
    if ((e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
