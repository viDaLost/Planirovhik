import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    telegramId: text("telegram_id").notNull(),
    displayName: text("display_name").notNull(),
    username: text("username"),
    languageCode: text("language_code"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_telegram_id_idx").on(table.telegramId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [index("projects_user_idx").on(table.userId, table.updatedAt)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", {
      enum: ["backlog", "in-progress", "review", "done"],
    })
      .notNull()
      .default("backlog"),
    priority: text("priority", {
      enum: ["low", "medium", "high", "critical"],
    })
      .notNull()
      .default("medium"),
    dueDate: text("due_date"),
    reminderAt: text("reminder_at"),
    reminderSentAt: text("reminder_sent_at"),
    recurrence: text("recurrence", {
      enum: ["none", "daily", "weekly", "monthly"],
    })
      .notNull()
      .default("none"),
    tagsJson: text("tags_json").notNull().default("[]"),
    subtasksJson: text("subtasks_json").notNull().default("[]"),
    estimateMinutes: integer("estimate_minutes"),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    index("tasks_user_updated_idx").on(table.userId, table.updatedAt),
    index("tasks_user_due_idx").on(table.userId, table.dueDate),
    index("tasks_reminder_idx").on(table.reminderAt, table.reminderSentAt),
  ],
);

export const preferences = sqliteTable("preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dataJson: text("data_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan", { enum: ["free", "premium", "team"] })
    .notNull()
    .default("free"),
  status: text("status", { enum: ["active", "expired", "cancelled"] })
    .notNull()
    .default("active"),
  source: text("source").notNull().default("system"),
  expiresAt: text("expires_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
