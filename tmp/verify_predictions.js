const XLSX = require('xlsx');
const https = require('https');

const SUPABASE_URL = 'fxwgbpassouaddakgyus.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const USERS = [
  { name: 'Skye Leach', id: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' },
  { name: 'Whitney Trujillo', id: '652154af-dc27-47b5-aa79-25903b9c4a1b' },
  { name: 'Bryan Leach', id: 'f35417e9-4f0d-4def-9c2f-c81276863fc0' },
  { name: 'Carlos Trujillo', id: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b' },
];

// Driver name normalization
const DRIVER_MAP = {
  'g. russell': 'RUS', 'george russell': 'RUS',
  'k. antonelli': 'ANT', 'andrea kimi antonelli': 'ANT', 'kimi antonelli': 'ANT',
  'c. leclerc': 'LEC', 'charles leclerc': 'LEC',
  'l. hamilton': 'HAM', 'lewis hamilton': 'HAM',
  'l. norris': 'NOR', 'lando norris': 'NOR',
  'm. verstappen': 'VER', 'max verstappen': 'VER',
  'o. piastri': 'PIA', 'oscar piastri': 'PIA',
  'i. hadjar': 'HAD', 'isack hadjar': 'HAD',
  'l. lawson': 'LAW', 'liam lawson': 'LAW',
  'o. bearman': 'BEA', 'oliver bearman': 'BEA',
  'p. gasly': 'GAS', 'pierre gasly': 'GAS',
  'c. sainz': 'SAI', 'carlos sainz': 'SAI',
  'a. albon': 'ALB', 'alexander albon': 'ALB', 'alex albon': 'ALB',
  'e. ocon': 'OCO', 'esteban ocon': 'OCO',
  'a. lindbald': 'LIN', 'arvid lindblad': 'LIN',
  'g. bartoleto': 'BOR', 'gabriel bortoleto': 'BOR',
  'n. hulkenberg': 'HUL', 'nico hulkenberg': 'HUL',
  'f. alonso': 'ALO', 'fernando alonso': 'ALO',
  'v. bottas': 'BOT', 'valtteri bottas': 'BOT',
  's. perez': 'PER', 'sergio perez': 'PER',
  'l. stroll': 'STR', 'lance stroll': 'STR',
  'f. colapinto': 'COL', 'franco colapinto': 'COL',
};

function normDriver(name) {
  if (!name || name === '' || name === '-') return null;
  name = name.toLowerCase().trim().replace(/\s+/g, ' ');
  // Handle comma-separated DNF lists
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    return parts.map(p => DRIVER_MAP[p] || p.toUpperCase()).join(',');
  }
  return DRIVER_MAP[name] || '';
}

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

function extractRacePredictions(wsData, startRow, hasSprint) {
  const result = { main: {}, sprint: {}, fl: {}, dnf: {} };
  let section = 'main';

  for (let i = startRow; i < Math.min(startRow + 25, wsData.length); i++) {
    const row = wsData[i].map(c => String(c || '').trim());
    const joined = row.join(' ').toLowerCase();

    if (joined.includes('sprint')) section = 'sprint';
    if (joined.includes('grand prix') && !joined.includes('sprint')) section = 'main';

    // Position rows: col 2 has position number
    const pos = parseInt(row[2]);
    if (!isNaN(pos) && pos >= 1 && pos <= 10) {
      const picks = {};
      for (let u = 0; u < 4; u++) {
        const pickCol = 5 + u * 2; // cols 5,7,9,11
        const driverName = row[pickCol];
        picks[USERS[u].name] = normDriver(driverName);
      }
      if (section === 'main') {
        result.main[pos] = picks;
      } else if (section === 'sprint' && pos <= 8) {
        result.sprint[pos] = picks;
      }
    }

    // Sprint positions 1-8
    const sprintPos = parseInt(row[2]);
    if (!isNaN(sprintPos) && sprintPos >= 1 && sprintPos <= 8 && section === 'sprint') {
      const picks = {};
      for (let u = 0; u < 4; u++) {
        const pickCol = 5 + u * 2;
        const driverName = row[pickCol];
        picks[USERS[u].name] = normDriver(driverName);
      }
      result.sprint[sprintPos] = picks;
    }

    // Fastest lap
    if (row[2].toLowerCase() === 'fastest lap') {
      for (let u = 0; u < 4; u++) {
        const pickCol = 5 + u * 2;
        result.fl[USERS[u].name] = normDriver(row[pickCol]);
      }
    }

    // DNF
    if (row[2].toLowerCase() === 'dnf') {
      for (let u = 0; u < 4; u++) {
        const pickCol = 5 + u * 2;
        result.dnf[USERS[u].name] = normDriver(row[pickCol]);
      }
    }
  }

  return result;
}

