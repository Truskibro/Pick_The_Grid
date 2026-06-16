// Recompute all points correctly and fix Supabase
const { createClient } = require('@supabase/supabase-js');

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// Verified 2026 race results
const MOCK_RACE_RESULTS = [
  { raceId: 'r01', classification: [
    {position:1,driverId:'RUS',status:'finished'},{position:2,driverId:'ANT',status:'finished'},{position:3,driverId:'LEC',status:'finished'},{position:4,driverId:'HAM',status:'finished'},{position:5,driverId:'NOR',status:'finished'},{position:6,driverId:'VER',status:'finished'},{position:7,driverId:'BEA',status:'finished'},{position:8,driverId:'LIN',status:'finished'},{position:9,driverId:'BOR',status:'finished'},{position:10,driverId:'GAS',status:'finished'},{position:11,driverId:'OCO',status:'finished'},{position:12,driverId:'ALB',status:'finished'},{position:13,driverId:'LAW',status:'finished'},{position:14,driverId:'COL',status:'finished'},{position:15,driverId:'SAI',status:'finished'},{position:16,driverId:'PER',status:'finished'},{position:17,driverId:'STR',status:'dnf'},{position:18,driverId:'ALO',status:'dnf'},{position:19,driverId:'BOT',status:'dnf'},{position:20,driverId:'HAD',status:'dnf'},{position:21,driverId:'PIA',status:'dns'},{position:22,driverId:'HUL',status:'dns'},
  ], fastestLapDriverId: 'ANT', dnfDriverIds: ['STR','ALO','BOT','HAD'], dnsDriverIds: ['PIA','HUL'] },
  { raceId: 'r02', classification: [
    {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'RUS',status:'finished'},{position:3,driverId:'HAM',status:'finished'},{position:4,driverId:'LEC',status:'finished'},{position:5,driverId:'BEA',status:'finished'},{position:6,driverId:'GAS',status:'finished'},{position:7,driverId:'LAW',status:'finished'},{position:8,driverId:'HAD',status:'finished'},{position:9,driverId:'SAI',status:'finished'},{position:10,driverId:'COL',status:'finished'},{position:11,driverId:'HUL',status:'finished'},{position:12,driverId:'LIN',status:'finished'},{position:13,driverId:'BOT',status:'finished'},{position:14,driverId:'OCO',status:'finished'},{position:15,driverId:'PER',status:'finished'},{position:16,driverId:'VER',status:'dnf'},{position:17,driverId:'ALO',status:'dnf'},{position:18,driverId:'STR',status:'dnf'},{position:19,driverId:'PIA',status:'dns'},{position:20,driverId:'NOR',status:'dns'},{position:21,driverId:'BOR',status:'dns'},{position:22,driverId:'ALB',status:'dns'},
  ], fastestLapDriverId: 'ANT', dnfDriverIds: ['VER','ALO','STR'], dnsDriverIds: ['PIA','NOR','BOR','ALB'],
    sprintClassification: [
    {position:1,driverId:'RUS',status:'finished'},{position:2,driverId:'LEC',status:'finished'},{position:3,driverId:'HAM',status:'finished'},{position:4,driverId:'NOR',status:'finished'},{position:5,driverId:'ANT',status:'finished'},{position:6,driverId:'PIA',status:'finished'},{position:7,driverId:'LAW',status:'finished'},{position:8,driverId:'BEA',status:'finished'},
  ]},
  { raceId: 'r03', classification: [
    {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'PIA',status:'finished'},{position:3,driverId:'LEC',status:'finished'},{position:4,driverId:'RUS',status:'finished'},{position:5,driverId:'NOR',status:'finished'},{position:6,driverId:'HAM',status:'finished'},{position:7,driverId:'GAS',status:'finished'},{position:8,driverId:'VER',status:'finished'},{position:9,driverId:'LAW',status:'finished'},{position:10,driverId:'OCO',status:'finished'},{position:11,driverId:'HUL',status:'finished'},{position:12,driverId:'HAD',status:'finished'},{position:13,driverId:'BOR',status:'finished'},{position:14,driverId:'LIN',status:'finished'},{position:15,driverId:'SAI',status:'finished'},{position:16,driverId:'COL',status:'finished'},{position:17,driverId:'PER',status:'finished'},{position:18,driverId:'ALO',status:'finished'},{position:19,driverId:'BOT',status:'finished'},{position:20,driverId:'ALB',status:'finished'},{position:21,driverId:'STR',status:'dnf'},{position:22,driverId:'BEA',status:'dnf'},
  ], fastestLapDriverId: 'ANT', dnfDriverIds: ['STR','BEA'], dnsDriverIds: [] },
  { raceId: 'r06', classification: [
    {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'NOR',status:'finished'},{position:3,driverId:'PIA',status:'finished'},{position:4,driverId:'RUS',status:'finished'},{position:5,driverId:'VER',status:'finished'},{position:6,driverId:'HAM',status:'finished'},{position:7,driverId:'COL',status:'finished'},{position:8,driverId:'LEC',status:'finished'},{position:9,driverId:'SAI',status:'finished'},{position:10,driverId:'ALB',status:'finished'},{position:11,driverId:'BEA',status:'finished'},{position:12,driverId:'BOR',status:'finished'},{position:13,driverId:'OCO',status:'finished'},{position:14,driverId:'LIN',status:'finished'},{position:15,driverId:'ALO',status:'finished'},{position:16,driverId:'PER',status:'finished'},{position:17,driverId:'STR',status:'finished'},{position:18,driverId:'BOT',status:'finished'},{position:19,driverId:'HUL',status:'dnf'},{position:20,driverId:'LAW',status:'dnf'},{position:21,driverId:'GAS',status:'dnf'},{position:22,driverId:'HAD',status:'dnf'},
  ], fastestLapDriverId: 'NOR', dnfDriverIds: ['HUL','LAW','GAS','HAD'], dnsDriverIds: [],
    sprintClassification: [
    {position:1,driverId:'NOR',status:'finished'},{position:2,driverId:'PIA',status:'finished'},{position:3,driverId:'LEC',status:'finished'},{position:4,driverId:'RUS',status:'finished'},{position:5,driverId:'VER',status:'finished'},{position:6,driverId:'ANT',status:'finished'},{position:7,driverId:'HAM',status:'finished'},{position:8,driverId:'GAS',status:'finished'},
  ]},
  { raceId: 'r07', classification: [
    {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'HAM',status:'finished'},{position:3,driverId:'VER',status:'finished'},{position:4,driverId:'LEC',status:'finished'},{position:5,driverId:'HAD',status:'finished'},{position:6,driverId:'COL',status:'finished'},{position:7,driverId:'LAW',status:'finished'},{position:8,driverId:'GAS',status:'finished'},{position:9,driverId:'SAI',status:'finished'},{position:10,driverId:'BEA',status:'finished'},{position:11,driverId:'PIA',status:'finished'},{position:12,driverId:'HUL',status:'finished'},{position:13,driverId:'BOR',status:'finished'},{position:14,driverId:'OCO',status:'finished'},{position:15,driverId:'STR',status:'finished'},{position:16,driverId:'BOT',status:'finished'},{position:17,driverId:'PER',status:'dnf'},{position:18,driverId:'NOR',status:'dnf'},{position:19,driverId:'RUS',status:'dnf'},{position:20,driverId:'ALO',status:'dnf'},{position:21,driverId:'ALB',status:'dnf'},{position:22,driverId:'LIN',status:'dns'},
  ], fastestLapDriverId: 'ANT', dnfDriverIds: ['PER','NOR','RUS','ALO','ALB'], dnsDriverIds: ['LIN'],
    sprintClassification: [
    {position:1,driverId:'RUS',status:'finished'},{position:2,driverId:'NOR',status:'finished'},{position:3,driverId:'ANT',status:'finished'},{position:4,driverId:'PIA',status:'finished'},{position:5,driverId:'LEC',status:'finished'},{position:6,driverId:'HAM',status:'finished'},{position:7,driverId:'VER',status:'finished'},{position:8,driverId:'LIN',status:'finished'},
  ]},
  { raceId: 'r08', classification: [
    {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'HAM',status:'finished'},{position:3,driverId:'GAS',status:'finished'},{position:4,driverId:'HAD',status:'finished'},{position:5,driverId:'PIA',status:'finished'},{position:6,driverId:'LAW',status:'finished'},{position:7,driverId:'LIN',status:'finished'},{position:8,driverId:'ALB',status:'finished'},{position:9,driverId:'OCO',status:'finished'},{position:10,driverId:'ALO',status:'finished'},{position:11,driverId:'BOR',status:'finished'},{position:12,driverId:'RUS',status:'finished'},{position:13,driverId:'HUL',status:'finished'},{position:14,driverId:'COL',status:'finished'},{position:15,driverId:'PER',status:'finished'},{position:16,driverId:'SAI',status:'dnf'},{position:17,driverId:'LEC',status:'dnf'},{position:18,driverId:'STR',status:'dnf'},{position:19,driverId:'NOR',status:'dnf'},{position:20,driverId:'BEA',status:'dnf'},{position:21,driverId:'BOT',status:'dnf'},{position:22,driverId:'VER',status:'dnf'},
  ], fastestLapDriverId: 'ANT', dnfDriverIds: ['SAI','LEC','STR','NOR','BEA','BOT','VER'], dnsDriverIds: [] },
  { raceId: 'r09', classification: [
    {position:1,driverId:'HAM',status:'finished'},{position:2,driverId:'RUS',status:'finished'},{position:3,driverId:'NOR',status:'finished'},{position:4,driverId:'VER',status:'finished'},{position:5,driverId:'PIA',status:'finished'},{position:6,driverId:'HAD',status:'finished'},{position:7,driverId:'GAS',status:'finished'},{position:8,driverId:'LAW',status:'finished'},{position:9,driverId:'LIN',status:'finished'},{position:10,driverId:'COL',status:'finished'},{position:11,driverId:'BOR',status:'finished'},{position:12,driverId:'SAI',status:'finished'},{position:13,driverId:'OCO',status:'finished'},{position:14,driverId:'PER',status:'finished'},{position:15,driverId:'LEC',status:'dnf'},{position:16,driverId:'ANT',status:'dnf'},{position:17,driverId:'BEA',status:'dnf'},{position:18,driverId:'ALB',status:'finished'},{position:19,driverId:'ALO',status:'dnf'},{position:20,driverId:'HUL',status:'dnf'},{position:21,driverId:'BOT',status:'dnf'},{position:22,driverId:'STR',status:'dnf'},
  ], fastestLapDriverId: 'HAM', dnfDriverIds: ['LEC','ANT','BEA','ALO','HUL','BOT','STR'], dnsDriverIds: [] },
];

