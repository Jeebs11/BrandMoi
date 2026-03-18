import { pgTable, serial, integer, text, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const dailyActivityTable = pgTable(
  "daily_activity",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
  },
  (t) => [unique("daily_activity_user_date").on(t.userId, t.date)]
);
