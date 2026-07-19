const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const fs = require('fs');

async function query(table, filters) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  return { status: res.status, body: await res.text() };
}

async function deleteRows(table, filters) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  return { status: res.status, body: await res.text() };
}

async function patchRow(table, filters, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Profile': 'public',
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
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
  'o. piastri': 'PIA', 'piastri': 'PIA', 'o. piastri': 'PIA', 'o. piastri': 'PIA',
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
  'n. hulkenberg': 'HUL', 'hulkenberg': 'HUL', 'hulkenberg': 'HUL',
  'f. alonso': 'ALO', 'alonso': 'ALO',
  'l. stroll': 'STR', 'stroll': 'STR',
  'v. bottas': 'BOT', 'bottas': 'BOT',
  's. perez': 'PER', 'perez': 'PER',
  'g. russell': 'RUS',
};

function driverNameToId(name) {
  if (!name) return null;
  const clean = name.toString().trim().toLowerCase().replace(/\s+/g, ' ');
  if (NAME_TO_ID[clean]) return NAME_TO_ID[clean];
  // try last name only
  const parts = clean.split(' ');
  const last = parts[parts.length - 1];
  if (NAME_TO_ID[last]) return NAME_TO_ID[last];
  console.log(`  ⚠️ Unknown driver name: "${name}"`);
  return null;
}

// ── Parse spreadsheet ─────────────────────────────────────────────────────
// Spreadsheet round → app race_id mapping (R4/R5 cancelled):
// R1→r01, R2→r02, R3→r03, R6→r04, R7→r05, R8→r06, R9→r07
// R10→r08, R11→r09, R12→r10 (but R10-R12 are empty templates)
const ROUND_MAP = {
  1: 'r01', 2: 'r02', 3: 'r03',
  6: 'r04', 7: 'r05', 8: 'r06', 9: 'r07',
  10: 'r08', 11: 'r09', 12: 'r10',
};

const sheetText = fs.readFileSync('/home/user/rork-app/sheet_full.txt', 'utf8');
const sheetLines = sheetText.split('\n');

