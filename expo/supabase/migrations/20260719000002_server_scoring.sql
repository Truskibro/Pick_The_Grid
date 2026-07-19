-- ============================================
-- Server-Side Scoring Migration
--
-- Moves point calculation from the client into a Postgres function.
-- A trigger fires `score_predictions_for_race(race_id)` AFTER INSERT OR
-- UPDATE on `race_results`, so the moment race results land, every user's
-- prediction for that race is rescored in one shot — leaderboards update
-- instantly without anyone opening the app.
--
-- PREREQUISITE: `multiseries-migration.sql` must be applied first so
-- `user_predictions.series_id`, `races.series_id`, and
-- `profiles.motogp_total_points` exist.
--
-- Safe to re-run: uses CREATE OR REPLACE and DROP IF EXISTS.
-- ============================================

-- ============================================
-- 1. score_predictions_for_race(p_race_id)
--
-- Reads the `race_results` row for p_race_id, iterates over every
-- `user_predictions` row for that race, computes points using the series'
-- scoring table, and writes points_earned + sprint_points_earned back to
-- each row. Also refreshes affected users' profiles.total_points (F1) or
-- profiles.motogp_total_points (MotoGP) as running sums over their
-- predictions for that series.
--
-- No-op if no race_results row exists or it has no classification.
-- ============================================
create or replace function public.score_predictions_for_race(
  p_race_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_id      text := 'f1';
  v_race_top_n     int;
  v_sprint_top_n   int;
  v_fl_bonus       int;
  v_dnf_bonus      int;
  v_race_points    int[];
  v_sprint_points  int[];

  v_result_row     public.race_results%rowtype;
  v_has_race       boolean := false;
  v_has_sprint     boolean := false;

  v_fastest_lap    text;
  v_dns_ids        text[];
  v_cls_json       jsonb;
  v_sprint_json    jsonb;

  v_pred_row       public.user_predictions%rowtype;
  v_predicted_top10 text[];
  v_predicted_sprint text[];
  v_predicted_fl    text;
  v_predicted_dnf   text;

  v_result_top_n   text[];
  v_sprint_top_n_arr text[];
  v_true_dnf_ids   text[];
  v_dns_set        text[];

  v_position_pts   int;
  v_fl_pts         int;
  v_dnf_pts        int;
  v_sprint_pts     int;
  v_total_pts      int;
  v_sprint_total   int;
  v_scored_drivers text[];
  v_pred_driver    text;
  v_actual_driver  text;
  v_cls_entry      jsonb;
  v_entry_status   text;
  v_entry_driver   text;
  v_entry_pos      int;
  v_idx            int;
  v_found_dns      boolean;

  v_affected_users uuid[];
  v_user_id        uuid;
  v_series_total   int;
  v_target_column  text;
begin
  -- Resolve the race's series (default to F1 for legacy rows).
  select coalesce(r.series_id, 'f1') into v_series_id
  from public.races r
  where r.id = p_race_id;
  if not found then
    v_series_id := 'f1';
  end if;

  -- Series-specific scoring config. Future series add a new branch here.
  if v_series_id = 'motogp' then
    v_race_points    := array[25,20,16,13,11,10,9,8,7,6,5,4,3,2,1];
    v_sprint_points  := array[12,9,7,6,5,4,3,2,1];
    v_race_top_n     := 15;
    v_sprint_top_n   := 9;
    v_fl_bonus       := 1;
    v_dnf_bonus      := 10;
    v_target_column  := 'motogp_total_points';
  else
    -- F1 (and any unknown series default to F1 rules).
    v_race_points    := array[25,18,15,12,10,8,6,4,2,1];
    v_sprint_points  := array[8,7,6,5,4,3,2,1];
    v_race_top_n     := 10;
    v_sprint_top_n   := 8;
    v_fl_bonus       := 1;
    v_dnf_bonus      := 10;
    v_target_column  := 'total_points';
  end if;

  -- Load the race_results row for this race.
  select * into v_result_row
  from public.race_results
  where race_id = p_race_id;
  if not found then
    -- No results yet — nothing to score.
    return;
  end if;

  v_cls_json    := coalesce(v_result_row.classification, '[]'::jsonb);
  v_sprint_json := coalesce(v_result_row.sprint_classification, '[]'::jsonb);
  v_fastest_lap := upper(coalesce(v_result_row.fastest_lap_driver_id, '')::text);

  v_has_race   := jsonb_array_length(v_cls_json) > 0;
  v_has_sprint := v_sprint_json is not null and jsonb_array_length(v_sprint_json) > 0;

  if not (v_has_race or v_has_sprint) then
    return;
  end if;

  -- Build the actual top-N driver list (sorted by position, uppercased).
  v_result_top_n := array[]::text[];
  if v_has_race then
    for v_cls_entry in select * from jsonb_array_elements(v_cls_json) order by (v_cls_entry->>'position')::int asc loop
      v_entry_pos := coalesce((v_cls_entry->>'position')::int, 0);
      if v_entry_pos > 0 and v_entry_pos <= v_race_top_n then
        v_entry_driver := upper(coalesce(v_cls_entry->>'driverId', ''));
        if v_entry_driver <> '' then
          v_result_top_n := array_append(v_result_top_n, v_entry_driver);
        end if;
      end if;
    end loop;
  end if;

  -- Build the actual sprint top-N driver list.
  v_sprint_top_n_arr := array[]::text[];
  if v_has_sprint then
    for v_cls_entry in select * from jsonb_array_elements(v_sprint_json) order by (v_cls_entry->>'position')::int asc loop
      v_entry_pos := coalesce((v_cls_entry->>'position')::int, 0);
      if v_entry_pos > 0 and v_entry_pos <= v_sprint_top_n then
        v_entry_driver := upper(coalesce(v_cls_entry->>'driverId', ''));
        if v_entry_driver <> '' then
          v_sprint_top_n_arr := array_append(v_sprint_top_n_arr, v_entry_driver);
        end if;
      end if;
    end loop;
  end if;

  -- Build the DNS set: explicit dns_driver_ids + any classification entry
  -- whose status is 'dns' / 'did not start' / 'did_not_start'.
  v_dns_set := array[]::text[];
  if v_result_row.dns_driver_ids is not null then
    for v_idx in 1..array_length(v_result_row.dns_driver_ids, 1) loop
      v_dns_set := array_append(v_dns_set, upper(coalesce(v_result_row.dns_driver_ids[v_idx], '')));
    end loop;
  end if;
  if v_has_race then
    for v_cls_entry in select * from jsonb_array_elements(v_cls_json) loop
      v_entry_status := lower(coalesce(v_cls_entry->>'status', ''));
      v_entry_driver := upper(coalesce(v_cls_entry->>'driverId', ''));
      if v_entry_driver <> '' and v_entry_status in ('dns', 'did not start', 'did_not_start') then
        if not v_dns_set @> array[v_entry_driver] then
          v_dns_set := array_append(v_dns_set, v_entry_driver);
        end if;
      end if;
    end loop;
  end if;

  -- Build the true-DNF set: classification entries whose status is a true
  -- DNF variant AND not in the DNS set, plus explicit dnf_driver_ids
  -- (minus DNS). DNS drivers never count as DNF.
  v_true_dnf_ids := array[]::text[];
  if v_has_race then
    for v_cls_entry in select * from jsonb_array_elements(v_cls_json) loop
      v_entry_status := lower(coalesce(v_cls_entry->>'status', ''));
      v_entry_driver := upper(coalesce(v_cls_entry->>'driverId', ''));
      if v_entry_driver = '' then continue; end if;
      if v_dns_set @> array[v_entry_driver] then continue; end if;
      if v_entry_status in ('dnf', 'retired', 'ret', 'did not finish', 'did_not_finish') then
        if not v_true_dnf_ids @> array[v_entry_driver] then
          v_true_dnf_ids := array_append(v_true_dnf_ids, v_entry_driver);
        end if;
      end if;
    end loop;
  end if;
  if v_result_row.dnf_driver_ids is not null then
    for v_idx in 1..array_length(v_result_row.dnf_driver_ids, 1) loop
      v_entry_driver := upper(coalesce(v_result_row.dnf_driver_ids[v_idx], ''));
      if v_entry_driver = '' then continue; end if;
      if v_dns_set @> array[v_entry_driver] then continue; end if;
      if not v_true_dnf_ids @> array[v_entry_driver] then
        v_true_dnf_ids := array_append(v_true_dnf_ids, v_entry_driver);
      end if;
    end loop;
  end if;

  -- Track every user whose points we touched, so we can refresh their
  -- per-series profile total afterwards.
  v_affected_users := array[]::uuid[];

  -- Loop over every prediction for this race and rescore it.
  for v_pred_row in select * from public.user_predictions where race_id = p_race_id loop
    v_predicted_top10  := coalesce(v_pred_row.predicted_top10, array[]::text[]);
    v_predicted_sprint := coalesce(v_pred_row.predicted_sprint_top8, array[]::text[]);
    v_predicted_fl     := upper(coalesce(v_pred_row.predicted_fastest_lap, '')::text);
    v_predicted_dnf    := upper(coalesce(v_pred_row.predicted_dnf, '')::text);

    -- ---- Race position points ----
    v_position_pts := 0;
    v_scored_drivers := array[]::text[];
    if v_has_race and array_length(v_predicted_top10, 1) > 0 then
      for v_idx in 1..least(array_length(v_predicted_top10, 1), v_race_top_n) loop
        v_pred_driver := upper(coalesce(v_predicted_top10[v_idx], ''));
        if v_pred_driver = '' then continue; end if;
        -- Skip duplicate picks (first occurrence scores).
        if v_scored_drivers @> array[v_pred_driver] then continue; end if;
        v_scored_drivers := array_append(v_scored_drivers, v_pred_driver);

        if v_idx <= array_length(v_result_top_n, 1) then
          v_actual_driver := coalesce(v_result_top_n[v_idx], '');
          if v_pred_driver = v_actual_driver then
            v_position_pts := v_position_pts + v_race_points[v_idx];
          end if;
        end if;
      end loop;
    end if;

    -- ---- Fastest lap bonus ----
    v_fl_pts := 0;
    if v_predicted_fl <> '' and v_predicted_fl = v_fastest_lap and v_fastest_lap <> '' then
      v_fl_pts := v_fl_bonus;
    end if;

    -- ---- DNF / Crash bonus ----
    v_dnf_pts := 0;
    if v_predicted_dnf = '' or v_predicted_dnf is null then
      -- No DNF predicted: bonus only if no true DNFs occurred.
      if array_length(v_true_dnf_ids, 1) is null or array_length(v_true_dnf_ids, 1) = 0 then
        v_dnf_pts := v_dnf_bonus;
      end if;
    else
      -- Predicted a DNF: bonus if it's in the true DNF set.
      -- If the pick was actually a DNS, no DNF points (DNS != DNF).
      if v_dns_set @> array[v_predicted_dnf] then
        v_dnf_pts := 0;
      elsif v_true_dnf_ids @> array[v_predicted_dnf] then
        v_dnf_pts := v_dnf_bonus;
      end if;
    end if;

    v_total_pts := v_position_pts + v_fl_pts + v_dnf_pts;

    -- ---- Sprint position points ----
    v_sprint_pts := 0;
    v_scored_drivers := array[]::text[];
    if v_has_sprint and array_length(v_predicted_sprint, 1) > 0 then
      for v_idx in 1..least(array_length(v_predicted_sprint, 1), v_sprint_top_n) loop
        v_pred_driver := upper(coalesce(v_predicted_sprint[v_idx], ''));
        if v_pred_driver = '' then continue; end if;
        if v_scored_drivers @> array[v_pred_driver] then continue; end if;
        v_scored_drivers := array_append(v_scored_drivers, v_pred_driver);

        if v_idx <= array_length(v_sprint_top_n_arr, 1) then
          v_actual_driver := coalesce(v_sprint_top_n_arr[v_idx], '');
          if v_pred_driver = v_actual_driver then
            v_sprint_pts := v_sprint_pts + v_sprint_points[v_idx];
          end if;
        end if;
      end loop;
    end if;

    v_sprint_total := v_sprint_pts;

    -- ---- Persist the computed points back to the prediction row ----
    update public.user_predictions
      set points_earned = v_total_pts,
          sprint_points_earned = v_sprint_total,
          updated_at = now()
    where id = v_pred_row.id;

    if not v_affected_users @> array[v_pred_row.user_id] then
      v_affected_users := array_append(v_affected_users, v_pred_row.user_id);
    end if;
  end loop;

  -- ---- Refresh affected users' per-series profile totals ----
  -- total_points stays the F1 sum; motogp_total_points is the MotoGP sum.
  -- We recompute the relevant column as the sum of points across all the
  -- user's predictions for that series.
  if array_length(v_affected_users, 1) is null then
    return;
  end if;

  foreach v_user_id in array v_affected_users loop
    if v_series_id = 'f1' then
      select coalesce(sum(points_earned + sprint_points_earned), 0)
        into v_series_total
      from public.user_predictions
      where user_id = v_user_id
        and coalesce(series_id, 'f1') = 'f1';

      update public.profiles
        set total_points = v_series_total,
            updated_at = now()
      where id = v_user_id;
    else
      -- MotoGP (or any non-F1 series) writes to motogp_total_points.
      -- NOTE: if multiple non-F1 series ever exist, this column would need
      -- to become per-series. For now there is only MotoGP.
      select coalesce(sum(points_earned + sprint_points_earned), 0)
        into v_series_total
      from public.user_predictions
      where user_id = v_user_id
        and coalesce(series_id, 'f1') = v_series_id;

      update public.profiles
        set motogp_total_points = v_series_total,
            updated_at = now()
      where id = v_user_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.score_predictions_for_race(text) to authenticated, service_role;

-- ============================================
-- 2. Trigger: rescore on race_results insert/update.
--    Inserting a race_results row (like the manual r10 insert) instantly
--    rescores every prediction for that race.
-- ============================================
drop trigger if exists score_predictions_on_result_insert on public.race_results;

create trigger score_predictions_on_result_insert
  after insert or update on public.race_results
  for each row
  execute function public.score_predictions_for_race(new.race_id);

-- ============================================
-- 3. Update save_user_prediction so saved picks don't clobber
--    server-computed points.
--
-- The client no longer sends authoritative points — the server computes
-- them via score_predictions_for_race when results land. On UPDATE we
-- therefore STOP overwriting points_earned / sprint_points_earned with
-- the (stale/zero) values passed by the client. On INSERT we seed them
-- to 0; the trigger will fill them in if results already exist.
--
-- After every save, if a race_results row exists for this race, we call
-- score_predictions_for_race so the just-saved prediction is scored
-- immediately (covers the rare case of a user editing picks after a
-- race result was already inserted).
-- ============================================
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
    0,
    coalesce(p_predicted_sprint_top8, '{}'),
    0,
    coalesce(p_series_id, 'f1')
  )
  on conflict (user_id, series_id, race_id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    predicted_top10 = excluded.predicted_top10,
    predicted_fastest_lap = excluded.predicted_fastest_lap,
    predicted_dnf = excluded.predicted_dnf,
    predicted_sprint_top8 = excluded.predicted_sprint_top8,
    series_id = excluded.series_id,
    updated_at = now()
    -- NOTE: points_earned and sprint_points_earned are intentionally NOT
    -- updated here. The server owns them via score_predictions_for_race.
  returning * into saved_row;

  -- If results already exist for this race, rescore now so the just-saved
  -- picks get points immediately. No-op if no race_results row exists.
  perform public.score_predictions_for_race(p_race_id);

  -- Re-fetch the row so the returned record reflects server-scored points.
  select * into saved_row from public.user_predictions where id = saved_row.id;

  return saved_row;
end;
$$;

grant execute on function public.save_user_prediction(text, text[], text, text, integer, text[], integer, text, text, text) to authenticated;

-- ============================================
-- 4. Backfill: score every race that already has results.
--    Runs the scoring function once per existing race_results row so
--    historical predictions (e.g. the manually-inserted Belgian GP r10)
--    get server-authored points immediately, not just future inserts.
--    Safe to re-run — the function is idempotent.
-- ============================================
do $$
declare
  r record;
begin
  for r in select distinct race_id from public.race_results where race_id is not null loop
    begin
      perform public.score_predictions_for_race(r.race_id);
    exception when others then
      -- Don't let one bad row abort the whole backfill.
      raise notice 'Backfill skipped for race %: %', r.race_id, sqlerrm;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
