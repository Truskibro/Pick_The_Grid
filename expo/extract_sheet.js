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

const DRIVER_MAP = {
  'g. russell': 'RUS', 'george russell': 'RUS',
  'k. antonelli': 'ANT',
  'c. leclerc': 'LEC',
  'l. hamilton': 'HAM', 'l. hamillton': 'HAM',
  'l. norris': 'NOR',
  'm. verstappen': 'VER',
  'o. piastri': 'PIA', 'o. piastri': 'PIA',
  'o. bearman': 'BEA',
  'p. gasly': 'GAS',
  'i. hadjar': 'HAD', 'i. hdjar': 'HAD',
  'l. lawson': 'LAW',
  'c. sainz': 'SAI',
  'f. colapinto': 'COL',
  'n. hulkenberg': 'HUL',
  'e. ocon': 'OCO',
  'a. lindblad': 'LIN', 'a. linblad': 'LIN',
  'a. albon': 'ALB',
  'g. bartoleto': 'BOR', 'g. bortoleto': 'BOR',
  's. perez': 'PER',
  'f. alonso': 'ALO',
  'v. bottas': 'BOT',
  'l. stroll': 'STR',
  'stroll': 'STR', 'alonso': 'ALO', 'bottas': 'BOT', 'hadjar': 'HAD',
  'perez': 'PER', 'colapinto': 'COL', 'lawson': 'LAW', 'albon': 'ALB',
};

function norm(name) {
  if (!name || name === 'g' || name === 'f') return null;
  const c = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (DRIVER_MAP[c]) return DRIVER_MAP[c];
  const words = c.split(' ');
  const last = words[words.length - 1];
  if (DRIVER_MAP[last]) return DRIVER_MAP[last];
  const first = words[0];
  if (DRIVER_MAP[first]) return DRIVER_MAP[first];
  return null;
}

const rounds = [];
let cur = null;

for (const row of data) {
  const col1 = String(row[1] || '').trim();
  
  if (col1.startsWith('Round ')) {
    if (cur) rounds.push(cur);
    cur = {
      name: col1,
      preds: users.map(() => ({ top10: [], fl: null, dnf: null })),
      roundPts: users.map(() => 0),
      totalPts: users.map(() => 0),
    };
    continue;
  }
  if (!cur) continue;
  
  const col3 = String(row[3] || '').trim();
  if (col3 === 'Current Round Points') {
    for (let u = 0; u < users.length; u++) cur.roundPts[u] = Number(row[users[u].ptsCol]) || 0;
    continue;
  }
  if (col3 === 'Total Points') {
    for (let u = 0; u < users.length; u++) cur.totalPts[u] = Number(row[users[u].ptsCol]) || 0;
    continue;
  }
  
  const pos = Number(row[2]);
  if (pos >= 1 && pos <= 10) {
    for (let u = 0; u < users.length; u++) {
      cur.preds[u].top10.push(norm(String(row[users[u].col] || '')));
    }
    continue;
  }
  
  if (String(row[2] || '') === 'Fastest Lap') {
    for (let u = 0; u < users.length; u++) {
      cur.preds[u].fl = norm(String(row[users[u].col] || ''));
    }
    continue;
  }
  
  if (String(row[2] || '') === 'DNF') {
    for (let u = 0; u < users.length; u++) {
      cur.preds[u].dnf = norm(String(row[users[u].col] || ''));
    }
  }
}
if (cur) rounds.push(cur);

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

console.log('=== RAW SPREADSHEET DATA ===');
for (const r of rounds) {
  const m = RACE_MAP[r.name];
  if (!m) { console.log('SKIP: ' + r.name); continue; }
  console.log('\n--- ' + r.name + ' (app: ' + m.id + ' ' + m.type + ') ---');
  console.log('  Round pts: ' + users.map((u,i) => u.name.split(' ')[0] + '=' + r.roundPts[i]).join(', '));
  console.log('  Total pts: ' + users.map((u,i) => u.name.split(' ')[0] + '=' + r.totalPts[i]).join(', '));
  for (let u = 0; u < users.length; u++) {
    const p = r.preds[u];
    if (!p.top10.some(x => x)) continue;
    console.log('  ' + users[u].name + ':');
    console.log('    top10: [' + p.top10.map(x => x||'null').join(',') + ']');
    console.log('    fl: ' + (p.fl||'null') + '  dnf: ' + (p.dnf||'null'));
  }
}

// Build per-race-id predictions
console.log('\n\n=== APP FORMAT ===');
const appPreds = {};
for (const r of rounds) {
  const m = RACE_MAP[r.name];
  if (!m) continue;
  if (!appPreds[m.id]) appPreds[m.id] = { sprint: null, race: null, sprintPts: null, racePts: null };
  if (m.type === 'sprint') {
    appPreds[m.id].sprint = r.preds;
    appPreds[m.id].sprintPts = r.roundPts;
  } else {
    appPreds[m.id].race = r.preds;
    appPreds[m.id].racePts = r.roundPts;
  }
}

for (const [raceId, rp] of Object.entries(appPreds)) {
  console.log('\n// ' + raceId);
  for (let u = 0; u < users.length; u++) {
    const racePred = rp.race.preds[u];
    const sprintPred = rp.sprint ? rp.sprint.preds[u] : null;
    console.log('  ' + users[u].name + ':');
    console.log('    top10: [' + racePred.top10.map(x => "'" + (x||'') + "'").join(', ') + '],');
    console.log('    fastestLap: ' + (racePred.fl ? "'" + racePred.fl + "'" : 'null') + ',');
    console.log('    dnf: ' + (racePred.dnf ? "'" + racePred.dnf + "'" : 'null') + ',');
    if (sprintPred && sprintPred.top10.some(x => x)) {
      console.log('    sprintTop8: [' + sprintPred.top10.slice(0, 8).map(x => "'" + (x||'') + "'").join(', ') + '],');
    } else {
      console.log('    sprintTop8: [],');
    }
  }
}
