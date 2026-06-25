const XLSX = require('xlsx');
const https = require('https');

// ── Config ──
const SUPABASE_URL = 'fxwgbpassouaddakgyus.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const USERS = [
  { name: 'Skye Leach', id: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4' },
  { name: 'Whitney Trujillo', id: '652154af-dc27-47b5-aa79-25903b9c4a1b' },
  { name: 'Bryan Leach', id: 'f35417e9-4f0d-4def-9c2f-c81276863fc0' },
  { name: 'Carlos Trujillo', id: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b' },
];

// Maps spreadsheet "Round" to app raceId
// Spreadsheet has R4=Bahrain, R5=Saudi (both cancelled in real 2026)
const SHEET_ROUND_TO_APP = {
  'Round 1': 'r01',
  'Round 2': 'r02',
  'Round 3': 'r03',
  'Round 6': 'r04',
  'Round 7': 'r05',
  'Round 8': 'r06',
  'Round 9': 'r07',
};

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

function parseSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const results = {}; // raceId -> { roundPts: { userName: pts }, totalPts: { userName: pts }, mainPts, sprintPts }
  const sheetRounds = {}; // roundKey -> raceId

  // First pass: find all race sections and their round keys
  for (let i = 0; i < data.length; i++) {
    const row = data[i].map(c => String(c || '').trim());
    const joined = row.join(' ').toLowerCase();
    for (let r = 1; r <= 24; r++) {
      const roundKey = `Round ${r}`;
      if (joined.includes(roundKey.toLowerCase()) && joined.includes('grand prix')) {
        const appId = SHEET_ROUND_TO_APP[roundKey];
        if (appId && !sheetRounds[roundKey]) {
          sheetRounds[roundKey] = { appId, startRow: i, sections: {} };
        }
      }
    }
  }

  // Second pass: extract points for each section
  for (const [roundKey, info] of Object.entries(sheetRounds)) {
    const appId = info.appId;
    if (!results[appId]) results[appId] = { roundPts: {}, totalPts: {}, sections: {} };

    // Scan from start row to find sprint/main sections and point rows
    let currentSection = 'main';
    let foundUsers = false;

    for (let i = info.startRow; i < Math.min(info.startRow + 50, data.length); i++) {
      const row = data[i].map(c => String(c || '').trim());
      const joined = row.join(' ').toLowerCase();

      // Detect sprint section
      if (joined.includes('sprint')) currentSection = 'sprint';
      if (joined.includes('grand prix') && !joined.includes('sprint')) currentSection = 'main';

      // Current Round Points
      if (joined.includes('current round points')) {
        const pts = {};
        // The format is: ["","","Current Round Points","","1","24","63","68"]
        // or: ["","","Current Round Points","8","2"] (with fewer values)
        // Actually looking at row 25: ["Current Round Points","1","24","63","68"]
        // Col 0 has "Current Round Points", cols 1-4 have the values
        
        // Let me parse: find all numeric values after "Current Round Points"
        const vals = [];
        for (let j = 0; j < row.length; j++) {
          if (row[j] === '' || isNaN(parseFloat(row[j]))) continue;
          vals.push(parseFloat(row[j]));
        }
        
        // Original format: row is ["","Current Round Points","","",1,"",24,"",63,"",68,""]
        // But defval='' makes empty cells empty string, so:
        // ["","Current Round Points","","","1","","24","","63","","68",""]
        // So the values are at cols 4, 6, 8, 10 (for 4 users)
        // But sometimes it's: ["Current Round Points","8","2"] with values at cols 1,2

        // Let me try the pattern matching more carefully
        const roundPtsIdx = row.findIndex(c => c.toLowerCase() === 'current round points');
        if (roundPtsIdx >= 0) {
          // Values come after the label
          for (let u = 0; u < USERS.length; u++) {
            // The value might be at position roundPtsIdx+1+u or there might be gaps
            // In the main format, the user points are at every other column starting from roundPtsIdx+1
            // But in reality, let me just look at all numeric cells
          }
        }

        if (vals.length > 0 && vals.length <= 4) {
          for (let u = 0; u < Math.min(vals.length, 4); u++) {
            pts[USERS[u].name] = vals[u];
          }
        }

        if (Object.keys(pts).length > 0) {
          if (!results[appId].sections[currentSection]) results[appId].sections[currentSection] = { roundPts: 0 };
          results[appId].sections[currentSection].roundPts = pts;
        }
        continue;
      }

      // Total Points
      if (joined.includes('total points') && !joined.includes('current')) {
        const pts = {};
        const vals = [];
        for (let j = 0; j < row.length; j++) {
          if (row[j] === '' || isNaN(parseFloat(row[j]))) continue;
          vals.push(parseFloat(row[j]));
        }
        if (vals.length >= 4) {
          for (let u = 0; u < 4; u++) {
            pts[USERS[u].name] = vals[u];
          }
        }
        if (Object.keys(pts).length > 0) {
          results[appId].totalPts = pts;
        }
      }
    }

    // Compute roundPts as sum of main + sprint section points
    const combined = {};
    for (const [section, sdata] of Object.entries(results[appId].sections)) {
      if (sdata.roundPts) {
        for (const [user, pts] of Object.entries(sdata.roundPts)) {
          combined[user] = (combined[user] || 0) + pts;
        }
      }
    }
    if (Object.keys(combined).length > 0) {
      results[appId].roundPts = combined;
    }
  }

  return results;
}

