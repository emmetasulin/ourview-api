// POST /api/onboarding
// Receives the 4-step onboarding form payload and creates the business record.
// Payload keys match ourview-onboarding.html exactly.
import { getSupabase } from '../lib/supabase.js';
import { handledPreflight } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const p = req.body || {};
  if (!p.name || !p.email) {
    return res.status(400).json({ error: 'Business name and email are required' });
  }

  const supabase = getSupabase();
  // No DB yet — accept it so the form still shows its success screen.
  if (!supabase) {
    return res.status(200).json({ ok: true, note: 'Supabase not connected yet — not persisted.' });
  }

  // If the request is signed in, we'll make that user the business owner.
  let ownerUserId = null;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token) {
    const { data: u } = await supabase.auth.getUser(token);
    ownerUserId = u?.user?.id || null;
  }

  const row = {
    name: p.name,
    owner_name: p.owner || null,
    owner_email: p.email,
    phone: p.phone || null,
    business_type: p.type || null,
    website: p.website || null,
    address: p.address || null,
    hours: p.hours || null,
    services: p.services || null,
    faqs: p.faqs || null,
    notes: p.notes || null,
    gmb_url: p.gmb || null,
    instagram_handle: p.instagram || null,
    tiktok_handle: p.tiktok || null,
    yelp_url: p.yelp || null,
    status: 'onboarding',
    onboarded_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.from('businesses').insert(row).select('id').single();
    if (error) throw error;
    const businessId = data.id;

    // Make the signed-in creator the OWNER, so they can log into this dashboard.
    if (ownerUserId) {
      await supabase.from('business_members').insert({
        business_id: businessId,
        user_id: ownerUserId,
        email: String(p.email).toLowerCase().trim(),
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      });
    }
    return res.status(200).json({ ok: true, businessId });
  } catch (err) {
    console.error('onboarding error:', err);
    return res.status(500).json({ error: 'Could not save onboarding' });
  }
}
