import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const linkedinConnectionsTable = pgTable("linkedin_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  memberUrn: text("member_urn").notNull(),
  displayName: text("display_name").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LinkedinConnection = typeof linkedinConnectionsTable.$inferSelect;