// Parse each line: "R13: [3]1 | [4]G. Russell | [5]25 | [6]M. Verstappen | [7]0 ..."
function parseLine(line) {
  const match = line.match(/^R(\d+):\s*(.*)$/);
  if (!match) return null;
  const rowNum = parseInt(match[1]);
  const rest = match[2];
  const cells = {};
  const cellRegex = /\[(\d+)\]([^\[]*)/g;
  let m;
  while ((m = cellRegex.exec(rest)) !== null) {
    cells[parseInt(m[1])] = m[2].trim();
  }
  return { rowNum, cells };
}

// Find round sections and extract picks
const rounds = {};
let currentRound = null;
let currentType = null; // 'race' or 'sprint'
let currentRaceId = null;

for (const line of sheetLines) {
  const parsed = parseLine(line);
  if (!parsed) continue;

  // Detect round headers
  const titleMatch = parsed.cells[2] || '';
  const roundHeaderMatch = titleMatch.match(/Round\s+(\d+)\s*-\s*(.*)/i);
  if (roundHeaderMatch) {
    const roundNum = parseInt(roundHeaderMatch[1]);
    const title = roundHeaderMatch[2];
    currentRound = roundNum;
    currentRaceId = ROUND_MAP[roundNum];
    if (title.toLowerCase().includes('sprint')) {
      currentType = 'sprint';
    } else {
      currentType = 'race';
    }
    if (currentRaceId && !rounds[currentRaceId]) {
      rounds[currentRaceId] = { race: { official: [], skye: [], whitney: [], bryan: [], carlos: [], fl: {}, dnf: {} }, sprint: { official: [], skye: [], whitney: [], bryan: [], carlos: [], fl: {}, dnf: {} } };
    }
    continue;
  }

  if (!currentRaceId || !rounds[currentRaceId]) continue;
  const section = rounds[currentRaceId][currentType];

  // Parse position rows (1-10)
  const pos = parseInt(parsed.cells[3] || '');
  if (pos >= 1 && pos <= 10 && parsed.cells[4]) {
    // [4]=official driver, [5]=official pts, [6]=skye, [7]=skye pts, [8]=whitney, [9]=whitney pts, [10]=bryan, [11]=bryan pts, [12]=carlos, [13]=carlos pts
    section.official.push({ pos, driver: parsed.cells[4], pts: parseInt(parsed.cells[5] || '0') });
    if (parsed.cells[6] && parsed.cells[6] !== 'g' && parsed.cells[6] !== 'f') {
      section.skye.push({ pos, driver: parsed.cells[6], pts: parseInt(parsed.cells[7] || '0') });
    }
    if (parsed.cells[8] && parsed.cells[8] !== 'g' && parsed.cells[8] !== 'f') {
      section.whitney.push({ pos, driver: parsed.cells[8], pts: parseInt(parsed.cells[9] || '0') });
    }
    if (parsed.cells[10] && parsed.cells[10] !== 'g' && parsed.cells[10] !== 'f') {
      section.bryan.push({ pos, driver: parsed.cells[10], pts: parseInt(parsed.cells[11] || '0') });
    }
    if (parsed.cells[12] && parsed.cells[12] !== 'g' && parsed.cells[12] !== 'f') {
      section.carlos.push({ pos, driver: parsed.cells[12], pts: parseInt(parsed.cells[13] || '0') });
    }
  }

  // Fastest lap
  if (parsed.cells[3] === 'Fastest Lap') {
    if (parsed.cells[4] && parsed.cells[4] !== 'g' && parsed.cells[4] !== 'f') section.fl.official = parsed.cells[4];
    if (parsed.cells[6] && parsed.cells[6] !== 'g' && parsed.cells[6] !== 'f') section.fl.skye = parsed.cells[6];
    if (parsed.cells[8] && parsed.cells[8] !== 'g' && parsed.cells[8] !== 'f') section.fl.whitney = parsed.cells[8];
    if (parsed.cells[10] && parsed.cells[10] !== 'g' && parsed.cells[10] !== 'f') section.fl.bryan = parsed.cells[10];
    if (parsed.cells[12] && parsed.cells[12] !== 'g' && parsed.cells[12] !== 'f') section.fl.carlos = parsed.cells[12];
  }

  // DNF
  if (parsed.cells[3] === 'DNF') {
    if (parsed.cells[4] && parsed.cells[4] !== 'g' && parsed.cells[4] !== 'f') section.dnf.official = parsed.cells[4];
    if (parsed.cells[6] && parsed.cells[6] !== 'g' && parsed.cells[6] !== 'f') section.dnf.skye = parsed.cells[6];
    if (parsed.cells[8] && parsed.cells[8] !== 'g' && parsed.cells[8] !== 'f') section.dnf.whitney = parsed.cells[8];
    if (parsed.cells[10] && parsed.cells[10] !== 'g' && parsed.cells[10] !== 'f') section.dnf.bryan = parsed.cells[10];
    if (parsed.cells[12] && parsed.cells[12] !== 'g' && parsed.cells[12] !== 'f') section.dnf.carlos = parsed.cells[12];
  }
}

// ── Convert spreadsheet picks to driver ID arrays ─────────────────────────
function picksToIds(picks) {
  return picks.map(p => driverNameToId(p.driver)).filter(Boolean);
}

function dnfToId(dnfStr) {
  if (!dnfStr) return null;
  // DNF can be a single name or comma-separated list
  // The app stores a single DNF driver ID, but spreadsheet may list multiple
  // We take the first one
  const first = dnfStr.split(',')[0].trim();
  return driverNameToId(first);
}

const sheetPicks = {};
for (const [raceId, data] of Object.entries(rounds)) {
  sheetPicks[raceId] = {};
  for (const [user, picks] of Object.entries({ skye: data.race.skye, whitney: data.race.whitney, bryan: data.race.bryan, carlos: data.race.carlos })) {
    if (picks.length === 0) continue;
    sheetPicks[raceId][user] = {
      top10: picksToIds(picks),
      fastestLap: driverNameToId(data.race.fl[user]),
      dnf: dnfToId(data.race.dnf[user]),
    };
  }
  // Sprint picks
  if (data.sprint.skye.length > 0 || data.sprint.whitney.length > 0 || data.sprint.bryan.length > 0 || data.sprint.carlos.length > 0) {
    for (const [user, picks] of Object.entries({ skye: data.sprint.skye, whitney: data.sprint.whitney, bryan: data.sprint.bryan, carlos: data.sprint.carlos })) {
      if (picks.length === 0) continue;
      if (!sheetPicks[raceId][user]) sheetPicks[raceId][user] = { top10: [], fastestLap: null, dnf: null };
      sheetPicks[raceId][user].sprintTop8 = picksToIds(picks);
    }
  }
}

// ── User IDs ──────────────────────────────────────────────────────────────
const USER_MAP = {
  skye: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
  whitney: '652154af-dc27-47b5-aa79-25903b9c4a1b',
  bryan: 'f35417e9-4f0d-4def-9c2f-c81276863fc0',
  carlos: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b',
};

(async () => {
  // ── 1. Print spreadsheet picks summary ──────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SPREADSHEET PICKS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const raceId of ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10']) {
    if (!sheetPicks[raceId]) {
      console.log(`${raceId}: NO spreadsheet section`);
      continue;
    }
    const users = Object.keys(sheetPicks[raceId]);
    if (users.length === 0) {
      console.log(`${raceId}: EMPTY (template only, no real picks)`);
    } else {
      for (const user of users) {
        const p = sheetPicks[raceId][user];
        const sprint = p.sprintTop8 ? `  sprint=[${p.sprintTop8.join(',')}]` : '';
        console.log(`${raceId} ${user}: top10=[${p.top10.join(',')}]  FL=${p.fastestLap}  DNF=${p.dnf}${sprint}`);
      }
    }
  }

  // ── 2. Query Supabase predictions for all 4 users ───────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('SUPABASE vs SPREADSHEET COMPARISON');
  console.log('═══════════════════════════════════════════════════════════════');

  const mismatches = [];
  const toDelete = [];

  for (const [userName, userId] of Object.entries(USER_MAP)) {
    console.log(`\n--- ${userName.toUpperCase()} ---`);
    const r = await query('user_predictions', `user_id=eq.${userId}&series_id=eq.f1&select=race_id,predicted_top10,predicted_fastest_lap,predicted_dnf,predicted_sprint_top8,points_earned,sprint_points_earned&order=race_id.asc`);
    if (r.status !== 200) { console.log('ERR', r.status, r.body.slice(0, 300)); continue; }
    const rows = JSON.parse(r.body);

    for (const row of rows) {
      const raceId = row.race_id;
      const sbTop10 = row.predicted_top10 || [];
      const sbFL = row.predicted_fastest_lap;
      const sbDNF = row.predicted_dnf;
      const sbSprint = row.predicted_sprint_top8 || [];

      const sheetEntry = sheetPicks[raceId]?.[userName];

      if (!sheetEntry) {
        // This prediction doesn't exist in the spreadsheet → fabricated
        console.log(`  ${raceId}: ❌ NOT IN SPREADSHEET (fabricated) → DELETE`);
        toDelete.push({ userId, raceId, userName });
        continue;
      }

      // Compare picks
      const sheetTop10 = sheetEntry.top10 || [];
      const sheetFL = sheetEntry.fastestLap;
      const sheetDNF = sheetEntry.dnf;
      const sheetSprint = sheetEntry.sprintTop8 || [];

      const top10Match = JSON.stringify(sbTop10) === JSON.stringify(sheetTop10);
      const flMatch = (sbFL || null) === (sheetFL || null);
      const dnfMatch = (sbDNF || null) === (sheetDNF || null);
      const sprintMatch = JSON.stringify(sbSprint) === JSON.stringify(sheetSprint);

      if (top10Match && flMatch && dnfMatch && sprintMatch) {
        console.log(`  ${raceId}: ✅ MATCH  pts=${row.points_earned} sprint=${row.sprint_points_earned}`);
      } else {
        const issues = [];
        if (!top10Match) issues.push(`top10: SB=[${sbTop10.join(',')}] vs Sheet=[${sheetTop10.join(',')}]`);
        if (!flMatch) issues.push(`FL: SB=${sbFL} vs Sheet=${sheetFL}`);
        if (!dnfMatch) issues.push(`DNF: SB=${sbDNF} vs Sheet=${sheetDNF}`);
        if (!sprintMatch) issues.push(`sprint: SB=[${sbSprint.join(',')}] vs Sheet=[${sheetSprint.join(',')}]`);
        console.log(`  ${raceId}: ⚠️ MISMATCH → ${issues.join('; ')}`);
        mismatches.push({ raceId, userName, issues, sbTop10, sheetTop10, sbFL, sheetFL, sbDNF, sheetDNF, sbSprint, sheetSprint });
      }
    }
  }

  // ── 3. Delete fabricated predictions ────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DELETING FABRICATED PREDICTIONS (r08/r09/r10)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const { userId, raceId, userName } of toDelete) {
    console.log(`  Deleting ${userName} ${raceId}...`);
    const dr = await deleteRows('user_predictions', `user_id=eq.${userId}&race_id=eq.${raceId}`);
    console.log(`    Status: ${dr.status}`);
  }

  // ── 4. Fix mismatches by updating Supabase to match spreadsheet ─────────
  if (mismatches.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('FIXING MISMATCHES (updating Supabase to match spreadsheet)');
    console.log('═══════════════════════════════════════════════════════════════');
    for (const m of mismatches) {
      const userId = USER_MAP[m.userName];
      const updateData = {
        predicted_top10: m.sheetTop10,
        predicted_fastest_lap: m.sheetFL,
        predicted_dnf: m.sheetDNF,
      };
      if (m.sheetSprint.length > 0) {
        updateData.predicted_sprint_top8 = m.sheetSprint;
      }
      console.log(`  Updating ${m.userName} ${m.raceId}: ${m.issues.join('; ')}`);
      const ur = await patchRow('user_predictions', `user_id=eq.${userId}&race_id=eq.${m.raceId}`, updateData);
      console.log(`    Status: ${ur.status}`);
    }
  }

  // ── 5. Trigger rescoring by touching race_results for affected races ────
  const affectedRaces = [...new Set([...toDelete.map(d => d.raceId), ...mismatches.map(m => m.raceId)])];
  if (affectedRaces.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('TRIGGERING RESCORE for affected races');
    console.log('═══════════════════════════════════════════════════════════════');
    for (const raceId of affectedRaces) {
      // Get current FL to "touch" the row
      const rr = await query('race_results', `race_id=eq.${raceId}&select=fastest_lap_driver_id`);
      if (rr.status === 200) {
        const rows = JSON.parse(rr.body);
        if (rows.length > 0) {
          const fl = rows[0].fastest_lap_driver_id;
          const pr = await patchRow('race_results', `race_id=eq.${raceId}`, { fastest_lap_driver_id: fl });
          console.log(`  ${raceId}: touched (status ${pr.status})`);
        }
      }
    }
  }

  // ── 6. Wait and verify final state ───────────────────────────────────────
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const [userName, userId] of Object.entries(USER_MAP)) {
    const r = await query('user_predictions', `user_id=eq.${userId}&series_id=eq.f1&select=race_id,points_earned,sprint_points_earned&order=race_id.asc`);
    if (r.status !== 200) continue;
    const rows = JSON.parse(r.body);
    let total = 0, sprintTotal = 0;
    const raceDetails = [];
    for (const row of rows) {
      const p = Number(row.points_earned || 0);
      const sp = Number(row.sprint_points_earned || 0);
      total += p; sprintTotal += sp;
      raceDetails.push(`${row.race_id}:${p}+${sp}`);
    }
    console.log(`${userName}: ${raceDetails.join('  ')}  TOTAL=${total + sprintTotal} (race=${total} sprint=${sprintTotal}, ${rows.length} races)`);

    const pr = await query('profiles', `id=eq.${userId}&select=total_points`);
    if (pr.status === 200) {
      const profile = JSON.parse(pr.body);
      console.log(`  profile.total_points = ${profile[0]?.total_points}`);
    }
  }
})();
