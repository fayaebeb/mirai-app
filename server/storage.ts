import { users, messages, sessions, notes, goals, type User, type InsertUser, type Message, type InsertMessage, type Session, type Note, type InsertNote, type Goal, type InsertGoal, InsertUserSafe, InsertFeedback, Feedback, inviteTokens } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, not } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUserSafe): Promise<User>;
  getMessagesByUserAndSession(userId: number, sessionId: string): Promise<Message[]>;
  createMessage(userId: number, message: InsertMessage): Promise<Message>;
  deleteMessagesBySessionId(userId: number, sessionId: string): Promise<boolean>;
  deleteMessagesByUserAndSession(userId: number, sessionId: string): Promise<void>;
  getUserLastSession(userId: number): Promise<Session | undefined>;
  getSessionBySessionId(sessionId: string): Promise<Session | undefined>;
  createUserSession(userId: number, sessionId: string): Promise<Session>;
  getNotesByUserId(userId: number): Promise<Note[]>;
  getNoteById(noteId: number, userId: number): Promise<Note | undefined>;
  createNote(userId: number, note: InsertNote): Promise<Note>;
  updateNote(noteId: number, userId: number, note: InsertNote): Promise<Note | undefined>;
  deleteNote(noteId: number, userId: number): Promise<boolean>;
  getGoalsByUserId(userId: number): Promise<Goal[]>;
  getNonCompletedGoalsByUserId(userId: number): Promise<Goal[]>;
  getGoalById(goalId: number, userId: number): Promise<Goal | undefined>;
  createGoal(userId: number, goal: InsertGoal): Promise<Goal>;
  updateGoal(goalId: number, userId: number, goal: InsertGoal): Promise<Goal | undefined>;
  deleteGoal(goalId: number, userId: number): Promise<boolean>;
  getInviteToken(tokenString: string): Promise<typeof inviteTokens.$inferSelect | undefined>;
  useInviteToken(tokenId: number, userId: number): Promise<void>;
  sessionStore: session.Store;
}

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

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email))
    return user
  }


  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUserSafe): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getMessagesByUserAndSession(userId: number, sessionId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.sessionId, sessionId)
        )
      )
      .orderBy(messages.timestamp);
  }

  async createMessage(userId: number, message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values({
        userId,
        ...message,
      })
      .returning();
    return newMessage;
  }

  async deleteMessagesBySessionId(userId: number, sessionId: string): Promise<boolean> {
    const result = await db
      .delete(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.sessionId, sessionId)
        )
      );
    return !!result.rowCount;
  }

  async deleteMessagesByUserAndSession(userId: number, sessionId: string): Promise<void> {
    await db
      .delete(messages)
      .where(and(eq(messages.userId, userId), eq(messages.sessionId, sessionId)));
  }

  async getUserLastSession(userId: number): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(1);
    return session;
  }

  async getSessionBySessionId(sessionId: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionId, sessionId))
      .limit(1);
    return session;
  }



  async createUserSession(userId: number, sessionId: string): Promise<Session> {
    // First check if the session already exists
    const existingSession = await this.getSessionBySessionId(sessionId);
    if (existingSession) {
      // Session already exists, just return it
      return existingSession;
    }

    // Create a new session if it doesn't exist
    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        sessionId,
      })
      .returning();
    return session;
  }

  async getNotesByUserId(userId: number): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt));
  }

  async getNoteById(noteId: number, userId: number): Promise<Note | undefined> {
    const [note] = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.userId, userId)
        )
      );
    return note;
  }

  async createNote(userId: number, note: InsertNote): Promise<Note> {
    const now = new Date();
    const [newNote] = await db
      .insert(notes)
      .values({
        userId,
        ...note,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return newNote;
  }

  async updateNote(noteId: number, userId: number, note: InsertNote): Promise<Note | undefined> {
    const [updatedNote] = await db
      .update(notes)
      .set({
        ...note,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.userId, userId)
        )
      )
      .returning();
    return updatedNote;
  }

  async deleteNote(noteId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(notes)
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.userId, userId)
        )
      );
    return !!result.rowCount;
  }

  async getGoalsByUserId(userId: number): Promise<Goal[]> {
    return await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.updatedAt));
  }

  async getNonCompletedGoalsByUserId(userId: number): Promise<Goal[]> {
    return await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.completed, false)
        )
      )
      .orderBy(desc(goals.updatedAt));
  }

  async getGoalById(goalId: number, userId: number): Promise<Goal | undefined> {
    const [goal] = await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.id, goalId),
          eq(goals.userId, userId)
        )
      );
    return goal;
  }

  async createGoal(userId: number, goal: InsertGoal): Promise<Goal> {
    const now = new Date();
    const [newGoal] = await db
      .insert(goals)
      .values({
        userId,
        // ensure description is never undefined:
        description: goal.description ?? "",
        title: goal.title,
        completed: goal.completed,
        dueDate: goal.dueDate,
        priority: goal.priority,
        category: goal.category,
        tags: goal.tags,
        reminderTime: goal.reminderTime,
        isRecurring: goal.isRecurring,
        recurringType: goal.recurringType,
        recurringInterval: goal.recurringInterval,
        recurringEndDate: goal.recurringEndDate,
      })
      .returning();
    return newGoal;
  }

  async updateGoal(goalId: number, userId: number, goal: InsertGoal): Promise<Goal | undefined> {
    const [updatedGoal] = await db
      .update(goals)
      .set({
        ...goal,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(goals.id, goalId),
          eq(goals.userId, userId)
        )
      )
      .returning();
    return updatedGoal;
  }

  async deleteGoal(goalId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(goals)
      .where(
        and(
          eq(goals.id, goalId),
          eq(goals.userId, userId)
        )
      );
    return !!result.rowCount;
  }

  async stampInitialLogin(id: number) {
    await db.update(users)
      .set({ initialLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async completeOnboarding(id: number) {
    await db.update(users)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(users.id, id));
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId));
  }

  async createFeedback(userId: number, feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db
      .insert(feedback)
      .values({
        userId,
        ...feedbackData,
      })
      .returning();
    return newFeedback;
  }

  async getInviteToken(tokenString: string) {
    const [token] = await db
      .select()
      .from(inviteTokens)
      .where(eq(inviteTokens.token, tokenString));
    return token;
  }

  async useInviteToken(tokenId: number, userId: number) {
    await db
      .update(inviteTokens)
      .set({
        usedById: userId,
        usedAt: new Date(),
        isValid: false,
      })
      .where(eq(inviteTokens.id, tokenId));
  }
}

export const storage = new DatabaseStorage();