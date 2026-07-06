-- ============================================
-- Apex Draft F1 - Supabase Schema
-- Run this in your Supabase SQL Editor.
-- Safe to re-run: drops & recreates profile/league_member rules cleanly.
-- ============================================

-- ============================================
-- 1. PROFILES (rebuilt cleanly)
-- ============================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
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

-- Ensure columns exist if the table was created with an older schema
alter table profiles add column if not exists updated_at timestamptz default now();
alter table profiles add column if not exists total_points integer default 0;
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists first_name text default '';
alter table profiles add column if not exists last_name text default '';
alter table profiles add column if not exists country text default '';
alter table profiles add column if not exists push_token text;
alter table profiles alter column total_points set default 0;
update profiles set total_points = 0 where total_points is null;
alter table profiles alter column total_points set not null;
update profiles set display_name = username where display_name is null;
alter table profiles alter column display_name set not null;
update profiles set first_name = '' where first_name is null;
update profiles set last_name = '' where last_name is null;
update profiles set country = '' where country is null;

alter table profiles enable row level security;

-- Drop ALL old policies on profiles to avoid duplicates
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'profiles' loop
    execute format('drop policy if exists %I on profiles', pol.policyname);
  end loop;
end $$;

create policy "profiles_select_all"  on profiles for select using (true);
create policy "profiles_insert_own"  on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- updated_at touch trigger
create or replace function public.set_profile_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute procedure public.set_profile_updated_at();

-- Auto-create profile ONLY after the user's email is confirmed.
-- This prevents "phantom" profiles for accounts that never finished verification.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_username text;
  candidate text;
  n int := 0;
begin
  -- Only create a profile once the user has confirmed their email.
  if new.email_confirmed_at is null then
    return new;
  end if;

  -- If a profile already exists for this user, do nothing.
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
$$ language plpgsql security definer;

-- Fire on insert (covers providers that confirm immediately) and on update
-- to email_confirmed_at (covers the standard email-verification flow).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute procedure public.handle_new_user();

