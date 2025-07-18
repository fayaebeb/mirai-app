import type { Request, Response } from "express";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const suggestHandler = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Invalid or empty message." });
    }

    const prompt = `You generate suggestions for possible next messages the user might want to send next based on a single user input.
The user's message is: "${message}"

Respond ONLY with a JSON array of 3 short, self-contained suggestions that the user might want to send next.
These suggestions should not assume any prior conversation or context, and they should be simple statements or questions that the user would send next.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const raw = completion.choices[0].message.content || "";

    let suggestions: string[] = [];

    // Try to extract the first valid JSON array from the response
    const jsonMatch = raw.match(/\[.*?\]/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          suggestions = parsed.map(item => String(item).trim()).slice(0, 3);
        }
      } catch (err) {
        console.error("JSON.parse failed:", err);
        return res.status(500).json({ error: "Failed to parse AI JSON output." });
      }
    } else {
      console.error("No valid JSON array found in OpenAI response:", raw);
      return res.status(500).json({ error: "AI response did not contain a valid JSON array." });
    }

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error("Suggest handler error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};