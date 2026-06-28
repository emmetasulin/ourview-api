// POST /api/chat   body: { businessId, message, sessionId }
// returns: { reply, leadCaptured }
//
// This is the endpoint the embeddable widget talks to. It works in three modes:
//   1. No OpenAI key yet      → friendly canned reply (so the widget "works" today)
//   2. Key but unknown biz    → real GPT-4o answer, generic, nothing written to DB
//   3. Key + real businessId  → GPT-4o trained on that business, full lead capture
import { getSupabase } from '../lib/supabase.js';
import { getOpenAI, MODEL } from '../lib/openai.js';
import { handledPreflight } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handledPreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessId, message, sessionId } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });

  const openai = getOpenAI();
  const supabase = getSupabase();

  // Mode 1 — not configured yet
  if (!openai) {
    return res.status(200).json({
      reply: "Thanks for reaching out! Someone from our team will be right with you. " +
             "(Heads up: the AI isn't fully switched on yet — add your OpenAI key to go live.)",
      leadCaptured: false,
    });
  }

  try {
    // Look up the business (if we have a DB + a real id)
    let business = null;
    if (supabase && businessId) {
      const { data } = await supabase
        .from('businesses')
        .select('name, hours, services, faqs, address, phone')
        .eq('id', businessId)
        .maybeSingle();
      business = data || null;
    }
    const biz = business || { name: 'our business' };

    const systemPrompt = `You are a helpful AI assistant for ${biz.name}.

Business hours: ${biz.hours || 'Not provided'}
Services: ${biz.services || 'Not provided'}
Address: ${biz.address || 'Not provided'}
Phone: ${biz.phone || 'Not provided'}
FAQs: ${biz.faqs || 'Not provided'}

Your job:
- Answer questions about the business clearly and briefly (under 3 sentences).
- If someone wants to book, get a quote, or needs follow-up, ask for their name and phone number.
- The moment you have BOTH a name and a phone number, reply with exactly: LEAD_CAPTURED:{name}:{phone}
- Be warm and conversational, never robotic.`;

    // Pull recent history for this session (only if we can)
    let history = [];
    if (supabase && sessionId) {
      const { data } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(20);
      history = (data || []).map((m) => ({ role: m.role, content: m.content }));
    }

    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }],
    });

    let reply = completion.choices?.[0]?.message?.content?.trim() || "Sorry, could you say that again?";
    let leadCaptured = false;

    // Did the AI capture a lead?
    if (reply.includes('LEAD_CAPTURED:')) {
      const parts = reply.split(':');
      const name = (parts[1] || '').trim();
      const phone = (parts[2] || '').trim();
      if (supabase && business) {
        await supabase.from('leads').insert({
          business_id: businessId,
          source: 'website_chat',
          name,
          phone,
          message: history.find((h) => h.role === 'user')?.content || message,
          session_id: sessionId,
        });
      }
      reply = `Got it${name ? `, ${name}` : ''}! We have your info and someone from our team will reach out${phone ? ` at ${phone}` : ''} shortly. 🙌`;
      leadCaptured = true;
    }

    // Persist the turn (only for real businesses)
    if (supabase && business) {
      await supabase.from('chat_messages').insert([
        { session_id: sessionId, business_id: businessId, role: 'user', content: message },
        { session_id: sessionId, business_id: businessId, role: 'assistant', content: reply },
      ]);
    }

    return res.status(200).json({ reply, leadCaptured });
  } catch (err) {
    console.error('chat error:', err);
    // Never hard-fail on the customer's website — degrade to a helpful message
    return res.status(200).json({
      reply: "Sorry, I'm having a little trouble right now — please call us directly and we'll help you out!",
      leadCaptured: false,
    });
  }
}
