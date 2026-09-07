import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { profileSnapshotsTable } from "./profile_snapshots";

// One row per analysis run; history preserved (not overwritten). Recommendation
// accept/edit/reject state lives inline in `recommendations` — no separate
// audit-log table for v1.
export const profileAnalysesTable = pgTable("profile_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  snapshotId: integer("snapshot_id").notNull().references(() => profileSnapshotsTable.id, { onDelete: "cascade" }),
  comparisonTable: jsonb("comparison_table").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  targetAudience: text("target_audience").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProfileAnalysis = typeof profileAnalysesTable.$inferSelect;