// ── Try different approach: directly extract points from known row positions ──
function extractPointsDirect() {
  const wb = XLSX.readFile('/tmp/spreadsheet.xlsx');
  const ws = wb.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const points = {}; // sheetRound -> { sprint: [pts], main: [pts], total: [pts] }

  for (let i = 0; i < data.length; i++) {
    const row = data[i].map(c => String(c || '').trim());
    const joined = row.join(' ').toLowerCase();
    
    if (joined.includes('current round points')) {
      // Extract all numeric values from the row
      const vals = row.filter(c => c !== '' && !isNaN(parseFloat(c))).map(Number);
      
      // Determine context: what race is this in?
      // Look backward for race header
      let raceHeader = '';
      for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
        const r = data[j].map(c => String(c || '').trim()).join(' ');
        if (r.toLowerCase().includes('round') && r.toLowerCase().includes('grand prix')) {
          raceHeader = r;
          break;
        }
      }
      
      // Determine section (sprint or main)
      let section = 'main';
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const r = data[j].map(c => String(c || '').trim()).join(' ').toLowerCase();
        if (r.includes('sprint')) { section = 'sprint'; break; }
        if (r.includes('grand prix')) { section = 'main'; break; }
      }
      
      const roundMatch = raceHeader.match(/Round\s+(\d+)/i);
      const sheetRound = roundMatch ? parseInt(roundMatch[1]) : null;
      
      if (sheetRound) {
        if (!points[sheetRound]) points[sheetRound] = {};
        points[sheetRound][section] = vals;
        points[sheetRound]._header = raceHeader.substring(0, 80);
      }
    }
    
    if (joined.includes('total points') && !joined.includes('current')) {
      const vals = row.filter(c => c !== '' && !isNaN(parseFloat(c))).map(Number);
      
      let raceHeader = '';
      for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
        const r = data[j].map(c => String(c || '').trim()).join(' ');
        if (r.toLowerCase().includes('round') && r.toLowerCase().includes('grand prix')) {
          raceHeader = r;
          break;
        }
      }
      
      const roundMatch = raceHeader.match(/Round\s+(\d+)/i);
      const sheetRound = roundMatch ? parseInt(roundMatch[1]) : null;
      
      if (sheetRound) {
        if (!points[sheetRound]) points[sheetRound] = {};
        points[sheetRound].total = vals;
        points[sheetRound]._header = raceHeader.substring(0, 80);
      }
    }
  }

  return points;
}

