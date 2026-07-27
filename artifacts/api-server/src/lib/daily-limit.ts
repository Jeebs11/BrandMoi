import { sql } from "drizzle-orm";
import { db, aiUsageTable } from "@workspace/db";

// DB-backed daily rate limit. Atomic upsert-and-increment, so it survives
// restarts and is safe under concurrent requests.
export async function checkAndIncrementDailyLimit(
  userId: number,
  kind: string,
  maxPerDay: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const [row] = await db
    .insert(aiUsageTable)
    .values({ userId, kind, date: today, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsageTable.userId, aiUsageTable.kind, aiUsageTable.date],
      set: { count: sql`${aiUsageTable.count} + 1` },
    })
    .returning({ count: aiUsageTable.count });

  const count = row?.count ?? maxPerDay + 1;
  if (count > maxPerDay) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxPerDay - count };
}
