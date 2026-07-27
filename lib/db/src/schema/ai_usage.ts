import { pgTable, serial, integer, text, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Daily AI usage counters, keyed by (user, kind, date) so day-scale rate
// limits survive server restarts. Short burst limits stay in-memory.
export const aiUsageTable = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    date: text("date").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [unique("ai_usage_user_kind_date").on(t.userId, t.kind, t.date)]
);

export type AiUsage = typeof aiUsageTable.$inferSelect;
