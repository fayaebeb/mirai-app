import { relations } from "drizzle-orm/relations";
import { users, sessions, messages, notes, goals } from "./schema";

export const sessionsRelations = relations(sessions, ({one, many}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
	messages: many(messages),
}));

export const usersRelations = relations(users, ({many}) => ({
	sessions: many(sessions),
	messages: many(messages),
	notes: many(notes),
	goals: many(goals),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	session: one(sessions, {
		fields: [messages.sessionId],
		references: [sessions.sessionId]
	}),
	user: one(users, {
		fields: [messages.userId],
		references: [users.id]
	}),
}));

export const notesRelations = relations(notes, ({one}) => ({
	user: one(users, {
		fields: [notes.userId],
		references: [users.id]
	}),
}));

export const goalsRelations = relations(goals, ({one}) => ({
	user: one(users, {
		fields: [goals.userId],
		references: [users.id]
	}),
}));