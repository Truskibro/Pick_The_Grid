const XLSX = require('xlsx');
const https = require('https');

// ── Config ──
const SUPABASE_URL = 'fxwgbpassouaddakgyus.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const USER_IDS = {
  'Skye Leach': 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
  'Whitney Trujillo': '652154af-dc27-47b5-aa79-25903b9c4a1b',
  'Bryan Leach': 'f35417e9-4f0d-4def-9c2f-c81276863fc0',
  'Carlos Trujillo': 'e11ea4f5-2ba4-4241-9791-b4b6a560534b',
};

// ── Fetch Supabase data ──
async function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: SUPABASE_URL,
      path: path,
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

// ── Parse spreadsheet ──
function parseSpreadsheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['2026'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Map of race sections
  const races = {};
  const raceNames = {
    'Round 1': { id: 'r01', name: 'Australian Grand Prix' },
    'Round 2': { id: 'r02', name: 'Chinese Grand Prix' },
    'Round 3': { id: 'r03', name: 'Japanese Grand Prix' },
    'Round 4': { id: 'r04', name: 'Miami Grand Prix' },
    'Round 5': { id: 'r05', name: 'Canadian Grand Prix' },
    'Round 6': { id: 'r06', name: 'Monaco Grand Prix' },
    'Round 7': { id: 'r07', name: 'Spanish Grand Prix' },
    'Round 8': { id: 'r08', name: 'Austrian Grand Prix' },
    'Round 9': { id: 'r09', name: 'British Grand Prix' },
    'Round 10': { id: 'r10', name: 'Belgian Grand Prix' },
    'Round 11': { id: 'r11', name: 'Hungarian Grand Prix' },
    'Round 12': { id: 'r12', name: 'Dutch Grand Prix' },
    'Round 13': { id: 'r13', name: 'Italian Grand Prix' },
    'Round 14': { id: 'r14', name: 'Spanish Grand Prix' },
    'Round 15': { id: 'r15', name: 'Azerbaijan Grand Prix' },
    'Round 16': { id: 'r16', name: 'Singapore Grand Prix' },
    'Round 17': { id: 'r17', name: 'United States Grand Prix' },
    'Round 18': { id: 'r18', name: 'Mexico City Grand Prix' },
    'Round 19': { id: 'r19', name: 'Brazilian Grand Prix' },
    'Round 20': { id: 'r20', name: 'Las Vegas Grand Prix' },
    'Round 21': { id: 'r21', name: 'Qatar Grand Prix' },
    'Round 22': { id: 'r22', name: 'Abu Dhabi Grand Prix' },
  };

  let currentRace = null;
  let section = null; // 'main' | 'sprint'
  let userCols = []; // [{ user: 'Skye Leach', pickCol: 5, ptsCol: 6 }, ...]

  for (let i = 0; i < data.length; i++) {
    const row = data[i].map((c) => String(c || '').trim());

    // Detect race section
    const joined = row.join(' ');
    for (const [key, race] of Object.entries(raceNames)) {
      if (joined.includes(key) && joined.includes('Grand Prix')) {
        currentRace = race;
        section = joined.toLowerCase().includes('sprint') ? 'sprint' : 'main';
        if (!races[race.id]) {
          races[race.id] = {
            name: race.name,
            hasSprint: false,
            main: null,
            sprint: null,
            roundPoints: {},
            totalPoints: {},
          };
        }
        if (section === 'sprint') races[race.id].hasSprint = true;
        userCols = []; // reset for each section
        break;
      }
    }

    if (!currentRace) continue;

    // Detect user columns from header row (has "Skye Leach", "Whitney Trujillo" etc)
    const userNames = ['Skye Leach', 'Whitney Trujillo', 'Bryan Leach', 'Carlos Trujillo'];
    const foundUsers = row.filter((c) => userNames.includes(c));
    if (foundUsers.length > 0) {
      userCols = [];
      // The pattern: name at col X, then "Driver Finish" at col X+1, "Pts" at col X+2
      // But in this sheet, name spans merged cells
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        const nameIdx = userNames.indexOf(cell);
        if (nameIdx >= 0) {
          // This user's picks are in next column, points in column after that
          userCols.push({
            user: cell,
            pickCol: j + 1,
            ptsCol: j + 2,
          });
        }
      }
    }

    if (userCols.length === 0) continue;

    // Check for "Current Round Points" row
    if (joined.includes('Current Round Points')) {
      const roundPts = {};
      for (const uc of userCols) {
        const val = parseFloat(row[uc.ptsCol]) || 0;
        roundPts[uc.user] = val;
      }
      if (section === 'sprint') {
        races[currentRace.id].roundPoints = { ...races[currentRace.id].roundPoints, ...roundPts };
      } else {
        races[currentRace.id].roundPoints = roundPts;
      }
      continue;
    }

    // Check for "Total Points" row
    if (joined.includes('Total Points') && !joined.includes('Current')) {
      const totalPts = {};
      for (const uc of userCols) {
        const val = parseFloat(row[uc.ptsCol]) || 0;
        totalPts[uc.user] = val;
      }
      races[currentRace.id].totalPoints = totalPts;
      continue;
    }

    // Check for driver pick rows - position numbers in col 1 or col 2
    const posCol1 = parseInt(row[1]);
    const posCol2 = parseInt(row[2]);
    const pos = isNaN(posCol2) ? (isNaN(posCol1) ? null : posCol1) : posCol2;

    if (pos && pos >= 1 && pos <= 10 && section === 'main') {
      if (!races[currentRace.id].main) {
        races[currentRace.id].main = {};
      }
      for (const uc of userCols) {
        if (!races[currentRace.id].main[uc.user]) races[currentRace.id].main[uc.user] = {};
        races[currentRace.id].main[uc.user][pos] = {
          driver: row[uc.pickCol],
          points: parseFloat(row[uc.ptsCol]) || 0,
        };
      }
    }

    // Fastest lap row
    if (row[1].toLowerCase() === 'fastest lap' || row[2].toLowerCase() === 'fastest lap') {
      if (section === 'main') {
        if (!races[currentRace.id].main) races[currentRace.id].main = {};
        for (const uc of userCols) {
          if (!races[currentRace.id].main[uc.user]) races[currentRace.id].main[uc.user] = {};
          races[currentRace.id].main[uc.user]['fastestLap'] = {
            driver: row[uc.pickCol],
            points: parseFloat(row[uc.ptsCol]) || 0,
          };
        }
      }
      continue;
    }

    // DNF row
    if (row[1].toLowerCase() === 'dnf' || row[2].toLowerCase() === 'dnf') {
      if (section === 'main') {
        if (!races[currentRace.id].main) races[currentRace.id].main = {};
        for (const uc of userCols) {
          if (!races[currentRace.id].main[uc.user]) races[currentRace.id].main[uc.user] = {};
          races[currentRace.id].main[uc.user]['dnf'] = {
            driver: row[uc.pickCol],
            points: parseFloat(row[uc.ptsCol]) || 0,
          };
        }
      }
      continue;
    }

    // Sprint positions 1-8
    if (pos && pos >= 1 && pos <= 8 && section === 'sprint') {
      if (!races[currentRace.id].sprint) races[currentRace.id].sprint = {};
      for (const uc of userCols) {
        if (!races[currentRace.id].sprint[uc.user]) races[currentRace.id].sprint[uc.user] = {};
        races[currentRace.id].sprint[uc.user][pos] = {
          driver: row[uc.pickCol],
          points: parseFloat(row[uc.ptsCol]) || 0,
        };
      }
    }
  }

  return races;
}

