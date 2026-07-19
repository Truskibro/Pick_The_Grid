const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const fs = require('fs');

async function query(table, filters) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' } });
  return { status: res.status, body: await res.text() };
}
async function patchRow(table, filters, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public', 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.text() };
}
async function upsert(table, data, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public', 'Content-Type': 'application/json', 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.text() };
}

// ── Driver name → ID mapping ──────────────────────────────────────────────
const NAME_TO_ID = {
  'g. russell': 'RUS', 'russell': 'RUS',
  'k. antonelli': 'ANT', 'antonelli': 'ANT',
  'c. leclerc': 'LEC', 'leclerc': 'LEC',
  'l. hamilton': 'HAM', 'hamilton': 'HAM', 'l. hamillton': 'HAM',
  'm. verstappen': 'VER', 'verstappen': 'VER',
  'l. norris': 'NOR', 'norris': 'NOR',
  'o. piastri': 'PIA', 'piastri': 'PIA', 'o. piastri': 'PIA',
  'i. hadjar': 'HAD', 'hadjar': 'HAD', 'i. hdjar': 'HAD',
  'l. lawson': 'LAW', 'lawson': 'LAW',
  'a. linblad': 'LIN', 'a. lindblad': 'LIN', 'lindblad': 'LIN', 'linblad': 'LIN',
  'p. gasly': 'GAS', 'gasly': 'GAS',
  'o. bearman': 'BEA', 'bearman': 'BEA',
  'f. colapinto': 'COL', 'colapinto': 'COL',
  'g. bartoleto': 'BOR', 'g. bortoleto': 'BOR', 'bortoleto': 'BOR',
  'e. ocon': 'OCO', 'ocon': 'OCO',
  'c. sainz': 'SAI', 'sainz': 'SAI',
  'a. albon': 'ALB', 'albon': 'ALB',
  'n. hulkenberg': 'HUL', 'hulkenberg': 'HUL',
  'f. alonso': 'ALO', 'alonso': 'ALO',
  'l. stroll': 'STR', 'stroll': 'STR',
  'v. bottas': 'BOT', 'bottas': 'BOT',
  's. perez': 'PER', 'perez': 'PER',
};

function cleanCell(val) {
  if (val == null) return '';
  // Strip trailing pipe and whitespace, then trim
  return val.toString().replace(/\s*\|\s*$/, '').trim();
}

function driverNameToId(name) {
  const clean = cleanCell(name).toLowerCase().replace(/\s+/g, ' ');
  if (!clean) return null;
  if (NAME_TO_ID[clean]) return NAME_TO_ID[clean];
  const parts = clean.split(' ');
  const last = parts[parts.length - 1];
  if (NAME_TO_ID[last]) return NAME_TO_ID[last];
  console.log(`  ⚠️ Unknown driver: "${clean}"`);
  return null;
}

// ── Spreadsheet round → app race_id ───────────────────────────────────────
const ROUND_MAP = { 1:'r01', 2:'r02', 3:'r03', 6:'r04', 7:'r05', 8:'r06', 9:'r07', 10:'r08', 11:'r09', 12:'r10' };

const sheetText = fs.readFileSync('/home/user/rork-app/sheet_full.txt', 'utf8');

