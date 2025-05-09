import OpenAI from "openai";

// Create OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to generate mind map structure from a topic
export async function generateMindMap(topic: string): Promise<any> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a mind map generator. Create a hierarchical mind map structure based on the topic provided.
                    Return ONLY a valid JSON array of nodes with the following structure:
                    [
                      { "id": "unique-id", "label": "Node Label", "parentId": null },
                      { "id": "unique-id-2", "label": "Child Node Label", "parentId": "unique-id" },
                      ...
                    ]
                    The root node should have null as parentId.
                    Each node must have a unique id, descriptive label, and parentId linking to parent.
                    Generate a comprehensive mind map with clear hierarchy, at least 3 levels deep with 15-25 total nodes.
                    Focus on creating a logical structure that helps understand the topic.`,
        },
        {
          role: "user",
          content: `Create a mind map for: ${topic}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Parse the response
    const parsed = JSON.parse(content);
    
    // If the response is directly an array, use it
    // Otherwise, check for a nodes field or similar
    const nodes = Array.isArray(parsed) ? parsed : 
                  parsed.nodes ? parsed.nodes : 
                  parsed.mindMap ? parsed.mindMap :
                  parsed.data ? parsed.data : [];
    
    return { nodes };
  } catch (error) {
    console.error("Error generating mind map:", error);
    throw error;
  }
}