// GET /api/dashboard?id={businessId}
// Returns the numbers + recent items the customer dashboard renders.
// Falls back to demo data when there's no DB or no id (so dashboard.html?id=demo
// shows a populated example without a backend running).
import { getSupabase } from '../lib/supabase.js';
import { handledPreflight } from '../lib/cors.js';

const DEMO = {
  demo: true,
  business: { name: "Marco's Italian Kitchen", plan: 'pro', status: 'active' },
  stats: { leadsCaptured: 34, callsRecovered: 18, newReviews: 11, rating: 4.6 },
  ratingTrend: { google: 4.6, yelp: 4.2 },
  leadInbox: [
    { source: 'call', name: '+1 (805) 447-2291', message: 'Do you have outdoor seating available...', when: '12m ago' },
    { source: 'website_chat', name: 'Priya S.', message: 'Can I make a reservation for 8 people...', when: '1h ago' },
    { source: 'dm', name: 'Instagram DM', message: 'Are you open on Memorial Day weekend?', when: '3h ago' },
  ],
  missedCalls: [
    { number: '+1 (805) 334-7821', when: 'Today · 9:14 AM', status: 'recovered' },
    { number: '+1 (650) 883-2201', when: 'Today · 3:22 PM', status: 'pending' },
  ],
  reviewRequests: [
    { name: 'Maria T.', when: 'Jun 3', stars: 5 },
    { name: 'Sofia K.', when: 'Jun 8', stars: null },
  ],
};

const startOfMonth = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
};

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query.id || req.query.businessId;
  const supabase = getSupabase();
  if (!supabase || !id || id === 'demo') return res.status(200).json(DEMO);

  try {
    const since = startOfMonth();
    const countSince = (table, col) =>
      supabase.from(table).select('id', { count: 'exact', head: true })
        .eq('business_id', id).gte(col, since);

    const [biz, leadsC, callsC, reviewsC, leadInbox, missed, reqs] = await Promise.all([
      supabase.from('businesses').select('name, plan, status').eq('id', id).maybeSingle(),
      countSince('leads', 'captured_at'),
      countSince('missed_calls', 'sent_at'),
      countSince('review_responses', 'responded_at'),
      supabase.from('leads').select('source, name, phone, message, captured_at')
        .eq('business_id', id).order('captured_at', { ascending: false }).limit(6),
      supabase.from('missed_calls').select('caller_number, status, sent_at')
        .eq('business_id', id).order('sent_at', { ascending: false }).limit(6),
      supabase.from('review_requests').select('customer_name, resulting_stars, sent_at')
        .eq('business_id', id).order('sent_at', { ascending: false }).limit(6),
    ]);

    return res.status(200).json({
      demo: false,
      business: biz.data || null,
      stats: {
        leadsCaptured: leadsC.count || 0,
        callsRecovered: callsC.count || 0,
        newReviews: reviewsC.count || 0,
        rating: null,
      },
      leadInbox: (leadInbox.data || []).map((l) => ({
        source: l.source, name: l.name || l.phone, message: l.message, when: l.captured_at,
      })),
      missedCalls: (missed.data || []).map((m) => ({
        number: m.caller_number, status: m.status, when: m.sent_at,
      })),
      reviewRequests: (reqs.data || []).map((r) => ({
        name: r.customer_name, stars: r.resulting_stars, when: r.sent_at,
      })),
    });
  } catch (err) {
    console.error('dashboard error:', err);
    return res.status(200).json(DEMO);
  }
}
