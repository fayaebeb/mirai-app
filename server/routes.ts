import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { comparePasswords, hashPassword, setupAuth } from "./auth";
import { insertMessageSchema, insertNoteSchema, insertGoalSchema, chatRequestSchema, insertFeedbackSchema } from "@shared/schema";
import { generateMindMap } from "./services/openai";
import rateLimit from 'express-rate-limit';
import { openai } from './openaiClient';
import dotenv from "dotenv";
import multer from "multer";
import { apiRateLimit, handleValidationErrors, validateFeedback, validateMessage, validatePasswordChange } from "./security";
import { getPersistentSessionId, sendError } from "./utils/errorResponse";
dotenv.config();

const createUserAwareRateLimiter = (options: { windowMs: number; max: number; message?: string }) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: options.message || 'Too many requests' },
    keyGenerator: (req: Request) => {
      const userId = req.user?.id ?? 'anonymous';
      const ip = req.ip;
      return `${userId}-${ip}`;
    },
  });

// Chat: 10 messages per minute per user
const granularChatLimiter = createUserAwareRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many chat requests. Please wait a moment.",
});

// Transcribe: 5 uploads per 5 minutes per user
const granularTranscribeLimiter = createUserAwareRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: "Too many transcription requests. Please wait and try again.",
});

// Setup multer for handling file uploads (in-memory storage) with enhanced security
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (OpenAI requirement)
    files: 1 // Only allow one file
  },
  fileFilter: (req, file, cb) => {
    // Only allow audio files for voice transcription
    const allowedMimeTypes = [
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
      'audio/m4a', 'audio/mpga', 'audio/mp3', 'audio/webm;codecs=opus'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`Security: Rejected file upload with mime type: ${file.mimetype}`);
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

const SKAPI = process.env.SKAPI!;

async function sendMessageToLangchain(
  message: string,
  useWeb: boolean,
  useDb: boolean,
): Promise<string> {
  // console.log(`Sending request to LangChain FastAPI: ${message}`);

  const response = await fetch(SKAPI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      useweb: useWeb,
      usedb: useDb,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LangChain FastAPI Error:", errorText);
    throw new Error(`LangChain API responded with status ${response.status}`);
  }

  const data = await response.json();
  console.log("LangChain API Response:", JSON.stringify(data, null, 2));

  if (!data.reply) {
    throw new Error("No reply field in LangChain API response");
  }

  return data.reply.trim();
}


function formatBotResponse(text: string): string {
  return text.replace(/\\n/g, '\n').trim();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.use("/api", apiRateLimit);


  // Add a dedicated goal tracker chat endpoint
  app.post("/api/goal-chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Use a different session ID pattern for goal chat to ensure separation from regular chat
    const goalSessionId = `goal_${req.user!.id}_${req.user!.email}`;
    const userContent = req.body.content;

    try {
      // Check if the session with the specific ID exists first
      const existingGoalSession = await storage.getSessionBySessionId(goalSessionId);
      if (!existingGoalSession) {
        console.log(`Creating new goal session for user ${req.user!.id} with sessionId ${goalSessionId}`);
        await storage.createUserSession(req.user!.id, goalSessionId);
      }

      // Save the user message with the goal-specific session ID
      const userMessage = await storage.createMessage(req.user!.id, {
        content: userContent,
        isBot: false,
        sessionId: goalSessionId,
      });

      console.log(`Sending request to Goal Tracker API: ${userContent}`);

      // Get ALL goals for this user (both active and completed)
      const allGoals = await storage.getGoalsByUserId(req.user!.id);

      // Format goals with completion status and dates for better context
      const formattedGoals = allGoals.map(goal => {
        const createdDate = new Date(goal.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        const updatedDate = new Date(goal.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        // Format due date if it exists
        let dueDateStr = "";
        if (goal.dueDate) {
          const dueDate = new Date(goal.dueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          dueDateStr = `, Due: ${dueDate}`;
        }

        return JSON.stringify({ id: goal.id, title: goal.title, description: goal.description, completed: goal.completed, createdAt: createdDate, updatedAt: updatedDate, dueDate: goal.dueDate ? new Date(goal.dueDate).toISOString() : null, priority: goal.priority, category: goal.category, tags: goal.tags, reminderTime: goal.reminderTime ? new Date(goal.reminderTime).toISOString() : null, isRecurring: goal.isRecurring, recurringType: goal.recurringType, recurringInterval: goal.recurringInterval, recurringEndDate: goal.recurringEndDate ? new Date(goal.recurringEndDate).toISOString() : null, });
      }).join("\n- ");

      const goalsText = formattedGoals ? `- ${formattedGoals}` : "No goals found.";

      let botResponse;

      try {
        const fullPrompt = `Here are user's goals:\n${goalsText}\n\nUser Message:\n${userContent}`;

        const chatResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are ミライ Goal Assistant" },
            { role: "user", content: fullPrompt },
          ],
          temperature: 1.0,
        });

        const aiMessage = chatResponse.choices[0].message.content?.trim();

        if (!aiMessage) {
          console.error("No message returned from OpenAI");
          botResponse = `I am ミライ Goal Assistant. I've received your message but I'm having trouble formulating a response right now.`;
        } else {
          botResponse = formatBotResponse(aiMessage);
        }
      } catch (error) {
        console.error("OpenAI API error:", error);
        botResponse = `I am ミライ, but I'm having trouble connecting to my brain right now. Please try again later.`;
      }

      // Save the bot response to the database
      const botMessage = await storage.createMessage(req.user!.id, {
        content: botResponse,
        isBot: true,
        sessionId: goalSessionId,
      });

      // Return the bot message
      res.json(botMessage);
    } catch (error) {
      console.error("Error processing goal message:", error);
      res.status(500).json({
        message: "Failed to process goal message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add a direct messages endpoint for the client
  app.post("/api/messages",
    granularChatLimiter,
    validateMessage,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");

      // Use the full email as the session ID to ensure uniqueness across users
      const persistentSessionId = getPersistentSessionId(req.user!.email);
      const result = chatRequestSchema.safeParse(req.body);

      if (!result.success) {
        console.error("Invalid request body:", result.error);
        return sendError(res, 400, "Invalid request data", result.error);
      }

      const body = result.data;

      try {
        // Check if the session with the specific ID exists first
        const existingUserSession = await storage.getUserLastSession(req.user!.id);
        if (!existingUserSession) {
          console.log(`Creating new session for user ${req.user!.id} with sessionId ${persistentSessionId}`);
          await storage.createUserSession(req.user!.id, persistentSessionId);
        }

        // Save the user message
        await storage.createMessage(req.user!.id, {
          ...body,
          isBot: false,
          sessionId: persistentSessionId,
        });


        // Get response from langchain
        const formattedResponse = await sendMessageToLangchain(
          body.content,
          body.useWeb ?? false,
          body.useDb ?? false,
        );

        // Bot message should inherit the same category as the user message
        const botMessage = await storage.createMessage(req.user!.id, {
          content: formattedResponse,
          isBot: true,
          sessionId: persistentSessionId,
        });

        res.json(botMessage);

      } catch (error) {
        console.error("Error in chat processing:", error);
        return sendError(res, 500, "Failed to process message", error instanceof Error ? error.message : "Unknown error");
      }
    });

  // Get messages for the main chat interface
  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const persistentSessionId = getPersistentSessionId(req.user!.email);
      console.log(persistentSessionId)

      // Check if the session exists, if not, create it
      const existingSession = await storage.getUserLastSession(req.user!.id);
    
      if (!existingSession || existingSession.sessionId !== persistentSessionId) {
          console.log(`Creating new session for user ${req.user!.id} with sessionId ${persistentSessionId}`);
          await storage.createUserSession(req.user!.id, persistentSessionId);
        }

      const messages = await storage.getMessagesByUserAndSession(
        req.user!.id,
        persistentSessionId
      );
      console.log(`Retrieved ${messages.length} messages for user ${req.user!.id} with sessionId ${persistentSessionId}`);
      res.json(messages);
    } catch (error) {
      console.error("Error retrieving messages:", error);
      res.status(500).json({
        message: "Failed to retrieve messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // DELETE endpoint to clear regular chat history
  app.delete("/api/messages",
    apiRateLimit,
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");

      try {
        // Use the same session ID pattern as other regular chat endpoints
        const persistentSessionId = getPersistentSessionId(req.user!.email);


        // Delete all messages with this session ID
        await storage.deleteMessagesByUserAndSession(
          req.user!.id,
          persistentSessionId
        );

        console.log(`Deleted all messages for user ${req.user!.id} with sessionId ${persistentSessionId}`);

        res.status(200).json({ message: "Chat history deleted successfully" });

      } catch (error) {
        console.error("Error deleting messages:", error);
        return sendError(
          res,
          500,
          "Failed to delete messages",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    });

  app.get("/api/goal-messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goalSessionId = `goal_${req.user!.id}_${req.user!.email}`;

      const existingGoalSession = await storage.getSessionBySessionId(goalSessionId);
      if (!existingGoalSession) {
        console.log(`Creating new goal session for user ${req.user!.id} with sessionId ${goalSessionId}`);
        await storage.createUserSession(req.user!.id, goalSessionId);
      }

      const messages = await storage.getMessagesByUserAndSession(
        req.user!.id,
        goalSessionId
      );
      console.log(`Retrieved ${messages.length} goal messages for user ${req.user!.id} with sessionId ${goalSessionId}`);
      res.json(messages);
    } catch (error) {
      console.error("Error retrieving goal messages:", error);
      res.status(500).json({
        message: "Failed to retrieve messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // DELETE endpoint to clear goal chat history
  app.delete("/api/goal-messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Use the same session ID pattern as other goal chat endpoints
      const goalSessionId = `goal_${req.user!.id}_${req.user!.email}`;

      // Delete all messages with this session ID
      const result = await storage.deleteMessagesBySessionId(req.user!.id, goalSessionId);

      console.log(`Deleted goal chat messages for user ${req.user!.id} with sessionId ${goalSessionId}, success: ${result}`);

      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting goal chat messages:", error);
      res.status(500).json({
        message: "Failed to delete goal chat messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Notes API routes
  app.get("/api/notes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const notes = await storage.getNotesByUserId(req.user!.id);
      res.json(notes);
    } catch (error) {
      console.error("Error retrieving notes:", error);
      res.status(500).json({
        message: "Failed to retrieve notes",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/notes/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const note = await storage.getNoteById(noteId, req.user!.id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      res.json(note);
    } catch (error) {
      console.error("Error retrieving note:", error);
      res.status(500).json({
        message: "Failed to retrieve note",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add an endpoint to get notes chat messages
  app.get("/api/notes-chat-messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Use a different session ID pattern for notes chat to ensure separation from regular chat
      const notesSessionId = `notes_${req.user!.id}_${req.user!.email}`;

      // Check if the session with the specific ID exists first
      const existingNotesSession = await storage.getSessionBySessionId(notesSessionId);
      if (!existingNotesSession) {
        console.log(`Creating new notes session for user ${req.user!.id} with sessionId ${notesSessionId}`);
        await storage.createUserSession(req.user!.id, notesSessionId);
      }

      const messages = await storage.getMessagesByUserAndSession(
        req.user!.id,
        notesSessionId
      );
      console.log(`Retrieved ${messages.length} notes chat messages for user ${req.user!.id} with sessionId ${notesSessionId}`);
      res.json(messages);
    } catch (error) {
      console.error("Error retrieving notes chat messages:", error);
      res.status(500).json({
        message: "Failed to retrieve notes chat messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add endpoint to clear notes chat history
  app.delete("/api/notes-chat-messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Use the same session ID pattern as other notes chat endpoints
      const notesSessionId = `notes_${req.user!.id}_${req.user!.email}`;

      // Delete all messages with this session ID
      const result = await storage.deleteMessagesBySessionId(req.user!.id, notesSessionId);

      console.log(`Deleted notes chat messages for user ${req.user!.id} with sessionId ${notesSessionId}, success: ${result}`);

      res.json({ success: result });
    } catch (error) {
      console.error("Error deleting notes chat messages:", error);
      res.status(500).json({
        message: "Failed to delete notes chat messages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add a dedicated notes chat endpoint
  app.post("/api/notes-chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Use a different session ID pattern for notes chat to ensure separation from regular chat
    const notesSessionId = `notes_${req.user!.id}_${req.user!.email}`;
    const userContent = req.body.content;
    const selectedNotes = req.body.notes || [];

    try {
      // Check if the session with the specific ID exists first
      const existingNotesSession = await storage.getSessionBySessionId(notesSessionId);
      if (!existingNotesSession) {
        console.log(`Creating new notes session for user ${req.user!.id} with sessionId ${notesSessionId}`);
        await storage.createUserSession(req.user!.id, notesSessionId);
      }

      // Save the user message with the notes-specific session ID
      const userMessage = await storage.createMessage(req.user!.id, {
        content: userContent,
        isBot: false,
        sessionId: notesSessionId,
      });

      console.log(`Sending request to Notes Chat API: ${userContent}`);

      // Format the selected notes for context
      let formattedNotes = "";
      if (selectedNotes && selectedNotes.length > 0) {
        formattedNotes = selectedNotes.map((note: any) => {
          const createdDate = new Date(note.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

          return `Title: ${note.title}\nContent: ${note.content}\nCreated: ${createdDate}\n---`;
        }).join("\n");
      } else {
        // If no notes were explicitly selected, try to get all user notes
        const allNotes = await storage.getNotesByUserId(req.user!.id);
        if (allNotes && allNotes.length > 0) {
          formattedNotes = allNotes.map(note => {
            const createdDate = new Date(note.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            return `Title: ${note.title}\nContent: ${note.content}\nCreated: ${createdDate}\n---`;
          }).join("\n");
        } else {
          formattedNotes = "No notes found.";
        }
      }

      let botResponse;

      try {
        // Combine notes and user query into a single prompt
        const fullPrompt = `The following are the user's notes:\n\n${formattedNotes}\n\nUser's message:\n${userContent}`;

        const chatResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are ミライ notes assistant.",
            },
            {
              role: "user",
              content: fullPrompt,
            },
          ],
          temperature: 1.0,
        });

        const aiMessage = chatResponse.choices[0].message.content?.trim();

        if (!aiMessage) {
          console.error("No message returned from OpenAI");
          botResponse = `I am ミライ ノートアシスタント. I've received your message but I'm having trouble formulating a response right now.`;
        } else {
          botResponse = formatBotResponse(aiMessage);
        }
      } catch (error) {
        console.error("OpenAI API error:", error);
        botResponse = `I am ミライ, but I'm having trouble connecting to my brain right now. Please try again later.`;
      }


      // Save the bot response to the database
      const botMessage = await storage.createMessage(req.user!.id, {
        content: botResponse,
        isBot: true,
        sessionId: notesSessionId,
      });

      // Return the bot message
      res.json(botMessage);
    } catch (error) {
      console.error("Error processing notes chat message:", error);
      res.status(500).json({
        message: "Failed to process notes chat message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/notes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertNoteSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Invalid request body:", result.error);
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const newNote = await storage.createNote(req.user!.id, result.data);
      res.status(201).json(newNote);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({
        message: "Failed to ノートを作成",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.put("/api/notes/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertNoteSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Invalid request body:", result.error);
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const updatedNote = await storage.updateNote(noteId, req.user!.id, result.data);
      if (!updatedNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      res.json(updatedNote);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({
        message: "Failed to update note",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const success = await storage.deleteNote(noteId, req.user!.id);
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({
        message: "Failed to delete note",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Mind Map API route
  app.post("/api/mind-map", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { topic } = req.body;

      if (!topic || typeof topic !== "string" || topic.trim() === "") {
        return res.status(400).json({ error: "Topic is required" });
      }

      console.log(`Generating mind map for topic: ${topic}`);

      const mindMap = await generateMindMap(topic);

      res.json(mindMap);
    } catch (error) {
      console.error("Error generating mind map:", error);
      res.status(500).json({
        message: "Failed to generate mind map",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Goals API routes
  app.get("/api/goals", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goals = await storage.getGoalsByUserId(req.user!.id);
      res.json(goals);
    } catch (error) {
      console.error("Error retrieving goals:", error);
      res.status(500).json({
        message: "Failed to retrieve goals",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/goals/active", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goals = await storage.getNonCompletedGoalsByUserId(req.user!.id);
      res.json(goals);
    } catch (error) {
      console.error("Error retrieving active goals:", error);
      res.status(500).json({
        message: "Failed to retrieve active goals",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get goals by category
  app.get("/api/goals/category/:category", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goals = await storage.getGoalsByUserId(req.user!.id);
      const categoryGoals = goals.filter(goal => goal.category === req.params.category);
      res.json(categoryGoals);
    } catch (error) {
      console.error("Error retrieving goals by category:", error);
      res.status(500).json({
        message: "Failed to retrieve goals by category",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get goals by priority
  app.get("/api/goals/priority/:priority", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goals = await storage.getGoalsByUserId(req.user!.id);
      const priorityGoals = goals.filter(goal => goal.priority === req.params.priority);
      res.json(priorityGoals);
    } catch (error) {
      console.error("Error retrieving goals by priority:", error);
      res.status(500).json({
        message: "Failed to retrieve goals by priority",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Search goals
  app.get("/api/goals/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const searchTerm = req.query.q as string;

    if (!searchTerm) {
      return res.status(400).json({ error: "Search term is required" });
    }

    try {
      const goals = await storage.getGoalsByUserId(req.user!.id);
      const searchResults = goals.filter(goal => {
        const titleMatch = goal.title.toLowerCase().includes(searchTerm.toLowerCase());
        const descriptionMatch = goal.description.toLowerCase().includes(searchTerm.toLowerCase());
        const categoryMatch = goal.category?.toLowerCase().includes(searchTerm.toLowerCase());
        const tagsMatch = goal.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        return titleMatch || descriptionMatch || categoryMatch || tagsMatch;
      });

      res.json(searchResults);
    } catch (error) {
      console.error("Error searching goals:", error);
      res.status(500).json({
        message: "Failed to search goals",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/goals/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goalId = parseInt(req.params.id);
      if (isNaN(goalId)) {
        return res.status(400).json({ error: "Invalid goal ID" });
      }

      const goal = await storage.getGoalById(goalId, req.user!.id);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      res.json(goal);
    } catch (error) {
      console.error("Error retrieving goal:", error);
      res.status(500).json({
        message: "Failed to retrieve goal",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/goals", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertGoalSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Invalid request body:", result.error);
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const newGoal = await storage.createGoal(req.user!.id, result.data);
      res.status(201).json(newGoal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({
        message: "Failed to create goal",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.put("/api/goals/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const result = insertGoalSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Invalid request body:", result.error);
      return res.status(400).json({ error: "Invalid request data" });
    }

    try {
      const goalId = parseInt(req.params.id);
      if (isNaN(goalId)) {
        return res.status(400).json({ error: "Invalid goal ID" });
      }

      const updatedGoal = await storage.updateGoal(goalId, req.user!.id, result.data);
      if (!updatedGoal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      res.json(updatedGoal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({
        message: "Failed to update goal",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goalId = parseInt(req.params.id);
      if (isNaN(goalId)) {
        return res.status(400).json({ error: "Invalid goal ID" });
      }

      const success = await storage.deleteGoal(goalId, req.user!.id);
      if (!success) {
        return res.status(404).json({ error: "Goal not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({
        message: "Failed to delete goal",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/change-password",
    apiRateLimit,
    validatePasswordChange, // Use the password validation defined above
    handleValidationErrors, // Handle validation errors
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");
      console.log("🔍 Received change-password request");
      console.log("🔐 req.user:", req.user); // <== log this

      const { oldPassword, newPassword } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      try {
        // Fetch user from the database
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Compare old password
        const passwordValid = await comparePasswords(oldPassword, user.password);
        if (!passwordValid) {
          return res.status(400).json({ error: "Old password is incorrect" });
        }

        // Hash the new password and update it in the database
        const hashedPassword = await hashPassword(newPassword);
        await storage.updateUserPassword(userId, hashedPassword);

        // Respond with success
        res.status(200).json({ message: "Password changed successfully" });
      } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ error: "Failed to change password" });
      }
    }
  );

  // Submit feedback with validation
  app.post("/api/feedback",
    apiRateLimit,
    validateFeedback,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");

      const result = insertFeedbackSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Invalid feedback data:", result.error);
        return sendError(res, 400, "Invalid feedback data", result.error);
      }

      try {
        // Get the user's persistent session ID
        const persistentSessionId = getPersistentSessionId(req.user!.email);

        // Create feedback entry
        const feedback = await storage.createFeedback(req.user!.id, {
          ...result.data,
          sessionId: persistentSessionId, // Use the persistent session ID
        });

        console.log(`Feedback submitted for user ${req.user!.id}`);
        res.status(201).json(feedback);
      } catch (error) {
        console.error("Error saving feedback:", error);
        return sendError(
          res,
          500,
          "Failed to save feedback",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  );


  const httpServer = createServer(app);
  return httpServer;
}