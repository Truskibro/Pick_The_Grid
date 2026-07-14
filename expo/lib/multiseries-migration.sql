-- ============================================
-- Multi-Series Migration — adds series_id support
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.
-- ============================================

-- 1. RACES: add series_id column (defaults to 'f1')
alter table races add column if not exists series_id text default 'f1';
update races set series_id = 'f1' where series_id is null;
alter table races alter column series_id set default 'f1';

-- 2. USER_PREDICTIONS: add series_id column (defaults to 'f1')
alter table public.user_predictions add column if not exists series_id text not null default 'f1';
update public.user_predictions set series_id = 'f1' where series_id is null or series_id = '';

-- Replace the old unique constraint (user_id + race_id) with a new one
-- that includes series_id, so F1 and MotoGP predictions for the same
-- race_id pattern never collide.
alter table public.user_predictions
  drop constraint if exists user_predictions_user_id_race_id_key;

alter table public.user_predictions
  add constraint user_predictions_user_id_series_id_race_id_key
  unique (user_id, series_id, race_id);

-- Indexes for efficient series filtering
create index if not exists user_predictions_series_id_idx
  on public.user_predictions (series_id);

create index if not exists user_predictions_user_id_series_id_idx
  on public.user_predictions (user_id, series_id);

create index if not exists user_predictions_series_id_race_id_idx
  on public.user_predictions (series_id, race_id);

-- 3. LEAGUES: add series_id column (defaults to 'f1')
alter table leagues add column if not exists series_id text default 'f1';
update leagues set series_id = 'f1' where series_id is null or series_id = '';
alter table leagues alter column series_id set default 'f1';

-- 4. PROFILES: add per-series points columns
-- total_points stays as the F1 total (backward compat).
-- motogp_total_points tracks MotoGP points separately.
alter table profiles add column if not exists motogp_total_points integer default 0;
update profiles set motogp_total_points = 0 where motogp_total_points is null;
alter table profiles alter column motogp_total_points set default 0;

-- 5. Update save_user_prediction RPC to accept series_id
--    Uses the new unique constraint (user_id, series_id, race_id) for upsert.
create or replace function public.save_user_prediction(
  p_race_id text,
  p_predicted_top10 text[],
  p_predicted_fastest_lap text default null,
  p_predicted_dnf text default null,
  p_points_earned integer default 0,
  p_predicted_sprint_top8 text[] default '{}',
  p_sprint_points_earned integer default 0,
  p_username text default null,
  p_display_name text default null,
  p_series_id text default 'f1'
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
    sprint_points_earned,
    series_id
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
    coalesce(p_sprint_points_earned, 0),
    coalesce(p_series_id, 'f1')
  )
  on conflict (user_id, series_id, race_id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    predicted_top10 = excluded.predicted_top10,
    predicted_fastest_lap = excluded.predicted_fastest_lap,
    predicted_dnf = excluded.predicted_dnf,
    points_earned = excluded.points_earned,
    predicted_sprint_top8 = excluded.predicted_sprint_top8,
    sprint_points_earned = excluded.sprint_points_earned,
    series_id = excluded.series_id,
    updated_at = now()
  returning * into saved_row;

  return saved_row;
end;
$$;

grant execute on function public.save_user_prediction(text, text[], text, text, integer, text[], integer, text, text, text) to authenticated;

-- 6. Backfill existing predictions and leagues to 'f1'
update public.user_predictions set series_id = 'f1' where series_id is null or series_id = '';
update leagues set series_id = 'f1' where series_id is null or series_id = '';

notify pgrst, 'reload schema';
