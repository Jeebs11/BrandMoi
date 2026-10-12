import type { Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, aiUsageTable } from "@workspace/db";

export interface DailyLimitResult {
  allowed: boolean;
  remaining: number;
  /** Gives back the run this call consumed. No-op when the call was not allowed. */
  refund: () => Promise<void>;
}

// DB-backed daily rate limit. Atomic upsert-and-increment, so it survives
// restarts and is safe under concurrent requests.
export async function checkAndIncrementDailyLimit(
  userId: number,
  kind: string,
  maxPerDay: number,
): Promise<DailyLimitResult> {
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
    return { allowed: false, remaining: 0, refund: async () => {} };
  }

  // Captures `today` so a call straddling UTC midnight refunds the row it charged.
  const refund = async () => {
    await db
      .update(aiUsageTable)
      .set({ count: sql`GREATEST(${aiUsageTable.count} - 1, 0)` })
      .where(
        and(
          eq(aiUsageTable.userId, userId),
          eq(aiUsageTable.kind, kind),
          eq(aiUsageTable.date, today),
        ),
      );
  };
  return { allowed: true, remaining: maxPerDay - count, refund };
}

// Call right after the `!limit.allowed` guard. If the response ends with an
// error status (AI failure, 404, etc.) the run is given back, so a failed
// attempt never costs the user an allowance. Over-limit calls never refund.
export function refundIfFailed(res: Response, limit: DailyLimitResult): void {
  if (!limit.allowed) return;
  res.once("finish", () => {
    if (res.statusCode >= 400) {
      limit.refund().catch(() => {});
    }
  });
}
