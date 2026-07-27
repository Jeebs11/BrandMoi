import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

// In-memory mirror of users.blocked so requireAuth can reject blocked users
// on every request without a DB hit. Loaded at boot; admin block/unblock
// updates both the DB and this set.
const blockedIds = new Set<number>();

export async function loadBlocklist(): Promise<void> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.blocked, true));
  blockedIds.clear();
  for (const r of rows) blockedIds.add(r.id);
}

export function isBlocked(userId: number): boolean {
  return blockedIds.has(userId);
}

export function setBlockedLocal(userId: number, blocked: boolean): void {
  if (blocked) blockedIds.add(userId);
  else blockedIds.delete(userId);
}
