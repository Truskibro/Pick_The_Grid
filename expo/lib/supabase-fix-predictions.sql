-- ============================================================
-- FIX: Predictions never save to Supabase
-- ============================================================
-- Root cause: this database was created with an OLD schema where
-- races.id and user_predictions.race_id are `uuid`, and the
-- user_predictions table is missing the sprint columns. The app
-- uses TEXT race ids ('r01'..'r24'), so every prediction save was
-- rejected by Postgres ("invalid input syntax for type uuid" and
-- "Could not find the column").
--
-- This migration drops the three incompatible tables and recreates
-- them with the correct text-based schema, then re-seeds the races.
--
-- SAFE TO RUN: races/race_results are empty, and user_predictions
-- contains only failed/garbage rows (saves have never succeeded).
-- It does NOT touch profiles, leagues, or league_members.
--
-- HOW TO RUN:
--   1. Open your Supabase dashboard
--   2. Go to SQL Editor -> New query
--   3. Paste this entire file and click "Run"
-- ============================================================

begin;

drop table if exists user_predictions cascade;
drop table if exists race_results cascade;
drop table if exists races cascade;

-- ----------------------------------------------------------------
-- RACES (text ids, matching the app's f1-data.ts)
-- ----------------------------------------------------------------
create table races (
  id text primary key,
  round integer not null,
  name text not null,
  location text not null,
  country text not null,
  country_flag text,
  race_date date not null,
  race_time text,
  status text default 'upcoming' check (status in ('upcoming', 'live', 'completed', 'cancelled')),
  has_sprint boolean default false,
  winner text,
  current_lap integer,
  total_laps integer
);

alter table races enable row level security;
create policy "races_select" on races for select using (true);
create policy "races_insert" on races for insert with check (true);

-- ----------------------------------------------------------------
-- RACE RESULTS
-- ----------------------------------------------------------------
create table race_results (
  id uuid default gen_random_uuid() primary key,
  race_id text references races(id) on delete cascade unique,
  classification jsonb not null default '[]',
  fastest_lap_driver_id text,
  dnf_driver_ids text[] default '{}',
  created_at timestamptz default now()
);

alter table race_results enable row level security;
create policy "race_results_select" on race_results for select using (true);
create policy "race_results_insert" on race_results for insert with check (true);

-- ----------------------------------------------------------------
-- USER PREDICTIONS (text race_id + sprint columns)
-- ----------------------------------------------------------------
create table user_predictions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  race_id text references races(id) on delete cascade not null,
  predicted_top10 text[] not null,
  predicted_fastest_lap text,
  predicted_dnf text,
  points_earned integer default 0,
  predicted_sprint_top8 text[] default '{}',
  sprint_points_earned integer default 0,
  username text,
  display_name text,
  updated_at timestamptz default now(),
  unique(user_id, race_id)
);

