const XLSX = require('xlsx');
const wb = XLSX.readFile('/tmp/spreadsheet.xlsx');
const ws = wb.Sheets['2026'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Driver name normalization (spreadsheet name -> 3-letter code)
const DM = {
  'g. russell': 'RUS', 'g russell': 'RUS',
  'k. antonelli': 'ANT', 'k antonelli': 'ANT',
  'c. leclerc': 'LEC', 'c leclerc': 'LEC',
  'l. hamilton': 'HAM', 'l hamilton': 'HAM', 'l. hamillton': 'HAM',
  'l. norris': 'NOR', 'l norris': 'NOR',
  'm. verstappen': 'VER', 'm verstappen': 'VER',
  'o. piastri': 'PIA', 'o piastri': 'PIA', 'o. piastri': 'PIA',
  'o. bearman': 'BEA', 'o bearman': 'BEA',
  'p. gasly': 'GAS', 'p gasly': 'GAS',
  'i. hadjar': 'HAD', 'i hadjar': 'HAD', 'i. hdjar': 'HAD',
  'l. lawson': 'LAW', 'l lawson': 'LAW',
  'c. sainz': 'SAI', 'c sainz': 'SAI',
  'f. colapinto': 'COL', 'f colapinto': 'COL',
  'n. hulkenberg': 'HUL', 'n hulkenberg': 'HUL',
  'e. ocon': 'OCO', 'e ocon': 'OCO',
  'a. lindblad': 'LIN', 'a lindblad': 'LIN', 'a. linblad': 'LIN', 'a linblad': 'LIN', 'a. lindbald': 'LIN',
  'a. albon': 'ALB', 'a albon': 'ALB',
  'g. bartoleto': 'BOR', 'g bartoleto': 'BOR', 'g. bortoleto': 'BOR',
  's. perez': 'PER', 's perez': 'PER',
  'f. alonso': 'ALO', 'f alonso': 'ALO',
  'v. bottas': 'BOT', 'v bottas': 'BOT',
  'l. stroll': 'STR', 'l stroll': 'STR',
  // Single-name DNF entries
  'stroll': 'STR', 'alonso': 'ALO', 'bottas': 'BOT',
  'hadjar': 'HAD', 'perez': 'PER', 'colapinto': 'COL',
  'lawson': 'LAW', 'albon': 'ALB',
  // Actual result entries with multiword DNF lists
  'alonso, bottas, hadjar, piastri, nico': null, // multi-name, skip
};

function norm(name) {
  if (!name || name === 'g' || name === 'f') return null;
  const c = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (DM[c] !== undefined) return DM[c];
  // Try matching by parts
  const words = c.split(/[\s,]+/);
  for (const w of words) {
    if (DM[w] !== undefined && DM[w] !== null) return DM[w];
  }
  // Try each known key as substring
  for (const [k, v] of Object.entries(DM)) {
    if (v && (c.includes(k) || k.includes(c))) return v;
  }
  if (c.length > 0) console.log('  UNKNOWN: ' + JSON.stringify(c));
  return null;
}

const users = [
  { name: 'Skye Leach', col: 5, ptsCol: 6, userId: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' },
  { name: 'Whitney Trujillo', col: 7, ptsCol: 8, userId: '652154af-dc27-47b5-aa79-25903b9c4a1b' },
  { name: 'Bryan Leach', col: 9, ptsCol: 10, userId: 'f35417e9-4f0d-4def-9c2f-c81276863fc0' },
  { name: 'Carlos Trujillo', col: 11, ptsCol: 12, userId: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b' },
];

const rounds = [];
let cur = null;

for (const row of data) {
  const col1 = String(row[1] || '').trim();
  if (col1.startsWith('Round ')) {
    if (cur) rounds.push(cur);
    cur = { name: col1, preds: users.map(() => ({ top10: [], fl: null, dnf: null })), roundPts: users.map(() => 0), totalPts: users.map(() => 0) };
    continue;
  }
  if (!cur) continue;
  const col3 = String(row[3] || '').trim();
  if (col3 === 'Current Round Points') { for (let u = 0; u < users.length; u++) cur.roundPts[u] = Number(row[users[u].ptsCol]) || 0; continue; }
  if (col3 === 'Total Points') { for (let u = 0; u < users.length; u++) cur.totalPts[u] = Number(row[users[u].ptsCol]) || 0; continue; }
  const pos = Number(row[2]);
  if (pos >= 1 && pos <= 10) {
    for (let u = 0; u < users.length; u++) cur.preds[u].top10.push(norm(String(row[users[u].col] || '')));
    continue;
  }
  if (String(row[2] || '') === 'Fastest Lap') {
    for (let u = 0; u < users.length; u++) cur.preds[u].fl = norm(String(row[users[u].col] || ''));
    continue;
  }
  if (String(row[2] || '') === 'DNF') {
    for (let u = 0; u < users.length; u++) cur.preds[u].dnf = norm(String(row[users[u].col] || ''));
  }
}
if (cur) rounds.push(cur);

// Map spreadsheet rounds to app race IDs
const RACE_MAP = {
  'Round 1 - Australian Grand Prix 2026': { id: 'r01', type: 'race' },
  'Round 2 - China 2026 - Sprint': { id: 'r02', type: 'sprint' },
  'Round 2 - China 2026 - Grand Prix': { id: 'r02', type: 'race' },
  'Round 3 - Japanese Grand Prix 2026': { id: 'r03', type: 'race' },
  'Round 6 - Miami Grand Prix 2026 - Sprint': { id: 'r04', type: 'sprint' },
  'Round 6 - Miami Grand Prix 2026': { id: 'r04', type: 'race' },
  'Round 7 - Grand Prix du Canada 2026 - Sprint': { id: 'r05', type: 'sprint' },
  'Round 7 - Grand Prix du Canada 2026': { id: 'r05', type: 'race' },
  'Round 8 - Monaco Grand Prix 2026': { id: 'r06', type: 'race' },
  'Round 9 - Spanish Grand Prix 2026': { id: 'r07', type: 'race' },
};

// Build app-format predictions
const appRaces = {};
for (const r of rounds) {
  const m = RACE_MAP[r.name];
  if (!m) continue;
  if (!appRaces[m.id]) appRaces[m.id] = { sprint: null, race: null };
  if (m.type === 'sprint') appRaces[m.id].sprint = r.preds;
  else appRaces[m.id].race = r.preds;
}

// Now generate the seed-predictions.ts content
console.log('=== FINAL PREDICTIONS FOR seed-predictions.ts ===\n');

for (const [raceId, ap] of Object.entries(appRaces)) {
  if (raceId === 'r07') {
    console.log('// R07 Spanish GP - NO predictions in spreadsheet (all blank)');
    console.log('// Skipping - no data to import\n');
    continue;
  }
  
  for (let u = 0; u < users.length; u++) {
    const rp = ap.race;
    const sp = ap.sprint;
    const racePreds = rp[u];
    const sprintPreds = sp ? sp[u] : null;
    
    // Find round pts from spreadsheet
    let spreadsheetRoundPts = 0;
    let spreadsheetTotalPts = 0;
    for (const r of rounds) {
      const m = RACE_MAP[r.name];
      if (m && m.id === raceId && m.type === 'race') {
        spreadsheetRoundPts = r.roundPts[u];
        // Total includes sprint if there was one
        if (sp) {
          for (const r2 of rounds) {
            const m2 = RACE_MAP[r2.name];
            if (m2 && m2.id === raceId && m2.type === 'sprint') {
              spreadsheetRoundPts += r2.roundPts[u];
            }
          }
        }
        spreadsheetTotalPts = r.totalPts[u];
      }
    }
    
    console.log(`// ${users[u].name} - ${raceId}`);
    console.log(`  // spreadsheet: round=${spreadsheetRoundPts} total=${spreadsheetTotalPts}`);
    console.log(`  top10: [${racePreds.top10.map(x => "'" + (x || '') + "'").join(', ')}],`);
    console.log(`  fl: ${racePreds.fl ? "'" + racePreds.fl + "'" : 'null'},`);
    console.log(`  dnf: ${racePreds.dnf ? "'" + racePreds.dnf + "'" : 'null'},`);
    if (sprintPreds && sprintPreds.top10.some(x => x)) {
      console.log(`  sprint: [${sprintPreds.top10.slice(0, 8).map(x => "'" + (x || '') + "'").join(', ')}],`);
    } else {
      console.log(`  sprint: [],`);
    }
    console.log('');
  }
}
