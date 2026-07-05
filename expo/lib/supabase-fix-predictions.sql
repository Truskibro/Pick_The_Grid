-- ============================================================
-- Apex Draft F1 - Supabase repair for fxwgbpassouaddakgyus
-- ============================================================
-- Purpose:
--   Safely repair the Supabase project currently used by the app:
--   https://fxwgbpassouaddakgyus.supabase.co
--
-- What this fixes:
--   - Adds missing columns on existing tables
--   - Creates user_predictions
--   - Creates user_achievements
--   - Creates/refreshes save_user_prediction()
--   - Rebuilds the needed RLS policies
--   - Refreshes Supabase/PostgREST schema cache
--
-- This script is intentionally NON-DESTRUCTIVE:
--   - It does not drop tables
--   - It does not delete rows
--   - It is safe to re-run
--
-- How to run:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this file -> Run
-- ============================================================

begin;

-- Required for gen_random_uuid().
create extension if not exists pgcrypto;

-- ============================================================
-- 1. PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  country text not null default '',
  push_token text,
  total_points integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists first_name text default '';
alter table public.profiles add column if not exists last_name text default '';
alter table public.profiles add column if not exists country text default '';
alter table public.profiles add column if not exists push_token text;
alter table public.profiles add column if not exists total_points integer default 0;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles
set
  username = coalesce(nullif(btrim(username), ''), 'user_' || substr(id::text, 1, 8)),
  display_name = coalesce(nullif(btrim(display_name), ''), nullif(btrim(username), ''), 'New Player'),
  first_name = coalesce(first_name, ''),
  last_name = coalesce(last_name, ''),
  country = coalesce(country, ''),
  total_points = coalesce(total_points, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.profiles alter column username set not null;
alter table public.profiles alter column display_name set not null;
alter table public.profiles alter column first_name set not null;
alter table public.profiles alter column last_name set not null;
alter table public.profiles alter column country set not null;
alter table public.profiles alter column total_points set default 0;
alter table public.profiles alter column total_points set not null;

create unique index if not exists profiles_username_key on public.profiles(username);

alter table public.profiles enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy profiles_select_all on public.profiles for select using (true);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
  n int := 0;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    '[^a-z0-9_]', '', 'g'
  ));

  if base_username is null or length(base_username) < 3 then
    base_username := 'user_' || substr(new.id::text, 1, 8);
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base_username || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, first_name, last_name, country)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data->>'display_name', candidate),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'country', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- ============================================================
-- 2. TEAMS
-- ============================================================
create table if not exists public.teams (
  id text primary key,
  name text not null,
  color text not null default '#666666',
  short_name text not null
);

alter table public.teams add column if not exists color text default '#666666';
alter table public.teams add column if not exists short_name text;
update public.teams set color = '#666666' where color is null or btrim(color) = '';
update public.teams set short_name = upper(substr(name, 1, 3)) where short_name is null or btrim(short_name) = '';
alter table public.teams alter column color set default '#666666';
alter table public.teams alter column color set not null;
alter table public.teams alter column short_name set not null;

alter table public.teams enable row level security;
drop policy if exists teams_select on public.teams;
drop policy if exists "Teams are viewable by everyone" on public.teams;
create policy teams_select on public.teams for select using (true);

insert into public.teams (id, name, color, short_name) values
  ('red-bull', 'Red Bull Racing', '#3671C6', 'RBR'),
  ('ferrari', 'Scuderia Ferrari', '#E8002D', 'FER'),
  ('mclaren', 'McLaren', '#FF8000', 'MCL'),
  ('mercedes', 'Mercedes-AMG', '#27F4D2', 'MER'),
  ('aston-martin', 'Aston Martin', '#229971', 'AMR'),
  ('alpine', 'Alpine', '#FF87BC', 'ALP'),
  ('williams', 'Williams', '#64C4FF', 'WIL'),
  ('rb', 'RB', '#6692FF', 'RB'),
  ('sauber', 'Kick Sauber', '#52E252', 'SAU'),
  ('haas', 'Haas', '#B6BABD', 'HAA')
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  short_name = excluded.short_name;

-- ============================================================
-- 3. DRIVERS
-- ============================================================
create table if not exists public.drivers (
  id text primary key,
  name text not null,
  short_name text not null,
  number integer,
  team_id text references public.teams(id),
  championship_points integer default 0
);

alter table public.drivers add column if not exists short_name text;
alter table public.drivers add column if not exists number integer;
alter table public.drivers add column if not exists team_id text references public.teams(id);
alter table public.drivers add column if not exists championship_points integer default 0;
update public.drivers set short_name = id where short_name is null or btrim(short_name) = '';
update public.drivers set championship_points = 0 where championship_points is null;
alter table public.drivers alter column short_name set not null;
alter table public.drivers alter column championship_points set default 0;

