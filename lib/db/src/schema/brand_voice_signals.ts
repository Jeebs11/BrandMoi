import { pgTable, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { draftsTable } from "./drafts";

export const brandVoiceSignalsTable = pgTable("brand_voice_signals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  draftId: integer("draft_id").notNull().references(() => draftsTable.id, { onDelete: "cascade" }),
  signals: jsonb("signals").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BrandVoiceSignal = typeof brandVoiceSignalsTable.$inferSelect;
