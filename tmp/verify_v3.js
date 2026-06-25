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
  if (!name || name === '' || name === '-' || name === 'null' || name === 'none') return null;
  name = name.toLowerCase().trim().replace(/\s+/g, ' ');
  if (name.includes(',')) {
    return name.split(',').map(p => p.trim()).map(p => DRIVER_MAP[p] || p.toUpperCase()).join(',');
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

function isRaceHeader(row) {
  const joined = row.map(c => String(c||'').trim()).join(' ').toLowerCase();
  return joined.includes('round') && joined.includes('grand prix');
}

function extractSection(rows, startIdx) {
  // Extract a section (main or sprint) starting from startIdx
  // Returns: { top10: { userName: [driverIds] }, sprint8: { userName: [driverIds] }, fl: { userName: driverId }, dnf: { userName: driverId }, roundPts: { userName: number } }
  // Stops at next race header or end
  const result = { top10: {}, sprint8: {}, fl: {}, dnf: {}, roundPts: {} };
  let currentSection = 'main';
  
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i].map(c => String(c || '').trim());
    const joined = row.join(' ').toLowerCase();
    
    // Stop at next race header
    if (i > startIdx && isRaceHeader(row)) break;
    
    // Detect sprint sub-section
    if (joined.includes('sprint')) currentSection = 'sprint';
    if (joined.includes('grand prix') && !joined.includes('sprint')) currentSection = 'main';
    
    // Position row: col 2 has the number
    const rawPos = parseInt(row[2]);
    if (!isNaN(rawPos) && rawPos >= 1 && rawPos <= 10 && currentSection === 'main') {
      // Row format: ["","",pos,actualDriver,actualPts, skyPick,skyPts, whitPick,whitPts, bryPick,bryPts, carPick,carPts]
      for (let u = 0; u < 4; u++) {
        const pickCol = 5 + u * 2;
        const pick = normDriver(row[pickCol]);
        const userName = USERS[u].name;
        if (!result.top10[userName]) result.top10[userName] = [];
        result.top10[userName][rawPos - 1] = pick; // 0-indexed
      }
    }
    
    // Sprint position row (col 2, positions 1-8)
    if (!isNaN(rawPos) && rawPos >= 1 && rawPos <= 8 && currentSection === 'sprint') {
      for (let u = 0; u < 4; u++) {
        const pickCol = 5 + u * 2;
        const pick = normDriver(row[pickCol]);
        const userName = USERS[u].name;
        if (!result.sprint8[userName]) result.sprint8[userName] = [];
        result.sprint8[userName][rawPos - 1] = pick;
      }
    }
    
    // Fastest lap
    if (row[2].toLowerCase() === 'fastest lap') {
      for (let u = 0; u < 4; u++) {
        result.fl[USERS[u].name] = normDriver(row[5 + u * 2]);
      }
    }
    
    // DNF
    if (row[2].toLowerCase() === 'dnf') {
      for (let u = 0; u < 4; u++) {
        let dnf = normDriver(row[5 + u * 2]);
        if (dnf && dnf.includes(',')) dnf = dnf.split(',')[0].trim();
        result.dnf[USERS[u].name] = dnf;
      }
    }
    
    // Current Round Points
    if (joined.includes('current round points')) {
      for (let u = 0; u < 4; u++) {
        const ptsCol = 6 + u * 2;
        const pts = parseFloat(row[ptsCol]);
        if (!isNaN(pts)) {
          if (!result.roundPts[USERS[u].name]) result.roundPts[USERS[u].name] = 0;
          result.roundPts[USERS[u].name] += pts;
        }
      }
    }
  }
  
  // Clean up arrays: filter nulls
  for (const u of USERS) {
    if (result.top10[u.name]) {
      result.top10[u.name] = result.top10[u.name].filter(d => d !== null && d !== undefined);
    }
    if (result.sprint8[u.name]) {
      result.sprint8[u.name] = result.sprint8[u.name].filter(d => d !== null && d !== undefined);
    }
  }
  
  return result;
}

