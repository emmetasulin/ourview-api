-- ourview.io — Supabase schema
-- Run this once in Supabase → SQL Editor → New query → Run.
--
-- Reconciled from the partner's integrations file + the onboarding form.
-- Changes vs the original draft:
--   • businesses extended to capture EVERY field the onboarding form collects
--     (owner_name, business_type, website, notes, tiktok_handle, yelp_url, gmb_url, etc.)
--   • added a review_requests table to power the dashboard's "Review Requests" panel
--   • added a status column + onboarded_at so we can tell onboarding vs active

-- ============================================================
-- BUSINESSES
-- ============================================================
create table if not exists businesses (
  id                      uuid primary key default gen_random_uuid(),

  -- Onboarding step 1: basics
  name                    text not null,
  owner_name              text,
  owner_email             text not null,
  phone                   text,
  business_type           text,          -- 'Restaurant', 'Salon', 'Auto Detailing', ...
  website                 text,

  -- Onboarding step 2: location & hours
  address                 text,
  hours                   text,          -- newline-delimited, e.g. "Monday: 09:00 – 18:00"

  -- Onboarding step 3: services & FAQs
  services                text,
  faqs                    text,
  notes                   text,          -- "anything else the AI should know"

  -- Onboarding step 4: socials & review links (as typed by the owner)
  gmb_url                 text,
  instagram_handle        text,
  tiktok_handle           text,
  yelp_url                text,

  -- Connected integration IDs/tokens (filled in later via OAuth / setup)
  twilio_number           text,
  gmb_account_id          text,
  gmb_location_id         text,
  gmb_access_token        text,
  gmb_refresh_token       text,
  instagram_account_id    text,
  instagram_access_token  text,

  -- Billing
  plan                    text default 'starter',   -- 'starter' | 'growth' | 'pro'
  stripe_customer_id      text,
  stripe_subscription_id  text,

  status                  text default 'onboarding', -- 'onboarding' | 'active' | 'paused'
  created_at              timestamptz default now(),
  onboarded_at            timestamptz
);

-- ============================================================
-- MISSED CALLS  (Twilio text-back)
-- ============================================================
create table if not exists missed_calls (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid references businesses(id) on delete cascade,
  caller_number  text,
  call_sid       text,
  text_sent      text,
  status         text default 'recovered',  -- 'recovered' | 'pending'
  sent_at        timestamptz default now()
);

-- ============================================================
-- CHAT MESSAGES  (website widget transcript)
-- ============================================================
create table if not exists chat_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   text,
  business_id  uuid references businesses(id) on delete cascade,
  role         text,   -- 'user' | 'assistant'
  content      text,
  created_at   timestamptz default now()
);

-- ============================================================
-- LEADS  (captured from chat, DMs, or calls)
-- ============================================================
create table if not exists leads (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references businesses(id) on delete cascade,
  source       text,   -- 'website_chat' | 'dm' | 'call'
  name         text,
  phone        text,
  message      text,   -- what they wanted (for the dashboard's lead inbox)
  session_id   text,
  status       text default 'new',  -- 'new' | 'contacted' | 'won'
  captured_at  timestamptz default now()
);

-- ============================================================
-- REVIEW RESPONSES  (auto-replied Google/Yelp reviews)
-- ============================================================
create table if not exists review_responses (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid references businesses(id) on delete cascade,
  review_id      text unique,
  platform       text default 'google',  -- 'google' | 'yelp'
  review_text    text,
  star_rating    text,
  response_text  text,
  responded_at   timestamptz default now()
);

-- ============================================================
-- DM RESPONSES  (Instagram / TikTok auto-replies)
-- ============================================================
create table if not exists dm_responses (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid references businesses(id) on delete cascade,
  platform          text,   -- 'instagram' | 'tiktok'
  sender_id         text,
  incoming_message  text,
  reply_sent        text,
  responded_at      timestamptz default now()
);

-- ============================================================
-- REVIEW REQUESTS  (Pro: text customers asking for a review)
-- Powers the dashboard "Review Requests" panel.
-- ============================================================
create table if not exists review_requests (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references businesses(id) on delete cascade,
  customer_name   text,
  customer_phone  text,
  status          text default 'sent',  -- 'sent' | 'responded' | 'awaiting'
  resulting_stars int,
  sent_at         timestamptz default now()
);

-- ============================================================
-- INDEXES (fast dashboard queries)
-- ============================================================
create index if not exists idx_leads_biz_time            on leads(business_id, captured_at desc);
create index if not exists idx_missed_calls_biz_time     on missed_calls(business_id, sent_at desc);
create index if not exists idx_chat_messages_session     on chat_messages(session_id, created_at);
create index if not exists idx_review_responses_biz_time on review_responses(business_id, responded_at desc);
create index if not exists idx_dm_responses_biz_time     on dm_responses(business_id, responded_at desc);
create index if not exists idx_review_requests_biz_time  on review_requests(business_id, sent_at desc);

-- ============================================================
-- SECURITY NOTE
-- The backend talks to Supabase with the SERVICE key, which bypasses RLS.
-- Keep SUPABASE_SERVICE_KEY server-side only (Vercel env var) — never ship it
-- to the browser. The customer dashboard reads data through the backend
-- (/api/dashboard), not directly from Supabase, so RLS can stay simple for v1.
