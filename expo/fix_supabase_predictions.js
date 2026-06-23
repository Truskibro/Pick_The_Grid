/**
 * Fix Supabase predictions and points to match the verified spreadsheet.
 * 
 * 1. Computes correct points using app scoring engine
 * 2. Updates Supabase user_predictions via REST API
 * 3. Updates profiles.total_points
 */

// ---- EMBEDDED RACE RESULTS (from f1-data.ts) ----
const MOCK_RACE_RESULTS = [
  // R01 Australian GP
  {
    raceId: 'r01',
    classification: [
      { position: 1, driverId: 'RUS', points: 25, status: 'finished' },
      { position: 2, driverId: 'ANT', points: 18, status: 'finished' },
      { position: 3, driverId: 'LEC', points: 15, status: 'finished' },
      { position: 4, driverId: 'HAM', points: 12, status: 'finished' },
      { position: 5, driverId: 'NOR', points: 10, status: 'finished' },
      { position: 6, driverId: 'VER', points: 8, status: 'finished' },
      { position: 7, driverId: 'BEA', points: 6, status: 'finished' },
      { position: 8, driverId: 'LIN', points: 4, status: 'finished' },
      { position: 9, driverId: 'BOR', points: 2, status: 'finished' },
      { position: 10, driverId: 'GAS', points: 1, status: 'finished' },
    ],
    fastestLapDriverId: 'VER',
    dnfDriverIds: ['ALO', 'BOT', 'HAD'],
    dnsDriverIds: ['PIA', 'HUL'],
  },
  // R02 Chinese GP (race)
  {
    raceId: 'r02',
    classification: [
      { position: 1, driverId: 'ANT', points: 25, status: 'finished' },
      { position: 2, driverId: 'RUS', points: 18, status: 'finished' },
      { position: 3, driverId: 'HAM', points: 15, status: 'finished' },
      { position: 4, driverId: 'LEC', points: 12, status: 'finished' },
      { position: 5, driverId: 'BEA', points: 10, status: 'finished' },
      { position: 6, driverId: 'GAS', points: 8, status: 'finished' },
      { position: 7, driverId: 'LAW', points: 6, status: 'finished' },
      { position: 8, driverId: 'HAD', points: 4, status: 'finished' },
      { position: 9, driverId: 'SAI', points: 2, status: 'finished' },
      { position: 10, driverId: 'COL', points: 1, status: 'finished' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['VER', 'ALO', 'STR'],
    dnsDriverIds: ['PIA', 'NOR', 'BOR', 'ALB'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', points: 8, status: 'finished' },
      { position: 2, driverId: 'LEC', points: 7, status: 'finished' },
      { position: 3, driverId: 'HAM', points: 6, status: 'finished' },
      { position: 4, driverId: 'NOR', points: 5, status: 'finished' },
      { position: 5, driverId: 'ANT', points: 4, status: 'finished' },
      { position: 6, driverId: 'PIA', points: 3, status: 'finished' },
      { position: 7, driverId: 'LAW', points: 2, status: 'finished' },
      { position: 8, driverId: 'BEA', points: 1, status: 'finished' },
    ],
  },
  // R03 Japanese GP
  {
    raceId: 'r03',
    classification: [
      { position: 1, driverId: 'ANT', points: 25, status: 'finished' },
      { position: 2, driverId: 'PIA', points: 18, status: 'finished' },
      { position: 3, driverId: 'LEC', points: 15, status: 'finished' },
      { position: 4, driverId: 'RUS', points: 12, status: 'finished' },
      { position: 5, driverId: 'NOR', points: 10, status: 'finished' },
      { position: 6, driverId: 'HAM', points: 8, status: 'finished' },
      { position: 7, driverId: 'GAS', points: 6, status: 'finished' },
      { position: 8, driverId: 'VER', points: 4, status: 'finished' },
      { position: 9, driverId: 'LAW', points: 2, status: 'finished' },
      { position: 10, driverId: 'OCO', points: 1, status: 'finished' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR', 'BEA'],
    dnsDriverIds: [],
  },
  // R04 Miami GP (race)
  {
    raceId: 'r04',
    classification: [
      { position: 1, driverId: 'ANT', points: 25, status: 'finished' },
      { position: 2, driverId: 'NOR', points: 18, status: 'finished' },
      { position: 3, driverId: 'PIA', points: 15, status: 'finished' },
      { position: 4, driverId: 'RUS', points: 12, status: 'finished' },
      { position: 5, driverId: 'VER', points: 10, status: 'finished' },
      { position: 6, driverId: 'HAM', points: 8, status: 'finished' },
      { position: 7, driverId: 'COL', points: 6, status: 'finished' },
      { position: 8, driverId: 'LEC', points: 4, status: 'finished' },
      { position: 9, driverId: 'SAI', points: 2, status: 'finished' },
      { position: 10, driverId: 'ALB', points: 1, status: 'finished' },
    ],
    fastestLapDriverId: 'NOR',
    dnfDriverIds: ['HUL', 'LAW', 'GAS', 'HAD'],
    dnsDriverIds: [],
    sprintClassification: [
      { position: 1, driverId: 'NOR', points: 8, status: 'finished' },
      { position: 2, driverId: 'PIA', points: 7, status: 'finished' },
      { position: 3, driverId: 'LEC', points: 6, status: 'finished' },
      { position: 4, driverId: 'RUS', points: 5, status: 'finished' },
      { position: 5, driverId: 'VER', points: 4, status: 'finished' },
      { position: 6, driverId: 'ANT', points: 3, status: 'finished' },
      { position: 7, driverId: 'HAM', points: 2, status: 'finished' },
      { position: 8, driverId: 'GAS', points: 1, status: 'finished' },
    ],
  },
  // R05 Canadian GP (race)
  {
    raceId: 'r05',
    classification: [
      { position: 1, driverId: 'ANT', points: 25, status: 'finished' },
      { position: 2, driverId: 'HAM', points: 18, status: 'finished' },
      { position: 3, driverId: 'VER', points: 15, status: 'finished' },
      { position: 4, driverId: 'LEC', points: 12, status: 'finished' },
      { position: 5, driverId: 'HAD', points: 10, status: 'finished' },
      { position: 6, driverId: 'COL', points: 8, status: 'finished' },
      { position: 7, driverId: 'LAW', points: 6, status: 'finished' },
      { position: 8, driverId: 'GAS', points: 4, status: 'finished' },
      { position: 9, driverId: 'SAI', points: 2, status: 'finished' },
      { position: 10, driverId: 'BEA', points: 1, status: 'finished' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'],
    dnsDriverIds: ['LIN'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', points: 8, status: 'finished' },
      { position: 2, driverId: 'NOR', points: 7, status: 'finished' },
      { position: 3, driverId: 'ANT', points: 6, status: 'finished' },
      { position: 4, driverId: 'PIA', points: 5, status: 'finished' },
      { position: 5, driverId: 'LEC', points: 4, status: 'finished' },
      { position: 6, driverId: 'HAM', points: 3, status: 'finished' },
      { position: 7, driverId: 'VER', points: 2, status: 'finished' },
      { position: 8, driverId: 'LIN', points: 1, status: 'finished' },
    ],
  },
  // R06 Monaco GP
  {
    raceId: 'r06',
    classification: [
      { position: 1, driverId: 'ANT', points: 25, status: 'finished' },
      { position: 2, driverId: 'HAM', points: 18, status: 'finished' },
      { position: 3, driverId: 'GAS', points: 15, status: 'finished' },
      { position: 4, driverId: 'HAD', points: 12, status: 'finished' },
      { position: 5, driverId: 'PIA', points: 10, status: 'finished' },
      { position: 6, driverId: 'LAW', points: 8, status: 'finished' },
      { position: 7, driverId: 'LIN', points: 6, status: 'finished' },
      { position: 8, driverId: 'ALB', points: 4, status: 'finished' },
      { position: 9, driverId: 'OCO', points: 2, status: 'finished' },
      { position: 10, driverId: 'ALO', points: 1, status: 'finished' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['SAI', 'LEC', 'STR', 'NOR', 'BEA', 'BOT', 'VER'],
    dnsDriverIds: [],
  },
];

// ---- SCORING ENGINE (simplified) ----
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

function scoreRace(top10, fastestLap, dnf, result) {
  let pts = 0;
  const resultTop10 = result.classification
    .filter(e => e.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map(e => e.driverId);
  
  const scored = new Set();
  for (let i = 0; i < Math.min(top10.length, 10); i++) {
    const pred = top10[i];
    if (!pred || scored.has(pred)) continue;
    scored.add(pred);
    if (pred === resultTop10[i]) pts += F1_POINTS[i];
  }
  
  // Fastest lap
  if (fastestLap && fastestLap === result.fastestLapDriverId) pts += FASTEST_LAP_BONUS;
  
  // DNF
  const dnsSet = new Set(result.dnsDriverIds || []);
  const dnfSet = new Set(result.dnfDriverIds || []);
  // Also check classification for DNF status
  for (const e of result.classification) {
    if (e.status === 'dnf' || e.status === 'retired') dnfSet.add(e.driverId);
    if (e.status === 'dns') dnsSet.add(e.driverId);
  }
  
  if (!dnf) {
    if (dnfSet.size === 0) pts += DNF_BONUS;
  } else if (!dnsSet.has(dnf) && dnfSet.has(dnf)) {
    pts += DNF_BONUS;
  }
  
  return pts;
}

function scoreSprint(top8, sprintResult) {
  if (!sprintResult || sprintResult.length === 0) return 0;
  let pts = 0;
  const resultTop8 = sprintResult
    .filter(e => e.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map(e => e.driverId);
  
  const scored = new Set();
  for (let i = 0; i < Math.min(top8.length, 8); i++) {
    const pred = top8[i];
    if (!pred || scored.has(pred)) continue;
    scored.add(pred);
    if (pred === resultTop8[i]) pts += SPRINT_POINTS[i];
  }
  return pts;
}

// ---- PREDICTIONS FROM SPREADSHEET ----
const PREDICTIONS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': { // Skye
    r01: { top10: ['VER','RUS','ANT','PIA','LEC','NOR','HAM','HAD','LAW','SAI'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','BEA','GAS'], fl: 'RUS', dnf: 'ALO', sprint: ['RUS','ANT','HAM','NOR','LEC','PIA','VER','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','HAM','NOR','VER','HAD','GAS','LIN'], fl: 'ANT', dnf: 'BOT', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','HAM','PIA','HAD','GAS','BEA'], fl: 'VER', dnf: 'COL', sprint: ['ANT','NOR','PIA','RUS','LEC','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','PIA','NOR','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'ANT', dnf: 'COL', sprint: ['ANT','RUS','NOR','PIA','LEC','VER','HAM','HAD'] },
    r06: { top10: ['ANT','VER','RUS','LEC','HAM','PIA','HAD','NOR','GAS','COL'], fl: 'ANT', dnf: 'LAW', sprint: [] },
  },
  '652154af-dc27-47b5-aa79-25903b9c4a1b': { // Whitney
    r01: { top10: ['ANT','RUS','LEC','PIA','HAD','VER','NOR','HAM','LAW','HUL'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','VER','NOR','HAD','HUL','BEA'], fl: 'RUS', dnf: 'STR', sprint: ['ANT','RUS','NOR','HAM','VER','PIA','LEC','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','NOR','VER','HAM','GAS','HAD','HUL'], fl: 'PIA', dnf: 'PER', sprint: [] },
    r04: { top10: ['PIA','VER','NOR','ANT','LEC','RUS','HAM','COL','SAI','GAS'], fl: null, dnf: 'STR', sprint: ['NOR','LEC','ANT','PIA','VER','RUS','HAM','COL'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'STR', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['ANT','VER','HAM','LEC','HAD','PIA','RUS','NOR','GAS','SAI'], fl: 'ANT', dnf: 'STR', sprint: [] },
  },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': { // Bryan
    r01: { top10: ['RUS','ANT','PIA','LEC','NOR','HAM','HAD','VER','LAW','LIN'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','NOR','VER','HAD','BEA','GAS'], fl: 'RUS', dnf: 'PER', sprint: ['RUS','ANT','HAM','LEC','LEC','VER','NOR','HAD'] },
    r03: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','PIA','HAM','GAS','HAD','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','NOR','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'NOR', dnf: 'BOT', sprint: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD'] },
    r06: { top10: ['ANT','VER','LEC','HAM','RUS','PIA','NOR','GAS','LAW','ALB'], fl: 'ANT', dnf: 'HAD', sprint: [] },
  },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': { // Carlos
    r01: { top10: ['RUS','ANT','LEC','PIA','HAD','HAM','NOR','VER','LAW','HUL'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','HAM','LEC','NOR','PIA','VER','HAD','GAS','HUL'], fl: 'RUS', dnf: 'ALB', sprint: ['RUS','ANT','HAM','NOR','LEC','VER','PIA','GAS'] },
    r03: { top10: ['ANT','RUS','LEC','HAM','PIA','NOR','HAD','VER','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','LEC','PIA','HAM','GAS','HUL'], fl: 'VER', dnf: null, sprint: ['NOR','ANT','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['ANT','RUS','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['VER','ANT','HAM','LEC','HAD','RUS','PIA','NOR','GAS','LAW'], fl: 'VER', dnf: 'BOR', sprint: [] },
  },
};

// ---- COMPUTE POINTS ----
const resultMap = new Map(MOCK_RACE_RESULTS.map(r => [r.raceId, r]));

console.log('=== COMPUTED POINTS ===');
const allPoints = {};

for (const [userId, races] of Object.entries(PREDICTIONS)) {
  let totalRace = 0;
  let totalSprint = 0;
  
  for (const [raceId, preds] of Object.entries(races)) {
    const result = resultMap.get(raceId);
    if (!result) { console.log(`  MISSING result for ${raceId}`); continue; }
    
    const racePts = scoreRace(preds.top10, preds.fl, preds.dnf, result);
    const sprintPts = scoreSprint(preds.sprint, result.sprintClassification);
    
    totalRace += racePts;
    totalSprint += sprintPts;
    
    if (!allPoints[userId]) allPoints[userId] = {};
    allPoints[userId][raceId] = { race: racePts, sprint: sprintPts };
  }
  
  const total = totalRace + totalSprint;
  console.log(`${userId.substring(0,8)}: race=${totalRace} sprint=${totalSprint} TOTAL=${total}`);
}

// ---- UPDATE SUPABASE ----
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

async function updateSupabase() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  
  for (const [userId, races] of Object.entries(PREDICTIONS)) {
    let userTotal = 0;
    
    for (const [raceId, preds] of Object.entries(races)) {
      const pts = allPoints[userId][raceId];
      userTotal += pts.race + pts.sprint;
      
      // Find existing row
      const getUrl = `${SUPABASE_URL}/rest/v1/user_predictions?user_id=eq.${userId}&race_id=eq.${raceId}&select=id`;
      const getResp = await fetch(getUrl, { headers: { ...headers, 'Content-Type': undefined, 'Prefer': undefined } });
      const existing = await getResp.json();
      
      const payload = {
        user_id: userId,
        race_id: raceId,
        predicted_top10: preds.top10,
        predicted_fastest_lap: preds.fl,
        predicted_dnf: preds.dnf,
        points_earned: pts.race,
        predicted_sprint_top8: preds.sprint,
        sprint_points_earned: pts.sprint,
        updated_at: new Date().toISOString(),
      };
      
      let resp;
      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing
        const updateUrl = `${SUPABASE_URL}/rest/v1/user_predictions?id=eq.${existing[0].id}`;
        resp = await fetch(updateUrl, { method: 'PATCH', headers, body: JSON.stringify(payload) });
      } else {
        // Insert new
        const insertUrl = `${SUPABASE_URL}/rest/v1/user_predictions`;
        resp = await fetch(insertUrl, { method: 'POST', headers: { ...headers, 'Prefer': 'return=minimal' }, body: JSON.stringify(payload) });
      }
      
      const ok = resp.ok ? 'OK' : `ERR ${resp.status}`;
      console.log(`  ${userId.substring(0,8)} ${raceId}: ${ok} race=${pts.race} sprint=${pts.sprint}`);
    }
    
    // Update profile total
    const profilePayload = { total_points: userTotal };
    const profileUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
    const profileResp = await fetch(profileUrl, { method: 'PATCH', headers, body: JSON.stringify(profilePayload) });
    console.log(`  Profile ${userId.substring(0,8)}: total=${userTotal} ${profileResp.ok ? 'OK' : 'ERR ' + profileResp.status}`);
  }
  
  console.log('\nDone!');
}

updateSupabase().catch(e => console.error('FATAL:', e));
