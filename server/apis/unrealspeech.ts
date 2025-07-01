import axios from "axios";

const API_KEY = process.env.UNREALSPEECH_API_KEY!;

// Language-based voice selection
const VOICE_MAP = {
  ja: "jf_alpha",
  en: "af_bella",
};

/**
 * Naive language detection based on character ranges.
 * You can enhance this with a library like "franc" for production use.
 */
function detectLanguage(text: string): "ja" | "en" {
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(text)) {
    return "ja";
  }
  return "en";
}

/**
 * Converts text to speech using Unreal Speech API.
 * Only uses content before "### 社内文書情報:", and switches voices based on language.
 * @param text Full input text
 * @returns MP3 audio buffer
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  try {
    // Extract only content before "### 社内文書情報:"
    const delimiter = "### 社内文書情報:";
    const filteredText = text.includes(delimiter)
      ? text.split(delimiter)[0].trim()
      : text;

    if (!filteredText) {
      throw new Error("Input text does not contain any content to speak.");
    }

    // Detect language and select voice
    const lang = detectLanguage(filteredText);
    const voiceId = VOICE_MAP[lang];

    const payload = {
      Text: filteredText,
      VoiceId: voiceId,
      Bitrate: "320k",
      AudioFormat: "mp3",
      OutputFormat: "url",
      TimestampType: "sentence",
      sync: false,
    };

    // Step 1: Request speech generation
    const initialRes = await axios.post("https://api.v8.unrealspeech.com/speech", payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const outputUri = initialRes.data?.OutputUri;
    if (!outputUri || typeof outputUri !== "string") {
      console.error("Unreal Speech raw response:", initialRes.data);
      throw new Error("No OutputUri returned from Unreal Speech.");
    }

    // Step 2: Download the generated audio file
    const audioRes = await axios.get(outputUri, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(audioRes.data);
    console.log(`Generated audio buffer: ${buffer.byteLength} bytes`);
    return buffer;

  } catch (error: any) {
    console.error("TTS generation error:", error);
    throw new Error(
      `Failed to generate speech: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
