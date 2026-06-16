// Query Supabase DB and compute correct leaderboard totals
const { Client } = require('pg');

const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_USER = 'postgres.fxwgbpassouaddakgyus';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 6543;

// Scoring engine (mirrors scoring.ts)
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

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
  const client = new Client({
    host: HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase.\n');

    // 1. Check all prediction rows
    const { rows } = await client.query(
      'SELECT id, user_id, username, display_name, race_id, points_earned, sprint_points_earned, predicted_top10, predicted_fastest_lap, predicted_dnf, predicted_sprint_top8 FROM user_predictions ORDER BY user_id, race_id'
    );

    console.log('=== ALL PREDICTION ROWS ===');
    const userNames = {};
    for (const row of rows) {
      console.log(`${row.username || '(no name)'} | ${row.race_id} | GP:${row.points_earned} Sprint:${row.sprint_points_earned} | display_name:"${row.display_name || ''}"`);
      if (!userNames[row.user_id]) {
        userNames[row.user_id] = { username: row.username, displayName: row.display_name };
      }
    }

    // 2. Recompute correct points
    console.log('\n=== RECOMPUTED POINTS ===');
    let discrepancies = 0;
    const correctTotals = {};

    for (const row of rows) {
      const result = resultsByRace[row.race_id];
      if (!result) {
        console.log(`SKIP ${row.username} ${row.race_id} - no result data`);
        continue;
      }

      const gpScore = computeGpScore(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result);
      let sprintScore = 0;
      if (row.predicted_sprint_top8 && row.predicted_sprint_top8.length > 0 && result.sprintClassification) {
        sprintScore = computeSprintScore(row.predicted_sprint_top8, result.sprintClassification);
      }

      const correctGp = gpScore.gp;
      const correctSprint = sprintScore;
      const correctTotal = correctGp + correctSprint;
      const dbTotal = (row.points_earned || 0) + (row.sprint_points_earned || 0);

      if (correctGp !== (row.points_earned || 0) || correctSprint !== (row.sprint_points_earned || 0)) {
        console.log(`**FIX** ${row.username} ${row.race_id}: DB(GP:${row.points_earned} Sprint:${row.sprint_points_earned}) -> CORRECT(GP:${correctGp} Sprint:${correctSprint}) [P:${gpScore.posPts} FL:${gpScore.flPts} DNF:${gpScore.dnfPts}]`);
        discrepancies++;
      }

      // Track correct totals
      const uid = row.user_id;
      if (!correctTotals[uid]) correctTotals[uid] = { username: row.username, displayName: row.display_name, gp: 0, sprint: 0, total: 0 };
      correctTotals[uid].gp += correctGp;
      correctTotals[uid].sprint += correctSprint;
      correctTotals[uid].total += correctTotal;
    }

    // 3. Show current DB totals from leaderboard query approach
    console.log('\n=== DB LEADERBOARD TOTALS (sum of points_earned + sprint_points_earned) ===');
    const { rows: dbTotals } = await client.query(
      'SELECT user_id, username, display_name, SUM(COALESCE(points_earned,0) + COALESCE(sprint_points_earned,0)) as total FROM user_predictions GROUP BY user_id, username, display_name ORDER BY total DESC'
    );
    for (const row of dbTotals) {
      console.log(`${row.username || row.display_name || '(unnamed)'} | ${row.total} pts`);
    }

    // 4. Show CORRECT totals
    console.log('\n=== CORRECT LEADERBOARD TOTALS ===');
    const sorted = Object.entries(correctTotals).sort((a,b) => b[1].total - a[1].total);
    for (const [uid, info] of sorted) {
      console.log(`${info.username || info.displayName || uid.substring(0,8)} | GP:${info.gp} Sprint:${info.sprint} Total:${info.total}`);
    }

    // 5. Check profiles table
    console.log('\n=== PROFILES TABLE ===');
    const { rows: profiles } = await client.query('SELECT id, username, display_name, total_points FROM profiles ORDER BY username');
    for (const p of profiles) {
      console.log(`${p.username || '(no username)'} | display:"${p.display_name || ''}" | total_points: ${p.total_points}`);
    }

    // 6. Check for placeholder names
    console.log('\n=== PLACEHOLDER NAME AUDIT ===');
    const placeholderPatterns = ['Unknown', 'user_', 'Guest', 'Player', 'unnamed'];
    for (const row of rows) {
      const name = row.username || row.display_name || '';
      if (placeholderPatterns.some(p => name.toLowerCase().includes(p.toLowerCase())) || !name) {
        console.log(`PLACEHOLDER: user_id=${row.user_id} race=${row.race_id} username="${row.username}" display_name="${row.display_name}"`);
      }
    }

    // 7. Fix discrepancies if any
    if (discrepancies > 0) {
      console.log(`\n=== FIXING ${discrepancies} DISCREPANCIES ===`);
      for (const row of rows) {
        const result = resultsByRace[row.race_id];
        if (!result) continue;

        const gpScore = computeGpScore(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result);
        let sprintScore = 0;
        if (row.predicted_sprint_top8 && row.predicted_sprint_top8.length > 0 && result.sprintClassification) {
          sprintScore = computeSprintScore(row.predicted_sprint_top8, result.sprintClassification);
        }

        if (gpScore.gp !== (row.points_earned || 0) || sprintScore !== (row.sprint_points_earned || 0)) {
          await client.query(
            'UPDATE user_predictions SET points_earned = $1, sprint_points_earned = $2 WHERE id = $3',
            [gpScore.gp, sprintScore, row.id]
          );
          console.log(`Fixed ${row.id}: ${row.username} ${row.race_id} GP=${gpScore.gp} Sprint=${sprintScore}`);
        }
      }
    }

    // 8. Update profiles total_points
    console.log('\n=== UPDATING PROFILES TOTAL_POINTS ===');
    for (const [uid, info] of Object.entries(correctTotals)) {
      const { rows: profileRows } = await client.query('SELECT id FROM profiles WHERE id = $1', [uid]);
      if (profileRows.length > 0) {
        await client.query('UPDATE profiles SET total_points = $1 WHERE id = $2', [info.total, uid]);
        console.log(`Updated profile ${info.username || uid.substring(0,8)}: total_points = ${info.total}`);
      }
    }

    console.log('\nDone!');
    await client.end();
  } catch (e) {
    console.error('Error:', e.message);
    try { await client.end(); } catch {}
    process.exit(1);
  }
}

main();
