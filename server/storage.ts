import { users, messages, sessions, notes, goals, type User, type InsertUser, type Message, type InsertMessage, type Session, type Note, type InsertNote, type Goal, type InsertGoal, InsertUserSafe, InsertFeedback, Feedback, inviteTokens, Chat, chats } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUserSafe): Promise<User>;

  getMessagesByChat(userId: number, chatId: number): Promise<Message[]>;
  createMessage(userId: number, message: InsertMessage): Promise<Message>;
  deleteMessagesInChat(userId: number, chatId: number): Promise<boolean>;

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

  getChatsByUser(userId: number): Promise<Chat[]>;
  createChat(userId: number, title?: string, type?: string): Promise<Chat>;
  renameChat(userId: number, chatId: number, title: string): Promise<Chat | undefined>;
  deleteChat(userId: number, chatId: number): Promise<boolean>;
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

  async getChatById(chatId: number): Promise<Chat | undefined> {
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    return chat;
  }

  async getChatsByUser(userId: number) {
    return await db.query.chats.findMany({
      where: eq(chats.userId, userId),
      orderBy: [desc(chats.createdAt)],
    });
  }

  async createChat(userId: number, title = "New chat", type = "regular") {
    const [chat] = await db
      .insert(chats)
      .values({ userId, title, type })
      .returning();
    return chat;
  }

  async renameChat(userId: number, chatId: number, title: string) {
    const [chat] = await db
      .update(chats)
      .set({ title })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .returning();
    return chat;
  }

  async deleteChat(userId: number, chatId: number) {
    const del = await db
      .delete(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
    return !!del.rowCount;
  }

  /* helper: reuse for goal / notes system threads */
  async getOrCreateSystemChat(userId: number, title: string, type: string) {
    const existing = await db.query.chats.findFirst({
      where: and(eq(chats.userId, userId), eq(chats.type, type)),
    });
    if (existing) return existing;
    return this.createChat(userId, title, type);
  }

  async getMessagesByChat(userId: number, chatId: number) {
    return await db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.userId, userId)))
      .orderBy(messages.createdAt);
  }

  async createMessage(userId: number, msg: InsertMessage) {
    const [m] = await db
      .insert(messages)
      .values({ userId, category: 'SELF', ...msg }) // msg must include chatId
      .returning();
    return m;
  }

  async deleteMessagesInChat(userId: number, chatId: number) {
    const del = await db
      .delete(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.userId, userId)));
    return !!del.rowCount;
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

  async getPastMessagesByChatId(chatId: number, limitCount: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(limitCount);
  }

  async setMessageVote(
    messageId: number,
    vote: -1 | 0 | 1
  ) {
    const [updated] = await db
      .update(messages)
      .set({ vote })
      .where(eq(messages.id, messageId))
      .returning();
    return updated;
  };
}

export const storage = new DatabaseStorage();