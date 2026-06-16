/**
 * COMPREHENSIVE DB FIX:
 * 1. Fix race IDs (r06→r04, r07→r05, r08→r06, r09→r07)
 * 2. Recompute all points against CORRECT race results
 * 3. Update profiles.total_points
 */
const { createClient } = require('@supabase/supabase-js');

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// Race ID mapping: DB stored wrong IDs → correct IDs
const RACE_ID_FIX = { r06: 'r04', r07: 'r05', r08: 'r06', r09: 'r07' };

// CORRECT 2026 race results (from f1-data.ts)
const CORRECT_RESULTS = [
  { // r01 - Australian GP
    raceId: 'r01',
    classification: [
      { position: 1, driverId: 'RUS', status: 'finished' }, { position: 2, driverId: 'ANT', status: 'finished' },
      { position: 3, driverId: 'LEC', status: 'finished' }, { position: 4, driverId: 'HAM', status: 'finished' },
      { position: 5, driverId: 'NOR', status: 'finished' }, { position: 6, driverId: 'VER', status: 'finished' },
      { position: 7, driverId: 'BEA', status: 'finished' }, { position: 8, driverId: 'LIN', status: 'finished' },
      { position: 9, driverId: 'BOR', status: 'finished' }, { position: 10, driverId: 'GAS', status: 'finished' },
      { position: 11, driverId: 'OCO', status: 'finished' }, { position: 12, driverId: 'ALB', status: 'finished' },
      { position: 13, driverId: 'LAW', status: 'finished' }, { position: 14, driverId: 'COL', status: 'finished' },
      { position: 15, driverId: 'SAI', status: 'finished' }, { position: 16, driverId: 'PER', status: 'finished' },
      { position: 17, driverId: 'STR', status: 'dnf' }, { position: 18, driverId: 'ALO', status: 'dnf' },
      { position: 19, driverId: 'BOT', status: 'dnf' }, { position: 20, driverId: 'HAD', status: 'dnf' },
      { position: 21, driverId: 'PIA', status: 'dns' }, { position: 22, driverId: 'HUL', status: 'dns' },
    ],
    fastestLapDriverId: 'VER', dnfDriverIds: ['STR', 'ALO', 'BOT', 'HAD'], dnsDriverIds: ['PIA', 'HUL'],
  },
  { // r02 - Chinese GP (SPRINT)
    raceId: 'r02',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' }, { position: 2, driverId: 'RUS', status: 'finished' },
      { position: 3, driverId: 'HAM', status: 'finished' }, { position: 4, driverId: 'LEC', status: 'finished' },
      { position: 5, driverId: 'BEA', status: 'finished' }, { position: 6, driverId: 'GAS', status: 'finished' },
      { position: 7, driverId: 'LAW', status: 'finished' }, { position: 8, driverId: 'HAD', status: 'finished' },
      { position: 9, driverId: 'SAI', status: 'finished' }, { position: 10, driverId: 'COL', status: 'finished' },
      { position: 11, driverId: 'HUL', status: 'finished' }, { position: 12, driverId: 'LIN', status: 'finished' },
      { position: 13, driverId: 'BOT', status: 'finished' }, { position: 14, driverId: 'OCO', status: 'finished' },
      { position: 15, driverId: 'PER', status: 'finished' },
      { position: 16, driverId: 'VER', status: 'dnf' }, { position: 17, driverId: 'ALO', status: 'dnf' },
      { position: 18, driverId: 'STR', status: 'dnf' },
      { position: 19, driverId: 'PIA', status: 'dns' }, { position: 20, driverId: 'NOR', status: 'dns' },
      { position: 21, driverId: 'BOR', status: 'dns' }, { position: 22, driverId: 'ALB', status: 'dns' },
    ],
    fastestLapDriverId: 'ANT', dnfDriverIds: ['VER', 'ALO', 'STR'], dnsDriverIds: ['PIA', 'NOR', 'BOR', 'ALB'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', status: 'finished' }, { position: 2, driverId: 'LEC', status: 'finished' },
      { position: 3, driverId: 'HAM', status: 'finished' }, { position: 4, driverId: 'NOR', status: 'finished' },
      { position: 5, driverId: 'ANT', status: 'finished' }, { position: 6, driverId: 'PIA', status: 'finished' },
      { position: 7, driverId: 'LAW', status: 'finished' }, { position: 8, driverId: 'BEA', status: 'finished' },
    ],
  },
  { // r03 - Japanese GP
    raceId: 'r03',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' }, { position: 2, driverId: 'PIA', status: 'finished' },
      { position: 3, driverId: 'LEC', status: 'finished' }, { position: 4, driverId: 'RUS', status: 'finished' },
      { position: 5, driverId: 'NOR', status: 'finished' }, { position: 6, driverId: 'HAM', status: 'finished' },
      { position: 7, driverId: 'GAS', status: 'finished' }, { position: 8, driverId: 'VER', status: 'finished' },
      { position: 9, driverId: 'LAW', status: 'finished' }, { position: 10, driverId: 'OCO', status: 'finished' },
      { position: 11, driverId: 'HUL', status: 'finished' }, { position: 12, driverId: 'HAD', status: 'finished' },
      { position: 13, driverId: 'BOR', status: 'finished' }, { position: 14, driverId: 'LIN', status: 'finished' },
      { position: 15, driverId: 'SAI', status: 'finished' }, { position: 16, driverId: 'COL', status: 'finished' },
      { position: 17, driverId: 'PER', status: 'finished' }, { position: 18, driverId: 'ALO', status: 'finished' },
      { position: 19, driverId: 'BOT', status: 'finished' }, { position: 20, driverId: 'ALB', status: 'finished' },
      { position: 21, driverId: 'STR', status: 'dnf' }, { position: 22, driverId: 'BEA', status: 'dnf' },
    ],
    fastestLapDriverId: 'ANT', dnfDriverIds: ['STR', 'BEA'], dnsDriverIds: [],
  },
  { // r04 - Miami GP (SPRINT)
    raceId: 'r04',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' }, { position: 2, driverId: 'NOR', status: 'finished' },
      { position: 3, driverId: 'PIA', status: 'finished' }, { position: 4, driverId: 'RUS', status: 'finished' },
      { position: 5, driverId: 'VER', status: 'finished' }, { position: 6, driverId: 'HAM', status: 'finished' },
      { position: 7, driverId: 'COL', status: 'finished' }, { position: 8, driverId: 'LEC', status: 'finished' },
      { position: 9, driverId: 'SAI', status: 'finished' }, { position: 10, driverId: 'ALB', status: 'finished' },
      { position: 11, driverId: 'BEA', status: 'finished' }, { position: 12, driverId: 'BOR', status: 'finished' },
      { position: 13, driverId: 'OCO', status: 'finished' }, { position: 14, driverId: 'LIN', status: 'finished' },
      { position: 15, driverId: 'ALO', status: 'finished' }, { position: 16, driverId: 'PER', status: 'finished' },
      { position: 17, driverId: 'STR', status: 'finished' }, { position: 18, driverId: 'BOT', status: 'finished' },
      { position: 19, driverId: 'HUL', status: 'dnf' }, { position: 20, driverId: 'LAW', status: 'dnf' },
      { position: 21, driverId: 'GAS', status: 'dnf' }, { position: 22, driverId: 'HAD', status: 'dnf' },
    ],
    fastestLapDriverId: 'NOR', dnfDriverIds: ['HUL', 'LAW', 'GAS', 'HAD'], dnsDriverIds: [],
    sprintClassification: [
      { position: 1, driverId: 'NOR', status: 'finished' }, { position: 2, driverId: 'PIA', status: 'finished' },
      { position: 3, driverId: 'LEC', status: 'finished' }, { position: 4, driverId: 'RUS', status: 'finished' },
      { position: 5, driverId: 'VER', status: 'finished' }, { position: 6, driverId: 'ANT', status: 'finished' },
      { position: 7, driverId: 'HAM', status: 'finished' }, { position: 8, driverId: 'GAS', status: 'finished' },
    ],
  },
  { // r05 - Canadian GP (SPRINT)
    raceId: 'r05',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' }, { position: 2, driverId: 'HAM', status: 'finished' },
      { position: 3, driverId: 'VER', status: 'finished' }, { position: 4, driverId: 'LEC', status: 'finished' },
      { position: 5, driverId: 'HAD', status: 'finished' }, { position: 6, driverId: 'COL', status: 'finished' },
      { position: 7, driverId: 'LAW', status: 'finished' }, { position: 8, driverId: 'GAS', status: 'finished' },
      { position: 9, driverId: 'SAI', status: 'finished' }, { position: 10, driverId: 'BEA', status: 'finished' },
      { position: 11, driverId: 'PIA', status: 'finished' }, { position: 12, driverId: 'HUL', status: 'finished' },
      { position: 13, driverId: 'BOR', status: 'finished' }, { position: 14, driverId: 'OCO', status: 'finished' },
      { position: 15, driverId: 'STR', status: 'finished' }, { position: 16, driverId: 'BOT', status: 'finished' },
      { position: 17, driverId: 'PER', status: 'dnf' }, { position: 18, driverId: 'NOR', status: 'dnf' },
      { position: 19, driverId: 'RUS', status: 'dnf' }, { position: 20, driverId: 'ALO', status: 'dnf' },
      { position: 21, driverId: 'ALB', status: 'dnf' }, { position: 22, driverId: 'LIN', status: 'dns' },
    ],
    fastestLapDriverId: 'ANT', dnfDriverIds: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'], dnsDriverIds: ['LIN'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', status: 'finished' }, { position: 2, driverId: 'NOR', status: 'finished' },
      { position: 3, driverId: 'ANT', status: 'finished' }, { position: 4, driverId: 'PIA', status: 'finished' },
      { position: 5, driverId: 'LEC', status: 'finished' }, { position: 6, driverId: 'HAM', status: 'finished' },
      { position: 7, driverId: 'VER', status: 'finished' }, { position: 8, driverId: 'LIN', status: 'finished' },
    ],
  },
  { // r06 - Monaco GP
    raceId: 'r06',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' }, { position: 2, driverId: 'HAM', status: 'finished' },
      { position: 3, driverId: 'GAS', status: 'finished' }, { position: 4, driverId: 'HAD', status: 'finished' },
      { position: 5, driverId: 'PIA', status: 'finished' }, { position: 6, driverId: 'LAW', status: 'finished' },
      { position: 7, driverId: 'LIN', status: 'finished' }, { position: 8, driverId: 'ALB', status: 'finished' },
      { position: 9, driverId: 'OCO', status: 'finished' }, { position: 10, driverId: 'ALO', status: 'finished' },
      { position: 11, driverId: 'BOR', status: 'finished' }, { position: 12, driverId: 'RUS', status: 'finished' },
      { position: 13, driverId: 'HUL', status: 'finished' }, { position: 14, driverId: 'COL', status: 'finished' },
      { position: 15, driverId: 'PER', status: 'finished' },
      { position: 16, driverId: 'SAI', status: 'dnf' }, { position: 17, driverId: 'LEC', status: 'dnf' },
      { position: 18, driverId: 'STR', status: 'dnf' }, { position: 19, driverId: 'NOR', status: 'dnf' },
      { position: 20, driverId: 'BEA', status: 'dnf' }, { position: 21, driverId: 'BOT', status: 'dnf' },
      { position: 22, driverId: 'VER', status: 'dnf' },
    ],
    fastestLapDriverId: 'ANT', dnfDriverIds: ['SAI', 'LEC', 'STR', 'NOR', 'BEA', 'BOT', 'VER'], dnsDriverIds: [],
  },
  { // r07 - Barcelona GP
    raceId: 'r07',
    classification: [
      { position: 1, driverId: 'HAM', status: 'finished' }, { position: 2, driverId: 'RUS', status: 'finished' },
      { position: 3, driverId: 'NOR', status: 'finished' }, { position: 4, driverId: 'VER', status: 'finished' },
      { position: 5, driverId: 'PIA', status: 'finished' }, { position: 6, driverId: 'HAD', status: 'finished' },
      { position: 7, driverId: 'GAS', status: 'finished' }, { position: 8, driverId: 'LAW', status: 'finished' },
      { position: 9, driverId: 'LIN', status: 'finished' }, { position: 10, driverId: 'COL', status: 'finished' },
      { position: 11, driverId: 'BOR', status: 'finished' }, { position: 12, driverId: 'SAI', status: 'finished' },
      { position: 13, driverId: 'OCO', status: 'finished' }, { position: 14, driverId: 'PER', status: 'finished' },
      { position: 15, driverId: 'LEC', status: 'dnf' }, { position: 16, driverId: 'ANT', status: 'dnf' },
      { position: 17, driverId: 'BEA', status: 'dnf' }, { position: 18, driverId: 'ALB', status: 'dnf' },
      { position: 19, driverId: 'ALO', status: 'dnf' }, { position: 20, driverId: 'HUL', status: 'dnf' },
      { position: 21, driverId: 'BOT', status: 'dnf' }, { position: 22, driverId: 'STR', status: 'dnf' },
    ],
    fastestLapDriverId: 'HAM', dnfDriverIds: ['LEC', 'ANT', 'BEA', 'ALB', 'ALO', 'HUL', 'BOT', 'STR'], dnsDriverIds: [],
  },
];