async function main() {
  const wb = XLSX.readFile('/tmp/spreadsheet.xlsx');
  const ws = wb.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const preds = await supabaseGet('/rest/v1/user_predictions?select=*&order=race_id.asc,user_id.asc');

  // Find all race headers and their row positions
  const raceHeaders = [];
  for (let i = 0; i < data.length; i++) {
    if (isRaceHeader(data[i])) {
      const joined = data[i].map(c => String(c||'').trim()).join(' ');
      const roundMatch = joined.match(/Round\s+(\d+)/i);
      if (roundMatch) {
        raceHeaders.push({ sheetRound: parseInt(roundMatch[1]), row: i, text: joined.substring(0, 80) });
      }
    }
  }

  console.log('Race headers found:');
  for (const rh of raceHeaders) {
    console.log(`  Row ${rh.row}: Round ${rh.sheetRound} - ${rh.text}`);
  }

  // Map sheet rounds to app race IDs
  const sheetToApp = { 1:'r01', 2:'r02', 3:'r03', 6:'r04', 7:'r05', 8:'r06', 9:'r07' };

  console.log('\n=== PREDICTION COMPARISON: SPREADSHEET vs SUPABASE ===\n');

  let totalMismatches = 0;
  let r07hasPicks = false;

  for (const rh of raceHeaders) {
    const appId = sheetToApp[rh.sheetRound];
    if (!appId) continue;

    const section = extractSection(data, rh.row);
    
    console.log(`── ${appId.toUpperCase()} (Sheet Round ${rh.sheetRound}) ──`);

    for (const user of USERS) {
      const sheetTop10 = section.top10[user.name] || [];
      const sheetSprint = section.sprint8[user.name] || [];
      const sheetFL = section.fl[user.name] || null;
      const sheetDNF = section.dnf[user.name] || null;

      const sbPred = preds.find(p => p.user_id === user.id && p.race_id === appId);
      
      if (!sbPred) {
        if (sheetTop10.length > 0 || sheetSprint.length > 0) {
          console.log(`  ${user.name}: ✗ MISSING from Supabase (has sheet predictions)`);
          console.log(`    Sheet: top10=${JSON.stringify(sheetTop10)}, sprint=${JSON.stringify(sheetSprint)}, FL=${sheetFL}, DNF=${sheetDNF}`);
          totalMismatches++;
        } else {
          console.log(`  ${user.name}: (no predictions in either source)`);
        }
        continue;
      }

      if (appId === 'r07' && (sheetTop10.length > 0 || sheetSprint.length > 0)) {
        r07hasPicks = true;
      }

      const sbTop10 = sbPred.predicted_top10 || [];
      const sbSprint = sbPred.predicted_sprint_top8 || [];
      const sbFL = sbPred.predicted_fastest_lap || null;
      const sbDNF = sbPred.predicted_dnf || null;

      const t10Match = JSON.stringify(sheetTop10) === JSON.stringify(sbTop10);
      const sMatch = JSON.stringify(sheetSprint) === JSON.stringify(sbSprint);
      const flMatch = sheetFL === sbFL;
      const dnfMatch = sheetDNF === sbDNF;
      const allOK = t10Match && sMatch && flMatch && dnfMatch;

      if (allOK) {
        console.log(`  ${user.name}: ✓ Match`);
      } else {
        totalMismatches++;
        console.log(`  ${user.name}: ✗ MISMATCH`);
        if (!t10Match) {
          console.log(`    Top10: Sheet=${JSON.stringify(sheetTop10)}`);
          console.log(`           SB    =${JSON.stringify(sbTop10)}`);
        }
        if (!sMatch) {
          console.log(`    Sprint:Sheet=${JSON.stringify(sheetSprint)}`);
          console.log(`           SB    =${JSON.stringify(sbSprint)}`);
        }
        if (!flMatch) console.log(`    FL:    Sheet=${sheetFL}, SB=${sbFL}`);
        if (!dnfMatch) console.log(`    DNF:   Sheet=${sheetDNF}, SB=${sbDNF}`);
      }
    }
    console.log('');
  }

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Total prediction mismatches: ${totalMismatches}`);

  // R07 special note
  if (!r07hasPicks) {
    console.log('\n⚠️  Spanish GP (R07): Spreadsheet has NO predictions filled in.');
    console.log('   Formulas default to 112 max points per user (all correct = 101 + FL=1 + DNF=10).');
    console.log('   Supabase has predictions with calculated points: [18, 84, 16, 12].');
    console.log('   These predictions DO NOT come from the spreadsheet.');
  }

  // Points summary
  console.log('\n=== POINTS PER RACE (from spreadsheet) ===');
  console.log('Race  | Skye  | Whitney | Bryan | Carlos');
  console.log('------|-------|---------|-------|-------');
  for (const rh of raceHeaders) {
    const appId = sheetToApp[rh.sheetRound];
    if (!appId) continue;
    const section = extractSection(data, rh.row);
    const pts = USERS.map(u => section.roundPts[u.name] || 0);
    console.log(` ${appId} | ${pts.map(p => String(p).padStart(5)).join(' | ')}`);
  }

  // Supabase points
  console.log('\n=== POINTS PER RACE (from Supabase) ===');
  console.log('Race  | Skye  | Whitney | Bryan | Carlos');
  console.log('------|-------|---------|-------|-------');
  for (const appId of ['r01','r02','r03','r04','r05','r06','r07']) {
    const pts = USERS.map(u => {
      const p = preds.find(pr => pr.user_id === u.id && pr.race_id === appId);
      return p ? (p.points_earned||0)+(p.sprint_points_earned||0) : 0;
    });
    console.log(` ${appId} | ${pts.map(p => String(p).padStart(5)).join(' | ')}`);
  }

  // Supabase totals
  const sbTotals = USERS.map(u => 
    preds.filter(p => p.user_id === u.id).reduce((s,p) => s+(p.points_earned||0)+(p.sprint_points_earned||0), 0)
  );
  console.log(`\nSupabase totals: Skye=${sbTotals[0]}, Whitney=${sbTotals[1]}, Bryan=${sbTotals[2]}, Carlos=${sbTotals[3]}`);
}

main().catch(console.error);