alter table public.drivers enable row level security;
drop policy if exists drivers_select on public.drivers;
drop policy if exists "Drivers are viewable by everyone" on public.drivers;
create policy drivers_select on public.drivers for select using (true);

insert into public.drivers (id, name, short_name, number, team_id, championship_points) values
  ('VER', 'Max Verstappen', 'VER', 1, 'red-bull', 437),
  ('NOR', 'Lando Norris', 'NOR', 4, 'mclaren', 374),
  ('LEC', 'Charles Leclerc', 'LEC', 16, 'ferrari', 356),
  ('PIA', 'Oscar Piastri', 'PIA', 81, 'mclaren', 292),
  ('HAM', 'Lewis Hamilton', 'HAM', 44, 'ferrari', 223),
  ('RUS', 'George Russell', 'RUS', 63, 'mercedes', 217),
  ('SAI', 'Carlos Sainz', 'SAI', 55, 'williams', 184),
  ('GAS', 'Pierre Gasly', 'GAS', 10, 'alpine', 120),
  ('ALO', 'Fernando Alonso', 'ALO', 14, 'aston-martin', 70),
  ('TSU', 'Yuki Tsunoda', 'TSU', 22, 'rb', 30),
  ('HUL', 'Nico Hulkenberg', 'HUL', 27, 'sauber', 26),
  ('LAW', 'Liam Lawson', 'LAW', 30, 'red-bull', 22),
  ('ALB', 'Alex Albon', 'ALB', 23, 'williams', 12),
  ('STR', 'Lance Stroll', 'STR', 18, 'aston-martin', 10),
  ('BEA', 'Oliver Bearman', 'BEA', 87, 'haas', 7),
  ('OCO', 'Esteban Ocon', 'OCO', 31, 'haas', 5),
  ('DOO', 'Jack Doohan', 'DOO', 7, 'alpine', 3),
  ('ANT', 'Kimi Antonelli', 'ANT', 12, 'mercedes', 2),
  ('HAD', 'Isack Hadjar', 'HAD', 6, 'rb', 0),
  ('BOR', 'Gabriel Bortoleto', 'BOR', 5, 'sauber', 0)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  number = excluded.number,
  team_id = excluded.team_id,
  championship_points = excluded.championship_points;

