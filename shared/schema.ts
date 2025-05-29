import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  isBot: boolean("is_bot").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  sessionId: text("session_id").notNull().references(() => sessions.sessionId),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  completed: boolean("completed").notNull().default(false),
  dueDate: timestamp("due_date"),
  priority: text("priority").default("medium"),
  category: text("category"),
  tags: text("tags").array(),
  reminderTime: timestamp("reminder_time"),
  // Recurring task fields
  isRecurring: boolean("is_recurring").default(false),
  recurringType: text("recurring_type"), // daily, weekly, monthly, custom
  recurringInterval: integer("recurring_interval"), // e.g., every X days, weeks, etc.
  recurringEndDate: timestamp("recurring_end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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