async function main() {
  const sheetPoints = extractPointsDirect();

  // Print all extracted points
  console.log('=== SPREADSHEET POINTS EXTRACTED ===\n');
  const sortedRounds = Object.keys(sheetPoints).map(Number).sort((a,b) => a-b);
  
  for (const r of sortedRounds) {
    const p = sheetPoints[r];
    console.log(`Sheet Round ${r}: ${p._header || ''}`);
    if (p.sprint) console.log(`  Sprint: ${JSON.stringify(p.sprint)}`);
    if (p.main) console.log(`  Main:   ${JSON.stringify(p.main)}`);
    if (p.total) console.log(`  Total:  ${JSON.stringify(p.total)}`);
    console.log('');
  }

  // Fetch Supabase data
  console.log('=== SUPABASE DATA ===\n');
  const preds = await supabaseGet('/rest/v1/user_predictions?select=*&order=race_id.asc,user_id.asc');
  const profiles = await supabaseGet('/rest/v1/profiles?select=*');

  const sbByUser = {};
  for (const p of preds) {
    if (!sbByUser[p.user_id]) sbByUser[p.user_id] = {};
    sbByUser[p.user_id][p.race_id] = (p.points_earned || 0) + (p.sprint_points_earned || 0);
  }

  // Map: app raceId -> [user1pts, user2pts, ...]
  const appRaceOrder = ['r01','r02','r03','r04','r05','r06','r07'];
  console.log('Supabase race points:');
  for (const rid of appRaceOrder) {
    const pts = USERS.map(u => sbByUser[u.id]?.[rid] || 0);
    console.log(`  ${rid}: ${JSON.stringify(pts)}`);
  }
  console.log('');

  // Compute totals
  const sbTotals = USERS.map(u => {
    let sum = 0;
    for (const rid of appRaceOrder) sum += sbByUser[u.id]?.[rid] || 0;
    return sum;
  });
  console.log(`Supabase totals: ${JSON.stringify(sbTotals)}`);

  // Now map sheet rounds to app races and compare
  // Sheet R1→r01, R2→r02, R3→r03, R6→r04, R7→r05, R8→r06, R9→r07
  const sheetToApp = { 1:'r01', 2:'r02', 3:'r03', 6:'r04', 7:'r05', 8:'r06', 9:'r07' };

  console.log('\n=== RACE-BY-RACE COMPARISON ===\n');
  console.log('Format: AppRace | Sheet Pts [S,M,T] | Supabase Pts | Match?\n');

  let sheetRunning = [0,0,0,0];
  let sbRunning = [0,0,0,0];

  for (const [sheetRound, appId] of Object.entries(sheetToApp)) {
    const p = sheetPoints[parseInt(sheetRound)];
    if (!p) continue;

    // Combine sprint+main for round points
    const sheetRoundPts = [0,0,0,0];
    if (p.sprint) for (let u = 0; u < Math.min(p.sprint.length, 4); u++) sheetRoundPts[u] += p.sprint[u];
    if (p.main) for (let u = 0; u < Math.min(p.main.length, 4); u++) sheetRoundPts[u] += p.main[u];

    const sbRoundPts = USERS.map(u => sbByUser[u.id]?.[appId] || 0);

    // Running totals
    for (let u = 0; u < 4; u++) {
      sheetRunning[u] += sheetRoundPts[u];
      sbRunning[u] += sbRoundPts[u];
    }

    const match = JSON.stringify(sheetRoundPts) === JSON.stringify(sbRoundPts);

    console.log(`${appId} (Sheet R${sheetRound}) ${p._header || ''}`);
    console.log(`  Sheet round pts:  ${JSON.stringify(sheetRoundPts)}`);
    console.log(`  Supabase pts:     ${JSON.stringify(sbRoundPts)}`);
    console.log(`  Match: ${match ? '✓' : '✗ MISMATCH'}`);
    console.log(`  Sheet running:    ${JSON.stringify(sheetRunning)}`);
    console.log(`  Supabase running: ${JSON.stringify(sbRunning)}`);
    console.log(`  Sheet total row:  ${JSON.stringify(p.total || 'N/A')}`);
    console.log('');
  }

  // Final comparison
  console.log('=== FINAL COMPARISON ===');
  console.log(`Sheet final totals (R9):     ${JSON.stringify(sheetPoints[9]?.total || 'N/A')}`);
  console.log(`Supabase profile totals:     ${JSON.stringify(profiles.filter(p => USERS.some(u => u.id === p.id)).map(p => p.total_points))}`);
  console.log(`Supabase computed totals:    ${JSON.stringify(sbRunning)}`);
  console.log(`Sheet computed totals:       ${JSON.stringify(sheetRunning)}`);
}

main().catch(console.error);
