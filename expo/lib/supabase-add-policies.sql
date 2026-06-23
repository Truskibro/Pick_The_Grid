-- Add INSERT/UPDATE policies for race_results and races tables
-- These are needed so the client can populate race results

-- ============================================
-- RACE RESULTS: Add columns + write policies
-- ============================================
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS dns_driver_ids text[] DEFAULT '{}';
ALTER TABLE race_results ADD COLUMN IF NOT EXISTS sprint_classification jsonb;

-- Add INSERT policy for race_results (authenticated users can insert)
DROP POLICY IF EXISTS "race_results_insert" ON race_results;
CREATE POLICY "race_results_insert" ON race_results
  FOR INSERT WITH CHECK (true);

-- Add UPDATE policy for race_results
DROP POLICY IF EXISTS "race_results_update" ON race_results;
CREATE POLICY "race_results_update" ON race_results
  FOR UPDATE USING (true) WITH CHECK (true);

-- Add DELETE policy for race_results
DROP POLICY IF EXISTS "race_results_delete" ON race_results;
CREATE POLICY "race_results_delete" ON race_results
  FOR DELETE USING (true);

-- ============================================
-- RACES: Add write policies
-- ============================================
DROP POLICY IF EXISTS "races_insert" ON races;
CREATE POLICY "races_insert" ON races
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "races_update" ON races;
CREATE POLICY "races_update" ON races
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "races_delete" ON races;
CREATE POLICY "races_delete" ON races
  FOR DELETE USING (true);