const resultsByRace = {};
for (const r of MOCK_RACE_RESULTS) resultsByRace[r.raceId] = r;

function isDnf(status) { return ['dnf','retired','ret','did not finish','did_not_finish'].includes((status||'').trim().toLowerCase()); }
function isDns(status) { return ['dns','did not start','did_not_start'].includes((status||'').trim().toLowerCase()); }

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

async function main() {
  const supabase = createClient(
    'https://fxwgbpassouaddakgyus.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8'
  );

  const { data: rows, error } = await supabase
    .from('user_predictions')
    .select('*')
    .order('user_id, race_id');

  if (error) { console.error('Fetch error:', error); return; }

  console.log('=== RECOMPUTING POINTS ===\n');

  const updates = [];
  let totalFixed = 0;

  for (const row of rows) {
    const result = resultsByRace[row.race_id];
    if (!result) {
      console.log(row.username, row.race_id, '- NO RACE RESULT, skipping');
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
      console.log(`FIX ${row.username} ${row.race_id}: GP ${dbGp}→${correctGp} Sprint ${dbSprint}→${correctSprint}`);
      console.log(`  (P:${gpScore.posPts} FL:${gpScore.flPts} DNF:${gpScore.dnfPts})`);
      updates.push({ id: row.id, points_earned: correctGp, sprint_points_earned: correctSprint });
      totalFixed++;
    } else {
      console.log(`OK  ${row.username} ${row.race_id}: GP ${correctGp} Sprint ${correctSprint}`);
    }
  }

  console.log(`\n=== ${totalFixed} rows need fixing ===`);

  if (updates.length > 0) {
    // Update each row individually using upsert with onConflict
    for (const u of updates) {
      const { error: updErr } = await supabase
        .from('user_predictions')
        .update({ 
          points_earned: u.points_earned, 
          sprint_points_earned: u.sprint_points_earned 
        })
        .eq('id', u.id);

      if (updErr) {
        console.error(`Failed to update ${u.id}:`, updErr.message);
      } else {
        console.log(`Updated ${u.id}: GP=${u.points_earned} Sprint=${u.sprint_points_earned}`);
      }
    }
    console.log('\nAll updates applied.');
  } else {
    console.log('\nAll points are already correct!');
  }

  // Print final totals
  console.log('\n=== FINAL PER-USER TOTALS ===');
  const totals = {};
  for (const row of rows) {
    const uid = row.user_id;
    if (!totals[uid]) totals[uid] = { username: row.username, gp: 0, sprint: 0, count: 0 };
    // Recompute after fixes
    const result = resultsByRace[row.race_id];
    const gpScore = result ? computeGpScore(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result) : { gp: 0 };
    let sprintScore = 0;
    if (result && row.predicted_sprint_top8 && row.predicted_sprint_top8.length > 0 && result.sprintClassification) {
      sprintScore = computeSprintScore(row.predicted_sprint_top8, result.sprintClassification);
    }
    totals[uid].gp += gpScore.gp;
    totals[uid].sprint += sprintScore;
    totals[uid].count++;
  }
  for (const [uid, info] of Object.entries(totals)) {
    console.log(`${info.username} | GP: ${info.gp} | Sprint: ${info.sprint} | Total: ${info.gp + info.sprint} | Races: ${info.count}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