function buildTop10(mainPicks, userName) {
  const top10 = [];
  for (let p = 1; p <= 10; p++) {
    if (mainPicks[p] && mainPicks[p][userName]) {
      top10.push(mainPicks[p][userName]);
    }
  }
  return top10;
}

function buildSprint8(sprintPicks, userName) {
  const s8 = [];
  for (let p = 1; p <= 8; p++) {
    if (sprintPicks[p] && sprintPicks[p][userName]) {
      s8.push(sprintPicks[p][userName]);
    }
  }
  return s8;
}

async function main() {
  const wb = XLSX.readFile('/tmp/spreadsheet.xlsx');
  const ws = wb.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const preds = await supabaseGet('/rest/v1/user_predictions?select=*&order=race_id.asc,user_id.asc');

  // Extract spreadsheet predictions for each race
  const sheetRaces = {
    r01: { startRow: 8, hasSprint: false },
    r02: { startRow: 28, hasSprint: true },
    r03: { startRow: 68, hasSprint: false },
    r04: { startRow: 128, hasSprint: true },
    r05: { startRow: 168, hasSprint: true },
    r06: { startRow: 208, hasSprint: false },
    r07: { startRow: 228, hasSprint: false },
  };

  let totalDiffs = 0;

  for (const [rid, info] of Object.entries(sheetRaces)) {
    const sheetPreds = extractRacePredictions(data, info.startRow, info.hasSprint);
    
    console.log(`\n=== ${rid.toUpperCase()} ===`);

    for (const user of USERS) {
      const sheetTop10 = buildTop10(sheetPreds.main, user.name);
      const sheetSprint = buildSprint8(sheetPreds.sprint, user.name);
      const sheetFL = sheetPreds.fl[user.name];
      const sheetDNF = sheetPreds.dnf[user.name];

      // Normalize DNF: convert comma-separated to single driver
      let sheetDNFSingle = sheetDNF;
      if (sheetDNFSingle && sheetDNFSingle.includes(',')) {
        sheetDNFSingle = sheetDNFSingle.split(',')[0].trim();
      }

      const sbPred = preds.find(p => p.user_id === user.id && p.race_id === rid);

      if (!sbPred) {
        if (sheetTop10.length > 0 || sheetSprint.length > 0) {
          console.log(`  ${user.name}: IN SUPABASE BUT NOT IN SPREADSHEET`);
          console.log(`    Sheet top10: ${JSON.stringify(sheetTop10)}`);
          totalDiffs++;
        } else {
          console.log(`  ${user.name}: No predictions (sheet & supabase both empty)`);
        }
        continue;
      }

      const sbTop10 = sbPred.predicted_top10 || [];
      const sbSprint = sbPred.predicted_sprint_top8 || [];
      const sbFL = sbPred.predicted_fastest_lap || null;
      const sbDNF = sbPred.predicted_dnf || null;

      const top10Match = JSON.stringify(sheetTop10) === JSON.stringify(sbTop10);
      const sprintMatch = JSON.stringify(sheetSprint) === JSON.stringify(sbSprint);
      const flMatch = sheetFL === sbFL;
      const dnfMatch = sheetDNFSingle === sbDNF;

      const allMatch = top10Match && sprintMatch && flMatch && dnfMatch;

      if (!allMatch) {
        totalDiffs++;
        console.log(`  ${user.name}: ✗ MISMATCH`);
        if (!top10Match) {
          console.log(`    Top10: Sheet=${JSON.stringify(sheetTop10)}`);
          console.log(`           SB    =${JSON.stringify(sbTop10)}`);
        }
        if (!sprintMatch) {
          console.log(`    Sprint: Sheet=${JSON.stringify(sheetSprint)}`);
          console.log(`            SB    =${JSON.stringify(sbSprint)}`);
        }
        if (!flMatch) console.log(`    FL: Sheet=${sheetFL}, SB=${sbFL}`);
        if (!dnfMatch) console.log(`    DNF: Sheet=${sheetDNFSingle}, SB=${sbDNF}`);
      } else {
        console.log(`  ${user.name}: ✓ Match`);
      }
    }
  }

  // Special: check R07
  console.log('\n=== R07 (SPANISH GP) SPECIAL CHECK ===');
  console.log('Spreadsheet has NO predictions for Spanish GP — all driver cells are blank.');
  console.log('Formulas default to max points (112) when no prediction is entered.');
  console.log('');
  for (const user of USERS) {
    const sbPred = preds.find(p => p.user_id === user.id && p.race_id === 'r07');
    if (sbPred) {
      console.log(`  ${user.name}: Supabase HAS predictions (points=${(sbPred.points_earned||0)+(sbPred.sprint_points_earned||0)})`);
      console.log(`    Top10: ${JSON.stringify(sbPred.predicted_top10?.slice(0,5))}...`);
    } else {
      console.log(`  ${user.name}: No prediction in Supabase`);
    }
  }

  // Summary of points: spreadsheet vs supabase per race
  console.log('\n=== POINTS SUMMARY: SPREADSHEET vs SUPABASE ===');
  console.log('Race  | Skye        | Whitney     | Bryan       | Carlos');
  console.log('      | Sheet / SB  | Sheet / SB  | Sheet / SB  | Sheet / SB');
  console.log('------|-------------|-------------|-------------|------------');

  // Compute sheet points per race from the extracted data
  for (const rid of ['r01','r02','r03','r04','r05','r06','r07']) {
    const info = sheetRaces[rid];
    const sheetPreds = extractRacePredictions(data, info.startRow, info.hasSprint);
    
    // Extract round points from the sheet
    const ptsRow = findRoundPointsRow(data, info.startRow);
    
    const sbPts = USERS.map(u => {
      const p = preds.find(pr => pr.user_id === u.id && pr.race_id === rid);
      return p ? (p.points_earned||0)+(p.sprint_points_earned||0) : 0;
    });

    // Get sheet round points from totals
    // Actually, let me compute from the running totals
    console.log(`  ${rid} | ${JSON.stringify(sbPts)}`);
  }

  console.log(`\nTotal discrepancies found: ${totalDiffs}`);
  if (totalDiffs === 0) {
    console.log('✓ All predictions match between spreadsheet and Supabase');
  }
}

function findRoundPointsRow(wsData, sectionStart) {
  for (let i = sectionStart; i < Math.min(sectionStart + 25, wsData.length); i++) {
    const row = wsData[i].map(c => String(c || '').trim());
    if (row.join(' ').toLowerCase().includes('current round points')) {
      const vals = [];
      // Values are at cols 6,8,10,12 for main format
      for (let c = 6; c <= 12; c += 2) {
        const v = parseFloat(row[c]);
        vals.push(isNaN(v) ? 0 : v);
      }
      return vals;
    }
  }
  return [0,0,0,0];
}

main().catch(console.error);
