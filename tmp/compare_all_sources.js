/**
 * COMPARE SPREADSHEET vs SUPABASE vs SEED FILE
 * Extract all predictions from the spreadsheet (source of truth),
 * compare against Supabase and seed-predictions.ts,
 * and report every discrepancy.
 */
const XLSX = require('xlsx');
const https = require('https');

// ── Driver name mapping ───────────────────────────────────────────────────
const DRIVER_MAP = {
  'G. Russell': 'RUS', 'George Russell': 'RUS',
  'K. Antonelli': 'ANT', 'Andrea Kimi Antonelli': 'ANT', 'Kimi Antonelli': 'ANT',
  'L. Hamilton': 'HAM', 'Lewis Hamilton': 'HAM',
  'C. Leclerc': 'LEC', 'Charles Leclerc': 'LEC',
  'L. Norris': 'NOR', 'Lando Norris': 'NOR',
  'M. Verstappen': 'VER', 'Max Verstappen': 'VER',
  'O. Piastri': 'PIA', 'Oscar Piastri': 'PIA',
  'O. Bearman': 'BEA', 'Oliver Bearman': 'BEA',
  'I. Hadjar': 'HAD', 'Isack Hadjar': 'HAD',
  'P. Gasly': 'GAS', 'Pierre Gasly': 'GAS',
  'A. Lindbald': 'LIN', 'Arvid Lindblad': 'LIN', 'A. Lindblad': 'LIN',
  'G. Bartoleto': 'BOR', 'Gabriel Bortoleto': 'BOR', 'G. Bortoleto': 'BOR',
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
  'J. Doohan': 'DOO', 'Jack Doohan': 'DOO',
};

const DNF_MAP = {
  'Alonso': 'ALO', 'Bottas': 'BOT', 'Hadjar': 'HAD', 'Piastri': 'PIA', 'Nico': 'HUL',
  'Stroll': 'STR', 'Perez': 'PER', 'Albon': 'ALB',
};

function mapDriver(name) {
  if (!name || typeof name !== 'string') return null;
  name = name.trim();
  if (DRIVER_MAP[name]) return DRIVER_MAP[name];
  // Try loose matching
  for (const [key, val] of Object.entries(DRIVER_MAP)) {
    if (name.toLowerCase().includes(key.split(' ').pop().toLowerCase())) {
      return val;
    }
  }
  return null;
}

function mapDnf(text) {
  if (!text || typeof text !== 'string') return null;
  text = text.trim();
  if (text === '' || text === '0') return null;
  // Could be a comma-separated list or single name
  // For predictions, it's a single driver name
  const parts = text.split(',').map(s => s.trim());
  for (const part of parts) {
    for (const [key, val] of Object.entries(DNF_MAP)) {
      if (part.toLowerCase().includes(key.toLowerCase())) return val;
    }
    // Try driver map
    const mapped = mapDriver(part);
    if (mapped) return mapped;
  }
  return null;
}

// ── User column mapping ───────────────────────────────────────────────────
const USER_COLUMNS = {
  'Skye Leach': { driverCol: 4, ptsCol: 5 },      // 0-indexed
  'Whitney Trujillo': { driverCol: 6, ptsCol: 7 },
  'Bryan Leach': { driverCol: 8, ptsCol: 9 },
  'Carlos Trujillo': { driverCol: 10, ptsCol: 11 },
};

const RACE_SECTIONS = [
  { name: 'Australian GP', round: 1, id: 'r01', startRow: 12, hasSprint: false },
  { name: 'China Sprint', round: 2, id: 'r02s', startRow: 32, isSprint: true, parentId: 'r02' },
  { name: 'China GP', round: 2, id: 'r02', startRow: 52, hasSprint: true },
  { name: 'Japan GP', round: 3, id: 'r03', startRow: 72, hasSprint: false },
  // Continue for all races...
];