function parseLine(line) {
  const match = line.match(/^R(\d+):\s*(.*)$/);
  if (!match) return null;
  const rowNum = parseInt(match[1]);
  const cells = {};
  const cellRegex = /\[(\d+)\]([^\[]*)/g;
  let m;
  while ((m = cellRegex.exec(match[2])) !== null) {
    cells[parseInt(m[1])] = cleanCell(m[2]);
  }
  return { rowNum, cells };
}

const rounds = {};
let currentRaceId = null;
let currentType = 'race';

for (const line of sheetText.split('\n')) {
  const parsed = parseLine(line);
  if (!parsed) continue;
  const title = parsed.cells[2] || '';
  const rh = title.match(/Round\s+(\d+)\s*-\s*(.*)/i);
  if (rh) {
    const roundNum = parseInt(rh[1]);
    currentRaceId = ROUND_MAP[roundNum];
    currentType = title.toLowerCase().includes('sprint') ? 'sprint' : 'race';
    if (currentRaceId && !rounds[currentRaceId]) {
      rounds[currentRaceId] = { race: {skye:[],whitney:[],bryan:[],carlos:[],fl:{},dnf:{}}, sprint: {skye:[],whitney:[],bryan:[],carlos:[],fl:{},dnf:{}} };
    }
    continue;
  }
  if (!currentRaceId || !rounds[currentRaceId]) continue;
  const section = rounds[currentRaceId][currentType];

  const pos = parseInt(parsed.cells[3] || '');
  if (pos >= 1 && pos <= 10) {
    // [6]=skye,[8]=whitney,[10]=bryan,[12]=carlos  (skip 'g'/'f' template placeholders)
    for (const [col, user] of [[6,'skye'],[8,'whitney'],[10,'bryan'],[12,'carlos']]) {
      const v = parsed.cells[col];
      if (v && v !== 'g' && v !== 'f' && v.length > 1) {
        const id = driverNameToId(v);
        if (id) section[user].push({ pos, id });
      }
    }
  }
  if (parsed.cells[3] === 'Fastest Lap') {
    for (const [col, user] of [[6,'skye'],[8,'whitney'],[10,'bryan'],[12,'carlos']]) {
      const v = parsed.cells[col];
      if (v && v !== 'g' && v !== 'f' && v.length > 1) section.fl[user] = driverNameToId(v);
    }
  }
  if (parsed.cells[3] === 'DNF') {
    for (const [col, user] of [[6,'skye'],[8,'whitney'],[10,'bryan'],[12,'carlos']]) {
      const v = parsed.cells[col];
      if (v && v !== 'g' && v !== 'f' && v.length > 1) {
        // DNF cell may be a comma-separated list; app stores single driver → take first
        const first = v.split(',')[0].trim();
        section.dnf[user] = driverNameToId(first);
      }
    }
  }
}

// Build sheet picks per user per race
const sheetPicks = {};
for (const [raceId, data] of Object.entries(rounds)) {
  sheetPicks[raceId] = {};
  for (const user of ['skye','whitney','bryan','carlos']) {
    const racePicks = data.race[user];
    const sprintPicks = data.sprint[user];
    if (racePicks.length === 0 && sprintPicks.length === 0) continue;
    // Sort by position
    racePicks.sort((a,b) => a.pos - b.pos);
    sprintPicks.sort((a,b) => a.pos - b.pos);
    sheetPicks[raceId][user] = {
      top10: racePicks.map(p => p.id),
      fastestLap: data.race.fl[user] || null,
      dnf: data.race.dnf[user] || null,
      sprintTop8: sprintPicks.length > 0 ? sprintPicks.map(p => p.id) : [],
    };
  }
}

const USER_MAP = {
  skye: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
  whitney: '652154af-dc27-47b5-aa79-25903b9c4a1b',
  bryan: 'f35417e9-4f0d-4def-9c2f-c81276863fc0',
  carlos: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b',
};

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SPREADSHEET PICKS (re-parsed correctly)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const raceId of ['r01','r02','r03','r04','r05','r06','r07','r08','r09','r10']) {
    if (!sheetPicks[raceId] || Object.keys(sheetPicks[raceId]).length === 0) {
      console.log(`${raceId}: EMPTY (no real picks in spreadsheet)`);
      continue;
    }
    for (const user of ['skye','whitney','bryan','carlos']) {
      const p = sheetPicks[raceId][user];
      if (!p) continue;
      const s = p.sprintTop8.length > 0 ? `  sprint=[${p.sprintTop8.join(',')}]` : '';
      console.log(`${raceId} ${user}: top10=[${p.top10.join(',')}]  FL=${p.fastestLap}  DNF=${p.dnf}${s}`);
    }
  }

  // ── Restore: PATCH each user_prediction with the correct spreadsheet picks ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESTORING SUPABASE PREDICTIONS FROM SPREADSHEET');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const [raceId, users] of Object.entries(sheetPicks)) {
    for (const [userName, picks] of Object.entries(users)) {
      const userId = USER_MAP[userName];
      const updateData = {
        predicted_top10: picks.top10,
        predicted_fastest_lap: picks.fastestLap,
        predicted_dnf: picks.dnf,
        predicted_sprint_top8: picks.sprintTop8,
        series_id: 'f1',
      };
      const pr = await patchRow('user_predictions', `user_id=eq.${userId}&race_id=eq.${raceId}`, updateData);
      const ok = pr.status === 200;
      console.log(`  ${userName} ${raceId}: ${ok ? '✅ restored' : '❌ '+pr.status+' '+pr.body.slice(0,150)}`);
    }
  }

  // ── Trigger rescore for all affected races ───────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TRIGGERING RESCORE');
  console.log('═══════════════════════════════════════════════════════════════');
  const affectedRaces = Object.keys(sheetPicks);
  for (const raceId of affectedRaces) {
    const rr = await query('race_results', `race_id=eq.${raceId}&select=fastest_lap_driver_id`);
    if (rr.status === 200) {
      const rows = JSON.parse(rr.body);
      if (rows.length > 0) {
        const fl = rows[0].fastest_lap_driver_id;
        const pr = await patchRow('race_results', `race_id=eq.${raceId}`, { fastest_lap_driver_id: fl });
        console.log(`  ${raceId}: touched (status ${pr.status})`);
      } else {
        console.log(`  ${raceId}: no race_results row (cannot rescore)`);
      }
    }
  }

  await new Promise(r => setTimeout(r, 2500));

  // ── Final verification ───────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const [userName, userId] of Object.entries(USER_MAP)) {
    const r = await query('user_predictions', `user_id=eq.${userId}&series_id=eq.f1&select=race_id,predicted_top10,predicted_fastest_lap,predicted_dnf,predicted_sprint_top8,points_earned,sprint_points_earned&order=race_id.asc`);
    if (r.status !== 200) continue;
    const rows = JSON.parse(r.body);
    let total = 0, sprintTotal = 0;
    const details = [];
    for (const row of rows) {
      const p = Number(row.points_earned || 0);
      const sp = Number(row.sprint_points_earned || 0);
      total += p; sprintTotal += sp;
      details.push(`${row.race_id}:${p}+${sp}`);
    }
    console.log(`${userName}: ${details.join('  ')}  TOTAL=${total+sprintTotal} (race=${total} sprint=${sprintTotal})`);
    const pr = await query('profiles', `id=eq.${userId}&select=total_points`);
    if (pr.status === 200) {
      const profile = JSON.parse(pr.body);
      console.log(`  profile.total_points = ${profile[0]?.total_points}`);
    }
  }

  // ── Cross-check against spreadsheet totals ───────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('SPREADSHEET TOTALS (through r07 = Round 9 Spain)');
  console.log('═══════════════════════════════════════════════════════════════');
  // From sheet_full.txt: R247 Total Points after Round 9 (Spain): Skye 146, Whitney 190, Bryan 149, Carlos 229
  console.log('Expected (from spreadsheet R247): Skye=146, Whitney=190, Bryan=149, Carlos=229');
})();
