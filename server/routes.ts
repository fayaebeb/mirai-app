import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertMessageSchema, insertNoteSchema, insertGoalSchema } from "@shared/schema";
import { generateMindMap } from "./services/openai";
import { openai } from './openaiClient';

function formatBotResponse(text: string): string {
  return text.replace(/\\n/g, '\n').trim();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Add a dedicated goal tracker chat endpoint
  app.post("/api/goal-chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Use a different session ID pattern for goal chat to ensure separation from regular chat
    const goalSessionId = `goal_${req.user!.id}_${req.user!.username}`;
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

        return `${goal.description} ${goal.completed ? "[COMPLETED]" : "[ACTIVE]"} - Created: ${createdDate}, Last Updated: ${updatedDate}${dueDateStr}`;
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
  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Use the full username as the session ID to ensure uniqueness across users
    const persistentSessionId = `user_${req.user!.id}_${req.user!.username}`;
    const userContent = req.body.content;

    try {
      // Check if the session with the specific ID exists first
      const existingUserSession = await storage.getSessionBySessionId(persistentSessionId);
      if (!existingUserSession) {
        console.log(`Creating new session for user ${req.user!.id} with sessionId ${persistentSessionId}`);
        await storage.createUserSession(req.user!.id, persistentSessionId);
      }

      // Save the user message
      const userMessage = await storage.createMessage(req.user!.id, {
        content: userContent,
        isBot: false,
        sessionId: persistentSessionId,
      });

  app.get("/api/goal-messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const goalSessionId = `goal_${req.user!.id}_${req.user!.username}`;

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
      const goalSessionId = `goal_${req.user!.id}_${req.user!.username}`;

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

  app.post("/api/chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Use the full username as the session ID to ensure uniqueness across users
      const persistentSessionId = `user_${req.user!.id}_${req.user!.username}`;

    const result = insertMessageSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Invalid request body:", result.error);
      return res.status(400).json({ error: "Invalid request data" });
    }

    const body = result.data;

    try {
      const existingUserSession = await storage.getSessionBySessionId(persistentSessionId);
      if (!existingUserSession) {
        console.log(`Creating new session for user ${req.user!.id} with sessionId ${persistentSessionId}`);
        await storage.createUserSession(req.user!.id, persistentSessionId);
      }

      await storage.createMessage(req.user!.id, {
        ...body,
        isBot: false,
        sessionId: persistentSessionId,
      });

      console.log(`Sending request to Langchain API: ${body.content}`);
      const response = await fetch(LANGFLOW_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: body.content,
          useweb: true,
          usedb: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Mirai API Error:", errorText);
        throw new Error(`Mirai API responded with status ${response.status}`);
      }

      const aiResponse = await response.json();
      const aiOutputText = aiResponse.reply;

      if (!aiOutputText) {
        throw new Error("Missing 'reply' in AI response");
      }

      const formattedResponse = formatBotResponse(aiOutputText);

      const botMessage = await storage.createMessage(req.user!.id, {
        content: formattedResponse,
        isBot: true,
        sessionId: persistentSessionId,
      });

      res.json(botMessage);
    } catch (error) {
      console.error("Error in /api/messages:", error);
      res.status(500).json({
        message: "Failed to process message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/messages/:sessionId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // Use the full username as the session ID to ensure uniqueness across users
      const persistentSessionId = `user_${req.user!.id}_${req.user!.username}`;

      // Check if the session with the specific ID exists first
      const existingUserSession = await storage.getSessionBySessionId(persistentSessionId);
      if (!existingUserSession) {
        console.log(`Creating new session for user ${req.user!.id} with sessionId ${persistentSessionId}`);
        await storage.createUserSession(req.user!.id, persistentSessionId);
      }

      const messages = await storage.getMessagesByUserAndSession(
        req.user!.id,
        persistentSessionId
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
      const notesSessionId = `notes_${req.user!.id}_${req.user!.username}`;

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
      const notesSessionId = `notes_${req.user!.id}_${req.user!.username}`;

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
    const notesSessionId = `notes_${req.user!.id}_${req.user!.username}`;
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


  const httpServer = createServer(app);
  return httpServer;
}