-- ============================================================================
-- FIX SCRIPT: Correct predictions imported from spreadsheet
-- Run this in the Supabase SQL Editor (https://fxwgbpassouaddakgyus.supabase.co)
-- This fixes the mismatched predictions and recalculates all points.
-- ============================================================================

begin;

-- ── Skye Leach (cb7536a7) — Fix r02 Grand Prix & Sprint ──
update public.user_predictions set
  predicted_top10 = '{"RUS","ANT","LEC","HAM","VER","PIA","NOR","HAD","BEA","GAS"}',
  predicted_sprint_top8 = '{"RUS","ANT","HAM","NOR","LEC","PIA","VER","HAD"}',
  points_earned = 14,
  sprint_points_earned = 22
where user_id = 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' and race_id = 'r02';

-- ── Skye Leach (cb7536a7) — Fix r03 Grand Prix ──
update public.user_predictions set
  predicted_top10 = '{"ANT","RUS","LEC","PIA","HAM","NOR","VER","HAD","GAS","LIN"}',
  points_earned = 41
where user_id = 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' and race_id = 'r03';

-- ── Skye Leach (cb7536a7) — Fix r05 Grand Prix & Sprint ──
update public.user_predictions set
  predicted_top10 = '{"RUS","ANT","PIA","NOR","HAM","LEC","VER","HAD","LIN","LAW"}',
  predicted_sprint_top8 = '{"ANT","RUS","NOR","PIA","LEC","VER","HAM","HAD"}',
  points_earned = 1,
  sprint_points_earned = 9
where user_id = 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' and race_id = 'r05';

-- ── Skye Leach (cb7536a7) — Fix r06 Grand Prix ──
update public.user_predictions set
  predicted_top10 = '{"ANT","VER","RUS","LEC","HAM","PIA","HAD","NOR","GAS","COL"}',
  points_earned = 26
where user_id = 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' and race_id = 'r06';

-- ── Whitney Trujillo (652154af) — Fix r06 Grand Prix ──
update public.user_predictions set
  predicted_top10 = '{"ANT","VER","HAM","LEC","HAD","PIA","RUS","NOR","GAS","SAI"}',
  points_earned = 36
where user_id = '652154af-dc27-47b5-aa79-25903b9c4a1b' and race_id = 'r06';

-- ── Bryan Leach (f35417e9) — Fix r06 Grand Prix ──
update public.user_predictions set
  predicted_top10 = '{"ANT","VER","LEC","HAM","RUS","PIA","NOR","GAS","LAW","ALB"}',
  points_earned = 26
where user_id = 'f35417e9-4f0d-4def-9c2f-c81276863fc0' and race_id = 'r06';

-- ── Fix profile total_points ──
update public.profiles set total_points = 147, updated_at = now()
where id = 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4';

update public.profiles set total_points = 228, updated_at = now()
where id = '652154af-dc27-47b5-aa79-25903b9c4a1b';

update public.profiles set total_points = 165, updated_at = now()
where id = 'f35417e9-4f0d-4def-9c2f-c81276863fc0';

update public.profiles set total_points = 230, updated_at = now()
where id = 'e11ea4f5-2ba4-4241-9791-b4b6a560534b';

commit;

-- Verify
select u.display_name, u.race_id, u.points_earned, u.sprint_points_earned,
       (u.points_earned + u.sprint_points_earned) as race_total
from public.user_predictions u
order by u.display_name, u.race_id;
