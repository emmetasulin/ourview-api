// Shared OpenAI client. Returns null until OPENAI_API_KEY is set, so the API
// degrades gracefully (friendly canned replies) before the key is added.
import OpenAI from 'openai';

let client = null;

export function getOpenAI() {
  if (client) return client;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  client = new OpenAI({ apiKey: key });
  return client;
}

// gpt-4o-mini: cheap + fast, ideal for short business-chat replies.
// Swap to 'gpt-4o', a Claude model, etc. here later — it's the only line to change.
export const MODEL = 'gpt-4o-mini';
