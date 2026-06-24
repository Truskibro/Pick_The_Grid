/**
 * FIX SUPABASE USING JS SDK
 * Updates user_predictions to match spreadsheet data,
 * recomputes points, and updates profiles.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
// Using the anon key to attempt PATCH operations
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Scoring engine
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

function norm(s) { return (s || '').trim().toUpperCase(); }

function calcMainPoints(raceResult, top10, fl, dnf) {
  if (!raceResult || !raceResult.classification || raceResult.classification.length === 0) return 0;
  let pts = 0;
  const scored = new Set();
  const resultTop10 = raceResult.classification
    .filter(e => e.position <= 10)
    .sort((a, b) => a.position - b.position);
  
  for (let i = 0; i < Math.min(top10.length, 10); i++) {
    const p = norm(top10[i]);
    const a = norm(resultTop10[i]?.driverId || '');
    if (!p || scored.has(p)) continue;
    scored.add(p);
    if (p === a) pts += F1_POINTS[i];
  }
  
  if (norm(fl) === norm(raceResult.fastest_lap_driver_id)) pts += 1;
  
  // DNF
  const pDnf = norm(dnf);
  const dnsSet = new Set((raceResult.dns_driver_ids || []).map(norm));
  const dnfSet = new Set();
  for (const e of raceResult.classification) {
    const did = norm(e.driverId);
    const st = (e.status || '').trim().toLowerCase();
    if (dnsSet.has(did)) continue;
    if (['dnf','retired','ret'].includes(st)) dnfSet.add(did);
  }
  for (const did of (raceResult.dnf_driver_ids || [])) {
    const nd = norm(did);
    if (!dnsSet.has(nd)) dnfSet.add(nd);
  }
  
  if (!pDnf && dnfSet.size === 0) pts += 10;
  else if (pDnf && !dnsSet.has(pDnf) && dnfSet.has(pDnf)) pts += 10;
  
  return pts;
}

function calcSprintPoints(sprintClass, sprintTop8) {
  if (!sprintClass || sprintClass.length === 0 || sprintTop8.length === 0) return 0;
  let pts = 0;
  const scored = new Set();
  const resultTop8 = sprintClass.filter(e => e.position <= 8).sort((a,b) => a.position - b.position);
  for (let i = 0; i < Math.min(sprintTop8.length, 8); i++) {
    const p = norm(sprintTop8[i]);
    const a = norm(resultTop8[i]?.driverId || '');
    if (!p || scored.has(p)) continue;
    scored.add(p);
    if (p === a) pts += SPRINT_POINTS[i];
  }
  return pts;
}

// Source of truth from seed-predictions.ts
const SEED = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': {
    r01: { top10: ['VER','RUS','ANT','PIA','LEC','NOR','HAM','HAD','LAW','SAI'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','BEA','GAS'], fl: 'RUS', dnf: 'ALO', sprint: ['RUS','ANT','HAM','NOR','LEC','PIA','VER','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','HAM','NOR','VER','HAD','GAS','LIN'], fl: 'ANT', dnf: 'BOT', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','HAM','PIA','HAD','GAS','BEA'], fl: 'VER', dnf: 'COL', sprint: ['ANT','NOR','PIA','RUS','LEC','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','PIA','NOR','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'ANT', dnf: 'COL', sprint: ['ANT','RUS','NOR','PIA','LEC','VER','HAM','HAD'] },
    r06: { top10: ['ANT','VER','RUS','LEC','HAM','PIA','HAD','NOR','GAS','COL'], fl: 'ANT', dnf: 'LAW', sprint: [] },
    r07: { top10: ['ANT','RUS','HAM','NOR','VER','PIA','LEC','HAD','HUL','GAS'], fl: 'ANT', dnf: 'LAW', sprint: [] },
  },
  '652154af-dc27-47b5-aa79-25903b9c4a1b': {
    r01: { top10: ['ANT','RUS','LEC','PIA','HAD','VER','NOR','HAM','LAW','HUL'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','VER','NOR','HAD','HUL','BEA'], fl: 'RUS', dnf: 'STR', sprint: ['ANT','RUS','NOR','HAM','VER','PIA','LEC','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','NOR','VER','HAM','GAS','HAD','HUL'], fl: 'PIA', dnf: 'PER', sprint: [] },
    r04: { top10: ['PIA','VER','NOR','ANT','LEC','RUS','HAM','COL','SAI','GAS'], fl: null, dnf: 'STR', sprint: ['NOR','LEC','ANT','PIA','VER','RUS','HAM','COL'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'STR', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['ANT','VER','HAM','LEC','HAD','PIA','RUS','NOR','GAS','SAI'], fl: 'ANT', dnf: 'STR', sprint: [] },
    r07: { top10: ['HAM','RUS','VER','LEC','PIA','HAD','GAS','LAW','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: [] },
  },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': {
    r01: { top10: ['RUS','ANT','PIA','LEC','NOR','HAM','HAD','VER','LAW','LIN'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','NOR','VER','HAD','BEA','GAS'], fl: 'RUS', dnf: 'PER', sprint: ['RUS','ANT','HAM','LEC','LEC','VER','NOR','HAD'] },
    r03: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','PIA','HAM','GAS','HAD','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','NOR','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'NOR', dnf: 'BOT', sprint: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD'] },
    r06: { top10: ['ANT','VER','LEC','HAM','RUS','PIA','NOR','GAS','LAW','ALB'], fl: 'ANT', dnf: 'HAD', sprint: [] },
    r07: { top10: ['RUS','ANT','HAM','VER','LEC','PIA','HAD','LAW','SAI','LIN'], fl: 'ANT', dnf: null, sprint: [] },
  },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': {
    r01: { top10: ['RUS','ANT','LEC','PIA','HAD','HAM','NOR','VER','LAW','HUL'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','HAM','LEC','NOR','PIA','VER','HAD','GAS','HUL'], fl: 'RUS', dnf: 'ALB', sprint: ['RUS','ANT','HAM','NOR','LEC','VER','PIA','GAS'] },
    r03: { top10: ['ANT','RUS','LEC','HAM','PIA','NOR','HAD','VER','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','LEC','PIA','HAM','GAS','HUL'], fl: 'VER', dnf: null, sprint: ['NOR','ANT','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['ANT','RUS','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['VER','ANT','HAM','LEC','HAD','RUS','PIA','NOR','GAS','LAW'], fl: 'VER', dnf: 'BOR', sprint: [] },
    r07: { top10: ['RUS','HAM','ANT','VER','NOR','LEC','HAD','PIA','HUL','LAW'], fl: 'RUS', dnf: null, sprint: [] },
  },
};

async function main() {
  // 1. Fetch race_results
  console.log('Fetching race results...');
  const { data: raceResults, error: rrErr } = await supabase.from('race_results').select('*');
  if (rrErr) { console.error('Failed to fetch race_results:', rrErr.message); return; }
  const rrMap = {};
  for (const rr of raceResults) rrMap[rr.race_id] = rr;
  console.log(`Got ${raceResults.length} race results.`);

  // 2. Fetch current predictions
  console.log('\nFetching predictions...');
  const { data: preds, error: predErr } = await supabase.from('user_predictions').select('*');
  if (predErr) { console.error('Failed to fetch predictions:', predErr.message); return; }
  console.log(`Got ${preds.length} predictions.`);

  // 3. Compare and fix
  console.log('\n═══ FIXING PREDICTIONS ═══');
  let fixedCount = 0;
  let recalcCount = 0;

  for (const [userId, races] of Object.entries(SEED)) {
    for (const [raceId, picks] of Object.entries(races)) {
      const sb = preds.find(p => p.user_id === userId && p.race_id === raceId);
      if (!sb) {
        console.log(`  ⚠️  Missing in Supabase: ${userId.substring(0,8)} ${raceId}`);
        continue;
      }

      const sbTop10 = sb.predicted_top10 || [];
      const sbSprint = sb.predicted_sprint_top8 || [];
      
      const top10Match = JSON.stringify(picks.top10) === JSON.stringify(sbTop10);
      const sprintMatch = JSON.stringify(picks.sprint) === JSON.stringify(sbSprint);
      const flMatch = picks.fl === sb.predicted_fastest_lap;
      const dnfMatch = picks.dnf === sb.predicted_dnf;

      // Recompute points with CURRENT picks (might differ from stored)
      const rr = rrMap[raceId];
      const newMain = calcMainPoints(rr, sbTop10, sb.predicted_fastest_lap, sb.predicted_dnf);
      const newSprint = calcSprintPoints(rr?.sprint_classification || [], sbSprint);
      const storedMain = sb.points_earned || 0;
      const storedSprint = sb.sprint_points_earned || 0;

      if (!top10Match || !sprintMatch || !flMatch || !dnfMatch) {
        console.log(`  📝 ${userId.substring(0,8)} ${raceId}: Updating picks...`);
        
        // Recompute with NEW (seed) picks
        const finalMain = calcMainPoints(rr, picks.top10, picks.fl, picks.dnf);
        const finalSprint = calcSprintPoints(rr?.sprint_classification || [], picks.sprint);

        // Update Supabase
        const { error: updateErr } = await supabase
          .from('user_predictions')
          .update({
            predicted_top10: picks.top10,
            predicted_fastest_lap: picks.fl,
            predicted_dnf: picks.dnf,
            predicted_sprint_top8: picks.sprint,
            points_earned: finalMain,
            sprint_points_earned: finalSprint,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('race_id', raceId);

        if (updateErr) {
          console.log(`    ❌ Failed: ${updateErr.message}`);
        } else {
          console.log(`    ✅ Updated. Main: ${storedMain}→${finalMain} Sprint: ${storedSprint}→${finalSprint}`);
          fixedCount++;
        }
      } else if (newMain !== storedMain || newSprint !== storedSprint) {
        // Picks match but points are stale
        console.log(`  🔄 ${userId.substring(0,8)} ${raceId}: Re-scoring ${storedMain}/${storedSprint} → ${newMain}/${newSprint}`);
        const { error: updateErr } = await supabase
          .from('user_predictions')
          .update({
            points_earned: newMain,
            sprint_points_earned: newSprint,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('race_id', raceId);

        if (!updateErr) recalcCount++;
      }
    }
  }

  console.log(`\nFixed ${fixedCount} prediction picks, rescored ${recalcCount}.`);

  // 4. Update profile totals
  console.log('\n═══ UPDATING PROFILES ═══');
  
  // Re-fetch predictions to get the latest points
  const { data: finalPreds } = await supabase.from('user_predictions').select('user_id, points_earned, sprint_points_earned');
  
  const totals = {};
  for (const p of finalPreds) {
    totals[p.user_id] = (totals[p.user_id] || 0) + (p.points_earned || 0) + (p.sprint_points_earned || 0);
  }

  for (const [userId, total] of Object.entries(totals)) {
    const { error } = await supabase
      .from('profiles')
      .update({ total_points: total })
      .eq('id', userId);
    
    const name = userId.substring(0, 8);
    if (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
    } else {
      console.log(`  ✅ ${name}: ${total} pts`);
    }
  }

  // 5. Final state
  console.log('\n═══ FINAL VERIFICATION ═══');
  const { data: profiles } = await supabase.from('profiles').select('id, username, display_name, total_points').order('total_points', { ascending: false });
  for (const p of profiles) {
    console.log(`  ${p.display_name || p.username || '?'}: ${p.total_points} pts`);
  }

  console.log('\n✅ All done.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
