import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const voiceSuggestionsTable = pgTable("voice_suggestions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  currentValue: text("current_value").notNull().default(""),
  suggestedValue: text("suggested_value").notNull(),
  rationale: text("rationale").notNull(),
  evidenceDraftIds: jsonb("evidence_draft_ids").notNull().default([]),
  evidenceSnippets: jsonb("evidence_snippets").notNull().default([]),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VoiceSuggestion = typeof voiceSuggestionsTable.$inferSelect;
