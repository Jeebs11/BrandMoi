import { pgTable, serial, integer, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { draftsTable } from "./drafts";

export const performanceSignalsTable = pgTable("performance_signals", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").notNull().unique().references(() => draftsTable.id, { onDelete: "cascade" }),
  impressions: integer("impressions").notNull().default(0),
  reactions: integer("reactions").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  reposts: integer("reposts").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  sends: integer("sends").notNull().default(0),
  membersReached: integer("members_reached").notNull().default(0),
  followersGained: integer("followers_gained").notNull().default(0),
  linkEngagements: integer("link_engagements").notNull().default(0),
  demographics: jsonb("demographics"),
  linkedinUrl: text("linkedin_url"),
  linkedinPostDate: text("linkedin_post_date"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PerformanceSignal = typeof performanceSignalsTable.$inferSelect;
