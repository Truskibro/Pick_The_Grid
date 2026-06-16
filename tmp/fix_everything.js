// Comprehensive fix: correct race IDs, recompute all points
const { createClient } = require('@supabase/supabase-js');

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// === VERIFIED 2026 F1 RESULTS (from formula1.com + FIA docs) ===
const RESULTS = {
  r01: {
    raceId: 'r01',
    classification: [
      {position:1,driverId:'RUS'},{position:2,driverId:'ANT'},{position:3,driverId:'LEC'},
      {position:4,driverId:'HAM'},{position:5,driverId:'NOR'},{position:6,driverId:'VER'},
      {position:7,driverId:'BEA'},{position:8,driverId:'LIN'},{position:9,driverId:'BOR'},
      {position:10,driverId:'GAS'},{position:11,driverId:'OCO'},{position:12,driverId:'ALB'},
      {position:13,driverId:'LAW'},{position:14,driverId:'COL'},{position:15,driverId:'SAI'},
      {position:16,driverId:'PER'},{position:17,driverId:'STR',status:'dnf'},
      {position:18,driverId:'ALO',status:'dnf'},{position:19,driverId:'BOT',status:'dnf'},
      {position:20,driverId:'HAD',status:'dnf'},{position:21,driverId:'PIA',status:'dns'},
      {position:22,driverId:'HUL',status:'dns'},
    ],
    fastestLapDriverId: 'VER',
    dnfDriverIds: ['STR','ALO','BOT','HAD'],
    dnsDriverIds: ['PIA','HUL'],
  },
  r02: {
    raceId: 'r02',
    classification: [
      {position:1,driverId:'ANT'},{position:2,driverId:'RUS'},{position:3,driverId:'HAM'},
      {position:4,driverId:'LEC'},{position:5,driverId:'BEA'},{position:6,driverId:'GAS'},
      {position:7,driverId:'LAW'},{position:8,driverId:'HAD'},{position:9,driverId:'SAI'},
      {position:10,driverId:'COL'},{position:11,driverId:'HUL'},{position:12,driverId:'LIN'},
      {position:13,driverId:'BOT'},{position:14,driverId:'OCO'},{position:15,driverId:'PER'},
      {position:16,driverId:'VER',status:'dnf'},{position:17,driverId:'ALO',status:'dnf'},
      {position:18,driverId:'STR',status:'dnf'},{position:19,driverId:'PIA',status:'dns'},
      {position:20,driverId:'NOR',status:'dns'},{position:21,driverId:'BOR',status:'dns'},
      {position:22,driverId:'ALB',status:'dns'},
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['VER','ALO','STR'],
    dnsDriverIds: ['PIA','NOR','BOR','ALB'],
    sprintClassification: [
      {position:1,driverId:'RUS'},{position:2,driverId:'LEC'},{position:3,driverId:'HAM'},
      {position:4,driverId:'NOR'},{position:5,driverId:'ANT'},{position:6,driverId:'PIA'},
      {position:7,driverId:'LAW'},{position:8,driverId:'BEA'},
    ],
  },
  r03: {
    raceId: 'r03',
    classification: [
      {position:1,driverId:'ANT'},{position:2,driverId:'PIA'},{position:3,driverId:'LEC'},
      {position:4,driverId:'RUS'},{position:5,driverId:'NOR'},{position:6,driverId:'HAM'},
      {position:7,driverId:'GAS'},{position:8,driverId:'VER'},{position:9,driverId:'LAW'},
      {position:10,driverId:'OCO'},{position:11,driverId:'HUL'},{position:12,driverId:'HAD'},
      {position:13,driverId:'BOR'},{position:14,driverId:'LIN'},{position:15,driverId:'SAI'},
      {position:16,driverId:'COL'},{position:17,driverId:'PER'},{position:18,driverId:'ALO'},
      {position:19,driverId:'BOT'},{position:20,driverId:'ALB'},
      {position:21,driverId:'STR',status:'dnf'},{position:22,driverId:'BEA',status:'dnf'},
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR','BEA'],
    dnsDriverIds: [],
  },
  r04: {
    raceId: 'r04',
    classification: [
      {position:1,driverId:'ANT'},{position:2,driverId:'NOR'},{position:3,driverId:'PIA'},
      {position:4,driverId:'RUS'},{position:5,driverId:'VER'},{position:6,driverId:'HAM'},
      {position:7,driverId:'COL'},{position:8,driverId:'LEC'},{position:9,driverId:'SAI'},
      {position:10,driverId:'ALB'},{position:11,driverId:'BEA'},{position:12,driverId:'BOR'},
      {position:13,driverId:'OCO'},{position:14,driverId:'LIN'},{position:15,driverId:'ALO'},
      {position:16,driverId:'PER'},{position:17,driverId:'STR'},{position:18,driverId:'BOT'},
      {position:19,driverId:'HUL',status:'dnf'},{position:20,driverId:'LAW',status:'dnf'},
      {position:21,driverId:'GAS',status:'dnf'},{position:22,driverId:'HAD',status:'dnf'},
    ],
    fastestLapDriverId: 'NOR',
    dnfDriverIds: ['HUL','LAW','GAS','HAD'],
    dnsDriverIds: [],
    sprintClassification: [
      {position:1,driverId:'NOR'},{position:2,driverId:'PIA'},{position:3,driverId:'LEC'},
      {position:4,driverId:'RUS'},{position:5,driverId:'VER'},{position:6,driverId:'ANT'},
      {position:7,driverId:'HAM'},{position:8,driverId:'GAS'},
    ],
  },
  r05: {
    raceId: 'r05',
    classification: [
      {position:1,driverId:'ANT'},{position:2,driverId:'HAM'},{position:3,driverId:'VER'},
      {position:4,driverId:'LEC'},{position:5,driverId:'HAD'},{position:6,driverId:'COL'},
      {position:7,driverId:'LAW'},{position:8,driverId:'GAS'},{position:9,driverId:'SAI'},
      {position:10,driverId:'BEA'},{position:11,driverId:'PIA'},{position:12,driverId:'HUL'},
      {position:13,driverId:'BOR'},{position:14,driverId:'OCO'},{position:15,driverId:'STR'},
      {position:16,driverId:'BOT'},{position:17,driverId:'PER',status:'dnf'},
      {position:18,driverId:'NOR',status:'dnf'},{position:19,driverId:'RUS',status:'dnf'},
      {position:20,driverId:'ALO',status:'dnf'},{position:21,driverId:'ALB',status:'dnf'},
      {position:22,driverId:'LIN',status:'dns'},
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['PER','NOR','RUS','ALO','ALB'],
    dnsDriverIds: ['LIN'],
    sprintClassification: [
      {position:1,driverId:'RUS'},{position:2,driverId:'NOR'},{position:3,driverId:'ANT'},
      {position:4,driverId:'PIA'},{position:5,driverId:'LEC'},{position:6,driverId:'HAM'},
      {position:7,driverId:'VER'},{position:8,driverId:'LIN'},
    ],
  },
  r06: {
    raceId: 'r06',
    classification: [
      {position:1,driverId:'ANT'},{position:2,driverId:'HAM'},{position:3,driverId:'GAS'},
      {position:4,driverId:'HAD'},{position:5,driverId:'PIA'},{position:6,driverId:'LAW'},
      {position:7,driverId:'LIN'},{position:8,driverId:'ALB'},{position:9,driverId:'OCO'},
      {position:10,driverId:'ALO'},{position:11,driverId:'BOR'},{position:12,driverId:'RUS'},
      {position:13,driverId:'HUL'},{position:14,driverId:'COL'},{position:15,driverId:'PER'},
      {position:16,driverId:'SAI',status:'dnf'},{position:17,driverId:'LEC',status:'dnf'},
      {position:18,driverId:'STR',status:'dnf'},{position:19,driverId:'NOR',status:'dnf'},
      {position:20,driverId:'BEA',status:'dnf'},{position:21,driverId:'BOT',status:'dnf'},
      {position:22,driverId:'VER',status:'dnf'},
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['SAI','LEC','STR','NOR','BEA','BOT','VER'],
    dnsDriverIds: [],
  },
  r07: {
    raceId: 'r07',
    classification: [
      {position:1,driverId:'HAM'},{position:2,driverId:'RUS'},{position:3,driverId:'NOR'},
      {position:4,driverId:'VER'},{position:5,driverId:'PIA'},{position:6,driverId:'HAD'},
      {position:7,driverId:'GAS'},{position:8,driverId:'LAW'},{position:9,driverId:'LIN'},
      {position:10,driverId:'COL'},{position:11,driverId:'BOR'},{position:12,driverId:'SAI'},
      {position:13,driverId:'OCO'},{position:14,driverId:'PER'},
      {position:15,driverId:'LEC',status:'dnf'},{position:16,driverId:'ANT',status:'dnf'},
      {position:17,driverId:'BEA',status:'dnf'},{position:18,driverId:'ALB',status:'dnf'},
      {position:19,driverId:'ALO',status:'dnf'},{position:20,driverId:'HUL',status:'dnf'},
      {position:21,driverId:'BOT',status:'dnf'},{position:22,driverId:'STR',status:'dnf'},
    ],
    fastestLapDriverId: 'HAM',
    dnfDriverIds: ['LEC','ANT','BEA','ALB','ALO','HUL','BOT','STR'],
    dnsDriverIds: [],
  },
};

// === SCORING FUNCTIONS ===
function isDnf(status) {
  return ['dnf','retired','ret','did not finish','did_not_finish'].includes((status||'').trim().toLowerCase());
}
function isDns(status) {
  return ['dns','did not start','did_not_start'].includes((status||'').trim().toLowerCase());
}

function computeGpScore(top10, fastestLap, dnf, result) {
  let posPts = 0;
  const scored = new Set();
  const resultTop10 = result.classification
    .filter(e => e.position <= 10)
    .sort((a,b) => a.position - b.position)
    .map(e => e.driverId);

  for (let i = 0; i < (top10||[]).length && i < 10; i++) {
    const pred = top10[i];
    const actual = resultTop10[i];
    if (!pred) continue;
    if (scored.has(pred)) continue;
    scored.add(pred);
    if (pred === actual) posPts += F1_POINTS[i];
  }

  let flPts = 0;
  if (fastestLap && fastestLap === result.fastestLapDriverId) flPts = FASTEST_LAP_BONUS;

  let dnfPts = 0;
  const dnsIds = new Set(result.dnsDriverIds || []);
  for (const e of result.classification) { if (isDns(e.status)) dnsIds.add(e.driverId); }
  const dnfIds = new Set();
  for (const e of result.classification) { if (isDnf(e.status) && !dnsIds.has(e.driverId)) dnfIds.add(e.driverId); }
  for (const d of (result.dnfDriverIds || [])) { if (!dnsIds.has(d)) dnfIds.add(d); }

  if (!dnf && dnfIds.size === 0) { dnfPts = DNF_BONUS; }
  else if (dnf && dnsIds.has(dnf)) { /* DNS = no points */ }
  else if (dnf && dnfIds.has(dnf)) { dnfPts = DNF_BONUS; }

  return { gp: posPts + flPts + dnfPts, posPts, flPts, dnfPts };
}

function computeSprintScore(sprintTop8, sprintResult) {
  if (!sprintResult || sprintResult.length === 0) return 0;
  let posPts = 0;
  const scored = new Set();
  const resultTop8 = sprintResult
    .filter(e => e.position <= 8)
    .sort((a,b) => a.position - b.position)
    .map(e => e.driverId);

  for (let i = 0; i < (sprintTop8||[]).length && i < 8; i++) {
    const pred = sprintTop8[i];
    const actual = resultTop8[i];
    if (!pred) continue;
    if (scored.has(pred)) continue;
    scored.add(pred);
    if (pred === actual) posPts += SPRINT_POINTS[i];
  }
  return posPts;
}

// === RACE ID MAPPING: Fix shifted IDs ===
const RACE_ID_FIX = { 'r06': 'r04', 'r07': 'r05', 'r08': 'r06', 'r09': 'r07' };

async function main() {
  const supabase = createClient(
    'https://fxwgbpassouaddakgyus.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8'
  );

  // --- STEP 1: Delete test Admin account ---
  console.log('=== STEP 1: Remove test Admin account ===');
  const { data: adminRows } = await supabase.from('user_predictions').select('id').eq('user_id', 'ec85e5ec');
  if (adminRows && adminRows.length > 0) {
    for (const r of adminRows) {
      const { error } = await supabase.from('user_predictions').delete().eq('id', r.id);
      console.log(error ? `  FAILED delete: ${error.message}` : `  Deleted Admin row ${r.id}`);
    }
  }

  // --- STEP 2: Fix race IDs in DB ---
  console.log('\n=== STEP 2: Fix shifted race IDs ===');
  for (const [oldId, newId] of Object.entries(RACE_ID_FIX)) {
    const { error } = await supabase
      .from('user_predictions')
      .update({ race_id: newId })
      .eq('race_id', oldId);
    console.log(error ? `  FAILED ${oldId}→${newId}: ${error.message}` : `  Fixed ${oldId}→${newId}`);
  }

  // --- STEP 3: Fetch all rows and recompute ---
  console.log('\n=== STEP 3: Recompute all points ===');
  const { data: rows, error } = await supabase
    .from('user_predictions')
    .select('*')
    .order('user_id, race_id');

  if (error) { console.error('Fetch error:', error); return; }

  const validRaceIds = ['r01','r02','r03','r04','r05','r06','r07'];
  let totalFixed = 0;

  for (const row of rows) {
    const result = RESULTS[row.race_id];
    if (!result) {
      console.log(`  ${row.username} ${row.race_id} - NO RESULT, skipping`);
      continue;
    }

    const gpScore = computeGpScore(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result);
    let sprintScore = 0;
    if (row.predicted_sprint_top8 && row.predicted_sprint_top8.length > 0 && result.sprintClassification) {
      sprintScore = computeSprintScore(row.predicted_sprint_top8, result.sprintClassification);
    }

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
      if (updErr) console.error(`    FAILED: ${updErr.message}`);
      else totalFixed++;
    } else {
      console.log(`  OK  ${row.username} ${row.race_id}: GP ${correctGp} Sprint ${correctSprint} (P:${gpScore.posPts} FL:${gpScore.flPts} DNF:${gpScore.dnfPts})`);
    }
  }

  console.log(`\n=== ${totalFixed} rows fixed ===`);

  // --- STEP 4: Print final totals ---
  console.log('\n=== FINAL LEADERBOARD ===');
  const { data: finalRows } = await supabase
    .from('user_predictions')
    .select('*')
    .order('user_id, race_id');

  const totals = {};
  for (const row of finalRows) {
    if (!validRaceIds.includes(row.race_id)) continue;
    const uid = row.user_id;
    if (!totals[uid]) totals[uid] = { username: row.username, gp: 0, sprint: 0, count: 0 };
    totals[uid].gp += (row.points_earned || 0);
    totals[uid].sprint += (row.sprint_points_earned || 0);
    totals[uid].count++;
  }

  const sorted = Object.entries(totals).sort((a,b) => (b[1].gp+b[1].sprint) - (a[1].gp+a[1].sprint));
  let rank = 1;
  for (const [uid, info] of sorted) {
    console.log(`  #${rank} ${info.username.padEnd(15)} | GP: ${String(info.gp).padStart(3)} | Sprint: ${String(info.sprint).padStart(2)} | Total: ${String(info.gp+info.sprint).padStart(3)} | Races: ${info.count}`);
    rank++;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
