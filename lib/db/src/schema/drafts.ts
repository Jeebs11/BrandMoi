import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { topicsTable } from "./topics";
import { seriesTable } from "./series";

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
  // Immutable snapshot of the post exactly as first AI-generated — set once
  // at draft creation, never touched by later edits/refines. Powers the
  // publish-time authenticity check (how much has this actually changed).
  aiOriginalPost: text("ai_original_post"),
  shortPost: text("short_post"),
  carouselOutput: text("carousel_output"),
  visualOutput: text("visual_output"),
  status: text("status").notNull().default("draft"),
  contentSource: text("content_source"),
  visualType: text("visual_type"),
  externalId: text("external_id"),
  postType: text("post_type"),
  diagnosis: jsonb("diagnosis"),
  mediaFormat: text("media_format"),
  linkedinUrl: text("linkedin_url"),
  isVoiceSample: boolean("is_voice_sample").notNull().default(false),
  topicId: integer("topic_id").references(() => topicsTable.id, { onDelete: "set null" }),
  seriesId: integer("series_id").references(() => seriesTable.id, { onDelete: "set null" }),
  seriesPart: integer("series_part"),
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
