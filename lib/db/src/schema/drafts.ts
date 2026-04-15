import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const draftsTable = pgTable("drafts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  rawInput: text("raw_input").notNull(),
  objective: text("objective").notNull(),
  persona: text("persona").notNull(),
  tone: text("tone").notNull(),
  structuredBreakdown: jsonb("structured_breakdown").notNull(),
  selectedHook: text("selected_hook"),
  postOutput: text("post_output"),
  shortPost: text("short_post"),
  carouselOutput: text("carousel_output"),
  visualOutput: text("visual_output"),
  status: text("status").notNull().default("draft"),
  contentSource: text("content_source"),
  visualType: text("visual_type"),
  externalId: text("external_id"),
  postType: text("post_type"),
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
