// POST /api/invite   body: { businessId, email, role }
// Header: Authorization: Bearer <supabase access token>
// Adds a teammate to a business — but only if the requester is an active
// owner/manager of that business (verified from their login token).
import { getSupabase } from '../lib/supabase.js';
import { handledPreflight } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });

  // 1) Who is asking? (validate their login token)
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !userData?.user) return res.status(401).json({ error: 'Please sign in again.' });
  const requesterId = userData.user.id;

  const { businessId, email, role } = req.body || {};
  if (!businessId || !email) return res.status(400).json({ error: 'businessId and email are required' });

  // 2) Is the requester allowed to invite for this business?
  const { data: membership } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_id', businessId)
    .eq('user_id', requesterId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !['owner', 'manager'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only an owner or manager can invite teammates.' });
  }

  // 3) Create the invite (or no-op if they're already on the team)
  const cleanEmail = String(email).toLowerCase().trim();
  const safeRole = role === 'manager' ? 'manager' : 'staff';
  const { error } = await supabase.from('business_members').insert({
    business_id: businessId,
    email: cleanEmail,
    role: safeRole,
    status: 'invited',
  });
  if (error) {
    if (error.code === '23505') return res.status(200).json({ ok: true, note: 'Already on the team.' });
    return res.status(500).json({ error: 'Could not send invite.' });
  }

  // (Next step: email the invitee a link to set up their login.)
  return res.status(200).json({ ok: true });
}
