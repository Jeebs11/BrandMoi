import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ideaFeedbackTable = pgTable("idea_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ideaText: text("idea_text").notNull(),
  ideaType: text("idea_type").notNull().default("brand"),
  signal: text("signal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IdeaFeedback = typeof ideaFeedbackTable.$inferSelect;
