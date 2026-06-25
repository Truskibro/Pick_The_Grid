const https = require('https');

const SUPABASE_URL = 'fxwgbpassouaddakgyus.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const USERS = [
  { name: 'Skye Leach', id: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' },
  { name: 'Whitney Trujillo', id: '652154af-dc27-47b5-aa79-25903b9c4a1b' },
  { name: 'Bryan Leach', id: 'f35417e9-4f0d-4def-9c2f-c81276863fc0' },
  { name: 'Carlos Trujillo', id: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b' },
];

async function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: SUPABASE_URL, path, headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

// ── Scoring engine (duplicated from scoring.ts) ──
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// Race results from f1-data.ts
const RACE_RESULTS = {
  r01: {
    classification: [
      { position:1,  driverId:'RUS' },{ position:2,  driverId:'ANT' },{ position:3,  driverId:'LEC' },
      { position:4,  driverId:'HAM' },{ position:5,  driverId:'NOR' },{ position:6,  driverId:'VER' },
      { position:7,  driverId:'BEA' },{ position:8,  driverId:'LIN' },{ position:9,  driverId:'BOR' },
      { position:10, driverId:'GAS' },{ position:11, driverId:'OCO' },{ position:12, driverId:'ALB' },
      { position:13, driverId:'LAW' },{ position:14, driverId:'COL' },{ position:15, driverId:'SAI' },
      { position:16, driverId:'PER' },{ position:17, driverId:'STR' },
      { position:18, driverId:'ALO', status:'dnf' },{ position:19, driverId:'BOT', status:'dnf' },
      { position:20, driverId:'HAD', status:'dnf' },
    ],
    fastestLapDriverId: 'VER',
    dnsDriverIds: ['PIA', 'HUL'],
    dnfDriverIds: ['ALO', 'BOT', 'HAD'],
  },
  r02: {
    classification: [
      { position:1, driverId:'ANT' },{ position:2, driverId:'RUS' },{ position:3, driverId:'HAM' },
      { position:4, driverId:'LEC' },{ position:5, driverId:'BEA' },{ position:6, driverId:'GAS' },
      { position:7, driverId:'LAW' },{ position:8, driverId:'HAD' },{ position:9, driverId:'SAI' },
      { position:10, driverId:'COL' },{ position:11, driverId:'HUL' },{ position:12, driverId:'LIN' },
      { position:13, driverId:'BOT' },{ position:14, driverId:'OCO' },{ position:15, driverId:'PER' },
      { position:16, driverId:'VER', status:'dnf' },{ position:17, driverId:'ALO', status:'dnf' },
      { position:18, driverId:'STR', status:'dnf' },
    ],
    fastestLapDriverId: 'ANT',
    dnsDriverIds: ['PIA', 'NOR', 'BOR', 'ALB'],
    dnfDriverIds: ['VER', 'ALO', 'STR'],
    sprintClassification: [
      { position:1, driverId:'RUS' },{ position:2, driverId:'LEC' },{ position:3, driverId:'HAM' },
      { position:4, driverId:'NOR' },{ position:5, driverId:'ANT' },{ position:6, driverId:'PIA' },
      { position:7, driverId:'LAW' },{ position:8, driverId:'BEA' },
    ],
  },
  r03: {
    classification: [
      { position:1, driverId:'ANT' },{ position:2, driverId:'PIA' },{ position:3, driverId:'LEC' },
      { position:4, driverId:'RUS' },{ position:5, driverId:'NOR' },{ position:6, driverId:'HAM' },
      { position:7, driverId:'GAS' },{ position:8, driverId:'VER' },{ position:9, driverId:'LAW' },
      { position:10, driverId:'OCO' },{ position:11, driverId:'HUL' },{ position:12, driverId:'HAD' },
      { position:13, driverId:'BOR' },{ position:14, driverId:'LIN' },{ position:15, driverId:'SAI' },
      { position:16, driverId:'COL' },{ position:17, driverId:'PER' },{ position:18, driverId:'ALO' },
      { position:19, driverId:'BOT' },{ position:20, driverId:'ALB' },
      { position:21, driverId:'STR', status:'dnf' },{ position:22, driverId:'BEA', status:'dnf' },
    ],
    fastestLapDriverId: 'ANT',
    dnsDriverIds: [],
    dnfDriverIds: ['STR', 'BEA'],
  },
  r04: {
    classification: [
      { position:1, driverId:'ANT' },{ position:2, driverId:'NOR' },{ position:3, driverId:'PIA' },
      { position:4, driverId:'RUS' },{ position:5, driverId:'VER' },{ position:6, driverId:'HAM' },
      { position:7, driverId:'COL' },{ position:8, driverId:'LEC' },{ position:9, driverId:'SAI' },
      { position:10, driverId:'ALB' },{ position:11, driverId:'BEA' },{ position:12, driverId:'BOR' },
      { position:13, driverId:'OCO' },{ position:14, driverId:'LIN' },{ position:15, driverId:'ALO' },
      { position:16, driverId:'PER' },{ position:17, driverId:'STR' },{ position:18, driverId:'BOT' },
      { position:19, driverId:'HUL', status:'dnf' },{ position:20, driverId:'LAW', status:'dnf' },
      { position:21, driverId:'GAS', status:'dnf' },{ position:22, driverId:'HAD', status:'dnf' },
    ],
    fastestLapDriverId: 'NOR',
    dnsDriverIds: [],
    dnfDriverIds: ['HUL', 'LAW', 'GAS', 'HAD'],
    sprintClassification: [
      { position:1, driverId:'NOR' },{ position:2, driverId:'PIA' },{ position:3, driverId:'LEC' },
      { position:4, driverId:'RUS' },{ position:5, driverId:'VER' },{ position:6, driverId:'ANT' },
      { position:7, driverId:'HAM' },{ position:8, driverId:'GAS' },
    ],
  },
  r05: {
    classification: [
      { position:1, driverId:'ANT' },{ position:2, driverId:'HAM' },{ position:3, driverId:'VER' },
      { position:4, driverId:'LEC' },{ position:5, driverId:'HAD' },{ position:6, driverId:'COL' },
      { position:7, driverId:'LAW' },{ position:8, driverId:'GAS' },{ position:9, driverId:'SAI' },
      { position:10, driverId:'BEA' },{ position:11, driverId:'PIA' },{ position:12, driverId:'HUL' },
      { position:13, driverId:'BOR' },{ position:14, driverId:'OCO' },{ position:15, driverId:'STR' },
      { position:16, driverId:'BOT' },
      { position:17, driverId:'PER', status:'dnf' },{ position:18, driverId:'NOR', status:'dnf' },
      { position:19, driverId:'RUS', status:'dnf' },{ position:20, driverId:'ALO', status:'dnf' },
      { position:21, driverId:'ALB', status:'dnf' },
    ],
    fastestLapDriverId: 'ANT',
    dnsDriverIds: ['LIN'],
    dnfDriverIds: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'],
    sprintClassification: [
      { position:1, driverId:'RUS' },{ position:2, driverId:'NOR' },{ position:3, driverId:'ANT' },
      { position:4, driverId:'PIA' },{ position:5, driverId:'LEC' },{ position:6, driverId:'HAM' },
      { position:7, driverId:'VER' },{ position:8, driverId:'LIN' },
    ],
  },
  r06: {
    classification: [
      { position:1, driverId:'ANT' },{ position:2, driverId:'HAM' },{ position:3, driverId:'GAS' },
      { position:4, driverId:'HAD' },{ position:5, driverId:'PIA' },{ position:6, driverId:'LAW' },
      { position:7, driverId:'LIN' },{ position:8, driverId:'ALB' },{ position:9, driverId:'OCO' },
      { position:10, driverId:'ALO' },{ position:11, driverId:'BOR' },{ position:12, driverId:'RUS' },
      { position:13, driverId:'HUL' },{ position:14, driverId:'COL' },{ position:15, driverId:'PER' },
      { position:16, driverId:'SAI', status:'dnf' },{ position:17, driverId:'LEC', status:'dnf' },
      { position:18, driverId:'STR', status:'dnf' },{ position:19, driverId:'NOR', status:'dnf' },
      { position:20, driverId:'BEA', status:'dnf' },{ position:21, driverId:'BOT', status:'dnf' },
      { position:22, driverId:'VER', status:'dnf' },
    ],
    fastestLapDriverId: 'ANT',
    dnsDriverIds: [],
    dnfDriverIds: ['SAI', 'LEC', 'STR', 'NOR', 'BEA', 'BOT', 'VER'],
  },
  r07: {
    classification: [
      { position:1, driverId:'HAM' },{ position:2, driverId:'RUS' },{ position:3, driverId:'NOR' },
      { position:4, driverId:'VER' },{ position:5, driverId:'PIA' },{ position:6, driverId:'HAD' },
      { position:7, driverId:'GAS' },{ position:8, driverId:'LAW' },{ position:9, driverId:'LIN' },
      { position:10, driverId:'COL' },{ position:11, driverId:'BOR' },{ position:12, driverId:'SAI' },
      { position:13, driverId:'OCO' },{ position:14, driverId:'PER' },
      { position:15, driverId:'LEC', status:'dnf' },{ position:16, driverId:'ANT', status:'dnf' },
      { position:17, driverId:'BEA', status:'dnf' },
      { position:18, driverId:'ALB' },{ position:19, driverId:'ALO', status:'dnf' },
      { position:20, driverId:'HUL', status:'dnf' },{ position:21, driverId:'BOT', status:'dnf' },
      { position:22, driverId:'STR', status:'dnf' },
    ],
    fastestLapDriverId: 'HAM',
    dnsDriverIds: [],
    dnfDriverIds: ['LEC', 'ANT', 'BEA', 'ALO', 'HUL', 'BOT', 'STR'],
  },
};

function isDns(driverId, result) {
  return (result.dnsDriverIds || []).includes(driverId);
}

function getTrueDnfs(result) {
  const dnfIds = new Set(result.dnfDriverIds || []);
  const dnsIds = new Set(result.dnsDriverIds || []);
  // Also check classification statuses
  for (const entry of result.classification) {
    if (entry.status === 'dns') dnsIds.add(entry.driverId);
    if (entry.status === 'dnf' && !dnsIds.has(entry.driverId)) dnfIds.add(entry.driverId);
  }
  // Remove DNS from DNF
  for (const d of dnsIds) dnfIds.delete(d);
  return dnfIds;
}

function calcRacePoints(pred, result) {
  let posPoints = 0;

  const actualTop10 = result.classification
    .filter(e => e.position <= 10)
    .sort((a,b) => a.position - b.position)
    .map(e => e.driverId);

  const used = new Set();
  for (let i = 0; i < Math.min(pred.top10.length, 10); i++) {
    const p = pred.top10[i];
    if (!p || used.has(p)) continue;
    used.add(p);
    if (p === actualTop10[i]) {
      posPoints += F1_POINTS[i];
    }
  }

  let flPoints = 0;
  if (pred.fastestLap && pred.fastestLap === result.fastestLapDriverId) {
    flPoints = FASTEST_LAP_BONUS;
  }

  const trueDnfs = getTrueDnfs(result);
  let dnfPoints = 0;
  if (!pred.dnf && trueDnfs.size === 0) {
    dnfPoints = DNF_BONUS;
  } else if (pred.dnf && trueDnfs.has(pred.dnf)) {
    dnfPoints = DNF_BONUS;
  }

  return posPoints + flPoints + dnfPoints;
}

function calcSprintPoints(sprintTop8, sprintResult) {
  if (!sprintResult || sprintResult.length === 0) return 0;
  let pts = 0;
  const actual = sprintResult
    .filter(e => e.position <= 8)
    .sort((a,b) => a.position - b.position)
    .map(e => e.driverId);
  const used = new Set();
  for (let i = 0; i < Math.min(sprintTop8.length, 8); i++) {
    const p = sprintTop8[i];
    if (!p || used.has(p)) continue;
    used.add(p);
    if (p === actual[i]) {
      pts += SPRINT_POINTS[i];
    }
  }
  return pts;
}

async function main() {
  const preds = await supabaseGet('/rest/v1/user_predictions?select=*&order=race_id.asc,user_id.asc');
  const profiles = await supabaseGet('/rest/v1/profiles?select=*');

  console.log('=== SCORING ENGINE RECALCULATION ===\n');
  console.log('Comparing Supabase stored points vs scoring engine computed points\n');

  const raceOrder = ['r01','r02','r03','r04','r05','r06','r07'];
  let allMatch = true;

  for (const user of USERS) {
    console.log(`── ${user.name} ──`);
    const userPreds = preds.filter(p => p.user_id === user.id);
    let totalStored = 0;
    let totalComputed = 0;
    const discrepancies = [];

    for (const rid of raceOrder) {
      const pred = userPreds.find(p => p.race_id === rid);
      const result = RACE_RESULTS[rid];
      if (!result) continue;

      if (!pred) {
        console.log(`  ${rid}: NO PREDICTION IN SUPABASE`);
        continue;
      }

      // Compute race points
      const compRace = calcRacePoints({
        top10: pred.predicted_top10 || [],
        fastestLap: pred.predicted_fastest_lap,
        dnf: pred.predicted_dnf,
      }, result);

      // Compute sprint points
      const compSprint = calcSprintPoints(
        pred.predicted_sprint_top8 || [],
        result.sprintClassification || []
      );

      const storedRace = pred.points_earned || 0;
      const storedSprint = pred.sprint_points_earned || 0;
      const storedTotal = storedRace + storedSprint;
      const compTotal = compRace + compSprint;

      totalStored += storedTotal;
      totalComputed += compTotal;

      const raceMatch = storedRace === compRace;
      const sprintMatch = storedSprint === compSprint;

      if (!raceMatch || !sprintMatch) {
        allMatch = false;
        discrepancies.push({
          race: rid,
          stored: { race: storedRace, sprint: storedSprint, total: storedTotal },
          computed: { race: compRace, sprint: compSprint, total: compTotal },
        });
        console.log(`  ${rid}: STORED race=${storedRace} sprint=${storedSprint} total=${storedTotal}`);
        console.log(`        COMPUTED race=${compRace} sprint=${compSprint} total=${compTotal}  ✗ MISMATCH`);
        // Show the picks for debugging
        console.log(`        Picks: top10=${JSON.stringify(pred.predicted_top10?.slice(0,5))}..., FL=${pred.predicted_fastest_lap}, DNF=${pred.predicted_dnf}`);
        if (pred.predicted_sprint_top8?.length > 0) {
          console.log(`        Sprint: ${JSON.stringify(pred.predicted_sprint_top8)}`);
        }
      } else {
        console.log(`  ${rid}: race=${compRace} sprint=${compSprint} total=${compTotal}  ✓`);
      }
    }

    console.log(`  Total: stored=${totalStored}, computed=${totalComputed} ${totalStored === totalComputed ? '✓' : '✗'}`);
    console.log('');
  }

  // Profile check
  console.log('── Profile Total Points Check ──');
  for (const user of USERS) {
    const prof = profiles.find(p => p.id === user.id);
    const userPreds = preds.filter(p => p.user_id === user.id);
    const sumFromPreds = userPreds.reduce((s, p) => s + (p.points_earned||0) + (p.sprint_points_earned||0), 0);
    const profilePts = prof?.total_points || 0;
    const match = profilePts === sumFromPreds;
    if (!match) allMatch = false;
    console.log(`  ${user.name}: profile=${profilePts}, sum of predictions=${sumFromPreds} ${match ? '✓' : '✗'}`);
  }

  console.log('');
  if (allMatch) {
    console.log('✓ ALL DATA IS CONSISTENT');
  } else {
    console.log('✗ DISCREPANCIES FOUND — need to fix Supabase');
  }
}

main().catch(console.error);
