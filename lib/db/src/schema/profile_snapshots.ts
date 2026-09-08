import { pgTable, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// One row per user, overwritten on each new upload. No raw document bytes are
// ever stored — only the normalized facts extracted from the most recently
// uploaded CV/LinkedIn export (matches Smart Import's memory-only posture).
export const profileSnapshotsTable = pgTable("profile_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  cvFacts: jsonb("cv_facts"),
  linkedinFacts: jsonb("linkedin_facts"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProfileSnapshot = typeof profileSnapshotsTable.$inferSelect;
