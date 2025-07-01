import { createInsertSchema } from "drizzle-zod";
import { pgTable, integer, text, boolean, timestamp, unique, serial, index, varchar, json, foreignKey } from "drizzle-orm/pg-core"

import { z } from "zod";

export const goalsBackup = pgTable("goals_backup", {
  id: integer(),
  userId: integer("user_id"),
  description: text(),
  completed: boolean(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  dueDate: timestamp("due_date"),
});

export const users = pgTable("users", {
  id: serial().primaryKey().notNull(),
  username: text("username").notNull(),
  password: text().notNull(),
  email: text("email").notNull(),
  initialLoginAt: timestamp("initial_login_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
}, (table) => [
  unique("users_email_key").on(table.email),      // ⇦ new unique
  unique("users_username_key").on(table.username) // (keep or drop, your choice)
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  content: text("content").notNull(),
  isBot: boolean("is_bot").notNull(),
  timestamp: timestamp().defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  description: text("description").notNull(),
  completed: boolean().default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  title: text().notNull(),
  priority: text().default('medium'),
  category: text(),
  tags: text().array(),
  reminderTime: timestamp("reminder_time"),
  isRecurring: boolean("is_recurring").default(false),
  recurringType: text("recurring_type"),
  recurringInterval: integer("recurring_interval"),
  recurringEndDate: timestamp("recurring_end_date"),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "goals_user_id_fkey"
  }).onDelete("cascade"),
]);

// Representing the feedback table that already exists in the database
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  sessionId: text("session_id").references(() => sessions.sessionId),
  messageId: integer("message_id").references(() => messages.id),
  comment: text("comment"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add password validation to the insert schema

  export const insertUserSchema = z
  .object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z
      .string()
      .min(8, "パスワードは8文字以上でなければなりません")
      .max(128, "パスワードは128文字以下でなければなりません")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        "英大文字・小文字・数字・記号を含めてください"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

  export const insertUserSafeSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  username: true,
});

// ✅ Lightweight schema for login only (no strength checks)
export const loginUserSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードは必須です"),
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
  category: z.string().optional().default(""),
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

export const insertFeedbackSchema = createInsertSchema(feedback).pick({
  comment: true,
  rating: true,
  messageId: true,
  sessionId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertUserSafe = z.infer<typeof insertUserSafeSchema>;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
