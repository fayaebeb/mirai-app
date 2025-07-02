import axios from "axios";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export async function textToSpeechStream(text: string, voiceId: string = "nova") {
  // Truncate input text at the "### 社内文書情報:" marker
  const cutoffIndex = text.indexOf("### 社内文書情報:");
  const truncatedText = cutoffIndex !== -1 ? text.slice(0, cutoffIndex) : text;

  return axios.post(
    "https://api.openai.com/v1/audio/speech",
    {
      model: "gpt-4o-mini-tts",
      input: truncatedText,
      voice: voiceId,
      response_format: "wav", // For low-latency, real-time audio
    },
    {
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
}
