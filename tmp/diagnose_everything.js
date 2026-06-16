/**
 * Comprehensive diagnostic: compares expected points (from our scoring engine)
 * against stored DB points for all users.
 * 
 * Also checks: duplicates, DNS/DNF classification, seed vs DB mismatches.
 */

// ---- Copied scoring constants ----
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

// ---- Copied race results from f1-data.ts ----
const MOCK_RACE_RESULTS = [
  // R01 - Australian GP
  {
    raceId: 'r01',
    classification: [
      { position: 1, driverId: 'RUS', status: 'finished' },
      { position: 2, driverId: 'ANT', status: 'finished' },
      { position: 3, driverId: 'LEC', status: 'finished' },
      { position: 4, driverId: 'HAM', status: 'finished' },
      { position: 5, driverId: 'NOR', status: 'finished' },
      { position: 6, driverId: 'VER', status: 'finished' },
      { position: 7, driverId: 'BEA', status: 'finished' },
      { position: 8, driverId: 'LIN', status: 'finished' },
      { position: 9, driverId: 'BOR', status: 'finished' },
      { position: 10, driverId: 'GAS', status: 'finished' },
      { position: 11, driverId: 'OCO', status: 'finished' },
      { position: 12, driverId: 'ALB', status: 'finished' },
      { position: 13, driverId: 'LAW', status: 'finished' },
      { position: 14, driverId: 'COL', status: 'finished' },
      { position: 15, driverId: 'SAI', status: 'finished' },
      { position: 16, driverId: 'PER', status: 'finished' },
      { position: 17, driverId: 'STR', status: 'dnf' },
      { position: 18, driverId: 'ALO', status: 'dnf' },
      { position: 19, driverId: 'BOT', status: 'dnf' },
      { position: 20, driverId: 'HAD', status: 'dnf' },
      { position: 21, driverId: 'PIA', status: 'dns' },
      { position: 22, driverId: 'HUL', status: 'dns' },
    ],
    fastestLapDriverId: 'VER',
    dnfDriverIds: ['STR', 'ALO', 'BOT', 'HAD'],
    dnsDriverIds: ['PIA', 'HUL'],
    sprintClassification: undefined,
  },
  // R02 - Chinese GP (SPRINT)
  {
    raceId: 'r02',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' },
      { position: 2, driverId: 'RUS', status: 'finished' },
      { position: 3, driverId: 'HAM', status: 'finished' },
      { position: 4, driverId: 'LEC', status: 'finished' },
      { position: 5, driverId: 'BEA', status: 'finished' },
      { position: 6, driverId: 'GAS', status: 'finished' },
      { position: 7, driverId: 'LAW', status: 'finished' },
      { position: 8, driverId: 'HAD', status: 'finished' },
      { position: 9, driverId: 'SAI', status: 'finished' },
      { position: 10, driverId: 'COL', status: 'finished' },
      { position: 11, driverId: 'HUL', status: 'finished' },
      { position: 12, driverId: 'LIN', status: 'finished' },
      { position: 13, driverId: 'BOT', status: 'finished' },
      { position: 14, driverId: 'OCO', status: 'finished' },
      { position: 15, driverId: 'PER', status: 'finished' },
      { position: 16, driverId: 'VER', status: 'dnf' },
      { position: 17, driverId: 'ALO', status: 'dnf' },
      { position: 18, driverId: 'STR', status: 'dnf' },
      { position: 19, driverId: 'PIA', status: 'dns' },
      { position: 20, driverId: 'NOR', status: 'dns' },
      { position: 21, driverId: 'BOR', status: 'dns' },
      { position: 22, driverId: 'ALB', status: 'dns' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['VER', 'ALO', 'STR'],
    dnsDriverIds: ['PIA', 'NOR', 'BOR', 'ALB'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', status: 'finished' },
      { position: 2, driverId: 'LEC', status: 'finished' },
      { position: 3, driverId: 'HAM', status: 'finished' },
      { position: 4, driverId: 'NOR', status: 'finished' },
      { position: 5, driverId: 'ANT', status: 'finished' },
      { position: 6, driverId: 'PIA', status: 'finished' },
      { position: 7, driverId: 'LAW', status: 'finished' },
      { position: 8, driverId: 'BEA', status: 'finished' },
    ],
  },
  // R03 - Japanese GP
  {
    raceId: 'r03',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' },
      { position: 2, driverId: 'PIA', status: 'finished' },
      { position: 3, driverId: 'LEC', status: 'finished' },
      { position: 4, driverId: 'RUS', status: 'finished' },
      { position: 5, driverId: 'NOR', status: 'finished' },
      { position: 6, driverId: 'HAM', status: 'finished' },
      { position: 7, driverId: 'GAS', status: 'finished' },
      { position: 8, driverId: 'VER', status: 'finished' },
      { position: 9, driverId: 'LAW', status: 'finished' },
      { position: 10, driverId: 'OCO', status: 'finished' },
      { position: 11, driverId: 'HUL', status: 'finished' },
      { position: 12, driverId: 'HAD', status: 'finished' },
      { position: 13, driverId: 'BOR', status: 'finished' },
      { position: 14, driverId: 'LIN', status: 'finished' },
      { position: 15, driverId: 'SAI', status: 'finished' },
      { position: 16, driverId: 'COL', status: 'finished' },
      { position: 17, driverId: 'PER', status: 'finished' },
      { position: 18, driverId: 'ALO', status: 'finished' },
      { position: 19, driverId: 'BOT', status: 'finished' },
      { position: 20, driverId: 'ALB', status: 'finished' },
      { position: 21, driverId: 'STR', status: 'dnf' },
      { position: 22, driverId: 'BEA', status: 'dnf' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR', 'BEA'],
    dnsDriverIds: [],
    sprintClassification: undefined,
  },
  // R04 - Miami GP (SPRINT)
  {
    raceId: 'r04',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' },
      { position: 2, driverId: 'NOR', status: 'finished' },
      { position: 3, driverId: 'PIA', status: 'finished' },
      { position: 4, driverId: 'RUS', status: 'finished' },
      { position: 5, driverId: 'VER', status: 'finished' },
      { position: 6, driverId: 'HAM', status: 'finished' },
      { position: 7, driverId: 'COL', status: 'finished' },
      { position: 8, driverId: 'LEC', status: 'finished' },
      { position: 9, driverId: 'SAI', status: 'finished' },
      { position: 10, driverId: 'ALB', status: 'finished' },
      { position: 11, driverId: 'BEA', status: 'finished' },
      { position: 12, driverId: 'BOR', status: 'finished' },
      { position: 13, driverId: 'OCO', status: 'finished' },
      { position: 14, driverId: 'LIN', status: 'finished' },
      { position: 15, driverId: 'ALO', status: 'finished' },
      { position: 16, driverId: 'PER', status: 'finished' },
      { position: 17, driverId: 'STR', status: 'finished' },
      { position: 18, driverId: 'BOT', status: 'finished' },
      { position: 19, driverId: 'HUL', status: 'dnf' },
      { position: 20, driverId: 'LAW', status: 'dnf' },
      { position: 21, driverId: 'GAS', status: 'dnf' },
      { position: 22, driverId: 'HAD', status: 'dnf' },
    ],
    fastestLapDriverId: 'NOR',
    dnfDriverIds: ['HUL', 'LAW', 'GAS', 'HAD'],
    dnsDriverIds: [],
    sprintClassification: [
      { position: 1, driverId: 'NOR', status: 'finished' },
      { position: 2, driverId: 'PIA', status: 'finished' },
      { position: 3, driverId: 'LEC', status: 'finished' },
      { position: 4, driverId: 'RUS', status: 'finished' },
      { position: 5, driverId: 'VER', status: 'finished' },
      { position: 6, driverId: 'ANT', status: 'finished' },
      { position: 7, driverId: 'HAM', status: 'finished' },
      { position: 8, driverId: 'GAS', status: 'finished' },
    ],
  },
  // R05 - Canadian GP (SPRINT)
  {
    raceId: 'r05',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' },
      { position: 2, driverId: 'HAM', status: 'finished' },
      { position: 3, driverId: 'VER', status: 'finished' },
      { position: 4, driverId: 'LEC', status: 'finished' },
      { position: 5, driverId: 'HAD', status: 'finished' },
      { position: 6, driverId: 'COL', status: 'finished' },
      { position: 7, driverId: 'LAW', status: 'finished' },
      { position: 8, driverId: 'GAS', status: 'finished' },
      { position: 9, driverId: 'SAI', status: 'finished' },
      { position: 10, driverId: 'BEA', status: 'finished' },
      { position: 11, driverId: 'PIA', status: 'finished' },
      { position: 12, driverId: 'HUL', status: 'finished' },
      { position: 13, driverId: 'BOR', status: 'finished' },
      { position: 14, driverId: 'OCO', status: 'finished' },
      { position: 15, driverId: 'STR', status: 'finished' },
      { position: 16, driverId: 'BOT', status: 'finished' },
      { position: 17, driverId: 'PER', status: 'dnf' },
      { position: 18, driverId: 'NOR', status: 'dnf' },
      { position: 19, driverId: 'RUS', status: 'dnf' },
      { position: 20, driverId: 'ALO', status: 'dnf' },
      { position: 21, driverId: 'ALB', status: 'dnf' },
      { position: 22, driverId: 'LIN', status: 'dns' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'],
    dnsDriverIds: ['LIN'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', status: 'finished' },
      { position: 2, driverId: 'NOR', status: 'finished' },
      { position: 3, driverId: 'ANT', status: 'finished' },
      { position: 4, driverId: 'PIA', status: 'finished' },
      { position: 5, driverId: 'LEC', status: 'finished' },
      { position: 6, driverId: 'HAM', status: 'finished' },
      { position: 7, driverId: 'VER', status: 'finished' },
      { position: 8, driverId: 'LIN', status: 'finished' },
    ],
  },
  // R06 - Monaco GP
  {
    raceId: 'r06',
    classification: [
      { position: 1, driverId: 'ANT', status: 'finished' },
      { position: 2, driverId: 'HAM', status: 'finished' },
      { position: 3, driverId: 'GAS', status: 'finished' },
      { position: 4, driverId: 'HAD', status: 'finished' },
      { position: 5, driverId: 'PIA', status: 'finished' },
      { position: 6, driverId: 'LAW', status: 'finished' },
      { position: 7, driverId: 'LIN', status: 'finished' },
      { position: 8, driverId: 'ALB', status: 'finished' },
      { position: 9, driverId: 'OCO', status: 'finished' },
      { position: 10, driverId: 'ALO', status: 'finished' },
      { position: 11, driverId: 'BOR', status: 'finished' },
      { position: 12, driverId: 'RUS', status: 'finished' },
      { position: 13, driverId: 'HUL', status: 'finished' },
      { position: 14, driverId: 'COL', status: 'finished' },
      { position: 15, driverId: 'PER', status: 'finished' },
      { position: 16, driverId: 'SAI', status: 'dnf' },
      { position: 17, driverId: 'LEC', status: 'dnf' },
      { position: 18, driverId: 'STR', status: 'dnf' },
      { position: 19, driverId: 'NOR', status: 'dnf' },
      { position: 20, driverId: 'BEA', status: 'dnf' },
      { position: 21, driverId: 'BOT', status: 'dnf' },
      { position: 22, driverId: 'VER', status: 'dnf' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['SAI', 'LEC', 'STR', 'NOR', 'BEA', 'BOT', 'VER'],
    dnsDriverIds: [],
    sprintClassification: undefined,
  },
  // R07 - Barcelona GP
  {
    raceId: 'r07',
    classification: [
      { position: 1, driverId: 'HAM', status: 'finished' },
      { position: 2, driverId: 'RUS', status: 'finished' },
      { position: 3, driverId: 'NOR', status: 'finished' },
      { position: 4, driverId: 'VER', status: 'finished' },
      { position: 5, driverId: 'PIA', status: 'finished' },
      { position: 6, driverId: 'HAD', status: 'finished' },
      { position: 7, driverId: 'GAS', status: 'finished' },
      { position: 8, driverId: 'LAW', status: 'finished' },
      { position: 9, driverId: 'LIN', status: 'finished' },
      { position: 10, driverId: 'COL', status: 'finished' },
      { position: 11, driverId: 'BOR', status: 'finished' },
      { position: 12, driverId: 'SAI', status: 'finished' },
      { position: 13, driverId: 'OCO', status: 'finished' },
      { position: 14, driverId: 'PER', status: 'finished' },
      { position: 15, driverId: 'LEC', status: 'dnf' },
      { position: 16, driverId: 'ANT', status: 'dnf' },
      { position: 17, driverId: 'BEA', status: 'dnf' },
      { position: 18, driverId: 'ALB', status: 'dnf' },
      { position: 19, driverId: 'ALO', status: 'dnf' },
      { position: 20, driverId: 'HUL', status: 'dnf' },
      { position: 21, driverId: 'BOT', status: 'dnf' },
      { position: 22, driverId: 'STR', status: 'dnf' },
    ],
    fastestLapDriverId: 'HAM',
    dnfDriverIds: ['LEC', 'ANT', 'BEA', 'ALB', 'ALO', 'HUL', 'BOT', 'STR'],
    dnsDriverIds: [],
    sprintClassification: undefined,
  },
];

// ---- Scoring engine (copied from scoring.ts) ----
function isDnsStatus(status) {
  return status === 'dns' || status === 'did not start' || status === 'did_not_start';
}

function isTrueDnfStatus(status) {
  return status === 'dnf' || status === 'retired' || status === 'ret' || status === 'did not finish' || status === 'did_not_finish';
}

function getDnsDriverIds(result) {
  const dnsIds = new Set();
  if (Array.isArray(result.dnsDriverIds)) {
    for (const id of result.dnsDriverIds) dnsIds.add(id);
  }
  if (Array.isArray(result.classification)) {
    for (const entry of result.classification) {
      if (isDnsStatus(entry.status)) dnsIds.add(entry.driverId);
    }
  }
  return dnsIds;
}

function getTrueDnfDriverIds(result) {
  const trueDnfIds = new Set();
  const dnsIds = getDnsDriverIds(result);
  if (Array.isArray(result.classification)) {
    for (const entry of result.classification) {
      if (dnsIds.has(entry.driverId)) continue;
      if (isTrueDnfStatus(entry.status)) trueDnfIds.add(entry.driverId);
    }
  }
  if (Array.isArray(result.dnfDriverIds)) {
    for (const id of result.dnfDriverIds) {
      if (!dnsIds.has(id)) trueDnfIds.add(id);
    }
  }
  return trueDnfIds;
}

function calculatePoints(prediction, result) {
  let positionPoints = 0;
  const alreadyScored = new Set();

  const resultTop10 = result.classification
    .filter(e => e.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map(e => e.driverId);

  for (let i = 0; i < prediction.top10.length && i < 10; i++) {
    const predId = prediction.top10[i];
    const actualId = resultTop10[i];
    if (!predId) continue;
    if (alreadyScored.has(predId)) continue;
    alreadyScored.add(predId);
    if (predId === actualId) positionPoints += F1_POINTS[i];
  }

  let flPoints = 0;
  if (prediction.fastestLap && prediction.fastestLap === result.fastestLapDriverId) {
    flPoints = 1;
  }

  let dnfPoints = 0;
  const predDnf = prediction.dnf;
  const dnsIds = getDnsDriverIds(result);
  const trueDnfIds = getTrueDnfDriverIds(result);
  if (!predDnf && trueDnfIds.size === 0) {
    dnfPoints = 10;
  } else if (predDnf && dnsIds.has(predDnf)) {
    // DNS - no points
  } else if (predDnf && trueDnfIds.has(predDnf)) {
    dnfPoints = 10;
  }

  return {
    positionPoints,
    fastestLapPoints: flPoints,
    dnfPoints,
    totalPoints: positionPoints + flPoints + dnfPoints,
  };
}

function calculateSprintPoints(sprintTop8, sprintResult) {
  let positionPoints = 0;
  const alreadyScored = new Set();
  const resultTop8 = sprintResult
    .filter(e => e.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map(e => e.driverId);

  for (let i = 0; i < sprintTop8.length && i < 8; i++) {
    const predId = sprintTop8[i];
    const actualId = resultTop8[i];
    if (!predId) continue;
    if (alreadyScored.has(predId)) continue;
    alreadyScored.add(predId);
    if (predId === actualId) positionPoints += SPRINT_POINTS[i];
  }

  return { positionPoints, totalPoints: positionPoints };
}

// ---- Seed predictions (condensed from seed-predictions.ts) ----
const SEED_PREDICTIONS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': { // Skye Leach
    username: 'skyeleach',
    displayName: 'Skye Leach',
    predictions: {
      r01: { top10: ['VER', 'RUS', 'ANT', 'PIA', 'LEC', 'NOR', 'HAM', 'HAD', 'LAW', 'SAI'], fastestLap: 'VER', dnf: 'STR', sprintTop8: [] },
      r02: { top10: ['RUS', 'ANT', 'HAM', 'LEC', 'BEA', 'GAS', 'LAW', 'HAD', 'SAI', 'COL'], fastestLap: 'RUS', dnf: 'ALO', sprintTop8: ['RUS', 'LEC', 'HAM', 'NOR', 'ANT', 'PIA', 'LAW', 'BEA'] },
      r03: { top10: ['ANT', 'PIA', 'LEC', 'RUS', 'NOR', 'HAM', 'GAS', 'VER', 'LAW', 'OCO'], fastestLap: 'ANT', dnf: 'BOT', sprintTop8: [] },
      r04: { top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'HAM', 'PIA', 'HAD', 'GAS', 'BEA'], fastestLap: 'VER', dnf: 'COL', sprintTop8: ['ANT', 'NOR', 'PIA', 'RUS', 'LEC', 'VER', 'HAM', 'HAD'] },
      r05: { top10: ['ANT', 'HAM', 'VER', 'LEC', 'HAD', 'COL', 'LAW', 'GAS', 'SAI', 'BEA'], fastestLap: 'ANT', dnf: 'COL', sprintTop8: ['RUS', 'NOR', 'ANT', 'PIA', 'LEC', 'HAM', 'VER', 'LIN'] },
      r06: { top10: ['ANT', 'HAM', 'HAD', 'PIA', 'LAW', 'LIN', 'GAS', 'ALB', 'OCO', 'PER'], fastestLap: 'ANT', dnf: 'LAW', sprintTop8: [] },
      r07: { top10: ['ANT', 'RUS', 'HAM', 'NOR', 'VER', 'PIA', 'LEC', 'HAD', 'HUL', 'GAS'], fastestLap: 'ANT', dnf: 'LAW', sprintTop8: [] },
    }
  },
  '652154af-dc27-47b5-aa79-25903b9c4a1b': { // Whitney Trujillo
    username: 'whitney',
    displayName: 'Whitney Trujillo',
    predictions: {
      r01: { top10: ['ANT', 'RUS', 'LEC', 'PIA', 'HAD', 'VER', 'NOR', 'HAM', 'LAW', 'HUL'], fastestLap: 'VER', dnf: 'STR', sprintTop8: [] },
      r02: { top10: ['RUS', 'ANT', 'LEC', 'HAM', 'PIA', 'VER', 'NOR', 'HAD', 'HUL', 'BEA'], fastestLap: 'RUS', dnf: 'STR', sprintTop8: ['ANT', 'RUS', 'NOR', 'HAM', 'VER', 'PIA', 'LEC', 'HAD'] },
      r03: { top10: ['ANT', 'RUS', 'LEC', 'PIA', 'NOR', 'VER', 'HAM', 'GAS', 'HAD', 'HUL'], fastestLap: 'PIA', dnf: 'PER', sprintTop8: [] },
      r04: { top10: ['PIA', 'VER', 'NOR', 'ANT', 'LEC', 'RUS', 'HAM', 'COL', 'SAI', 'GAS'], fastestLap: null, dnf: 'STR', sprintTop8: ['NOR', 'LEC', 'ANT', 'PIA', 'VER', 'RUS', 'HAM', 'COL'] },
      r05: { top10: ['RUS', 'ANT', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'], fastestLap: 'ANT', dnf: 'STR', sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'] },
      r06: { top10: ['ANT', 'HAM', 'HAD', 'PIA', 'LEC', 'LIN', 'LAW', 'GAS', 'ALB', 'PER'], fastestLap: 'ANT', dnf: 'STR', sprintTop8: [] },
      r07: { top10: ['HAM', 'RUS', 'VER', 'LEC', 'PIA', 'HAD', 'GAS', 'LAW', 'LIN', 'COL'], fastestLap: 'ANT', dnf: 'ALO', sprintTop8: [] },
    }
  },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': { // Bryan Leach
    username: 'bryanleach',
    displayName: 'Bryan Leach',
    predictions: {
      r01: { top10: ['RUS', 'ANT', 'PIA', 'LEC', 'NOR', 'HAM', 'HAD', 'VER', 'LAW', 'LIN'], fastestLap: 'RUS', dnf: 'ALO', sprintTop8: [] },
      r02: { top10: ['RUS', 'ANT', 'LEC', 'HAM', 'PIA', 'NOR', 'VER', 'HAD', 'BEA', 'GAS'], fastestLap: 'RUS', dnf: 'PER', sprintTop8: ['RUS', 'ANT', 'HAM', 'LEC', 'LEC', 'VER', 'NOR', 'HAD'] },
      r03: { top10: ['RUS', 'ANT', 'LEC', 'HAM', 'VER', 'PIA', 'NOR', 'HAD', 'GAS', 'LIN'], fastestLap: 'RUS', dnf: 'STR', sprintTop8: [] },
      r04: { top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'PIA', 'HAM', 'GAS', 'HAD', 'COL'], fastestLap: 'ANT', dnf: 'ALO', sprintTop8: ['ANT', 'NOR', 'PIA', 'LEC', 'RUS', 'VER', 'HAM', 'HAD'] },
      r05: { top10: ['RUS', 'ANT', 'NOR', 'PIA', 'HAM', 'LEC', 'VER', 'HAD', 'LIN', 'LAW'], fastestLap: 'NOR', dnf: 'BOT', sprintTop8: ['RUS', 'ANT', 'NOR', 'PIA', 'HAM', 'LEC', 'VER', 'HAD'] },
      r06: { top10: ['ANT', 'HAM', 'PIA', 'HAD', 'LAW', 'LIN', 'GAS', 'ALB', 'OCO', 'PER'], fastestLap: 'ANT', dnf: 'HAD', sprintTop8: [] },
      r07: { top10: ['RUS', 'ANT', 'HAM', 'VER', 'LEC', 'PIA', 'HAD', 'LAW', 'SAI', 'LIN'], fastestLap: 'ANT', dnf: null, sprintTop8: [] },
    }
  },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': { // Carlos Trujillo
    username: 'sainz4ever55',
    displayName: 'Carlos Trujillo',
    predictions: {
      r01: { top10: ['RUS', 'ANT', 'LEC', 'PIA', 'HAD', 'HAM', 'NOR', 'VER', 'LAW', 'HUL'], fastestLap: 'RUS', dnf: 'ALO', sprintTop8: [] },
      r02: { top10: ['RUS', 'ANT', 'HAM', 'LEC', 'NOR', 'PIA', 'VER', 'HAD', 'GAS', 'HUL'], fastestLap: 'RUS', dnf: 'ALB', sprintTop8: ['RUS', 'ANT', 'HAM', 'NOR', 'LEC', 'VER', 'PIA', 'GAS'] },
      r03: { top10: ['ANT', 'RUS', 'LEC', 'HAM', 'PIA', 'NOR', 'HAD', 'VER', 'GAS', 'LIN'], fastestLap: 'RUS', dnf: 'STR', sprintTop8: [] },
      r04: { top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'LEC', 'PIA', 'HAM', 'GAS', 'HUL'], fastestLap: 'VER', dnf: null, sprintTop8: ['NOR', 'ANT', 'PIA', 'LEC', 'RUS', 'VER', 'HAM', 'HAD'] },
      r05: { top10: ['ANT', 'RUS', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'], fastestLap: 'ANT', dnf: 'ALO', sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'] },
      r06: { top10: ['VER', 'ANT', 'HAM', 'LEC', 'HAD', 'RUS', 'PIA', 'NOR', 'GAS', 'LAW'], fastestLap: 'VER', dnf: 'BOR', sprintTop8: [] },
      r07: { top10: ['RUS', 'HAM', 'ANT', 'VER', 'NOR', 'LEC', 'HAD', 'PIA', 'HUL', 'LAW'], fastestLap: 'RUS', dnf: null, sprintTop8: [] },
    }
  },
};

