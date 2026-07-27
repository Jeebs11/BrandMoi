import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { topicsTable } from "./topics";

export const seriesTable = pgTable("series", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  theme: text("theme").notNull(),
  topicId: integer("topic_id").references(() => topicsTable.id, { onDelete: "set null" }),
  targetAudience: text("target_audience"),
  // "standard" | "dialogue" | "letter" | "qa" | "story_arc"
  format: text("format").notNull().default("standard"),
  // Null means "endless" — no fixed part count, the series just keeps going
  // until the user marks it completed.
  plannedParts: integer("planned_parts"),
  // "planning" | "active" | "completed"
  status: text("status").notNull().default("planning"),
  // A short recurring tag/tagline (e.g. "#JuniorPMDiaries" or "🧵 Junior PM
  // Diaries") repeated across every part so readers recognise the series and
  // can click through to the rest of it — the LinkedIn equivalent of a show title.
  hook: text("hook"),
  // Persisted AI-suggested angles per part, user-editable — [{part, angle}].
  // Kept on the series row (not regenerated each visit) so edits survive reload.
  plannedAngles: jsonb("planned_angles").$type<Array<{ part: number; angle: string }>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSeriesSchema = createInsertSchema(seriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSeries = z.infer<typeof insertSeriesSchema>;
export type Series = typeof seriesTable.$inferSelect;