-- ============================================================
-- 4. RACES
-- ============================================================
create table if not exists public.races (
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

alter table public.races add column if not exists has_sprint boolean default false;
alter table public.races add column if not exists winner text;
alter table public.races add column if not exists current_lap integer;
alter table public.races add column if not exists total_laps integer;
alter table public.races enable row level security;
drop policy if exists races_select on public.races;
drop policy if exists "Races are viewable by everyone" on public.races;
create policy races_select on public.races for select using (true);

insert into public.races (id, round, name, location, country, country_flag, race_date, race_time, status, has_sprint, total_laps) values
  ('r01', 1,  'Australian Grand Prix',     'Melbourne',      'Australia', '🇦🇺', '2026-03-08', '05:00', 'completed', false, 58),
  ('r02', 2,  'Chinese Grand Prix',       'Shanghai',       'China',     '🇨🇳', '2026-03-15', '07:00', 'completed', true,  56),
  ('r03', 3,  'Japanese Grand Prix',      'Suzuka',         'Japan',     '🇯🇵', '2026-03-29', '06:00', 'completed', false, 53),
  ('r04', 4,  'Bahrain Grand Prix',       'Sakhir',         'Bahrain',   '🇧🇭', '2026-04-12', '16:00', 'cancelled', false, 57),
  ('r05', 5,  'Saudi Arabian Grand Prix', 'Jeddah',         'Saudi Arabia', '🇸🇦', '2026-04-19', '18:00', 'cancelled', false, 50),
  ('r06', 6,  'Miami Grand Prix',         'Miami',          'USA',       '🇺🇸', '2026-05-03', '20:00', 'completed', true,  57),
  ('r07', 7,  'Canadian Grand Prix',      'Montreal',       'Canada',    '🇨🇦', '2026-05-24', '18:00', 'completed', true,  70),
  ('r08', 8,  'Monaco Grand Prix',        'Monte Carlo',    'Monaco',    '🇲🇨', '2026-06-07', '13:00', 'upcoming',  false, 78),
  ('r09', 9,  'Spanish Grand Prix',       'Barcelona',      'Spain',     '🇪🇸', '2026-06-14', '13:00', 'upcoming',  false, 66),
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
on conflict (id) do update set
  round = excluded.round,
  name = excluded.name,
  location = excluded.location,
  country = excluded.country,
  country_flag = excluded.country_flag,
  race_date = excluded.race_date,
  race_time = excluded.race_time,
  status = excluded.status,
  has_sprint = excluded.has_sprint,
  total_laps = excluded.total_laps;

-- ============================================================
-- 5. RACE RESULTS
-- ============================================================
create table if not exists public.race_results (
  id uuid default gen_random_uuid() primary key,
  race_id text references public.races(id) on delete cascade unique,
  classification jsonb not null default '[]',
  fastest_lap_driver_id text,
  dnf_driver_ids text[] default '{}',
  created_at timestamptz default now()
);

alter table public.race_results enable row level security;
drop policy if exists race_results_select on public.race_results;
drop policy if exists "Race results are viewable by everyone" on public.race_results;
create policy race_results_select on public.race_results for select using (true);

-- ============================================================
-- 6. LEAGUES
-- ============================================================
create table if not exists public.leagues (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '',
  visibility text default 'public' check (visibility in ('public', 'private')),
  join_code text unique not null,
  member_count integer default 1,
  created_at timestamptz default now()
);

alter table public.leagues add column if not exists member_count integer default 1;
update public.leagues set member_count = 1 where member_count is null;
alter table public.leagues alter column member_count set default 1;

alter table public.leagues enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'leagues' loop
    execute format('drop policy if exists %I on public.leagues', pol.policyname);
  end loop;
end $$;
create policy leagues_select on public.leagues for select using (true);
create policy leagues_insert on public.leagues for insert with check (auth.uid() = owner_id);
create policy leagues_update on public.leagues for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy leagues_delete on public.leagues for delete using (auth.uid() = owner_id);

-- ============================================================
-- 7. LEAGUE MEMBERS
-- ============================================================
create table if not exists public.league_members (
  id uuid default gen_random_uuid() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  user_id uuid not null,
  role text default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

-- Repoint league_members.user_id to profiles(id) so embedded profile reads work.
do $$
declare con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.league_members'::regclass
      and contype = 'f'
      and conname like '%user_id%'
  loop
    execute format('alter table public.league_members drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.league_members
  add constraint league_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.league_members enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'league_members' loop
    execute format('drop policy if exists %I on public.league_members', pol.policyname);
  end loop;
end $$;
create policy lm_select on public.league_members for select using (true);
create policy lm_insert on public.league_members for insert with check (auth.uid() = user_id);
create policy lm_delete on public.league_members for delete using (auth.uid() = user_id);

-- ============================================================
-- 8. USER ACHIEVEMENTS
-- ============================================================
create table if not exists public.user_achievements (
  user_id uuid references auth.users(id) on delete cascade not null,
  achievement_id text not null,
  unlocked_tiers text[] default '{}',
  current_value integer default 0,
  unlocked_at jsonb default '{}',
  updated_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;
drop policy if exists achievements_select_own on public.user_achievements;
drop policy if exists achievements_select_all on public.user_achievements;
drop policy if exists achievements_insert_own on public.user_achievements;
drop policy if exists achievements_update_own on public.user_achievements;
drop policy if exists achievements_delete_own on public.user_achievements;
-- Achievements are public (shown on profiles). Only the owner can modify.
create policy achievements_select_all on public.user_achievements for select using (true);
create policy achievements_insert_own on public.user_achievements for insert with check (auth.uid() = user_id);
create policy achievements_update_own on public.user_achievements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy achievements_delete_own on public.user_achievements for delete using (auth.uid() = user_id);

-- ============================================================
-- 9. USER PREDICTIONS
-- ============================================================
create table if not exists public.user_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_id text not null references public.races(id) on delete cascade,
  username text not null,
  display_name text not null,
  predicted_top10 text[] not null default '{}',
  predicted_fastest_lap text,
  predicted_dnf text,
  points_earned integer not null default 0,
  predicted_sprint_top8 text[] not null default '{}',
  sprint_points_earned integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_predictions_user_race_key unique (user_id, race_id),
  constraint user_predictions_top10_length check (array_length(predicted_top10, 1) is null or array_length(predicted_top10, 1) <= 10),
  constraint user_predictions_sprint_top8_length check (array_length(predicted_sprint_top8, 1) is null or array_length(predicted_sprint_top8, 1) <= 8)
);

create index if not exists user_predictions_user_id_idx on public.user_predictions(user_id);
create index if not exists user_predictions_race_id_idx on public.user_predictions(race_id);
create index if not exists user_predictions_updated_at_idx on public.user_predictions(updated_at desc);

alter table public.user_predictions enable row level security;
drop policy if exists predictions_select_all on public.user_predictions;
drop policy if exists predictions_insert_own on public.user_predictions;
drop policy if exists predictions_update_own on public.user_predictions;
drop policy if exists predictions_delete_own on public.user_predictions;
drop policy if exists predictions_insert_auth on public.user_predictions;
drop policy if exists predictions_update_auth on public.user_predictions;
drop policy if exists predictions_delete_auth on public.user_predictions;
create policy predictions_select_all on public.user_predictions for select using (true);
create policy predictions_insert_own on public.user_predictions for insert with check (auth.uid() = user_id);
create policy predictions_update_own on public.user_predictions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy predictions_delete_own on public.user_predictions for delete using (auth.uid() = user_id);

create or replace function public.prepare_user_prediction_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_username text;
  profile_display_name text;
begin
  select p.username, p.display_name
    into profile_username, profile_display_name
  from public.profiles p
  where p.id = new.user_id;

  new.username := coalesce(nullif(btrim(new.username), ''), nullif(btrim(profile_username), ''), 'user_' || substr(new.user_id::text, 1, 8));
  new.display_name := coalesce(nullif(btrim(new.display_name), ''), nullif(btrim(profile_display_name), ''), new.username);
  new.predicted_top10 := coalesce(new.predicted_top10, '{}');
  new.predicted_sprint_top8 := coalesce(new.predicted_sprint_top8, '{}');
  new.points_earned := coalesce(new.points_earned, 0);
  new.sprint_points_earned := coalesce(new.sprint_points_earned, 0);
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists user_predictions_prepare_names on public.user_predictions;
create trigger user_predictions_prepare_names
  before insert or update on public.user_predictions
  for each row execute function public.prepare_user_prediction_names();

drop function if exists public.save_user_prediction(text, text[], text, text, integer, text[], integer);
drop function if exists public.save_user_prediction(text, text[], text, text, integer, text[], integer, text, text);

create or replace function public.save_user_prediction(
  p_race_id text,
  p_predicted_top10 text[],
  p_predicted_fastest_lap text default null,
  p_predicted_dnf text default null,
  p_points_earned integer default 0,
  p_predicted_sprint_top8 text[] default '{}',
  p_sprint_points_earned integer default 0,
  p_username text default null,
  p_display_name text default null
)
returns public.user_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  profile_username text;
  profile_display_name text;
  next_username text;
  next_display_name text;
  saved_row public.user_predictions;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select p.username, p.display_name
    into profile_username, profile_display_name
  from public.profiles p
  where p.id = current_user_id;

  next_username := coalesce(nullif(btrim(p_username), ''), nullif(btrim(profile_username), ''), 'user_' || substr(current_user_id::text, 1, 8));
  next_display_name := coalesce(nullif(btrim(p_display_name), ''), nullif(btrim(profile_display_name), ''), next_username);

  insert into public.user_predictions (
    user_id,
    race_id,
    username,
    display_name,
    predicted_top10,
    predicted_fastest_lap,
    predicted_dnf,
    points_earned,
    predicted_sprint_top8,
    sprint_points_earned
  )
  values (
    current_user_id,
    p_race_id,
    next_username,
    next_display_name,
    coalesce(p_predicted_top10, '{}'),
    p_predicted_fastest_lap,
    p_predicted_dnf,
    coalesce(p_points_earned, 0),
    coalesce(p_predicted_sprint_top8, '{}'),
    coalesce(p_sprint_points_earned, 0)
  )
  on conflict (user_id, race_id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    predicted_top10 = excluded.predicted_top10,
    predicted_fastest_lap = excluded.predicted_fastest_lap,
    predicted_dnf = excluded.predicted_dnf,
    points_earned = excluded.points_earned,
    predicted_sprint_top8 = excluded.predicted_sprint_top8,
    sprint_points_earned = excluded.sprint_points_earned
  returning * into saved_row;

  return saved_row;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.teams to anon, authenticated;
grant select on public.drivers to anon, authenticated;
grant select on public.races to anon, authenticated;
grant select on public.race_results to anon, authenticated;
grant select on public.leagues to anon, authenticated;
grant select on public.league_members to anon, authenticated;
grant select on public.user_predictions to anon, authenticated;
grant insert, update, delete on public.user_predictions to authenticated;
grant select, insert, update, delete on public.user_achievements to authenticated;
grant execute on function public.save_user_prediction(text, text[], text, text, integer, text[], integer, text, text) to authenticated;

-- ============================================================
-- 10. NOTIFICATION LOG
-- ============================================================
create table if not exists public.notification_log (
  id uuid default gen_random_uuid() primary key,
  race_id text not null,
  sent_at timestamptz default now(),
  recipient_count integer default 0
);

alter table public.notification_log enable row level security;
drop policy if exists "Anyone can read notification_log" on public.notification_log;
drop policy if exists "Service can insert notification_log" on public.notification_log;
create policy "Anyone can read notification_log" on public.notification_log for select using (true);
create policy "Service can insert notification_log" on public.notification_log for insert with check (true);

-- Tell PostgREST to refresh tables/functions immediately.
notify pgrst, 'reload schema';

commit;
