-- ════════════════════════════════════════════════════════════
-- ARCADE ZONE — Supabase SQL Setup
-- Run this entire file in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rcyxjalllqatqddeztvv/sql/new
-- ════════════════════════════════════════════════════════════

-- 1. Battle rooms (for multiplayer)
create table if not exists az_rooms (
  code        text primary key,
  game        text not null,
  seed        text not null,
  difficulty  text default 'medium',
  status      text default 'waiting',
  p1_id       text, p1_name text,
  p1_score    int  default 0, p1_done bool default false,
  p2_id       text, p2_name text,
  p2_score    int  default 0, p2_done bool default false,
  created_at  timestamptz default now()
);

-- 2. Global leaderboard scores
create table if not exists az_scores (
  id          uuid primary key default gen_random_uuid(),
  game        text not null,
  player_id   text not null,
  player_name text not null,
  score       int  not null,
  meta        jsonb default '{}',
  created_at  timestamptz default now()
);

-- 3. Player data sync (cross-device progress)
create table if not exists player_data (
  user_id    text primary key,
  data       jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Row Level Security (allow public anonymous access)
alter table az_rooms    enable row level security;
alter table az_scores   enable row level security;
alter table player_data enable row level security;

create policy "az_rooms_all"   on az_rooms    for all using (true) with check (true);
create policy "az_scores_all"  on az_scores   for all using (true) with check (true);
create policy "pd_select"      on player_data for select using (true);
create policy "pd_insert"      on player_data for insert with check (true);
create policy "pd_update"      on player_data for update using (true);

-- Done! All 3 tables created.
