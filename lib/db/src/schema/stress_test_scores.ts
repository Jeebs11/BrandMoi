import { pgTable, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { draftsTable } from "./drafts";
import { usersTable } from "./users";

export const stressTestScoresTable = pgTable("stress_test_scores", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").references(() => draftsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  overallScore: integer("overall_score").notNull(),
  factorScores: jsonb("factor_scores").notNull(),
  fixesApplied: boolean("fixes_applied").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StressTestScore = typeof stressTestScoresTable.$inferSelect;