-- Backfill profiles for any CONFIRMED auth users missing one (safety net).
-- Unconfirmed users are intentionally skipped — no profile until verification.
insert into public.profiles (id, username, display_name, first_name, last_name, country)
select
  u.id,
  'user_' || substr(u.id::text, 1, 8),
  coalesce(u.raw_user_meta_data->>'display_name', 'New Player'),
  coalesce(u.raw_user_meta_data->>'first_name', ''),
  coalesce(u.raw_user_meta_data->>'last_name', ''),
  coalesce(u.raw_user_meta_data->>'country', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email_confirmed_at is not null
on conflict (id) do nothing;

-- ============================================
-- 2. TEAMS
-- ============================================
create table if not exists teams (
  id text primary key,
  name text not null,
  color text not null,
  short_name text not null
);

alter table teams add column if not exists color text default '#666666';
alter table teams add column if not exists short_name text;
update teams set color = '#666666' where color is null or btrim(color) = '';
update teams set short_name = upper(substr(name, 1, 3)) where short_name is null or btrim(short_name) = '';
alter table teams alter column color set not null;
alter table teams alter column short_name set not null;

alter table teams enable row level security;
drop policy if exists "Teams are viewable by everyone" on teams;
drop policy if exists "teams_select" on teams;
create policy "teams_select" on teams for select using (true);

-- ============================================
-- 3. DRIVERS
-- ============================================
create table if not exists drivers (
  id text primary key,
  name text not null,
  short_name text not null,
  number integer,
  team_id text references teams(id),
  championship_points integer default 0
);

alter table drivers add column if not exists short_name text;
alter table drivers add column if not exists number integer;
alter table drivers add column if not exists team_id text references teams(id);
alter table drivers add column if not exists championship_points integer default 0;
update drivers set short_name = id where short_name is null or btrim(short_name) = '';
update drivers set championship_points = 0 where championship_points is null;
alter table drivers alter column short_name set not null;
alter table drivers alter column championship_points set default 0;

alter table drivers enable row level security;
drop policy if exists "Drivers are viewable by everyone" on drivers;
drop policy if exists "drivers_select" on drivers;
create policy "drivers_select" on drivers for select using (true);

-- ============================================
-- 4. RACES
-- ============================================
create table if not exists races (
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

alter table races add column if not exists has_sprint boolean default false;

alter table races enable row level security;
drop policy if exists "Races are viewable by everyone" on races;
drop policy if exists "races_select" on races;
create policy "races_select" on races for select using (true);

-- ============================================
-- 5. RACE RESULTS
-- ============================================
create table if not exists race_results (
  id uuid default gen_random_uuid() primary key,
  race_id text references races(id) on delete cascade unique,
  classification jsonb not null default '[]',
  fastest_lap_driver_id text,
  dnf_driver_ids text[] default '{}',
  dns_driver_ids text[] default '{}',
  sprint_classification jsonb,
  created_at timestamptz default now()
);

alter table race_results add column if not exists dns_driver_ids text[] default '{}';
alter table race_results add column if not exists sprint_classification jsonb;

alter table race_results enable row level security;
drop policy if exists "Race results are viewable by everyone" on race_results;
drop policy if exists "race_results_select" on race_results;
create policy "race_results_select" on race_results for select using (true);

-- ============================================
-- 6. USER PREDICTIONS
-- ============================================
drop function if exists public.save_user_prediction(text, text[], text, text, integer, text[], integer);
drop function if exists public.save_user_prediction(text, text[], text, text, integer, text[], integer, text, text);
drop trigger if exists user_predictions_prepare_names on public.user_predictions;
drop function if exists public.prepare_user_prediction_names();
drop table if exists public.user_predictions cascade;

create table public.user_predictions (
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

create index user_predictions_user_id_idx on public.user_predictions(user_id);
create index user_predictions_race_id_idx on public.user_predictions(race_id);
create index user_predictions_updated_at_idx on public.user_predictions(updated_at desc);

alter table public.user_predictions enable row level security;

create policy predictions_select_all
  on public.user_predictions
  for select
  using (true);

create policy predictions_insert_own
  on public.user_predictions
  for insert
  with check (auth.uid() = user_id);

create policy predictions_update_own
  on public.user_predictions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy predictions_delete_own
  on public.user_predictions
  for delete
  using (auth.uid() = user_id);

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

create trigger user_predictions_prepare_names
  before insert or update on public.user_predictions
  for each row
  execute function public.prepare_user_prediction_names();

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
grant select on public.user_predictions to anon, authenticated;
grant insert, update, delete on public.user_predictions to authenticated;
grant execute on function public.save_user_prediction(text, text[], text, text, integer, text[], integer, text, text) to authenticated;

-- ============================================
-- 7. LEAGUES
-- ============================================
create table if not exists leagues (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text default '',
  visibility text default 'public' check (visibility in ('public', 'private')),
  join_code text unique not null,
  member_count integer default 1,
  created_at timestamptz default now()
);

alter table leagues add column if not exists member_count integer default 1;
update leagues set member_count = 1 where member_count is null;
alter table leagues alter column member_count set default 1;

alter table leagues enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'leagues' loop
    execute format('drop policy if exists %I on leagues', pol.policyname);
  end loop;
end $$;
create policy "leagues_select" on leagues for select using (true);
create policy "leagues_insert" on leagues for insert with check (auth.uid() = owner_id);
create policy "leagues_update" on leagues for update using (auth.uid() = owner_id);
create policy "leagues_delete" on leagues for delete using (auth.uid() = owner_id);

-- ============================================
-- 8. LEAGUE MEMBERS
-- Critical: user_id references PROFILES (not auth.users) so PostgREST can
-- embed profile data in a single joined query.
-- ============================================
create table if not exists league_members (
  id uuid default gen_random_uuid() primary key,
  league_id uuid references leagues(id) on delete cascade not null,
  user_id uuid not null,
  role text default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

-- Drop any existing FK from user_id (it may point at auth.users) and re-add it
-- so it targets profiles(id). This is what lets us write:
--   .select('user_id, role, joined_at, profiles(username, display_name, total_points)')
do $$
declare con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.league_members'::regclass
      and contype = 'f'
      and conname like '%user_id%'
  loop
    execute format('alter table league_members drop constraint %I', con.conname);
  end loop;
end $$;

alter table league_members
  add constraint league_members_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table league_members enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'league_members' loop
    execute format('drop policy if exists %I on league_members', pol.policyname);
  end loop;
end $$;

create policy "lm_select" on league_members for select using (true);
create policy "lm_insert" on league_members for insert with check (auth.uid() = user_id);
create policy "lm_delete" on league_members for delete using (auth.uid() = user_id);

-- ============================================
-- SEED: Teams
-- ============================================
insert into teams (id, name, color, short_name) values
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
on conflict (id) do nothing;

-- SEED: Drivers
insert into drivers (id, name, short_name, number, team_id, championship_points) values
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
on conflict (id) do nothing;

-- ============================================
-- 9. STALE ACCOUNT CLEANUP
-- Deletes accounts that were created but never signed into.
-- Two buckets:
--   (a) Unverified signups   → deleted after 24 hours
--   (b) Verified but never signed in → deleted after 7 days
-- Run this function manually or schedule it with pg_cron (below).
-- ============================================
create or replace function public.cleanup_stale_accounts()
returns table(deleted_user_id uuid, reason text) as $$
declare
  rec record;
begin
  -- (a) Unverified accounts older than 24 hours
  for rec in
    select id, email, created_at
    from auth.users
    where email_confirmed_at is null
      and last_sign_in_at is null
      and created_at < now() - interval '24 hours'
  loop
    delete from auth.users where id = rec.id;
    deleted_user_id := rec.id;
    reason := 'Unverified — created ' || rec.created_at::date::text || ', never signed in';
    return next;
  end loop;

  -- (b) Verified accounts that have NEVER signed in, older than 7 days
  for rec in
    select id, email, created_at, email_confirmed_at
    from auth.users
    where email_confirmed_at is not null
      and last_sign_in_at is null
      and created_at < now() - interval '7 days'
  loop
    delete from auth.users where id = rec.id;
    deleted_user_id := rec.id;
    reason := 'Verified but never signed in — confirmed ' || rec.email_confirmed_at::date::text || ', created ' || rec.created_at::date::text;
    return next;
  end loop;
end;
$$ language plpgsql security definer;

-- Schedule via pg_cron (runs daily at 03:00 UTC).
-- If the pg_cron extension is not installed, this is a no-op and you can
-- run `select cleanup_stale_accounts();` manually when you need to purge.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-stale-accounts',
      '0 3 * * *',
      'select cleanup_stale_accounts();'
    );
  end if;
end $$;

-- ============================================
-- SEED: 2026 Races — matches official F1 2026 calendar
-- Cancelled: Bahrain (r04) and Saudi Arabia (r05)
-- ============================================
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

-- ============================================
-- 10. USER ACHIEVEMENTS
-- Synced across devices — local AsyncStorage is the cache,
-- Supabase is the source of truth for cross-device sync.
-- ============================================
create table if not exists user_achievements (
  user_id uuid references auth.users on delete cascade not null,
  achievement_id text not null,
  unlocked_tiers text[] default '{}',
  current_value integer default 0,
  unlocked_at jsonb default '{}',
  season_instances jsonb default null,
  updated_at timestamptz default now(),
  primary key (user_id, achievement_id)
);

alter table user_achievements enable row level security;

drop policy if exists "achievements_select_own" on user_achievements;
drop policy if exists "achievements_select_all" on user_achievements;
drop policy if exists "achievements_insert_own" on user_achievements;
drop policy if exists "achievements_update_own" on user_achievements;
drop policy if exists "achievements_delete_own" on user_achievements;

-- Achievements are public (shown on profiles). Only the owner can modify.
create policy "achievements_select_all" on user_achievements for select using (true);
create policy "achievements_insert_own" on user_achievements for insert with check (auth.uid() = user_id);
create policy "achievements_update_own" on user_achievements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "achievements_delete_own" on user_achievements for delete using (auth.uid() = user_id);

-- ============================================
-- 11. NOTIFICATION LOG
-- ============================================
create table if not exists notification_log (
  id uuid default gen_random_uuid() primary key,
  race_id text not null,
  sent_at timestamptz default now(),
  recipient_count integer default 0
);

alter table notification_log enable row level security;

drop policy if exists "Anyone can read notification_log" on notification_log;
drop policy if exists "Service can insert notification_log" on notification_log;
create policy "Anyone can read notification_log" on notification_log for select using (true);
create policy "Service can insert notification_log" on notification_log for insert with check (true);

notify pgrst, 'reload schema';
