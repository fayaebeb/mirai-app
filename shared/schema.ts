import { createInsertSchema } from "drizzle-zod";
import { pgTable, integer, text, boolean, timestamp, unique, serial, index, varchar, json, foreignKey } from "drizzle-orm/pg-core"

import { z } from "zod";

export const goalsBackup = pgTable("goals_backup", {
  id: integer(),
  userId: integer("user_id"),
  description: text(),
  completed: boolean(),
  createdAt: timestamp("created_at", { mode: 'string' }),
  updatedAt: timestamp("updated_at", { mode: 'string' }),
  dueDate: timestamp("due_date", { mode: 'string' }),
});

export const users = pgTable("users", {
  id: serial().primaryKey().notNull(),
  username: text().notNull(),
  password: text().notNull(),
  email: text(),
}, (table) => [
  unique("users_username_key").on(table.username),
]);

export const session = pgTable("session", {
  sid: varchar().primaryKey().notNull(),
  sess: json().notNull(),
  expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
  index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const sessions = pgTable("sessions", {
  id: serial().primaryKey().notNull(),
  userId: integer("user_id").notNull(),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "sessions_user_id_fkey"
  }).onDelete("cascade"),
  unique("sessions_session_id_unique").on(table.sessionId),
]);

export const messages = pgTable("messages", {
  id: serial().primaryKey().notNull(),
  userId: integer("user_id").notNull(),
  content: text().notNull(),
  isBot: boolean("is_bot").notNull(),
  timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
  sessionId: text("session_id").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [sessions.sessionId],
    name: "messages_session_id_fkey"
  }),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "messages_user_id_fkey"
  }).onDelete("cascade"),
]);

export const notes = pgTable("notes", {
  id: serial().primaryKey().notNull(),
  userId: integer("user_id").notNull(),
  title: text().notNull(),
  content: text().notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "notes_user_id_fkey"
  }).onDelete("cascade"),
]);

export const goals = pgTable("goals", {
  id: serial().primaryKey().notNull(),
  userId: integer("user_id").notNull(),
  description: text().notNull(),
  completed: boolean().default(false).notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
  dueDate: timestamp("due_date", { mode: 'string' }),
  title: text().notNull(),
  priority: text().default('medium'),
  category: text(),
  tags: text().array(),
  reminderTime: timestamp("reminder_time", { mode: 'string' }),
  isRecurring: boolean("is_recurring").default(false),
  recurringType: text("recurring_type"),
  recurringInterval: integer("recurring_interval"),
  recurringEndDate: timestamp("recurring_end_date", { mode: 'string' }),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "goals_user_id_fkey"
  }).onDelete("cascade"),
]);

// Add password validation to the insert schema
export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    password: true
  })
  .extend({
    password: z.string().min(6, "パスワードは6文字以上でなければなりません")
  });

export const insertSessionSchema = createInsertSchema(sessions).pick({
  userId: true,
  sessionId: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  isBot: true,
  sessionId: true,
});

export const chatRequestSchema = insertMessageSchema.extend({
  useWeb: z.boolean().optional(),
  useDb: z.boolean().optional(),
});

export const insertNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
});

export const insertGoalSchema = createInsertSchema(goals).pick({
  title: true,
  description: true,
  completed: true,
  dueDate: true,
  priority: true,
  category: true,
  tags: true,
  reminderTime: true,
  isRecurring: true,
  recurringType: true,
  recurringInterval: true,
  recurringEndDate: true,
}).extend({
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string().optional(),
  dueDate: z.string().or(z.date()).nullable().optional().transform(val =>
    val ? new Date(val) : null
  ),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  category: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  reminderTime: z.string().or(z.date()).nullable().optional().transform(val =>
    val ? new Date(val) : null
  ),
  isRecurring: z.boolean().optional().default(false),
  recurringType: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
  recurringInterval: z.number().positive().optional(),
  recurringEndDate: z.string().or(z.date()).nullable().optional().transform(val =>
    val ? new Date(val) : null
  )
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;