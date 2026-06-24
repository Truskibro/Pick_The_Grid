/**
 * COMPREHENSIVE SUPABASE AUDIT
 * 1. Extract predictions from spreadsheet (source of truth)
 * 2. Compare against Supabase user_predictions
 * 3. Recompute all points using the scoring engine
 * 4. Report and fix all discrepancies
 */

const XLSX = require('xlsx');
const https = require('https');

// ── User IDs ──────────────────────────────────────────────────────────────
const USERS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'Skye Leach',
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 'Whitney Trujillo',
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'Bryan Leach',
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'Carlos Trujillo',
};

const USER_NAMES = {
  'Skye Leach': { id: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4', first: 'Skye' },
  'Whitney Trujillo': { id: '652154af-dc27-47b5-aa79-25903b9c4a1b', first: 'Whitney' },
  'Bryan Leach': { id: 'f35417e9-4f0d-4def-9c2f-c81276863fc0', first: 'Bryan' },
  'Carlos Trujillo': { id: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b', first: 'Carlos' },
};

// ── Supabase config ───────────────────────────────────────────────────────
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

// ── Scoring engine (replicated from expo/lib/scoring.ts) ──────────────────
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

function norm(str) {
  return (str || '').trim().toUpperCase();
}

function isDnsStatus(status) {
  return ['dns', 'did not start', 'did_not_start'].includes((status || '').trim().toLowerCase());
}

function isTrueDnfStatus(status) {
  return ['dnf', 'retired', 'ret', 'did not finish', 'did_not_finish'].includes((status || '').trim().toLowerCase());
}

function getDnsDriverIds(classification) {
  const dnsIds = new Set();
  for (const entry of classification) {
    if (isDnsStatus(entry.status)) {
      dnsIds.add(norm(entry.driverId));
    }
  }
  return dnsIds;
}

function getTrueDnfDriverIds(classification, dnsIds) {
  const dnfIds = new Set();
  for (const entry of classification) {
    const did = norm(entry.driverId);
    if (dnsIds.has(did)) continue;
    if (isTrueDnfStatus(entry.status)) {
      dnfIds.add(did);
    }
  }
  return dnfIds;
}

function calculateMainPoints(predictionTop10, predictionFL, predictionDNF, classification, fastestLapDriverId) {
  let positionPoints = 0;
  const correctPositions = [];
  const alreadyScored = new Set();

  const resultTop10 = classification
    .filter(e => e.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map(e => norm(e.driverId));

  for (let i = 0; i < Math.min(predictionTop10.length, 10); i++) {
    const predicted = norm(predictionTop10[i]);
    const actual = resultTop10[i];
    if (!predicted) continue;
    if (alreadyScored.has(predicted)) continue;
    alreadyScored.add(predicted);
    if (predicted === actual) {
      positionPoints += F1_POINTS[i];
      correctPositions.push(i);
    }
  }

  let flPoints = 0;
  if (norm(predictionFL) === norm(fastestLapDriverId)) {
    flPoints = FASTEST_LAP_BONUS;
  }

  let dnfPoints = 0;
  const predDnf = norm(predictionDNF);
  const dnsIds = getDnsDriverIds(classification);
  const dnfIds = getTrueDnfDriverIds(classification, dnsIds);

  if (!predDnf && dnfIds.size === 0) {
    dnfPoints = DNF_BONUS;
  } else if (predDnf && dnsIds.has(predDnf)) {
    // DNS - no DNF points
  } else if (predDnf && dnfIds.has(predDnf)) {
    dnfPoints = DNF_BONUS;
  }

  return {
    positionPoints,
    correctPositions,
    flPoints,
    dnfPoints,
    totalPoints: positionPoints + flPoints + dnfPoints,
  };
}

function calculateSprintPoints(predictionSprintTop8, sprintClassification) {
  let positionPoints = 0;
  const correctPositions = [];
  const alreadyScored = new Set();

  const resultTop8 = sprintClassification
    .filter(e => e.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map(e => norm(e.driverId));

  for (let i = 0; i < Math.min(predictionSprintTop8.length, 8); i++) {
    const predicted = norm(predictionSprintTop8[i]);
    const actual = resultTop8[i];
    if (!predicted) continue;
    if (alreadyScored.has(predicted)) continue;
    alreadyScored.add(predicted);
    if (predicted === actual) {
      positionPoints += SPRINT_POINTS[i];
      correctPositions.push(i);
    }
  }

  return { positionPoints, totalPoints: positionPoints, correctPositions };
}

// ── Fetch from Supabase REST API ──────────────────────────────────────────
async function fetchSupabase(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    https.get(url, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

// ── Extract predictions from spreadsheet ──────────────────────────────────
function extractSpreadsheet() {
  const workbook = XLSX.readFile('/tmp/spreadsheet.xlsx');
  const sheetNames = workbook.SheetNames;
  
  // Find the predictions sheet - it's the one with driver names in columns
  const predictions = {};
  
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    console.log(`\n=== Sheet: ${name} (${data.length} rows) ===`);
    
    // Print first 5 rows to understand structure
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i].map(c => typeof c === 'string' ? c.substring(0, 30) : c);
      console.log(`  Row ${i}: [${row.join(' | ')}]`);
    }
  }
  
  return predictions;
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE SUPABASE AUDIT');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Extract spreadsheet data
  console.log('📊 Extracting spreadsheet...');
  extractSpreadsheet();

  // 2. Fetch Supabase data
  console.log('\n📡 Fetching Supabase data...');
  const [raceResults, predictions, profiles] = await Promise.all([
    fetchSupabase('race_results?select=*'),
    fetchSupabase('user_predictions?select=*&order=user_id,race_id'),
    fetchSupabase('profiles?select=*'),
  ]);

  console.log(`  Race results: ${raceResults.length} races`);
  console.log(`  Predictions: ${predictions.length} rows`);
  console.log(`  Profiles: ${profiles.length} users`);

  // 3. Build race results map
  const raceResultsMap = {};
  for (const rr of raceResults) {
    raceResultsMap[rr.race_id] = rr;
  }

  // 4. Recompute all points
  console.log('\n🧮 Recomputing all points...');
  const recomputed = {};
  const discrepancies = [];

  for (const pred of predictions) {
    const key = `${pred.user_id}:${pred.race_id}`;
    const rr = raceResultsMap[pred.race_id];
    
    if (!rr || !rr.classification || rr.classification.length === 0) {
      console.log(`  ⚠️  No race results for ${pred.race_id} — skipping`);
      continue;
    }

    const mainResult = calculateMainPoints(
      pred.predicted_top10 || [],
      pred.predicted_fastest_lap,
      pred.predicted_dnf,
      rr.classification,
      rr.fastest_lap_driver_id
    );

    let sprintResult = { totalPoints: 0 };
    if (rr.sprint_classification && rr.sprint_classification.length > 0 && (pred.predicted_sprint_top8 || []).length > 0) {
      sprintResult = calculateSprintPoints(
        pred.predicted_sprint_top8 || [],
        rr.sprint_classification
      );
    }

    recomputed[key] = {
      userId: pred.user_id,
      raceId: pred.race_id,
      storedMainPoints: pred.points_earned || 0,
      storedSprintPoints: pred.sprint_points_earned || 0,
      storedTotal: (pred.points_earned || 0) + (pred.sprint_points_earned || 0),
      recomputedMainPoints: mainResult.totalPoints,
      recomputedSprintPoints: sprintResult.totalPoints,
      recomputedTotal: mainResult.totalPoints + sprintResult.totalPoints,
    };

    if (recomputed[key].storedMainPoints !== recomputed[key].recomputedMainPoints ||
        recomputed[key].storedSprintPoints !== recomputed[key].recomputedSprintPoints) {
      discrepancies.push({
        ...recomputed[key],
        details: {
          mainCorrect: mainResult.correctPositions,
          flCorrect: mainResult.flPoints > 0,
          dnfCorrect: mainResult.dnfPoints > 0,
          sprintCorrect: sprintResult.correctPositions || [],
        }
      });
    }
  }

  // 5. Report discrepancies
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  DISCREPANCIES FOUND');
  console.log('═══════════════════════════════════════════════════');

  if (discrepancies.length === 0) {
    console.log('\n✅ ALL POINTS ARE CORRECT! No discrepancies found.');
  } else {
    console.log(`\n❌ ${discrepancies.length} mismatches found:\n`);
    for (const d of discrepancies) {
      const userName = USERS[d.userId] || d.userId.substring(0, 8);
      console.log(`  ${userName} - ${d.raceId}:`);
      console.log(`    Stored:    Main=${d.storedMainPoints} Sprint=${d.storedSprintPoints} Total=${d.storedTotal}`);
      console.log(`    Recompute: Main=${d.recomputedMainPoints} Sprint=${d.recomputedSprintPoints} Total=${d.recomputedTotal}`);
      console.log(`    Diff:      Main=${d.recomputedMainPoints - d.storedMainPoints} Sprint=${d.recomputedSprintPoints - d.storedSprintPoints}`);
    }
  }

  // 6. Compute correct profile totals
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CORRECT PROFILE TOTALS');
  console.log('═══════════════════════════════════════════════════');

  const correctTotals = {};
  for (const [key, val] of Object.entries(recomputed)) {
    const uid = val.userId;
    correctTotals[uid] = (correctTotals[uid] || 0) + val.recomputedTotal;
  }

  console.log('\nProfile total_points comparison:');
  for (const prof of profiles) {
    const name = prof.display_name || prof.username || prof.id.substring(0, 8);
    const stored = prof.total_points || 0;
    const correct = correctTotals[prof.id] || 0;
    const diff = correct - stored;
    const status = diff === 0 ? '✅' : `❌ (off by ${diff})`;
    console.log(`  ${name}: Stored=${stored} Correct=${correct} ${status}`);
  }

  // 7. Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Prediction point mismatches: ${discrepancies.length}`);
  const profileMismatches = profiles.filter(p => {
    const stored = p.total_points || 0;
    const correct = correctTotals[p.id] || 0;
    return stored !== correct;
  });
  console.log(`  Profile total mismatches: ${profileMismatches.length}`);
}

main().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });
