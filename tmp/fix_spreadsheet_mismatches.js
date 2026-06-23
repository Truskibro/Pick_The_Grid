/**
 * Comprehensive fix script:
 * 1. Extract correct predictions from spreadsheet
 * 2. Compare with Supabase
 * 3. Fix all mismatches
 * 4. Recalculate points
 */

const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// ===== CORRECT PREDICTIONS FROM SPREADSHEET =====
// Extracted manually by reading the spreadsheet row by row.
// Driver codes: VER, RUS, ANT, PIA, LEC, NOR, HAM, HAD, LAW, SAI,
//               GAS, BEA, COL, LIN, HUL, OCO, BOR, ALB, PER,
//               BOT, STR, ALO

const CORRECT_PREDICTIONS = {
  // ── Skye Leach ──
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': {
    r01: {
      top10: ['VER', 'RUS', 'ANT', 'PIA', 'LEC', 'NOR', 'HAM', 'HAD', 'LAW', 'SAI'],
      fastestLap: 'VER',
      dnf: 'STR',
      sprintTop8: [],
    },
    r02: {
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'VER', 'PIA', 'NOR', 'HAD', 'BEA', 'GAS'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      sprintTop8: ['RUS', 'ANT', 'HAM', 'NOR', 'LEC', 'PIA', 'VER', 'HAD'],
    },
    r03: {
      top10: ['ANT', 'RUS', 'LEC', 'PIA', 'HAM', 'NOR', 'VER', 'HAD', 'GAS', 'LIN'],
      fastestLap: 'ANT',
      dnf: 'BOT',
      sprintTop8: [],
    },
    r04: {
      top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'HAM', 'PIA', 'HAD', 'GAS', 'BEA'],
      fastestLap: 'VER',
      dnf: 'COL',
      sprintTop8: ['ANT', 'NOR', 'PIA', 'RUS', 'LEC', 'VER', 'HAM', 'HAD'],
    },
    r05: {
      top10: ['RUS', 'ANT', 'PIA', 'NOR', 'HAM', 'LEC', 'VER', 'HAD', 'LIN', 'LAW'],
      fastestLap: 'ANT',
      dnf: 'COL',
      sprintTop8: ['ANT', 'RUS', 'NOR', 'PIA', 'LEC', 'VER', 'HAM', 'HAD'],
    },
    r06: {
      top10: ['ANT', 'VER', 'RUS', 'LEC', 'HAM', 'PIA', 'HAD', 'NOR', 'GAS', 'COL'],
      fastestLap: 'ANT',
      dnf: 'LAW',
      sprintTop8: [],
    },
    r07: {
      top10: ['ANT', 'RUS', 'HAM', 'NOR', 'VER', 'PIA', 'LEC', 'HAD', 'HUL', 'GAS'],
      fastestLap: 'ANT',
      dnf: 'LAW',
      sprintTop8: [],
    },
  },
  // ── Whitney Trujillo ──
  '652154af-dc27-47b5-aa79-25903b9c4a1b': {
    r01: {
      top10: ['ANT', 'RUS', 'LEC', 'PIA', 'HAD', 'VER', 'NOR', 'HAM', 'LAW', 'HUL'],
      fastestLap: 'VER',
      dnf: 'STR',
      sprintTop8: [],
    },
    r02: {
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'PIA', 'VER', 'NOR', 'HAD', 'HUL', 'BEA'],
      fastestLap: 'RUS',
      dnf: 'STR',
      sprintTop8: ['ANT', 'RUS', 'NOR', 'HAM', 'VER', 'PIA', 'LEC', 'HAD'],
    },
    r03: {
      top10: ['ANT', 'RUS', 'LEC', 'PIA', 'NOR', 'VER', 'HAM', 'GAS', 'HAD', 'HUL'],
      fastestLap: 'PIA',
      dnf: 'PER',
      sprintTop8: [],
    },
    r04: {
      top10: ['PIA', 'VER', 'NOR', 'ANT', 'LEC', 'RUS', 'HAM', 'COL', 'SAI', 'GAS'],
      fastestLap: null,
      dnf: 'STR',
      sprintTop8: ['NOR', 'LEC', 'ANT', 'PIA', 'VER', 'RUS', 'HAM', 'COL'],
    },
    r05: {
      top10: ['RUS', 'ANT', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'],
      fastestLap: 'ANT',
      dnf: 'STR',
      sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'],
    },
    r06: {
      top10: ['ANT', 'VER', 'HAM', 'LEC', 'HAD', 'PIA', 'RUS', 'NOR', 'GAS', 'SAI'],
      fastestLap: 'ANT',
      dnf: 'STR',
      sprintTop8: [],
    },
    r07: {
      top10: ['HAM', 'RUS', 'VER', 'LEC', 'PIA', 'HAD', 'GAS', 'LAW', 'LIN', 'COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      sprintTop8: [],
    },
  },
  // ── Bryan Leach ──
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': {
    r01: {
      top10: ['RUS', 'ANT', 'PIA', 'LEC', 'NOR', 'HAM', 'HAD', 'VER', 'LAW', 'LIN'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      sprintTop8: [],
    },
    r02: {
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'PIA', 'NOR', 'VER', 'HAD', 'BEA', 'GAS'],
      fastestLap: 'RUS',
      dnf: 'PER',
      sprintTop8: ['RUS', 'ANT', 'HAM', 'LEC', 'LEC', 'VER', 'NOR', 'HAD'],
    },
    r03: {
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'VER', 'PIA', 'NOR', 'HAD', 'GAS', 'LIN'],
      fastestLap: 'RUS',
      dnf: 'STR',
      sprintTop8: [],
    },
    r04: {
      top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'PIA', 'HAM', 'GAS', 'HAD', 'COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      sprintTop8: ['ANT', 'NOR', 'PIA', 'LEC', 'RUS', 'VER', 'HAM', 'HAD'],
    },
    r05: {
      top10: ['RUS', 'ANT', 'NOR', 'PIA', 'HAM', 'LEC', 'VER', 'HAD', 'LIN', 'LAW'],
      fastestLap: 'NOR',
      dnf: 'BOT',
      sprintTop8: ['RUS', 'ANT', 'NOR', 'PIA', 'HAM', 'LEC', 'VER', 'HAD'],
    },
    r06: {
      top10: ['ANT', 'VER', 'LEC', 'HAM', 'RUS', 'PIA', 'NOR', 'GAS', 'LAW', 'ALB'],
      fastestLap: 'ANT',
      dnf: 'HAD',
      sprintTop8: [],
    },
    r07: {
      top10: ['RUS', 'ANT', 'HAM', 'VER', 'LEC', 'PIA', 'HAD', 'LAW', 'SAI', 'LIN'],
      fastestLap: 'ANT',
      dnf: null,
      sprintTop8: [],
    },
  },
  // ── Carlos Trujillo ──
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': {
    r01: {
      top10: ['RUS', 'ANT', 'LEC', 'PIA', 'HAD', 'HAM', 'NOR', 'VER', 'LAW', 'HUL'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      sprintTop8: [],
    },
    r02: {
      top10: ['RUS', 'ANT', 'HAM', 'LEC', 'NOR', 'PIA', 'VER', 'HAD', 'GAS', 'HUL'],
      fastestLap: 'RUS',
      dnf: 'ALB',
      sprintTop8: ['RUS', 'ANT', 'HAM', 'NOR', 'LEC', 'VER', 'PIA', 'GAS'],
    },
    r03: {
      top10: ['ANT', 'RUS', 'LEC', 'HAM', 'PIA', 'NOR', 'HAD', 'VER', 'GAS', 'LIN'],
      fastestLap: 'RUS',
      dnf: 'STR',
      sprintTop8: [],
    },
    r04: {
      top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'LEC', 'PIA', 'HAM', 'GAS', 'HUL'],
      fastestLap: 'VER',
      dnf: null,
      sprintTop8: ['NOR', 'ANT', 'PIA', 'LEC', 'RUS', 'VER', 'HAM', 'HAD'],
    },
    r05: {
      top10: ['ANT', 'RUS', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'],
    },
    r06: {
      top10: ['VER', 'ANT', 'HAM', 'LEC', 'HAD', 'RUS', 'PIA', 'NOR', 'GAS', 'LAW'],
      fastestLap: 'VER',
      dnf: 'BOR',
      sprintTop8: [],
    },
    r07: {
      top10: ['RUS', 'HAM', 'ANT', 'VER', 'NOR', 'LEC', 'HAD', 'PIA', 'HUL', 'LAW'],
      fastestLap: 'RUS',
      dnf: null,
      sprintTop8: [],
    },
  },
};

// ===== RACE RESULTS (from f1-data.ts, verified) =====
const RACE_RESULTS = {
  r01: {
    classification: [
      { position: 1, driverId: 'RUS' }, { position: 2, driverId: 'ANT' },
      { position: 3, driverId: 'LEC' }, { position: 4, driverId: 'HAM' },
      { position: 5, driverId: 'NOR' }, { position: 6, driverId: 'VER' },
      { position: 7, driverId: 'BEA' }, { position: 8, driverId: 'LIN' },
      { position: 9, driverId: 'BOR' }, { position: 10, driverId: 'GAS' },
    ],
    fastestLapDriverId: 'VER',
    dnfDriverIds: ['ALO', 'BOT', 'HAD'],
    dnsDriverIds: ['PIA', 'HUL'],
    hasSprint: false,
  },
  r02: {
    classification: [
      { position: 1, driverId: 'ANT' }, { position: 2, driverId: 'RUS' },
      { position: 3, driverId: 'HAM' }, { position: 4, driverId: 'LEC' },
      { position: 5, driverId: 'BEA' }, { position: 6, driverId: 'GAS' },
      { position: 7, driverId: 'LAW' }, { position: 8, driverId: 'HAD' },
      { position: 9, driverId: 'SAI' }, { position: 10, driverId: 'COL' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['VER', 'ALO', 'STR'],
    dnsDriverIds: ['PIA', 'NOR', 'BOR', 'ALB'],
    hasSprint: true,
    sprintClassification: [
      { position: 1, driverId: 'RUS' }, { position: 2, driverId: 'LEC' },
      { position: 3, driverId: 'HAM' }, { position: 4, driverId: 'NOR' },
      { position: 5, driverId: 'ANT' }, { position: 6, driverId: 'PIA' },
      { position: 7, driverId: 'LAW' }, { position: 8, driverId: 'BEA' },
    ],
  },
  r03: {
    classification: [
      { position: 1, driverId: 'ANT' }, { position: 2, driverId: 'PIA' },
      { position: 3, driverId: 'LEC' }, { position: 4, driverId: 'RUS' },
      { position: 5, driverId: 'NOR' }, { position: 6, driverId: 'HAM' },
      { position: 7, driverId: 'GAS' }, { position: 8, driverId: 'VER' },
      { position: 9, driverId: 'LAW' }, { position: 10, driverId: 'OCO' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR', 'BEA'],
    dnsDriverIds: [],
    hasSprint: false,
  },
  r04: {
    classification: [
      { position: 1, driverId: 'ANT' }, { position: 2, driverId: 'NOR' },
      { position: 3, driverId: 'PIA' }, { position: 4, driverId: 'RUS' },
      { position: 5, driverId: 'VER' }, { position: 6, driverId: 'HAM' },
      { position: 7, driverId: 'COL' }, { position: 8, driverId: 'LEC' },
      { position: 9, driverId: 'SAI' }, { position: 10, driverId: 'ALB' },
    ],
    fastestLapDriverId: 'NOR',
    dnfDriverIds: ['HUL', 'LAW', 'GAS', 'HAD'],
    dnsDriverIds: [],
    hasSprint: true,
    sprintClassification: [
      { position: 1, driverId: 'NOR' }, { position: 2, driverId: 'PIA' },
      { position: 3, driverId: 'LEC' }, { position: 4, driverId: 'RUS' },
      { position: 5, driverId: 'VER' }, { position: 6, driverId: 'ANT' },
      { position: 7, driverId: 'HAM' }, { position: 8, driverId: 'GAS' },
    ],
  },
  r05: {
    classification: [
      { position: 1, driverId: 'ANT' }, { position: 2, driverId: 'HAM' },
      { position: 3, driverId: 'VER' }, { position: 4, driverId: 'LEC' },
      { position: 5, driverId: 'HAD' }, { position: 6, driverId: 'COL' },
      { position: 7, driverId: 'LAW' }, { position: 8, driverId: 'GAS' },
      { position: 9, driverId: 'SAI' }, { position: 10, driverId: 'BEA' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'],
    dnsDriverIds: ['LIN'],
    hasSprint: true,
    sprintClassification: [
      { position: 1, driverId: 'RUS' }, { position: 2, driverId: 'NOR' },
      { position: 3, driverId: 'ANT' }, { position: 4, driverId: 'PIA' },
      { position: 5, driverId: 'LEC' }, { position: 6, driverId: 'HAM' },
      { position: 7, driverId: 'VER' }, { position: 8, driverId: 'LIN' },
    ],
  },
  r06: {
    classification: [
      { position: 1, driverId: 'ANT' }, { position: 2, driverId: 'HAM' },
      { position: 3, driverId: 'GAS' }, { position: 4, driverId: 'HAD' },
      { position: 5, driverId: 'PIA' }, { position: 6, driverId: 'LAW' },
      { position: 7, driverId: 'LIN' }, { position: 8, driverId: 'ALB' },
      { position: 9, driverId: 'OCO' }, { position: 10, driverId: 'ALO' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['SAI', 'LEC', 'STR', 'NOR', 'BEA', 'BOT', 'VER'],
    dnsDriverIds: [],
    hasSprint: false,
  },
  r07: {
    classification: [
      { position: 1, driverId: 'HAM' }, { position: 2, driverId: 'RUS' },
      { position: 3, driverId: 'NOR' }, { position: 4, driverId: 'VER' },
      { position: 5, driverId: 'PIA' }, { position: 6, driverId: 'HAD' },
      { position: 7, driverId: 'GAS' }, { position: 8, driverId: 'LAW' },
      { position: 9, driverId: 'LIN' }, { position: 10, driverId: 'COL' },
    ],
    fastestLapDriverId: 'HAM',
    dnfDriverIds: ['LEC', 'ANT', 'BEA', 'ALO', 'HUL', 'BOT', 'STR'],
    dnsDriverIds: [],
    hasSprint: false,
  },
};

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

function calculateRacePoints(prediction, result) {
  let positionPoints = 0;
  const resultTop10 = result.classification.map(e => e.driverId);

  for (let i = 0; i < prediction.top10.length && i < 10; i++) {
    if (prediction.top10[i] === resultTop10[i]) {
      positionPoints += F1_POINTS[i];
    }
  }

  let fastestLapPoints = 0;
  if (prediction.fastestLap && prediction.fastestLap === result.fastestLapDriverId) {
    fastestLapPoints = FASTEST_LAP_BONUS;
  }

  let dnfPoints = 0;
  const dnsSet = new Set(result.dnsDriverIds || []);
  const dnfSet = new Set(result.dnfDriverIds || []);

  if (!prediction.dnf && dnfSet.size === 0) {
    dnfPoints = DNF_BONUS;
  } else if (prediction.dnf && dnsSet.has(prediction.dnf)) {
    // DNS pick gets 0
  } else if (prediction.dnf && dnfSet.has(prediction.dnf)) {
    dnfPoints = DNF_BONUS;
  }

  return { positionPoints, fastestLapPoints, dnfPoints, totalPoints: positionPoints + fastestLapPoints + dnfPoints };
}

function calculateSprintPoints(sprintTop8, sprintResult) {
  let positionPoints = 0;
  const resultTop8 = sprintResult.map(e => e.driverId);

  for (let i = 0; i < sprintTop8.length && i < 8; i++) {
    if (sprintTop8[i] === resultTop8[i]) {
      positionPoints += SPRINT_POINTS[i];
    }
  }

  return { positionPoints, totalPoints: positionPoints };
}

function computeTotalPoints(userId) {
  const predictions = CORRECT_PREDICTIONS[userId];
  let total = 0;
  const breakdown = {};

  for (const [raceId, pred] of Object.entries(predictions)) {
    const result = RACE_RESULTS[raceId];
    if (!result) { breakdown[raceId] = { race: 0, sprint: 0, raceBreakdown: null, sprintBreakdown: null }; continue; }

    const raceBreakdown = calculateRacePoints(pred, result);
    let sprintBreakdown = null;
    let sprintPoints = 0;

    if (result.hasSprint && pred.sprintTop8.length > 0 && result.sprintClassification) {
      sprintBreakdown = calculateSprintPoints(pred.sprintTop8, result.sprintClassification);
      sprintPoints = sprintBreakdown.totalPoints;
    }

    breakdown[raceId] = {
      race: raceBreakdown.totalPoints,
      sprint: sprintPoints,
      raceBreakdown,
      sprintBreakdown,
    };
    total += raceBreakdown.totalPoints + sprintPoints;
  }

  return { total, breakdown };
}

async function fetchSupabasePredictions(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?select=*&user_id=eq.${userId}&order=race_id`, { headers });
  if (!res.ok) throw new Error(`Fetch failed for ${userId}: ${res.status}`);
  return res.json();
}

async function updateSupabasePrediction(rowId, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?id=eq.${rowId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Update failed for ${rowId}: ${res.status} ${err}`);
  }
  return res.json();
}

async function updateProfile(userId, totalPoints) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ total_points: totalPoints }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.log(`  Profile update failed for ${userId}: ${err}`);
    return false;
  }
  return true;
}

// ===== MAIN =====
async function main() {
  console.log('='.repeat(80));
  console.log('  PICK THE GRID — SPREADSHEET vs SUPABASE COMPARISON');
  console.log('='.repeat(80));

  let totalMismatches = 0;
  let totalFixes = 0;

  for (const [userId, correctRaces] of Object.entries(CORRECT_PREDICTIONS)) {
    const userName = {
      'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'Skye Leach',
      '652154af-dc27-47b5-aa79-25903b9c4a1b': 'Whitney Trujillo',
      'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'Bryan Leach',
      'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'Carlos Trujillo',
    }[userId] || userId;

    console.log(`\n--- ${userName} (${userId.substring(0, 8)}...) ---`);

    // Compute expected points
    const { total: expectedTotal, breakdown } = computeTotalPoints(userId);

    // Fetch Supabase data
    let supabaseRows;
    try {
      supabaseRows = await fetchSupabasePredictions(userId);
    } catch (e) {
      console.log(`  ERROR fetching Supabase data: ${e.message}`);
      continue;
    }

    let supabaseTotal = 0;
    const rowsByRace = {};
    for (const row of supabaseRows) {
      rowsByRace[row.race_id] = row;
      supabaseTotal += (row.points_earned || 0) + (row.sprint_points_earned || 0);
    }

    console.log(`  Supabase stored total: ${supabaseTotal}  |  Expected total: ${expectedTotal}`);
    if (supabaseTotal !== expectedTotal) {
      console.log(`  *** TOTAL MISMATCH: Diff = ${supabaseTotal - expectedTotal} ***`);
    }

    // Check each race
    for (const [raceId, correctPred] of Object.entries(correctRaces)) {
      const sbRow = rowsByRace[raceId];
      const bd = breakdown[raceId];

      if (!sbRow) {
        console.log(`  ${raceId}: MISSING from Supabase!`);
        totalMismatches++;
        continue;
      }

      const mismatches = [];

      // Check top10
      const sbTop10 = sbRow.predicted_top10 || [];
      if (JSON.stringify(sbTop10) !== JSON.stringify(correctPred.top10)) {
        mismatches.push(`top10: DB=${JSON.stringify(sbTop10)} vs SS=${JSON.stringify(correctPred.top10)}`);
      }

      // Check fastestLap
      if ((sbRow.predicted_fastest_lap || null) !== (correctPred.fastestLap || null)) {
        mismatches.push(`FL: DB=${sbRow.predicted_fastest_lap} vs SS=${correctPred.fastestLap}`);
      }

      // Check DNF
      if ((sbRow.predicted_dnf || null) !== (correctPred.dnf || null)) {
        mismatches.push(`DNF: DB=${sbRow.predicted_dnf} vs SS=${correctPred.dnf}`);
      }

      // Check sprint
      const sbSprint = sbRow.predicted_sprint_top8 || [];
      if (JSON.stringify(sbSprint) !== JSON.stringify(correctPred.sprintTop8)) {
        mismatches.push(`Sprint: DB=${JSON.stringify(sbSprint)} vs SS=${JSON.stringify(correctPred.sprintTop8)}`);
      }

      // Check points
      const sbRacePts = sbRow.points_earned || 0;
      const sbSprintPts = sbRow.sprint_points_earned || 0;
      const expectedRacePts = bd ? bd.race : 0;
      const expectedSprintPts = bd ? bd.sprint : 0;

      if (sbRacePts !== expectedRacePts) {
        mismatches.push(`Race Pts: DB=${sbRacePts} vs Expected=${expectedRacePts}`);
      }
      if (sbSprintPts !== expectedSprintPts) {
        mismatches.push(`Sprint Pts: DB=${sbSprintPts} vs Expected=${expectedSprintPts}`);
      }

      if (mismatches.length > 0) {
        console.log(`  ${raceId}: ${mismatches.length} MISMATCHES`);
        for (const m of mismatches) console.log(`    - ${m}`);
        totalMismatches += mismatches.length;

        // FIX IT
        const payload = {
          predicted_top10: correctPred.top10,
          predicted_fastest_lap: correctPred.fastestLap || null,
          predicted_dnf: correctPred.dnf || null,
          points_earned: expectedRacePts,
          predicted_sprint_top8: correctPred.sprintTop8,
          sprint_points_earned: expectedSprintPts,
        };

        try {
          await updateSupabasePrediction(sbRow.id, payload);
          console.log(`    >> FIXED in Supabase (row ${sbRow.id})`);
          totalFixes++;
        } catch (e) {
          console.log(`    >> FIX FAILED: ${e.message}`);
        }
      } else {
        // Points match but check if picks are the same as the expected
        if (JSON.stringify(sbTop10) === JSON.stringify(correctPred.top10) &&
            (sbRow.predicted_fastest_lap || null) === (correctPred.fastestLap || null) &&
            (sbRow.predicted_dnf || null) === (correctPred.dnf || null) &&
            JSON.stringify(sbSprint) === JSON.stringify(correctPred.sprintTop8)) {
          console.log(`  ${raceId}: OK (${bd.race}+${bd.sprint}=${bd.race+bd.sprint}pts)`);
        }
      }
    }

    // Update profile total
    const newTotal = expectedTotal;
    if (newTotal !== supabaseTotal) {
      await updateProfile(userId, newTotal);
      console.log(`  >> Profile total updated: ${supabaseTotal} → ${newTotal}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`  SUMMARY: ${totalMismatches} mismatches found, ${totalFixes} fixes applied`);
  console.log(`${'='.repeat(80)}`);

  // Print final leaderboard
  console.log('\n  FINAL LEADERBOARD:');
  const lb = [];
  for (const userId of Object.keys(CORRECT_PREDICTIONS)) {
    const { total } = computeTotalPoints(userId);
    const userName = {
      'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'Skye Leach',
      '652154af-dc27-47b5-aa79-25903b9c4a1b': 'Whitney Trujillo',
      'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'Bryan Leach',
      'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'Carlos Trujillo',
    }[userId];
    lb.push({ name: userName, total });
  }
  lb.sort((a, b) => b.total - a.total);
  lb.forEach((e, i) => console.log(`  ${i+1}. ${e.name}: ${e.total} pts`));
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
