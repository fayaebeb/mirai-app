import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { comparePasswords, hashPassword, setupAuth } from "./auth";
import { insertMessageSchema, insertNoteSchema, insertGoalSchema, chatRequestSchema, insertFeedbackSchema, DbType } from "@shared/schema";
import { generateMindMap } from "./services/openai";
import rateLimit from 'express-rate-limit';
import { openai } from './openaiClient';
import dotenv from "dotenv";
import multer from "multer";
import { apiRateLimit, handleValidationErrors, validateFeedback, validateMessage, validatePasswordChange } from "./security";
import { getPersistentSessionId, sendError } from "./utils/errorResponse";
import { WebSocketServer, WebSocket } from "ws";
import { transcribeAudio } from "./apis/openai";
import { textToSpeechStream } from "./apis/textToSpeechStream";
import { z } from "zod";
import { suggestHandler } from "./apis/suggest";
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
const chatTitleSchema = z.object({ title: z.string().min(1).max(80) });
const chatMessageSchema = insertMessageSchema.pick({ content: true, isBot: true, dbType: true }).extend({
  dbType: z
    .enum([
      'db1',
      'db2',
      'db3',
      'regular',
    ] as const)
    .optional()
    .default('regular'),
});;

const getOrCreateVoiceChat = async (userId: number) =>
  await storage.getOrCreateSystemChat(userId, "Voice Assistant", "voice");

