// TEMP diagnostic endpoint — delete after we fix the DB connection.
// GET /api/debug  → shows what the backend sees for the Supabase config
// (URL is not secret; key is shown as a short prefix only).
import { getSupabase } from '../lib/supabase.js';
import { handledPreflight } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;

  const rawUrl = process.env.SUPABASE_URL || null;
  const out = {
    supabaseUrl: rawUrl,
    supabaseUrlLength: (rawUrl || '').length,
    serviceKeyPrefix: (process.env.SUPABASE_SERVICE_KEY || '').slice(0, 14),
    serviceKeyLength: (process.env.SUPABASE_SERVICE_KEY || '').length,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  };

  const supabase = getSupabase();
  if (!supabase) {
    out.test = 'no supabase client (missing env vars)';
    return res.status(200).json(out);
  }

  const { data, error } = await supabase.from('businesses').select('id').limit(1);
  out.test = error
    ? { ok: false, message: error.message, code: error.code, details: error.details, hint: error.hint }
    : { ok: true, rowsReturned: (data || []).length };

  return res.status(200).json(out);
}