// ---- Compute expected points ----
console.log('\n========== EXPECTED POINTS (from scoring engine) ==========\n');

const resultByRaceId = new Map();
for (const r of MOCK_RACE_RESULTS) resultByRaceId.set(r.raceId, r);

const raceNames = {
  r01: 'Australian GP', r02: 'Chinese GP', r03: 'Japanese GP',
  r04: 'Miami GP', r05: 'Canadian GP', r06: 'Monaco GP',
  r07: 'Barcelona GP',
};

const COMPLETED_RACE_IDS = ['r01','r02','r03','r04','r05','r06','r07'];

for (const [userId, user] of Object.entries(SEED_PREDICTIONS)) {
  console.log(`\n--- ${user.displayName} (${user.username}) ---`);
  let grandTotal = 0;

  for (const raceId of COMPLETED_RACE_IDS) {
    const pred = user.predictions[raceId];
    if (!pred) continue;

    const result = resultByRaceId.get(raceId);
    if (!result) continue;

    const fullPred = { ...pred, top10: pred.top10 || [], fastestLap: pred.fastestLap, dnf: pred.dnf || null, sprintTop8: pred.sprintTop8 || [] };
    const main = calculatePoints(fullPred, result);
    let sprintScore = { totalPoints: 0 };

    if (pred.sprintTop8?.length > 0 && result.sprintClassification) {
      sprintScore = calculateSprintPoints(pred.sprintTop8, result.sprintClassification);
    }

    const raceTotal = main.totalPoints + sprintScore.totalPoints;
    grandTotal += raceTotal;

    // Show top10 matches
    const resultTop10 = result.classification.filter(e => e.position <= 10).sort((a,b) => a.position - b.position).map(e => e.driverId);
    const matches = [];
    const seen = new Set();
    for (let i = 0; i < Math.min(pred.top10.length, 10); i++) {
      if (seen.has(pred.top10[i])) continue;
      seen.add(pred.top10[i]);
      if (pred.top10[i] === resultTop10[i]) matches.push(`P${i+1}:${pred.top10[i]}`);
    }

    console.log(`  ${raceNames[raceId]} (${raceId}): GP=${main.totalPoints} (pos=${main.positionPoints}, FL=${main.fastestLapPoints}, DNF=${main.dnfPoints})` +
      (sprintScore.totalPoints > 0 ? ` Sprint=${sprintScore.totalPoints}` : '') +
      ` = TOTAL ${raceTotal}`);
    if (matches.length > 0) console.log(`    Matches: ${matches.join(', ')}`);
    if (main.dnfPoints === 0 && pred.dnf) {
      const dnsIds = getDnsDriverIds(result);
      const trueDnfIds = getTrueDnfDriverIds(result);
      console.log(`    DNF missed: picked=${pred.dnf}, DNS=${[...dnsIds].join(',')}, trueDNF=${[...trueDnfIds].join(',')}`);
    }
  }

  console.log(`  >>> GRAND TOTAL: ${grandTotal}`);
}

