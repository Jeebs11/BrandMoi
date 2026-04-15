import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { draftsTable } from "./drafts";

export const performanceSignalsTable = pgTable("performance_signals", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").notNull().unique().references(() => draftsTable.id, { onDelete: "cascade" }),
  impressions: integer("impressions").notNull().default(0),
  reactions: integer("reactions").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  reposts: integer("reposts").notNull().default(0),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PerformanceSignal = typeof performanceSignalsTable.$inferSelect;