// ── Helper: normalize driver name from spreadsheet to driver ID ──
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

function normalizeDriver(name) {
  if (!name || name === '' || name === '-' || name === 'null' || name === 'none') return null;
  name = name.toLowerCase().trim().replace(/\s+/g, ' ');
  // Handle "Alonso, Bottas, Hadjar" style lists
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    return parts.map(p => DRIVER_MAP[p] || p.toUpperCase()).join(',');
  }
  return DRIVER_MAP[name] || name.toUpperCase();
}

// ── Main ──
async function main() {
  console.log('=== FULL AUDIT: SPREADSHEET vs SUPABASE ===\n');

  const spreadsheet = parseSpreadsheet('/tmp/spreadsheet.xlsx');

  // Fetch Supabase predictions
  const preds = await supabaseGet('/rest/v1/user_predictions?select=*&order=race_id.asc,user_id.asc');

  // Fetch profiles
  const profiles = await supabaseGet('/rest/v1/profiles?select=*');

  console.log('── Supabase Profiles ──');
  for (const p of profiles) {
    console.log(`  ${p.display_name || p.username} (${p.id}) - total_points: ${p.total_points || 0}`);
  }
  console.log('');

  // Build Supabase lookup: userId -> raceId -> { points_earned, sprint_points_earned }
  const sbLookup = {};
  for (const p of preds) {
    if (!sbLookup[p.user_id]) sbLookup[p.user_id] = {};
    sbLookup[p.user_id][p.race_id] = {
      racePoints: p.points_earned || 0,
      sprintPoints: p.sprint_points_earned || 0,
      total: (p.points_earned || 0) + (p.sprint_points_earned || 0),
    };
  }

  // For each race, compare spreadsheet round points vs Supabase
  const raceOrder = ['r01','r02','r03','r04','r05','r06','r07'];

  console.log('── Race-by-Race Comparison ──');
  console.log('Format: User | Spreadsheet Round Pts | Supabase (race+sprint=total) | Match?\n');

  const totals = {};
  for (const user of Object.keys(USER_IDS)) {
    totals[user] = { sheet: 0, supabase: 0 };
  }

  for (const rid of raceOrder) {
    const r = spreadsheet[rid];
    if (!r) { console.log(`  ${rid}: NOT FOUND in spreadsheet\n`); continue; }

    console.log(`  ${rid} — ${r.name}${r.hasSprint ? ' (Sprint)' : ''}:`);
    for (const user of Object.keys(USER_IDS)) {
      const userId = USER_IDS[user];
      const sheetPts = r.roundPoints[user] || 0;
      const sb = sbLookup[userId]?.[rid];
      const sbTotal = sb ? sb.total : 0;

      totals[user].sheet += sheetPts;
      totals[user].supabase += sbTotal;

      const match = sheetPts === sbTotal ? '✓' : '✗ MISMATCH';
      console.log(`    ${user}: Sheet=${sheetPts}, Supabase=${sbTotal} (race=${sb?.racePoints||0}+sprint=${sb?.sprintPoints||0}) ${match}`);
    }
    console.log('');

    // Also print spreadsheet total points
    if (Object.keys(r.totalPoints).length > 0) {
      console.log(`    Spreadsheet cumulative totals after ${rid}:`);
      for (const [user, pts] of Object.entries(r.totalPoints)) {
        console.log(`      ${user}: ${pts}`);
      }
      console.log('');
    }
  }

  // ── Grand Totals ──
  console.log('── Grand Totals (R01-R07) ──');
  for (const user of Object.keys(USER_IDS)) {
    const match = totals[user].sheet === totals[user].supabase ? '✓' : '✗ MISMATCH';
    console.log(`  ${user}: Sheet=${totals[user].sheet}, Supabase=${totals[user].supabase} ${match}`);
  }

  // ── Supabase profile totalPoints ──
  console.log('\n── Supabase Profile Total Points vs Computed ──');
  for (const p of profiles) {
    const uName = Object.keys(USER_IDS).find(k => USER_IDS[k] === p.id);
    if (uName) {
      const computed = totals[uName]?.supabase || 0;
      const match = p.total_points === computed ? '✓' : '✗ MISMATCH';
      console.log(`  ${uName}: Profile=${p.total_points}, Computed from predictions=${computed} ${match}`);
    }
  }
}

main().catch(console.error);
