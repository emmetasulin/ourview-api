// Shared Supabase client. Returns null until SUPABASE_URL + SUPABASE_SERVICE_KEY
// are set, so the API still runs (in demo/fallback mode) before keys are added.
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
