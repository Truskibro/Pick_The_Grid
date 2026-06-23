const XLSX = require('xlsx');
const wb = XLSX.readFile('/tmp/spreadsheet.xlsx');
const ws = wb.Sheets['2026'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const users = [
  { name: 'Skye Leach', col: 5, ptsCol: 6 },
  { name: 'Whitney Trujillo', col: 7, ptsCol: 8 },
  { name: 'Bryan Leach', col: 9, ptsCol: 10 },
  { name: 'Carlos Trujillo', col: 11, ptsCol: 12 },
];

// Driver name normalization: spreadsheet uses full names, app uses 3-letter codes
const DRIVER_NAME_MAP = {
  'g. russell': 'RUS',
  'george russell': 'RUS',
  'k. antonelli': 'ANT',
  'andrea kimi antonelli': 'ANT',
  'c. leclerc': 'LEC',
  'charles leclerc': 'LEC',
  'l. hamilton': 'HAM',
  'lewis hamilton': 'HAM',
  'l. norris': 'NOR',
  'lando norris': 'NOR',
  'm. verstappen': 'VER',
  'max verstappen': 'VER',
  'o. piastri': 'PIA',
  'oscar piastri': 'PIA',
  'o. bearman': 'BEA',
  'oliver bearman': 'BEA',
  'p. gasly': 'GAS',
  'pierre gasly': 'GAS',
  'i. hadjar': 'HAD',
  'isack hadjar': 'HAD',
  'l. lawson': 'LAW',
  'liam lawson': 'LAW',
  'c. sainz': 'SAI',
  'carlos sainz': 'SAI',
  'f. colapinto': 'COL',
  'franco colapinto': 'COL',
  'n. hulkenberg': 'HUL',
  'nico hulkenberg': 'HUL',
  'e. ocon': 'OCO',
  'esteban ocon': 'OCO',
  'a. lindblad': 'LIN',
  'a. linblad': 'LIN',
  'arvid lindblad': 'LIN',
  'a. albon': 'ALB',
  'alexander albon': 'ALB',
  'g. bartoleto': 'BOR',
  'gabriel bortoleto': 'BOR',
  'g. bortoleto': 'BOR',
  's. perez': 'PER',
  'sergio perez': 'PER',
  'f. alonso': 'ALO',
  'fernando alonso': 'ALO',
  'v. bottas': 'BOT',
  'valtteri bottas': 'BOT',
  'l. stroll': 'STR',
  'lance stroll': 'STR',
  'i. hdjar': 'HAD',
  'a. linblad': 'LIN',
};

function normalizeDriver(name) {
  if (!name || name === 'g' || name === 'f') return null;
  const cleaned = name.toLowerCase().replace(/\s+/g, ' ').trim();
  // Try exact match
  if (DRIVER_NAME_MAP[cleaned]) return DRIVER_NAME_MAP[cleaned];
  // Try matching known names
  for (const [key, val] of Object.entries(DRIVER_NAME_MAP)) {
    if (cleaned.includes(key) || key.includes(cleaned)) return val;
  }
  console.log('  UNKNOWN DRIVER:', JSON.stringify(name), 'cleaned:', JSON.stringify(cleaned));
  return null;
}

const rounds = [];
let currentRound = null;

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const firstCell = String(row[0] || '').trim();
  
  if (firstCell.startsWith('Round ')) {
    if (currentRound) rounds.push(currentRound);
    const isSprint = firstCell.includes('Sprint');
    const isGP = firstCell.includes('Grand Prix') && !isSprint;
    currentRound = {
      name: firstCell,
      isSprint,
      isGP,
      actualResults: [],
      predictions: users.map(() => ({ top10: [], fastestLap: null, dnf: null })),
      roundPoints: users.map(() => 0),
      totalPoints: users.map(() => 0),
    };
    continue;
  }
  
  if (!currentRound) continue;
  
  if (String(row[2] || '') === 'Current Round Points') {
    for (let u = 0; u < users.length; u++) {
      currentRound.roundPoints[u] = Number(row[users[u].ptsCol]) || 0;
    }
    continue;
  }
  
  if (String(row[2] || '') === 'Total Points') {
    for (let u = 0; u < users.length; u++) {
      currentRound.totalPoints[u] = Number(row[users[u].ptsCol]) || 0;
    }
    continue;
  }
  
  const pos = Number(row[2]);
  if (pos >= 1 && pos <= 10) {
    const actualDriver = normalizeDriver(String(row[3] || ''));
    currentRound.actualResults.push({ pos, driver: actualDriver });
    for (let u = 0; u < users.length; u++) {
      currentRound.predictions[u].top10.push(normalizeDriver(String(row[users[u].col] || '')));
    }
    continue;
  }
  
  if (String(row[2] || '') === 'Fastest Lap') {
    for (let u = 0; u < users.length; u++) {
      const val = normalizeDriver(String(row[users[u].col] || ''));
      currentRound.predictions[u].fastestLap = val;
    }
    continue;
  }
  
  if (String(row[2] || '') === 'DNF') {
    for (let u = 0; u < users.length; u++) {
      const val = String(row[users[u].col] || '').trim();
      // DNF can be names or "none" / empty
      const normalized = normalizeDriver(val);
      currentRound.predictions[u].dnf = normalized;
    }
    continue;
  }
}