const resultsByRace = {};
for (const r of CORRECT_RESULTS) resultsByRace[r.raceId] = r;

// ---- Scoring engine ----
function isDnf(s) { return ['dnf','retired','ret','did not finish','did_not_finish'].includes((s||'').trim().toLowerCase()); }
function isDns(s) { return ['dns','did not start','did_not_start'].includes((s||'').trim().toLowerCase()); }

function computeGp(top10, fastestLap, dnf, result) {
  let posPts = 0;
  const scored = new Set();
  const r10 = result.classification.filter(e => e.position <= 10).sort((a,b) => a.position - b.position).map(e => e.driverId);
  for (let i = 0; i < (top10||[]).length && i < 10; i++) {
    if (!top10[i] || scored.has(top10[i])) continue;
    scored.add(top10[i]);
    if (top10[i] === r10[i]) posPts += F1_POINTS[i];
  }
  let flPts = (fastestLap && fastestLap === result.fastestLapDriverId) ? FASTEST_LAP_BONUS : 0;
  let dnfPts = 0;
  const dnsIds = new Set(result.dnsDriverIds || []);
  for (const e of result.classification) { if (isDns(e.status)) dnsIds.add(e.driverId); }
  const trueDnfIds = new Set();
  for (const e of result.classification) { if (isDnf(e.status) && !dnsIds.has(e.driverId)) trueDnfIds.add(e.driverId); }
  for (const d of (result.dnfDriverIds || [])) { if (!dnsIds.has(d)) trueDnfIds.add(d); }
  if (!dnf && trueDnfIds.size === 0) dnfPts = DNF_BONUS;
  else if (dnf && dnsIds.has(dnf)) { /* DNS: no points */ }
  else if (dnf && trueDnfIds.has(dnf)) dnfPts = DNF_BONUS;
  return { gp: posPts + flPts + dnfPts, posPts, flPts, dnfPts };
}

