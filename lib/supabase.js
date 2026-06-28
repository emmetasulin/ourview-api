// Shared Supabase client. Returns null until SUPABASE_URL + SUPABASE_SERVICE_KEY
// are set, so the API still runs (in demo/fallback mode) before keys are added.
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (client) return client;
  // Trim whitespace and strip any trailing slash. A trailing "/" in the URL
  // creates a double slash in the REST path → PostgREST PGRST125 "invalid path".
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