if (currentRound) rounds.push(currentRound);

// Print results
for (const r of rounds) {
  // Skip cancelled/placeholder rounds
  if (r.predictions.every(p => p.top10.every(x => !x))) continue;
  
  console.log('--- ' + r.name + ' ---');
  console.log('  Actual: ' + r.actualResults.map(d => d.pos + ':' + (d.driver || '?')).join(', '));
  for (let u = 0; u < users.length; u++) {
    const p = r.predictions[u];
    console.log('  ' + users[u].name + ':');
    console.log('    Top10: [' + p.top10.map(x => x || 'null').join(', ') + ']');
    console.log('    FL: ' + (p.fastestLap || 'null') + '  DNF: ' + (p.dnf || 'null'));
  }
  console.log('  Round Pts: ' + users.map((u, i) => u.name.split(' ')[0] + '=' + r.roundPoints[i]).join(', '));
  console.log('  Total Pts: ' + users.map((u, i) => u.name.split(' ')[0] + '=' + r.totalPoints[i]).join(', '));
  console.log('');
}

// Now group by race for the app mapping
// Spreadsheet round -> App race ID mapping
// R1 Australian -> r01
// R2 China Sprint + R2 China GP -> r02 (sprint + race)
// R3 Japanese -> r03
// R4 Bahrain -> CANCELLED (skip)
// R5 Saudi -> CANCELLED (skip)
// R6 Miami Sprint + R6 Miami GP -> r04 (sprint + race)
// R7 Canada Sprint + R7 Canada GP -> r05 (sprint + race)
// R8 Monaco -> r06
// R9 Spanish -> r07

console.log('\n===== APP PREDICTION FORMAT =====\n');

const APP_RACE_MAP = {
  'Round 1 - Australian Grand Prix 2026': { raceId: 'r01', type: 'race' },
  'Round 2 - China 2026 - Sprint': { raceId: 'r02', type: 'sprint' },
  'Round 2 - China 2026 - Grand Prix': { raceId: 'r02', type: 'race' },
  'Round 3 - Japanese Grand Prix 2026': { raceId: 'r03', type: 'race' },
  'Round 6 - Miami Grand Prix 2026 - Sprint': { raceId: 'r04', type: 'sprint' },
  'Round 6 - Miami Grand Prix 2026': { raceId: 'r04', type: 'race' },
  'Round 7 - Grand Prix du Canada 2026 - Sprint': { raceId: 'r05', type: 'sprint' },
  'Round 7 - Grand Prix du Canada 2026': { raceId: 'r05', type: 'race' },
  'Round 8 - Monaco Grand Prix 2026': { raceId: 'r06', type: 'race' },
  'Round 9 - Spanish Grand Prix 2026': { raceId: 'r07', type: 'race' },
};

const appRaces = {};
for (const r of rounds) {
  const mapping = APP_RACE_MAP[r.name];
  if (!mapping) continue;
  const { raceId, type } = mapping;
  if (!appRaces[raceId]) {
    appRaces[raceId] = { raceId, sprintPreds: users.map(() => null), racePreds: users.map(() => null) };
  }
  for (let u = 0; u < users.length; u++) {
    if (type === 'sprint') {
      appRaces[raceId].sprintPreds[u] = r.predictions[u];
    } else {
      appRaces[raceId].racePreds[u] = r.predictions[u];
    }
  }
}

for (const [raceId, race] of Object.entries(appRaces)) {
  console.log('// ' + raceId);
  for (let u = 0; u < users.length; u++) {
    const rp = race.racePreds[u];
    const sp = race.sprintPreds[u];
    if (!rp) continue;
    console.log('  ' + users[u].name + ':');
    console.log('    raceId: \'' + raceId + '\',');
    console.log('    top10: [' + rp.top10.map(x => '\'' + (x || 'null') + '\'').join(', ') + '],');
    console.log('    fastestLap: ' + (rp.fastestLap ? '\'' + rp.fastestLap + '\'' : 'null') + ',');
    console.log('    dnf: ' + (rp.dnf ? '\'' + rp.dnf + '\'' : 'null') + ',');
    if (sp && sp.top10.some(x => x)) {
      console.log('    sprintTop8: [' + sp.top10.slice(0, 8).map(x => '\'' + (x || 'null') + '\'').join(', ') + '],');
    } else {
      console.log('    sprintTop8: [],');
    }
    console.log('    // spreadsheet round pts: ' + r.roundPoints[u] + ', total: ' + r.totalPoints[u]);
  }
  console.log('');
}