// ---- Now query Supabase DB ----
console.log('\n========== SUPABASE DB STATE ==========\n');

const { createClient } = require('@supabase/supabase-js');

// Read env vars from .env file
const fs = require('fs');
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Try .env files
try {
  const envContent = fs.readFileSync('expo/.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)/);
    if (match) supabaseUrl = match[1].trim();
    const match2 = line.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
    if (match2) supabaseKey = match2[1].trim();
  }
} catch {}

console.log('Supabase URL:', supabaseUrl ? 'found' : 'NOT FOUND');

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Fetch ALL predictions
  const { data, error } = await supabase
    .from('user_predictions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.log('ERROR fetching from Supabase:', error.message);
    return;
  }

  console.log(`Total rows in user_predictions: ${data.length}\n`);

  // Check for duplicates
  const seen = new Map();
  const dupes = [];
  for (const row of data) {
    const key = `${row.user_id}:${row.race_id}`;
    if (seen.has(key)) dupes.push({ existing: seen.get(key), duplicate: row });
    else seen.set(key, row);
  }
  if (dupes.length > 0) {
    console.log('DUPLICATES FOUND:');
    for (const d of dupes) {
      console.log(`  ${d.existing.user_id}/${d.existing.race_id}: id=${d.existing.id} vs id=${d.duplicate.id}`);
    }
  } else {
    console.log('No duplicate (user_id, race_id) pairs found.');
  }

  // Group by user
  const byUser = new Map();
  for (const row of data) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(row);
  }

  console.log('\n--- DB Points by User ---');
  for (const [userId, rows] of byUser) {
    const username = rows[0].username || 'Unknown';
    const displayName = rows[0].display_name || username;
    let totalDB = 0;
    for (const row of rows) {
      const gp = row.points_earned || 0;
      const sp = row.sprint_points_earned || 0;
      totalDB += gp + sp;
      console.log(`  ${displayName} / ${userId.substring(0,8)} / ${row.race_id}: GP=${gp} Sprint=${sp}`);
    }
    console.log(`  >>> DB TOTAL for ${displayName}: ${totalDB}\n`);
  }

  // Compare expected vs DB
  console.log('\n========== EXPECTED vs DB COMPARISON ==========\n');
  const raceIdFix = { r06: 'r04', r07: 'r05', r08: 'r06', r09: 'r07' };

  for (const [userId, user] of Object.entries(SEED_PREDICTIONS)) {
    const dbRows = byUser.get(userId) || [];
    console.log(`\n--- ${user.displayName} ---`);

    let expectedTotal = 0;
    let dbTotal = 0;
    let mismatches = 0;

    for (const raceId of COMPLETED_RACE_IDS) {
      const pred = user.predictions[raceId];
      if (!pred) continue;

      const result = resultByRaceId.get(raceId);
      if (!result) continue;

      const fullPred = { ...pred, top10: pred.top10 || [], fastestLap: pred.fastestLap, dnf: pred.dnf || null, sprintTop8: pred.sprintTop8 || [] };
      const main = calculatePoints(fullPred, result);
      let sprintScore = { totalPoints: 0 };
      if (pred.sprintTop8?.length > 0 && result.sprintClassification) {
        sprintScore = calculateSprintPoints(pred.sprintTop8, result.sprintClassification);
      }
      const expGP = main.totalPoints;
      const expSP = sprintScore.totalPoints;

      // Find DB row (accounting for race ID fix mapping)
      let dbRow = dbRows.find(r => r.race_id === raceId);
      if (!dbRow) {
        // Try reverse mapping
        const fixedId = Object.entries(raceIdFix).find(([k, v]) => v === raceId)?.[0];
        if (fixedId) dbRow = dbRows.find(r => r.race_id === fixedId);
      }

      const dbGP = dbRow?.points_earned ?? 0;
      const dbSP = dbRow?.sprint_points_earned ?? 0;

      expectedTotal += expGP + expSP;
      dbTotal += dbGP + dbSP;

      const gpOk = expGP === dbGP;
      const spOk = expSP === dbSP;
      if (!gpOk || !spOk) {
        mismatches++;
        console.log(`  MISMATCH ${raceId} (DB race_id=${dbRow?.race_id || 'N/A'}): GP expected=${expGP} DB=${dbGP} ${gpOk ? '✓' : '✗'} | Sprint expected=${expSP} DB=${dbSP} ${spOk ? '✓' : '✗'}`);
      } else {
        console.log(`  OK ${raceId}: GP=${expGP} Sprint=${expSP}`);
      }
    }

    console.log(`  TOTALS: Expected=${expectedTotal}, DB=${dbTotal} ${expectedTotal === dbTotal ? '✓' : '✗ MISMATCH'}`);
    if (mismatches === 0) console.log(`  All ${COMPLETED_RACE_IDS.length} races match.`);
    else console.log(`  ${mismatches} race(s) have mismatched points!`);
  }

  // Check Supabase triggers/functions
  console.log('\n========== CHECKING FOR SUPABASE TRIGGERS/FUNCTIONS ==========\n');

  // Check RPC function
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_leaderboard');
  if (rpcError) {
    console.log('RPC get_leaderboard:', rpcError.message);
  } else {
    console.log('RPC get_leaderboard returned', rpcData?.length || 0, 'entries');
    if (rpcData) {
      for (const entry of rpcData) {
        console.log(`  ${entry.username || entry.display_name || '?'}: ${entry.total_points || 0} pts`);
      }
    }
  }

  // Check profiles table
  const { data: profiles, error: profError } = await supabase.from('profiles').select('*');
  if (profError) {
    console.log('Profiles error:', profError.message);
  } else if (profiles) {
    console.log('\nProfiles table:');
    for (const p of profiles) {
      console.log(`  ${p.username || '?'} (${p.id?.substring(0,8)}): total_points=${p.total_points}`);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
