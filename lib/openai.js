// Shared AI client. We use the OpenAI SDK but point it at Google Gemini's
// OpenAI-compatible endpoint — so the rest of the code never changes, and
// switching AI providers later is just these few lines.
// Returns null until the AI key is set, so the API degrades gracefully
// (friendly canned replies) before the key exists.
import OpenAI from 'openai';

let client = null;

export function getOpenAI() {
  if (client) return client;
  const key = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  client = new OpenAI({
    apiKey: key,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
  return client;
}

// gemini-2.5-flash: fast, free-tier friendly, great for short business chat.
// To change providers/models later, edit the apiKey + baseURL above and this line.
export const MODEL = 'gemini-2.5-flash';