alter table user_predictions enable row level security;
create policy "predictions_select_all" on user_predictions for select using (true);
create policy "predictions_insert_auth" on user_predictions for insert with check (auth.role() = 'authenticated');
create policy "predictions_update_auth" on user_predictions for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "predictions_delete_auth" on user_predictions for delete using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- SEED: 2026 Races — matches official F1 2026 calendar
-- Cancelled: Bahrain (r04) and Saudi Arabia (r05)
-- ----------------------------------------------------------------
insert into races (id, round, name, location, country, country_flag, race_date, race_time, status, has_sprint, total_laps) values
  ('r01', 1,  'Australian Grand Prix',     'Melbourne',      'Australia', '🇦🇺', '2026-03-08', '05:00', 'completed', false, 58),
  ('r02', 2,  'Chinese Grand Prix',       'Shanghai',       'China',     '🇨🇳', '2026-03-15', '07:00', 'completed', true,  56),
  ('r03', 3,  'Japanese Grand Prix',      'Suzuka',         'Japan',     '🇯🇵', '2026-03-29', '06:00', 'completed', false, 53),
  ('r04', 4,  'Bahrain Grand Prix',       'Sakhir',         'Bahrain',   '🇧🇭', '2026-04-12', '16:00', 'cancelled', false, 57),
  ('r05', 5,  'Saudi Arabian Grand Prix', 'Jeddah',          'Saudi Arabia', '🇸🇦', '2026-04-19', '18:00', 'cancelled', false, 50),
  ('r06', 6,  'Miami Grand Prix',         'Miami',          'USA',       '🇺🇸', '2026-05-03', '20:00', 'completed', true,  57),
  ('r07', 7,  'Canadian Grand Prix',      'Montreal',       'Canada',    '🇨🇦', '2026-05-24', '18:00', 'completed', true,  70),
  ('r08', 8,  'Monaco Grand Prix',        'Monte Carlo',    'Monaco',    '🇲🇨', '2026-06-07', '13:00', 'upcoming',  false, 78),
  ('r09', 9,  'Spanish Grand Prix',       'Barcelona',       'Spain',     '🇪🇸', '2026-06-14', '13:00', 'upcoming',  false, 66),
  ('r10', 10, 'Austrian Grand Prix',      'Spielberg',      'Austria',   '🇦🇹', '2026-06-28', '13:00', 'upcoming',  false, 71),
  ('r11', 11, 'British Grand Prix',       'Silverstone',    'United Kingdom', '🇬🇧', '2026-07-05', '14:00', 'upcoming', true,  52),
  ('r12', 12, 'Belgian Grand Prix',       'Spa-Francorchamps', 'Belgium', '🇧🇪', '2026-07-19', '13:00', 'upcoming', false, 44),
  ('r13', 13, 'Hungarian Grand Prix',     'Budapest',       'Hungary',   '🇭🇺', '2026-07-26', '13:00', 'upcoming',  false, 70),
  ('r14', 14, 'Dutch Grand Prix',         'Zandvoort',      'Netherlands', '🇳🇱', '2026-08-23', '13:00', 'upcoming', true,  72),
  ('r15', 15, 'Italian Grand Prix',       'Monza',          'Italy',     '🇮🇹', '2026-09-06', '13:00', 'upcoming',  false, 53),
  ('r16', 16, 'Madrid Grand Prix',        'Madrid',         'Spain',     '🇪🇸', '2026-09-13', '13:00', 'upcoming',  false, 55),
  ('r17', 17, 'Azerbaijan Grand Prix',    'Baku',           'Azerbaijan', '🇦🇿', '2026-09-27', '12:00', 'upcoming', false, 51),
  ('r18', 18, 'Singapore Grand Prix',     'Marina Bay',     'Singapore', '🇸🇬', '2026-10-11', '12:00', 'upcoming', true,  62),
  ('r19', 19, 'United States Grand Prix', 'Austin',         'USA',       '🇺🇸', '2026-10-25', '19:00', 'upcoming',  false, 56),
  ('r20', 20, 'Mexico City Grand Prix',   'Mexico City',    'Mexico',    '🇲🇽', '2026-11-01', '20:00', 'upcoming',  false, 71),
  ('r21', 21, 'São Paulo Grand Prix',     'Interlagos',     'Brazil',    '🇧🇷', '2026-11-08', '17:00', 'upcoming',  false, 71),
  ('r22', 22, 'Las Vegas Grand Prix',     'Las Vegas',      'USA',       '🇺🇸', '2026-11-21', '06:00', 'upcoming',  false, 50),
  ('r23', 23, 'Qatar Grand Prix',         'Lusail',         'Qatar',     '🇶🇦', '2026-11-29', '17:00', 'upcoming',  false, 57),
  ('r24', 24, 'Abu Dhabi Grand Prix',     'Yas Marina',     'UAE',       '🇦🇪', '2026-12-06', '14:00', 'upcoming',  false, 58)
on conflict (id) do nothing;

commit;
