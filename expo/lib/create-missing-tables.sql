-- ============================================================
-- Apex Draft F1 - Create Missing Tables
-- Run this in YOUR Supabase SQL Editor:
--   https://supabase.com/dashboard/project/fxwgbpassouaddakgyus
--   SQL Editor → New query → paste → Run
--
-- Safe to re-run — uses IF NOT EXISTS everywhere.
-- ============================================================

begin;

-- Required for gen_random_uuid().
create extension if not exists pgcrypto;

-- ============================================================
-- 1. USER PREDICTIONS
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
  constraint user_predictions_top10_length check (
    array_length(predicted_top10, 1) is null or array_length(predicted_top10, 1) <= 10
  ),
  constraint user_predictions_sprint_top8_length check (
    array_length(predicted_sprint_top8, 1) is null or array_length(predicted_sprint_top8, 1) <= 8
  )
);

create index if not exists user_predictions_user_id_idx on public.user_predictions(user_id);
create index if not exists user_predictions_race_id_idx on public.user_predictions(race_id);
create index if not exists user_predictions_updated_at_idx on public.user_predictions(updated_at desc);

alter table public.user_predictions enable row level security;

-- Drop any existing policies cleanly, then create fresh ones
drop policy if exists predictions_select_all on public.user_predictions;
drop policy if exists predictions_insert_own on public.user_predictions;
drop policy if exists predictions_update_own on public.user_predictions;
drop policy if exists predictions_delete_own on public.user_predictions;

create policy predictions_select_all
  on public.user_predictions for select using (true);

create policy predictions_insert_own
  on public.user_predictions for insert
  with check (auth.uid() = user_id);

create policy predictions_update_own
  on public.user_predictions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy predictions_delete_own
  on public.user_predictions for delete
  using (auth.uid() = user_id);

-- Auto-fill username/display_name from profiles on every insert/update
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

  new.username := coalesce(
    nullif(btrim(new.username), ''),
    nullif(btrim(profile_username), ''),
    'user_' || substr(new.user_id::text, 1, 8)
  );
  new.display_name := coalesce(
    nullif(btrim(new.display_name), ''),
    nullif(btrim(profile_display_name), ''),
    new.username
  );
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

-- Convenience RPC: upsert a prediction for the logged-in user
drop function if exists public.save_user_prediction(
  text, text[], text, text, integer, text[], integer
);
drop function if exists public.save_user_prediction(
  text, text[], text, text, integer, text[], integer, text, text
);

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

  next_username := coalesce(
    nullif(btrim(p_username), ''),
    nullif(btrim(profile_username), ''),
    'user_' || substr(current_user_id::text, 1, 8)
  );
  next_display_name := coalesce(
    nullif(btrim(p_display_name), ''),
    nullif(btrim(profile_display_name), ''),
    next_username
  );

  insert into public.user_predictions (
    user_id, race_id, username, display_name,
    predicted_top10, predicted_fastest_lap, predicted_dnf,
    points_earned, predicted_sprint_top8, sprint_points_earned
  )
  values (
    current_user_id, p_race_id, next_username, next_display_name,
    coalesce(p_predicted_top10, '{}'), p_predicted_fastest_lap, p_predicted_dnf,
    coalesce(p_points_earned, 0), coalesce(p_predicted_sprint_top8, '{}'),
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

grant select on public.user_predictions to anon, authenticated;
grant insert, update, delete on public.user_predictions to authenticated;
grant execute on function public.save_user_prediction(
  text, text[], text, text, integer, text[], integer, text, text
) to authenticated;

-- ============================================================
-- 2. USER ACHIEVEMENTS
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
create policy achievements_select_all
  on public.user_achievements for select
  using (true);
create policy achievements_insert_own
  on public.user_achievements for insert
  with check (auth.uid() = user_id);
create policy achievements_update_own
  on public.user_achievements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy achievements_delete_own
  on public.user_achievements for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_achievements to authenticated;

-- ============================================================
-- 3. NOTIFICATION LOG
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

create policy "Anyone can read notification_log"
  on public.notification_log for select using (true);
create policy "Service can insert notification_log"
  on public.notification_log for insert with check (true);

-- ============================================================
-- Refresh PostgREST schema cache
-- ============================================================
notify pgrst, 'reload schema';

commit;
