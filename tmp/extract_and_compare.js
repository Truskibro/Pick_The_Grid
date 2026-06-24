/**
 * Extract predictions from spreadsheet with CORRECT column mapping,
 * map spreadsheet rounds to app race IDs, and compare against Supabase.
 */
const XLSX = require('xlsx');
const https = require('https');

// Column mapping (0-indexed from raw row data):
// Row example: ["","",1,"G. Russell",25,"M. Verstappen",0,"K. Antonelli",0,...]
// Index:        0  1  2  3          4  5              6  7              8
// So actual result: driver at 3, pts at 4
// Skye: driver at 5, pts at 6
// Whitney: driver at 7, pts at 8
// Bryan: driver at 9, pts at 10
// Carlos: driver at 11, pts at 12

const COLS = {
  'Skye Leach': { driver: 5, pts: 6 },
  'Whitney Trujillo': { driver: 7, pts: 8 },
  'Bryan Leach': { driver: 9, pts: 10 },
  'Carlos Trujillo': { driver: 11, pts: 12 },
};

const USER_IDS = {
  'Skye Leach': 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
  'Whitney Trujillo': '652154af-dc27-47b5-aa79-25903b9c4a1b',
  'Bryan Leach': 'f35417e9-4f0d-4def-9c2f-c81276863fc0',
  'Carlos Trujillo': 'e11ea4f5-2ba4-4241-9791-b4b6a560534b',
};

const DRIVER_MAP = {
  'G. Russell': 'RUS', 'George Russell': 'RUS',
  'K. Antonelli': 'ANT', 'Andrea Kimi Antonelli': 'ANT',
  'L. Hamilton': 'HAM', 'Lewis Hamilton': 'HAM',
  'C. Leclerc': 'LEC', 'Charles Leclerc': 'LEC',
  'L. Norris': 'NOR', 'Lando Norris': 'NOR',
  'M. Verstappen': 'VER', 'Max Verstappen': 'VER',
  'O. Piastri': 'PIA', 'Oscar Piastri': 'PIA',
  'O. Bearman': 'BEA', 'Oliver Bearman': 'BEA',
  'I. Hadjar': 'HAD', 'Isack Hadjar': 'HAD',
  'P. Gasly': 'GAS', 'Pierre Gasly': 'GAS',
  'A. Lindbald': 'LIN', 'Arvid Lindblad': 'LIN',
  'G. Bartoleto': 'BOR', 'Gabriel Bortoleto': 'BOR',
  'L. Lawson': 'LAW', 'Liam Lawson': 'LAW',
  'C. Sainz': 'SAI', 'Carlos Sainz': 'SAI',
  'F. Colapinto': 'COL', 'Franco Colapinto': 'COL',
  'N. Hulkenberg': 'HUL', 'Nico Hulkenberg': 'HUL',
  'F. Alonso': 'ALO', 'Fernando Alonso': 'ALO',
  'L. Stroll': 'STR', 'Lance Stroll': 'STR',
  'S. Perez': 'PER', 'Sergio Perez': 'PER',
  'A. Albon': 'ALB', 'Alexander Albon': 'ALB',
  'V. Bottas': 'BOT', 'Valtteri Bottas': 'BOT',
  'E. Ocon': 'OCO', 'Esteban Ocon': 'OCO',
};

const DNF_DRIVERS = {
  'Alonso': 'ALO', 'Bottas': 'BOT', 'Hadjar': 'HAD', 'Piastri': 'PIA', 'Nico': 'HUL',
  'Stroll': 'STR', 'Perez': 'PER', 'Albon': 'ALB', 'Hulkenberg': 'HUL',
  'Russell': 'RUS', 'Norris': 'NOR', 'Verstappen': 'VER', 'Leclerc': 'LEC',
  'Bearman': 'BEA', 'Sainz': 'SAI', 'Lawson': 'LAW',
};

function mapDriver(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = name.trim();
  if (DRIVER_MAP[clean]) return DRIVER_MAP[clean];
  // Try partial match
  for (const [key, val] of Object.entries(DRIVER_MAP)) {
    if (clean.toLowerCase().includes(key.toLowerCase().split(' ')[1] || key.toLowerCase())) {
      return val;
    }
  }
  return null;
}

function mapDnf(text) {
  if (!text || typeof text !== 'string') return null;
  text = text.trim();
  if (text === '' || text === '0') return null;
  // Try each word as a driver name
  const words = text.split(',').map(s => s.trim());
  for (const word of words) {
    for (const [key, id] of Object.entries(DNF_DRIVERS)) {
      if (word.toLowerCase().includes(key.toLowerCase())) return id;
    }
    const mapped = mapDriver(word);
    if (mapped) return mapped;
  }
  return null;
}

