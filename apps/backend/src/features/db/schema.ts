import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const CommonRows = {
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

export const UserTable = pgTable(
  "user",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text().notNull(),
    email: text().notNull(),
    company: text().notNull(),
    passwordHash: text().notNull(),

    ...CommonRows,
  },
  (t) => [
    uniqueIndex("user_email_key")
      .on(t.email)
      .where(sql`${t.isActive}`),
  ]
);
