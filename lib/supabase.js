// Shared Supabase client. Returns null until SUPABASE_URL + SUPABASE_SERVICE_KEY
// are set, so the API still runs (in demo/fallback mode) before keys are added.
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (client) return client;
  // Normalize the URL: trim whitespace, drop trailing slashes, and remove an
  // accidental "/rest/v1" suffix (a common copy-paste mistake). Without this,
  // the REST path gets doubled → PostgREST PGRST125 "invalid path".
  const url = (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
    .replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