// Let me map out all race sections from the spreadsheet
function findRaceSections(data) {
  const sections = [];
  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    const firstText = String(row[1] || '').trim();
    if (firstText.startsWith('Round')) {
      sections.push({ row: i, text: firstText });
    }
  }
  return sections;
}

// ── Fetch Supabase ────────────────────────────────────────────────────────
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

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  const workbook = XLSX.readFile('/tmp/spreadsheet.xlsx');
  const sheet = workbook.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find all race section headers
  const sections = findRaceSections(data);
  console.log('Race sections found:');
  for (const s of sections) {
    console.log(`  Row ${s.row}: ${s.text}`);
  }

  // Extract predictions for each race section
  // Pattern: after header row, skip 1-3 rows to get to user names, then 10 position rows follow
  
  console.log('\n═══ EXTRACTING PREDICTIONS FROM SPREADSHEET ═══\n');
  
  const spreadsheetPreds = {}; // { 'userName:raceId': { top10, fl, dnf, sprintTop8 } }
  
  for (const section of sections) {
    const startRow = section.row;
    const text = section.text;
    console.log(`\n--- ${text} (row ${startRow}) ---`);
    
    // Determine user columns from row with user names (usually startRow+1 or +2)
    let userNamesRow = null;
    for (let r = startRow + 1; r < Math.min(startRow + 5, data.length); r++) {
      const row = data[r];
      if (row[5] && String(row[5]).includes('Skye')) {
        userNamesRow = r;
        break;
      }
    }
    
    if (!userNamesRow) {
      console.log('  ⚠️ Could not find user names row');
      continue;
    }
    
    // Position rows start after user names (usually +1 or +2)
    let posStartRow = userNamesRow + 2;
    // The first driver name should be in one of the next rows
    for (let r = userNamesRow + 1; r < Math.min(userNamesRow + 5, data.length); r++) {
      const val = String(data[r][3] || '').trim();
      if (mapDriver(val)) {
        posStartRow = r;
        break;
      }
    }
    
    // Extract top 10 picks for each user
    const userPicks = {};
    for (const [name, cols] of Object.entries(USER_COLUMNS)) {
      userPicks[name] = { top10: [], fl: null, dnf: null, points: 0 };
    }
    
    // Read positions 1-10
    for (let i = 0; i < 10; i++) {
      const row = data[posStartRow + i];
      if (!row) break;
      
      for (const [name, cols] of Object.entries(USER_COLUMNS)) {
        const driverName = String(row[cols.driverCol] || '').trim();
        const points = parseInt(row[cols.ptsCol]) || 0;
        const driverId = mapDriver(driverName);
        
        if (driverId) {
          userPicks[name].top10.push(driverId);
        } else if (driverName) {
          console.log(`  Unknown driver at P${i+1} for ${name}: "${driverName}"`);
        }
      }
    }
    
    // Read FL and DNF (usually after the 10 positions)
    for (let r = posStartRow + 10; r < Math.min(posStartRow + 14, data.length); r++) {
      const row = data[r];
      const label = String(row[2] || '').trim();
      
      if (label === 'Fastest Lap' || label.includes('Fastest')) {
        for (const [name, cols] of Object.entries(USER_COLUMNS)) {
          const driverName = String(row[cols.driverCol] || '').trim();
          userPicks[name].fl = mapDriver(driverName);
          if (!userPicks[name].fl && driverName) {
            console.log(`  Unknown FL for ${name}: "${driverName}"`);
          }
        }
      }
      
      if (label === 'DNF' || label.includes('DNF')) {
        for (const [name, cols] of Object.entries(USER_COLUMNS)) {
          const dnfText = String(row[cols.driverCol] || '').trim();
          userPicks[name].dnf = mapDnf(dnfText);
          if (!userPicks[name].dnf && dnfText && dnfText !== '0') {
            console.log(`  Unknown DNF for ${name}: "${dnfText}"`);
          }
        }
      }
    }
    
    // Determine race ID
    let raceId = null;
    let isSprint = false;
    if (text.includes('Sprint')) {
      isSprint = true;
    }
    
    // Map round number to race ID
    const roundMatch = text.match(/Round\s+(\d+)/);
    if (roundMatch) {
      const round = parseInt(roundMatch[1]);
      raceId = `r${String(round).padStart(2, '0')}`;
    }
    
    if (!raceId) {
      console.log('  ⚠️ Could not determine race ID');
      continue;
    }
    
    // Store predictions
    for (const [name, picks] of Object.entries(userPicks)) {
      const key = `${name}:${raceId}${isSprint ? 's' : ''}`;
      spreadsheetPreds[key] = {
        name,
        raceId,
        isSprint,
        top10: picks.top10,
        fl: picks.fl,
        dnf: picks.dnf,
      };
      
      if (!isSprint) {
        console.log(`  ${name} (${raceId}): P1=${picks.top10[0] || '?'} P10=${picks.top10[9] || '?'} FL=${picks.fl || 'none'} DNF=${picks.dnf || 'none'}`);
      } else {
        console.log(`  ${name} (${raceId} Sprint): Top8=${picks.top10.join(',')}`);
      }
    }
  }

  // ── Fetch Supabase predictions ──────────────────────────────────────────
  console.log('\n═══ COMPARING WITH SUPABASE ═══\n');
  const supabasePreds = await fetchSupabase('user_predictions?select=*&order=user_id,race_id');
  
  const USER_ID_MAP = {
    'Skye Leach': 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
    'Whitney Trujillo': '652154af-dc27-47b5-aa79-25903b9c4a1b',
    'Bryan Leach': 'f35417e9-4f0d-4def-9c2f-c81276863fc0',
    'Carlos Trujillo': 'e11ea4f5-2ba4-4241-9791-b4b6a560534b',
  };

  const mismatches = [];
  
  for (const [key, sp] of Object.entries(spreadsheetPreds)) {
    if (sp.isSprint) continue; // Skip sprint sections for now
    
    const userId = USER_ID_MAP[sp.name];
    if (!userId) continue;
    
    const sb = supabasePreds.find(p => p.user_id === userId && p.race_id === sp.raceId);
    if (!sb) {
      console.log(`  ❌ ${sp.name} ${sp.raceId}: Not found in Supabase!`);
      mismatches.push({ type: 'missing', name: sp.name, raceId: sp.raceId });
      continue;
    }
    
    // Compare top10
    const sbTop10 = sb.predicted_top10 || [];
    let top10Match = true;
    for (let i = 0; i < 10; i++) {
      if (sp.top10[i] !== sbTop10[i]) {
        if (top10Match) {
          console.log(`  ❌ ${sp.name} ${sp.raceId}: Top10 mismatch`);
          top10Match = false;
        }
        console.log(`     P${i+1}: Spreadsheet=${sp.top10[i] || '?'} Supabase=${sbTop10[i] || '?'}`);
      }
    }
    
    // Compare FL
    if (sp.fl !== sb.predicted_fastest_lap) {
      console.log(`  ❌ ${sp.name} ${sp.raceId}: FL mismatch (Spreadsheet=${sp.fl} Supabase=${sb.predicted_fastest_lap})`);
    }
    
    // Compare DNF
    if (sp.dnf !== sb.predicted_dnf) {
      console.log(`  ❌ ${sp.name} ${sp.raceId}: DNF mismatch (Spreadsheet=${sp.dnf} Supabase=${sb.predicted_dnf})`);
    }
    
    if (top10Match && sp.fl === sb.predicted_fastest_lap && sp.dnf === sb.predicted_dnf) {
      console.log(`  ✅ ${sp.name} ${sp.raceId}: MATCH`);
    }
  }

  console.log(`\n═══ SUMMARY ═══`);
  console.log(`Total spreadsheet predictions: ${Object.keys(spreadsheetPreds).filter(k => !spreadsheetPreds[k].isSprint).length}`);
  console.log(`Mismatches found: checking...`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