// Spreadsheet round → App race ID mapping
// The spreadsheet has 24 rounds; Bahrain (R4) and Saudi (R5) were cancelled.
// App uses the updated calendar. We need to map only non-cancelled rounds.
const ROUND_TO_APP = {
  1: 'r01',   // Australia
  2: 'r02',   // China
  3: 'r03',   // Japan
  // 4: CANCELLED (Bahrain)
  // 5: CANCELLED (Saudi)
  6: 'r04',   // Miami
  7: 'r05',   // Canada
  8: 'r06',   // Monaco
  9: 'r07',   // Barcelona/Spanish GP
};

const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

function fetchSupabase(endpoint) {
  return new Promise((resolve, reject) => {
    https.get(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function extractPredictions(data, startRow, raceId) {
  // Find the user names row (should have "Skye Leach" in col 5)
  let userRow = null;
  for (let r = startRow; r < Math.min(startRow + 10, data.length); r++) {
    const val = String(data[r][5] || '').trim();
    if (val === 'Skye Leach') {
      userRow = r;
      break;
    }
  }
  if (!userRow) return null;

  // Position rows start after the header row (which follows user names row)
  let posStartRow = null;
  for (let r = userRow + 2; r < Math.min(userRow + 5, data.length); r++) {
    const val = String(data[r][3] || '').trim();
    if (mapDriver(val) || val === '') {
      // Row with actual results - this is posStartRow if there's a number in col 2
      if (String(data[r][2] || '').trim() === '1') {
        posStartRow = r;
        break;
      }
    }
  }
  if (!posStartRow) return null;

  const results = {};
  for (const name of Object.keys(COLS)) {
    results[name] = { top10: [], fl: null, dnf: null };
  }

  // Read positions 1-10
  for (let i = 0; i < 10; i++) {
    const row = data[posStartRow + i];
    if (!row) break;
    for (const [name, cols] of Object.entries(COLS)) {
      const driverName = String(row[cols.driver] || '').trim();
      const driverId = mapDriver(driverName);
      if (driverId) results[name].top10.push(driverId);
    }
  }

  // Read FL and DNF
  for (let r = posStartRow + 10; r < Math.min(posStartRow + 14, data.length); r++) {
    const row = data[r];
    const label = String(row[2] || '').trim();
    if (label === 'Fastest Lap') {
      for (const [name, cols] of Object.entries(COLS)) {
        const driverName = String(row[cols.driver] || '').trim();
        results[name].fl = mapDriver(driverName);
      }
    }
    if (label === 'DNF') {
      for (const [name, cols] of Object.entries(COLS)) {
        const dnfText = String(row[cols.driver] || '').trim();
        results[name].dnf = mapDnf(dnfText);
      }
    }
  }

  return results;
}

function extractSprint(data, startRow, raceId) {
  let userRow = null;
  for (let r = startRow; r < Math.min(startRow + 10, data.length); r++) {
    if (String(data[r][5] || '').trim() === 'Skye Leach') { userRow = r; break; }
  }
  if (!userRow) return null;

  let posStartRow = null;
  for (let r = userRow + 2; r < Math.min(userRow + 5, data.length); r++) {
    if (String(data[r][2] || '').trim() === '1') { posStartRow = r; break; }
  }
  if (!posStartRow) return null;

  const results = {};
  for (const name of Object.keys(COLS)) {
    results[name] = { sprintTop8: [] };
  }

  for (let i = 0; i < 8; i++) {
    const row = data[posStartRow + i];
    if (!row) break;
    for (const [name, cols] of Object.entries(COLS)) {
      const driverName = String(row[cols.driver] || '').trim();
      const driverId = mapDriver(driverName);
      if (driverId) results[name].sprintTop8.push(driverId);
    }
  }

  return results;
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  const workbook = XLSX.readFile('/tmp/spreadsheet.xlsx');
  const sheet = workbook.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find round headers
  const roundHeaders = [];
  for (let i = 0; i < data.length; i++) {
    const text = String(data[i][1] || '').trim();
    if (text.startsWith('Round')) {
      roundHeaders.push({ row: i, text });
    }
  }

  console.log('Spreadsheet round headers found:');
  for (const h of roundHeaders) console.log(`  Row ${h.row}: ${h.text}`);

  // Extract predictions for R1-R3 and R6-R9 (which map to app r01-r07)
  const extracted = {}; // { name: { raceId: { top10, fl, dnf, sprintTop8 } } }

  for (const h of roundHeaders) {
    const roundMatch = h.text.match(/Round\s+(\d+)/);
    if (!roundMatch) continue;
    const roundNum = parseInt(roundMatch[1]);
    const appId = ROUND_TO_APP[roundNum];
    if (!appId) continue;

    const isSprint = h.text.includes('Sprint');

    if (isSprint) {
      const sprintData = extractSprint(data, h.row, appId);
      if (sprintData) {
        for (const [name, picks] of Object.entries(sprintData)) {
          if (!extracted[name]) extracted[name] = {};
          if (!extracted[name][appId]) extracted[name][appId] = { top10: [], fl: null, dnf: null, sprintTop8: [] };
          extracted[name][appId].sprintTop8 = picks.sprintTop8;
        }
      }
    } else {
      const raceData = extractPredictions(data, h.row, appId);
      if (raceData) {
        for (const [name, picks] of Object.entries(raceData)) {
          if (!extracted[name]) extracted[name] = {};
          if (!extracted[name][appId]) extracted[name][appId] = { top10: [], fl: null, dnf: null, sprintTop8: [] };
          extracted[name][appId].top10 = picks.top10;
          extracted[name][appId].fl = picks.fl;
          extracted[name][appId].dnf = picks.dnf;
        }
      }
    }
  }

  // Print extracted data
  console.log('\n═══ EXTRACTED PREDICTIONS (Spreadsheet → App race IDs) ═══');
  for (const name of Object.keys(extracted).sort()) {
    for (const raceId of Object.keys(extracted[name]).sort()) {
      const p = extracted[name][raceId];
      console.log(`\n${name} ${raceId}`);
      console.log(`  Top10: [${p.top10.join(', ')}]`);
      console.log(`  FL: ${p.fl || 'none'}  DNF: ${p.dnf || 'none'}`);
      if (p.sprintTop8.length > 0) console.log(`  Sprint: [${p.sprintTop8.join(', ')}]`);
    }
  }

  // Compare with Supabase
  console.log('\n═══ COMPARING WITH SUPABASE ═══');
  const sbPreds = await fetchSupabase('user_predictions?select=*&order=user_id,race_id');
  
  let totalChecks = 0;
  let mismatches = 0;

  for (const [name, races] of Object.entries(extracted)) {
    const userId = USER_IDS[name];
    for (const [raceId, picks] of Object.entries(races)) {
      const sb = sbPreds.find(p => p.user_id === userId && p.race_id === raceId);
      if (!sb) {
        console.log(`❌ ${name} ${raceId}: NOT IN SUPABASE`);
        mismatches++;
        continue;
      }

      // Compare top10
      const sbTop10 = sb.predicted_top10 || [];
      let ok = true;
      totalChecks++;
      
      for (let i = 0; i < Math.max(picks.top10.length, sbTop10.length); i++) {
        if (picks.top10[i] !== sbTop10[i]) {
          if (ok) { console.log(`❌ ${name} ${raceId}: Top10 mismatch`); ok = false; }
          console.log(`   P${i+1}: Sheet=${picks.top10[i] || '?'}  SB=${sbTop10[i] || '?'}`);
        }
      }
      
      if (picks.fl !== sb.predicted_fastest_lap) {
        if (ok) { console.log(`❌ ${name} ${raceId}: FL mismatch`); ok = false; }
        console.log(`   FL: Sheet=${picks.fl || 'none'}  SB=${sb.predicted_fastest_lap || 'none'}`);
      }
      
      if (picks.dnf !== sb.predicted_dnf) {
        if (ok) { console.log(`❌ ${name} ${raceId}: DNF mismatch`); ok = false; }
        console.log(`   DNF: Sheet=${picks.dnf || 'none'}  SB=${sb.predicted_dnf || 'none'}`);
      }
      
      if (picks.sprintTop8.length > 0 || (sb.predicted_sprint_top8 || []).length > 0) {
        const sbSprint = sb.predicted_sprint_top8 || [];
        let sprintOk = true;
        for (let i = 0; i < Math.max(picks.sprintTop8.length, sbSprint.length); i++) {
          if (picks.sprintTop8[i] !== sbSprint[i]) {
            if (sprintOk) { if (ok) console.log(`❌ ${name} ${raceId}: Sprint mismatch`); else console.log(`   Sprint mismatch:`); sprintOk = false; ok = false; }
            console.log(`   S${i+1}: Sheet=${picks.sprintTop8[i] || '?'}  SB=${sbSprint[i] || '?'}`);
          }
        }
      }
      
      if (ok) {
        console.log(`✅ ${name} ${raceId}: MATCH`);
      } else {
        mismatches++;
      }
    }
  }

  console.log(`\n═══ SUMMARY ═══`);
  console.log(`Total comparisons: ${totalChecks}`);
  console.log(`Mismatches: ${mismatches}`);
  console.log(`Matches: ${totalChecks - mismatches}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