function computeSprint(top8, sprintResult) {
  if (!top8 || top8.length === 0 || !sprintResult || sprintResult.length === 0) return 0;
  let pts = 0;
  const scored = new Set();
  const r8 = sprintResult.filter(e => e.position <= 8).sort((a,b) => a.position - b.position).map(e => e.driverId);
  for (let i = 0; i < top8.length && i < 8; i++) {
    if (!top8[i] || scored.has(top8[i])) continue;
    scored.add(top8[i]);
    if (top8[i] === r8[i]) pts += SPRINT_POINTS[i];
  }
  return pts;
}

async function main() {
  const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: rows, error } = await supabase
    .from('user_predictions')
    .select('*')
    .order('user_id, race_id');

  if (error) { console.error('Fetch error:', error); return; }

  console.log(`Found ${rows.length} prediction rows\n`);

  // ---- STEP 1: Fix race IDs ----
  console.log('=== STEP 1: Fix race IDs ===\n');
  let idFixes = 0;
  for (const row of rows) {
    const correctId = RACE_ID_FIX[row.race_id];
    if (correctId) {
      console.log(`  ${row.username} ${row.race_id} → ${correctId}`);
      const { error: updErr } = await supabase
        .from('user_predictions')
        .update({ race_id: correctId })
        .eq('id', row.id);
      if (updErr) {
        console.error(`  FAILED: ${updErr.message}`);
      } else {
        row.race_id = correctId;
        idFixes++;
      }
    }
  }
  console.log(`\nFixed ${idFixes} race IDs\n`);

  // ---- STEP 2: Recompute all points ----
  console.log('=== STEP 2: Recompute points ===\n');
  let pointFixes = 0;

  for (const row of rows) {
    const result = resultsByRace[row.race_id];
    if (!result) {
      console.log(`  SKIP ${row.username} ${row.race_id} - no race result`);
      continue;
    }

    const gpScore = computeGp(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result);
    const sprintScore = row.predicted_sprint_top8?.length > 0 && result.sprintClassification
      ? computeSprint(row.predicted_sprint_top8, result.sprintClassification) : 0;

    const correctGp = gpScore.gp;
    const correctSprint = sprintScore;
    const dbGp = row.points_earned || 0;
    const dbSprint = row.sprint_points_earned || 0;

    if (correctGp !== dbGp || correctSprint !== dbSprint) {
      console.log(`  FIX ${row.username} ${row.race_id}: GP ${dbGp}→${correctGp} Sprint ${dbSprint}→${correctSprint} (P:${gpScore.posPts} FL:${gpScore.flPts} DNF:${gpScore.dnfPts})`);
      const { error: updErr } = await supabase
        .from('user_predictions')
        .update({ points_earned: correctGp, sprint_points_earned: correctSprint })
        .eq('id', row.id);
      if (updErr) {
        console.error(`  FAILED: ${updErr.message}`);
      } else {
        pointFixes++;
      }
    } else {
      console.log(`  OK  ${row.username} ${row.race_id}: GP ${correctGp} Sprint ${correctSprint}`);
    }
  }
  console.log(`\nFixed ${pointFixes} point values\n`);

  // ---- STEP 3: Verify final totals ----
  console.log('=== STEP 3: Final totals ===\n');
  const totals = {};
  for (const row of rows) {
    const uid = row.user_id;
    if (!totals[uid]) totals[uid] = { username: row.username, displayName: row.display_name, gp: 0, sprint: 0, count: 0 };
    const result = resultsByRace[row.race_id];
    if (!result) continue;
    const gpScore = computeGp(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result);
    const spScore = row.predicted_sprint_top8?.length > 0 && result.sprintClassification
      ? computeSprint(row.predicted_sprint_top8, result.sprintClassification) : 0;
    totals[uid].gp += gpScore.gp;
    totals[uid].sprint += spScore;
    totals[uid].count++;
  }

  console.log('Username          | GP Pts | Sprint | Total  | Races');
  console.log('------------------|--------|--------|--------|------');
  for (const [uid, t] of Object.entries(totals)) {
    const total = t.gp + t.sprint;
    console.log(`${(t.displayName || t.username || '?').padEnd(17)} | ${String(t.gp).padStart(6)} | ${String(t.sprint).padStart(6)} | ${String(total).padStart(6)} | ${t.count}`);

    // Update profiles.total_points
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ total_points: total })
      .eq('id', uid);
    if (profErr) {
      console.log(`  Profile update FAILED for ${t.username}: ${profErr.message}`);
    }
  }

  // Remove admin test account from leaderboard
  console.log('\n=== STEP 4: Cleanup ===');
  const { error: delErr } = await supabase
    .from('user_predictions')
    .delete()
    .eq('user_id', 'ec85e5ec-edca-4196-91a6-56b19bfff6c7');
  if (delErr) {
    console.log('Admin cleanup:', delErr.message);
  } else {
    console.log('Admin test predictions removed.');
  }

  const { error: profDelErr } = await supabase
    .from('profiles')
    .update({ total_points: 0 })
    .eq('id', 'ec85e5ec-edca-4196-91a6-56b19bfff6c7');
  if (profDelErr) {
    console.log('Admin profile cleanup:', profDelErr.message);
  } else {
    console.log('Admin profile zeroed.');
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