async function sendMessageToLangchain(
  message: string,
  useWeb: boolean,
  useDb: boolean,
  selectedDb: DbType,
  history: { role: string, content: string }[]
): Promise<string> {
  // console.log(`Sending request to LangChain FastAPI: ${message}`);

  let db = '';
  if (selectedDb === 'regular') {
    db = 'db1';
  } else if (selectedDb === 'db1') {
    db = 'db1';
  } else if (selectedDb === 'db2') {
    db = 'db2'
  } else if (selectedDb === 'db3') {
    db = 'db3'
  }

  const response = await fetch(SKAPI, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      useweb: useWeb,
      usedb: useDb,
      db: db,
      history: history
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

const processedPastMessages = async (chatId: number) => {
  const messages = await storage.getPastMessagesByChatId(chatId, 5);
  messages.reverse();

  messages.pop();

  // Format the conversation history string
  let pastMessages: { role: string, content: string }[] = [];
  for (const message of messages) {
    if (message.isBot) {
      pastMessages.push({ role: "AI", content: message.content });
    } else {
      pastMessages.push({ role: "user", content: message.content });
    }
  }

  const history = pastMessages.map((message) => {
    if (message.role === "AI") {
      const contentSplit = message.content.split('###');
      message.content = contentSplit[0]; // Keep content before ###

      message.content = message.content.trim().replace(/\s+/g, ' ');
    }
    return message;
  });

  return history
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.use("/api", apiRateLimit);


  // Add a dedicated goal tracker chat endpoint
  app.post("/api/goal-chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userId = req.user!.id;
    const userContent = req.body.content as string;

    try {
      /* 1️⃣  Get (or lazily create) the dedicated Goal-assistant chat */
      const goalChat = await storage.getOrCreateSystemChat(
        userId,
        "Goal Tracker",
        "goal"                 // type column in chats table
      );

      /* 2️⃣  Save the USER message */
      await storage.createMessage(userId, {
        chatId: goalChat.id,
        content: userContent,
        isBot: false,
        dbType: 'regular'
      });

      console.log(`Sending request to Goal Tracker API: ${userContent}`);

      /* 3️⃣  Build goal context */
      const allGoals = await storage.getGoalsByUserId(userId);
      const goalsText = allGoals.length
        ? allGoals.map(g => `• ${g.title} (${g.completed ? "✅" : "❌"})`).join("\n")
        : "No goals found.";

      /* 4️⃣  Ask OpenAI */
      let botResponse: string;
      try {
        const fullPrompt = `Here are user's goals:\n${goalsText}\n\nUser Message:\n${userContent}`;
        const chatResp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are ミライ Goal Assistant" },
            { role: "user", content: fullPrompt }
          ],
          temperature: 1.0,
        });
        botResponse =
          chatResp.choices[0].message.content?.trim() ??
          "I am ミライ Goal Assistant, but I'm having trouble responding right now.";
      } catch (err) {
        console.error("OpenAI API error:", err);
        botResponse =
          "I am ミライ Goal Assistant, but I'm having trouble connecting to my brain right now.";
      }

      /* 5️⃣  Save the BOT reply */
      const botMsg = await storage.createMessage(userId, {
        chatId: goalChat.id,
        content: botResponse,
        isBot: true,
        dbType: 'regular'
      });

      /* 6️⃣  Return the bot message */
      res.json(botMsg);
    } catch (error) {
      console.error("Error processing goal message:", error);
      res.status(500).json({
        message: "Failed to process goal message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add a direct messages endpoint for the client
  app.post(
    "/api/messages",
    granularChatLimiter,
    validateMessage,
    handleValidationErrors,
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");

      /* validate body */
      const parse = chatRequestSchema.safeParse(req.body);
      if (!parse.success) {
        console.error("Invalid request body:", parse.error);
        return sendError(res, 400, "Invalid request data", parse.error);
      }
      const { chatId, content, useWeb = false, useDb = false, dbType: _dbType } = parse.data;
      const userId = req.user!.id;

      try {
        /* 1️⃣  Get (or lazily create) a single “Main Chat” for this user */
        const chat = await storage.getChatById(chatId);
        if (!chat || chat.userId !== userId) {
          return sendError(res, 403, "Forbidden: chat not found");
        }

        const dbType = useDb ? (chat.dbType ?? 'regular') : 'regular';

        /* 2️⃣  Save USER message */
        await storage.createMessage(userId, {
          chatId,
          content,
          isBot: false,
          dbType
        });

        const history = await processedPastMessages(chatId)

        /* 3️⃣  Ask LangChain / FastAPI */
        const formattedResponse = await sendMessageToLangchain(
          content,
          useWeb,
          useDb,
          dbType,
          history
        );

        /* 4️⃣  Save BOT reply */
        const botMsg = await storage.createMessage(userId, {
          chatId,
          content: formattedResponse,
          isBot: true,
          dbType
        });

        /* 5️⃣  Return bot message */
        res.json(botMsg);
      } catch (error) {
        console.error("Error in chat processing:", error);
        return sendError(
          res,
          500,
          "Failed to process message",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  );

  // Get messages for the main chat interface
  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const userId = req.user!.id;

      /* 1️⃣  Find or create the Main Chat for this user */
      let mainChat =
        (await storage.getChatsByUser(userId)).find(
          (c) => c.type === "regular" && c.title === "Main Chat"
        );

      if (!mainChat) {
        console.log(`Creating Main Chat for user ${userId}`);
        mainChat = await storage.createChat(userId, "Main Chat", "regular");
      }

      /* 2️⃣  Fetch all messages in that chat */
      const messages = await storage.getMessagesByChat(userId, mainChat.id);

      console.log(
        `Retrieved ${messages.length} messages for user ${userId} (chatId ${mainChat.id})`
      );
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
  // app.delete(
  //   "/api/messages",
  //   apiRateLimit,
  //   async (req: Request, res: Response) => {
  //     if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");

  //     try {
  //       const userId = req.user!.id;

  //       /* 1️⃣  Find—or lazily create—the user’s “Main Chat” */
  //       let mainChat =
  //         (await storage.getChatsByUser(userId)).find(
  //           (c) => c.type === "regular" && c.title === "Main Chat"
  //         );

  //       if (!mainChat) {
  //         console.log(`Creating Main Chat for user ${userId}`);
  //         mainChat = await storage.createChat(userId, "Main Chat", "regular");
  //       }

  //       /* 2️⃣  Delete every message in that chat */
  //       await storage.deleteMessagesInChat(userId, mainChat.id);

  //       console.log(
  //         `Deleted all messages for user ${userId} in chatId ${mainChat.id}`
  //       );

  //       res.status(200).json({ message: "Chat history deleted successfully" });
  //     } catch (error) {
  //       console.error("Error deleting messages:", error);
  //       return sendError(
  //         res,
  //         500,
  //         "Failed to delete messages",
  //         error instanceof Error ? error.message : "Unknown error"
  //       );
  //     }
  //   }
  // );

  app.get("/api/goal-messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      /* 1️⃣  Locate (or lazily create) the Goal-assistant chat */
      const goalChat = await storage.getOrCreateSystemChat(
        req.user!.id,
        "Goal Tracker",
        "goal"                 // chats.type
      );

      /* 2️⃣  Fetch every message in that chat */
      const messages = await storage.getMessagesByChat(
        req.user!.id,
        goalChat.id
      );

      console.log(
        `Retrieved ${messages.length} goal messages for user ${req.user!.id} (chatId ${goalChat.id})`
      );
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
      /* 1️⃣  Find—or create—the Goal-assistant chat for this user */
      const goalChat = await storage.getOrCreateSystemChat(
        req.user!.id,
        "Goal Tracker",
        "goal"               // chats.type
      );

      /* 2️⃣  Remove every message in that chat */
      const success = await storage.deleteMessagesInChat(
        req.user!.id,
        goalChat.id
      );

      console.log(
        `Deleted goal chat messages for user ${req.user!.id} (chatId ${goalChat.id}), success: ${success}`
      );

      res.json({ success });
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
      /* 1️⃣  Locate (or lazily create) the Notes-assistant chat */
      const notesChat = await storage.getOrCreateSystemChat(
        req.user!.id,
        "Notes Assistant",   // title
        "notes"              // chats.type
      );

      /* 2️⃣  Pull every message in that chat */
      const messages = await storage.getMessagesByChat(
        req.user!.id,
        notesChat.id
      );

      console.log(
        `Retrieved ${messages.length} notes chat messages for user ${req.user!.id} (chatId ${notesChat.id})`
      );
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
      /* 1️⃣  Locate (or lazily create) the Notes-assistant chat */
      const notesChat = await storage.getOrCreateSystemChat(
        req.user!.id,
        "Notes Assistant",   // title
        "notes"              // chats.type
      );

      /* 2️⃣  Remove every message in that chat */
      const success = await storage.deleteMessagesInChat(
        req.user!.id,
        notesChat.id
      );

      console.log(
        `Deleted notes chat messages for user ${req.user!.id} (chatId ${notesChat.id}), success: ${success}`
      );
      res.json({ success });
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

    const userId = req.user!.id;
    const userContent = req.body.content as string;
    const selectedNotes = (req.body.notes || []) as Array<any>; // same shape as before

    try {
      /* 1️⃣  Get (or lazily create) the Notes-assistant chat */
      const notesChat = await storage.getOrCreateSystemChat(
        userId,
        "Notes Assistant",
        "notes"                         // chats.type
      );

      /* 2️⃣  Save the user message */
      await storage.createMessage(userId, {
        chatId: notesChat.id,
        content: userContent,
        isBot: false,
        dbType: 'regular'
      });

      console.log(`Sending request to Notes Chat API: ${userContent}`);

      /* 3️⃣  Build notes context */
      let formattedNotes = "";

      if (selectedNotes.length) {
        formattedNotes = selectedNotes
          .map((n) => {
            const created = new Date(n.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            return `Title: ${n.title}\nContent: ${n.content}\nCreated: ${created}\n---`;
          })
          .join("\n");
      } else {
        const allNotes = await storage.getNotesByUserId(userId);
        formattedNotes = allNotes.length
          ? allNotes
            .map((n) => {
              const created = new Date(n.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              return `Title: ${n.title}\nContent: ${n.content}\nCreated: ${created}\n---`;
            })
            .join("\n")
          : "No notes found.";
      }

      /* 4️⃣  Call OpenAI */
      let botResponse: string;
      try {
        const prompt = `The following are the user's notes:\n\n${formattedNotes}\n\nUser's message:\n${userContent}`;
        const chatResp = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are ミライ notes assistant." },
            { role: "user", content: prompt },
          ],
          temperature: 1.0,
        });
        botResponse =
          chatResp.choices[0].message.content?.trim() ??
          "I am ミライ ノートアシスタント. I've received your message but I'm having trouble formulating a response right now.";
      } catch (err) {
        console.error("OpenAI API error:", err);
        botResponse =
          "I am ミライ, but I'm having trouble connecting to my brain right now. Please try again later.";
      }

      /* 5️⃣  Save the bot reply */
      const botMessage = await storage.createMessage(userId, {
        chatId: notesChat.id,
        content: botResponse,
        isBot: true,
        dbType: 'regular'
      });

      /* 6️⃣  Return reply */
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

  // Voice input endpoint - transcribes audio only with enhanced security
  app.post(
    "/api/voice/transcribe",
    granularTranscribeLimiter,
    upload.single("audio"),
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");
      if (!req.file) return sendError(res, 400, "No audio file uploaded");

      try {
        console.log(`Security: Audio file upload from user ${req.user!.email}, size: ${req.file.size} bytes`);

        // Transcribe audio to text
        const transcribedText = await transcribeAudio(req.file.buffer);
        console.log("Transcribed text:", transcribedText);

        // Return only the transcript
        return res.status(200).json({ transcribedText });
      } catch (error) {
        console.error("Error processing voice input:", error);
        return sendError(
          res,
          500,
          "Failed to process voice input",
          error instanceof Error ? error.message : "Unknown error"
        );

      }
    }
  );

  // Text-to-speech endpoint with validation
  app.post("/api/voice/speech",
    apiRateLimit,
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return sendError(res, 401, "Unauthorized");

      try {
        const { text, voiceId } = req.body;

        if (!text || typeof text !== 'string') {
          return sendError(res, 400, "Valid text is required");
        }

        if (text.length > 10000) {
          return sendError(res, 400, "Text too long (max 10,000 characters)");
        }

        console.log("Streaming TTS audio...");

        const openaiResponse = await textToSpeechStream(text, voiceId);

        // Set headers for streaming audio
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Transfer-Encoding", "chunked");

        // Stream OpenAI's audio response directly to the client
        openaiResponse.data.pipe(res);
      } catch (error) {
        console.error("Streaming error:", error);
        return sendError(
          res,
          500,
          "Failed to stream speech",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }
  );

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

  app.post("/api/chats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = chatTitleSchema.partial().extend({
      dbType: z.enum(['db1', 'db2', 'db3', 'regular']).default('regular')
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { title = "新しいチャット", dbType } = parsed.data;
    const chat = await storage.createChat(req.user!.id, title, "regular", dbType);
    res.status(201).json(chat);
  });

  app.get("/api/chats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const chats = await storage.getChatsByUser(req.user!.id);
    const userChats = chats.filter(
      chat => chat.type !== "notes" && chat.type !== "goal"
    );
    res.json(userChats);
  });

  app.patch("/api/chats/:chatId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const chatId = Number(req.params.chatId);
    const { title } = chatTitleSchema.parse(req.body);
    const updated = await storage.renameChat(req.user!.id, chatId, title);
    if (!updated) return res.sendStatus(404);
    res.json(updated);
  });

  app.delete("/api/chats/:chatId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const chatId = Number(req.params.chatId);
    const ok = await storage.deleteChat(req.user!.id, chatId);
    console.log("deleted chatid :", chatId)
    res.sendStatus(ok ? 204 : 404);
  });

  app.get("/api/chats/:chatId/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const chatId = Number(req.params.chatId);
    const msgs = await storage.getMessagesByChat(req.user!.id, chatId);
    res.json(msgs);
  });

  app.post("/api/votes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userId = req.user!.id;
    const { messageId, value } = req.body as {
      messageId: number;
      value: 1 | -1;
    };

    if (value !== 1 && value !== -1) {
      return res.status(400).json({ error: "Value must be 1 or -1" });
    }

    try {
      const updated = await storage.setMessageVote(messageId, value);
      if (!updated) return res.status(404).json({ error: "Message not found" });

      res.json({ success: true, vote: value });
    } catch (err) {
      console.error("POST /api/votes error:", err);
      sendError(res, 500, "Failed to cast vote");
    }
  });

  // Clear (neutralize) your vote
  app.delete("/api/votes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { messageId } = req.body as { messageId: number };

    try {
      const updated = await storage.setMessageVote(messageId, 0); // neutralize
      if (!updated) return res.status(404).json({ error: "Message not found" });

      res.json({ success: true, vote: 0 });
    } catch (err) {
      console.error("DELETE /api/votes error:", err);
      sendError(res, 500, "Failed to clear vote");
    }
  });



  app.post(
    "/api/chats/:chatId/messages",
    granularChatLimiter,          // you already have this rate-limiter defined
    async (req, res) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const chatId = Number(req.params.chatId);
      const { content, isBot, dbType } = chatMessageSchema.parse(req.body);

      /* save message */
      const msg = await storage.createMessage(req.user!.id, {
        chatId,
        content,
        isBot,
        dbType
      });

      res.status(201).json(msg);
    }
  );

  app.delete("/api/chats/:chatId/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const chatId = Number(req.params.chatId);
    const ok = await storage.deleteMessagesInChat(req.user!.id, chatId);
    res.sendStatus(ok ? 204 : 404);
  });

  app.patch(
    "/api/chats/:chatId/rename",
    apiRateLimit,
    async (req: Request, res: Response) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      // parse & validate chatId
      const chatId = Number(req.params.chatId);
      if (isNaN(chatId)) {
        return res.status(400).json({ error: "Invalid chat ID" });
      }

      // validate new title
      const parsed = chatTitleSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("Invalid title:", parsed.error);
        return res.status(400).json({ error: "Title must be 1–80 characters" });
      }
      const { title } = parsed.data;

      try {
        // attempt the rename
        const updatedChat = await storage.renameChat(req.user!.id, chatId, title);
        if (!updatedChat) {
          return res.sendStatus(404);
        }
        res.json(updatedChat);
      } catch (err) {
        console.error("Error renaming chat:", err);
        res.status(500).json({
          error: "Failed to rename chat",
          detail: err instanceof Error ? err.message : undefined,
        });
      }
    }
  );

  app.post("/api/suggest", apiRateLimit, suggestHandler);

  const httpServer = createServer(app);

  // Set up WebSocket server with basic security
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    verifyClient: (info: any) => {
      // Basic rate limiting for WebSocket connections
      const origin = info.origin;
      const userAgent = info.req.headers['user-agent'];

      console.log(`WebSocket connection attempt from origin: ${origin}, user-agent: ${userAgent}`);

      // Allow all connections in development, add origin checking in production
      return true;
    }
  });

  interface VoiceModeClient {
    userId: number;
    email: string;
    ws: WebSocket;
    chatId: number;
    lastActivity: number;
  }

  const voiceModeClients: VoiceModeClient[] = [];

  // Clean up inactive clients every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (let i = voiceModeClients.length - 1; i >= 0; i--) {
      const client = voiceModeClients[i];
      if (now - client.lastActivity > timeout) {
        console.log(`Removing inactive WebSocket client: ${client.email}`);
        client.ws.close();
        voiceModeClients.splice(i, 1);
      }
    }
  }, 5 * 60 * 1000);

  wss.on('connection', (ws, req) => {
    console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);

    // Set up ping/pong for connection health
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    // Handle client connection
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data.type);

        if (data.type === 'auth') {
          // Authenticate user and store connection info
          if (data.userId && data.email && Number.isInteger(data.chatId)) {
            const existingClientIndex = voiceModeClients.findIndex(
              client => client.userId === data.userId
            );

            const clientData = {
              userId: data.userId,
              email: data.email,
              ws,
              chatId: data.chatId,
              lastActivity: Date.now()
            };

            if (existingClientIndex !== -1) {
              // Update existing client
              voiceModeClients[existingClientIndex] = clientData;
              console.log(`Updated WebSocket connection for user ${data.email}`);
            } else {
              // Add new client
              voiceModeClients.push(clientData);
              console.log(`Registered WebSocket connection for user ${data.email}`);
            }

            // Send confirmation
            ws.send(JSON.stringify({ type: 'auth_success' }));
          }
          return;
        }

        // Require authentication for all other message types
        const client = voiceModeClients.find(c => c.ws === ws);
        if (!client) {
          console.warn("Unauthenticated WebSocket message blocked:", data.type);
          ws.send(JSON.stringify({ type: 'error', message: 'Authenticate first' }));
          ws.close();
          return;
        }

        client.lastActivity = Date.now();

        if (data.type === 'speech') {
          if (!data.audioData) {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing audio data' }));
            return;
          }

          try {
            const buffer = Buffer.from(data.audioData, 'base64');
            console.log("Transcribing voice mode audio...");
            const transcribedText = await transcribeAudio(buffer);
            console.log("Voice mode transcribed text:", transcribedText);

            ws.send(JSON.stringify({
              type: 'transcription',
              text: transcribedText
            }));

            const persistentSessionId = getPersistentSessionId(client.email);

            const userMessage = await storage.createMessage(client.userId, {
              content: transcribedText,
              isBot: false,
              chatId: client.chatId,
              dbType: data.dbType
            });

            const history = await processedPastMessages(client.chatId)

            console.log("Processing voice mode message with AI...");
            const formattedResponse = await sendMessageToLangchain(
              transcribedText,
              data.useweb ?? false,
              data.usedb ?? false,
              data.dbType,
              history
            );

            const botMessage = await storage.createMessage(client.userId, {
              content: formattedResponse,
              isBot: true,
              chatId: client.chatId,
              dbType: data.dbType
            });

            ws.send(JSON.stringify({
              type: 'ai_response',
              userMessage,
              message: botMessage
            }));

            console.log("Generating speech for voice mode response...");
            try {
              const openaiResponse = await textToSpeechStream(formattedResponse);

              const chunks: Buffer[] = [];
              let totalSize = 0;
              let streamAborted = false;
              const MAX_AUDIO_SIZE = 5 * 1024 * 1024;

              openaiResponse.data.on('data', (chunk: Buffer) => {
                if (streamAborted) return;

                totalSize += chunk.length;
                if (totalSize > MAX_AUDIO_SIZE) {
                  streamAborted = true;
                  console.error(`TTS stream exceeded limit: ${totalSize} bytes`);
                  openaiResponse.data.destroy();

                  ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Audio response too large to handle safely.'
                  }));
                  return;
                }

                chunks.push(chunk);
              });

              openaiResponse.data.on('end', () => {
                if (streamAborted) return;

                const audioBuffer = Buffer.concat(chunks);
                const base64Audio = audioBuffer.toString('base64');

                ws.send(JSON.stringify({
                  type: 'speech_response',
                  audioData: base64Audio
                }));
              });

              openaiResponse.data.on('error', (err: Error) => {
                console.error("Error streaming TTS:", err);
                if (!streamAborted) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Failed to generate speech'
                  }));
                }
              });

            } catch (error) {
              console.error("Error generating speech:", error);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to generate speech response'
              }));
            }
          } catch (error) {
            console.error("Error processing voice mode message:", error);
            ws.send(JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error'
            }));
          }
        }

      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      const clientIndex = voiceModeClients.findIndex(client => client.ws === ws);
      if (clientIndex !== -1) {
        const client = voiceModeClients[clientIndex];
        console.log(`User ${client.email} disconnected from voice mode`);
        voiceModeClients.splice(clientIndex, 1);
      }
    });

    ws.send(JSON.stringify({ type: 'connected' }));
  });
  return httpServer;
}