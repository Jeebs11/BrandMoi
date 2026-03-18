import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const draftsTable = pgTable("drafts", {
  id: serial("id").primaryKey(),
  rawInput: text("raw_input").notNull(),
  objective: text("objective").notNull(),
  persona: text("persona").notNull(),
  tone: text("tone").notNull(),
  structuredBreakdown: jsonb("structured_breakdown").notNull(),
  postOutput: text("post_output"),
  carouselOutput: text("carousel_output"),
  visualOutput: text("visual_output"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDraftSchema = createInsertSchema(draftsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof draftsTable.$inferSelect;
