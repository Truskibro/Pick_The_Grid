// Use Supabase REST API with service role key to populate race data
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text.substring(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return res.text();
}

// ============================================================
// VERIFIED 2026 RACE RESULTS
// ============================================================
const RACE_RESULTS = {
  r01: {
    classification: [
      { position: 1,  driverId: 'RUS', status: 'finished' },
      { position: 2,  driverId: 'ANT', status: 'finished' },
      { position: 3,  driverId: 'LEC', status: 'finished' },
      { position: 4,  driverId: 'HAM', status: 'finished' },
      { position: 5,  driverId: 'NOR', status: 'finished' },
      { position: 6,  driverId: 'VER', status: 'finished' },
      { position: 7,  driverId: 'BEA', status: 'finished' },
      { position: 8,  driverId: 'LIN', status: 'finished' },
      { position: 9,  driverId: 'BOR', status: 'finished' },
      { position: 10, driverId: 'GAS', status: 'finished' },
      { position: 11, driverId: 'OCO', status: 'finished' },
      { position: 12, driverId: 'ALB', status: 'finished' },
      { position: 13, driverId: 'LAW', status: 'finished' },
      { position: 14, driverId: 'COL', status: 'finished' },
      { position: 15, driverId: 'SAI', status: 'finished' },
      { position: 16, driverId: 'PER', status: 'finished' },
      { position: 17, driverId: 'STR', status: 'finished' },
      { position: 18, driverId: 'ALO', status: 'dnf' },
      { position: 19, driverId: 'BOT', status: 'dnf' },
      { position: 20, driverId: 'HAD', status: 'dnf' },
      { position: 21, driverId: 'PIA', status: 'dns' },
      { position: 22, driverId: 'HUL', status: 'dns' },
    ],
    fastest_lap_driver_id: 'VER',
    dnf_driver_ids: ['ALO', 'BOT', 'HAD'],
    dns_driver_ids: ['PIA', 'HUL'],
  },
  r02: {
    classification: [
      { position: 1,  driverId: 'ANT', status: 'finished' },
      { position: 2,  driverId: 'RUS', status: 'finished' },
      { position: 3,  driverId: 'HAM', status: 'finished' },
      { position: 4,  driverId: 'LEC', status: 'finished' },
      { position: 5,  driverId: 'BEA', status: 'finished' },
      { position: 6,  driverId: 'GAS', status: 'finished' },
      { position: 7,  driverId: 'LAW', status: 'finished' },
      { position: 8,  driverId: 'HAD', status: 'finished' },
      { position: 9,  driverId: 'SAI', status: 'finished' },
      { position: 10, driverId: 'COL', status: 'finished' },
      { position: 11, driverId: 'HUL', status: 'finished' },
      { position: 12, driverId: 'LIN', status: 'finished' },
      { position: 13, driverId: 'BOT', status: 'finished' },
      { position: 14, driverId: 'OCO', status: 'finished' },
      { position: 15, driverId: 'PER', status: 'finished' },
      { position: 16, driverId: 'VER', status: 'dnf' },
      { position: 17, driverId: 'ALO', status: 'dnf' },
      { position: 18, driverId: 'STR', status: 'dnf' },
      { position: 19, driverId: 'PIA', status: 'dns' },
      { position: 20, driverId: 'NOR', status: 'dns' },
      { position: 21, driverId: 'BOR', status: 'dns' },
      { position: 22, driverId: 'ALB', status: 'dns' },
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['VER', 'ALO', 'STR'],
    dns_driver_ids: ['PIA', 'NOR', 'BOR', 'ALB'],
    sprint_classification: [
      { position: 1, driverId: 'RUS', status: 'finished' },
      { position: 2, driverId: 'LEC', status: 'finished' },
      { position: 3, driverId: 'HAM', status: 'finished' },
      { position: 4, driverId: 'NOR', status: 'finished' },
      { position: 5, driverId: 'ANT', status: 'finished' },
      { position: 6, driverId: 'PIA', status: 'finished' },
      { position: 7, driverId: 'LAW', status: 'finished' },
      { position: 8, driverId: 'BEA', status: 'finished' },
    ],
  },
  r03: {
    classification: [
      { position: 1,  driverId: 'ANT', status: 'finished' },
      { position: 2,  driverId: 'PIA', status: 'finished' },
      { position: 3,  driverId: 'LEC', status: 'finished' },
      { position: 4,  driverId: 'RUS', status: 'finished' },
      { position: 5,  driverId: 'NOR', status: 'finished' },
      { position: 6,  driverId: 'HAM', status: 'finished' },
      { position: 7,  driverId: 'GAS', status: 'finished' },
      { position: 8,  driverId: 'VER', status: 'finished' },
      { position: 9,  driverId: 'LAW', status: 'finished' },
      { position: 10, driverId: 'OCO', status: 'finished' },
      { position: 11, driverId: 'HUL', status: 'finished' },
      { position: 12, driverId: 'HAD', status: 'finished' },
      { position: 13, driverId: 'BOR', status: 'finished' },
      { position: 14, driverId: 'LIN', status: 'finished' },
      { position: 15, driverId: 'SAI', status: 'finished' },
      { position: 16, driverId: 'COL', status: 'finished' },
      { position: 17, driverId: 'PER', status: 'finished' },
      { position: 18, driverId: 'ALO', status: 'finished' },
      { position: 19, driverId: 'BOT', status: 'finished' },
      { position: 20, driverId: 'ALB', status: 'finished' },
      { position: 21, driverId: 'STR', status: 'dnf' },
      { position: 22, driverId: 'BEA', status: 'dnf' },
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['STR', 'BEA'],
    dns_driver_ids: [],
  },
  r04: {
    classification: [
      { position: 1,  driverId: 'ANT', status: 'finished' },
      { position: 2,  driverId: 'NOR', status: 'finished' },
      { position: 3,  driverId: 'PIA', status: 'finished' },
      { position: 4,  driverId: 'RUS', status: 'finished' },
      { position: 5,  driverId: 'VER', status: 'finished' },
      { position: 6,  driverId: 'HAM', status: 'finished' },
      { position: 7,  driverId: 'COL', status: 'finished' },
      { position: 8,  driverId: 'LEC', status: 'finished' },
      { position: 9,  driverId: 'SAI', status: 'finished' },
      { position: 10, driverId: 'ALB', status: 'finished' },
      { position: 11, driverId: 'BEA', status: 'finished' },
      { position: 12, driverId: 'BOR', status: 'finished' },
      { position: 13, driverId: 'OCO', status: 'finished' },
      { position: 14, driverId: 'LIN', status: 'finished' },
      { position: 15, driverId: 'ALO', status: 'finished' },
      { position: 16, driverId: 'PER', status: 'finished' },
      { position: 17, driverId: 'STR', status: 'finished' },
      { position: 18, driverId: 'BOT', status: 'finished' },
      { position: 19, driverId: 'HUL', status: 'dnf' },
      { position: 20, driverId: 'LAW', status: 'dnf' },
      { position: 21, driverId: 'GAS', status: 'dnf' },
      { position: 22, driverId: 'HAD', status: 'dnf' },
    ],
    fastest_lap_driver_id: 'NOR',
    dnf_driver_ids: ['HUL', 'LAW', 'GAS', 'HAD'],
    dns_driver_ids: [],
    sprint_classification: [
      { position: 1, driverId: 'NOR', status: 'finished' },
      { position: 2, driverId: 'PIA', status: 'finished' },
      { position: 3, driverId: 'LEC', status: 'finished' },
      { position: 4, driverId: 'RUS', status: 'finished' },
      { position: 5, driverId: 'VER', status: 'finished' },
      { position: 6, driverId: 'ANT', status: 'finished' },
      { position: 7, driverId: 'HAM', status: 'finished' },
      { position: 8, driverId: 'GAS', status: 'finished' },
    ],
  },
  r05: {
    classification: [
      { position: 1,  driverId: 'ANT', status: 'finished' },
      { position: 2,  driverId: 'HAM', status: 'finished' },
      { position: 3,  driverId: 'VER', status: 'finished' },
      { position: 4,  driverId: 'LEC', status: 'finished' },
      { position: 5,  driverId: 'HAD', status: 'finished' },
      { position: 6,  driverId: 'COL', status: 'finished' },
      { position: 7,  driverId: 'LAW', status: 'finished' },
      { position: 8,  driverId: 'GAS', status: 'finished' },
      { position: 9,  driverId: 'SAI', status: 'finished' },
      { position: 10, driverId: 'BEA', status: 'finished' },
      { position: 11, driverId: 'PIA', status: 'finished' },
      { position: 12, driverId: 'HUL', status: 'finished' },
      { position: 13, driverId: 'BOR', status: 'finished' },
      { position: 14, driverId: 'OCO', status: 'finished' },
      { position: 15, driverId: 'STR', status: 'finished' },
      { position: 16, driverId: 'BOT', status: 'finished' },
      { position: 17, driverId: 'PER', status: 'dnf' },
      { position: 18, driverId: 'NOR', status: 'dnf' },
      { position: 19, driverId: 'RUS', status: 'dnf' },
      { position: 20, driverId: 'ALO', status: 'dnf' },
      { position: 21, driverId: 'ALB', status: 'dnf' },
      { position: 22, driverId: 'LIN', status: 'dns' },
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'],
    dns_driver_ids: ['LIN'],
    sprint_classification: [
      { position: 1, driverId: 'RUS', status: 'finished' },
      { position: 2, driverId: 'NOR', status: 'finished' },
      { position: 3, driverId: 'ANT', status: 'finished' },
      { position: 4, driverId: 'PIA', status: 'finished' },
      { position: 5, driverId: 'LEC', status: 'finished' },
      { position: 6, driverId: 'HAM', status: 'finished' },
      { position: 7, driverId: 'VER', status: 'finished' },
      { position: 8, driverId: 'LIN', status: 'finished' },
    ],
  },
  r06: {
    classification: [
      { position: 1,  driverId: 'ANT', status: 'finished' },
      { position: 2,  driverId: 'HAM', status: 'finished' },
      { position: 3,  driverId: 'GAS', status: 'finished' },
      { position: 4,  driverId: 'HAD', status: 'finished' },
      { position: 5,  driverId: 'PIA', status: 'finished' },
      { position: 6,  driverId: 'LAW', status: 'finished' },
      { position: 7,  driverId: 'LIN', status: 'finished' },
      { position: 8,  driverId: 'ALB', status: 'finished' },
      { position: 9,  driverId: 'OCO', status: 'finished' },
      { position: 10, driverId: 'ALO', status: 'finished' },
      { position: 11, driverId: 'BOR', status: 'finished' },
      { position: 12, driverId: 'RUS', status: 'finished' },
      { position: 13, driverId: 'HUL', status: 'finished' },
      { position: 14, driverId: 'COL', status: 'finished' },
      { position: 15, driverId: 'PER', status: 'finished' },
      { position: 16, driverId: 'SAI', status: 'dnf' },
      { position: 17, driverId: 'LEC', status: 'dnf' },
      { position: 18, driverId: 'STR', status: 'dnf' },
      { position: 19, driverId: 'NOR', status: 'dnf' },
      { position: 20, driverId: 'BEA', status: 'dnf' },
      { position: 21, driverId: 'BOT', status: 'dnf' },
      { position: 22, driverId: 'VER', status: 'dnf' },
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['SAI', 'LEC', 'STR', 'NOR', 'BEA', 'BOT', 'VER'],
    dns_driver_ids: [],
  },
  r07: {
    classification: [
      { position: 1,  driverId: 'HAM', status: 'finished' },
      { position: 2,  driverId: 'RUS', status: 'finished' },
      { position: 3,  driverId: 'NOR', status: 'finished' },
      { position: 4,  driverId: 'VER', status: 'finished' },
      { position: 5,  driverId: 'PIA', status: 'finished' },
      { position: 6,  driverId: 'HAD', status: 'finished' },
      { position: 7,  driverId: 'GAS', status: 'finished' },
      { position: 8,  driverId: 'LAW', status: 'finished' },
      { position: 9,  driverId: 'LIN', status: 'finished' },
      { position: 10, driverId: 'COL', status: 'finished' },
      { position: 11, driverId: 'BOR', status: 'finished' },
      { position: 12, driverId: 'SAI', status: 'finished' },
      { position: 13, driverId: 'OCO', status: 'finished' },
      { position: 14, driverId: 'PER', status: 'finished' },
      { position: 15, driverId: 'LEC', status: 'dnf' },
      { position: 16, driverId: 'ANT', status: 'dnf' },
      { position: 17, driverId: 'BEA', status: 'dnf' },
      { position: 18, driverId: 'ALB', status: 'finished' },
      { position: 19, driverId: 'ALO', status: 'dnf' },
      { position: 20, driverId: 'HUL', status: 'dnf' },
      { position: 21, driverId: 'BOT', status: 'dnf' },
      { position: 22, driverId: 'STR', status: 'dnf' },
    ],
    fastest_lap_driver_id: 'HAM',
    dnf_driver_ids: ['LEC', 'ANT', 'BEA', 'ALO', 'HUL', 'BOT', 'STR'],
    dns_driver_ids: [],
  },
};

const CORRECT_RACES = [
  { id: 'r01', round: 1,  name: 'Australian Grand Prix',     location: 'Melbourne',   country: 'Australia',       race_date: '2026-03-08', race_time: '05:00', status: 'completed', has_sprint: false, total_laps: 58 },
  { id: 'r02', round: 2,  name: 'Chinese Grand Prix',        location: 'Shanghai',    country: 'China',           race_date: '2026-03-15', race_time: '07:00', status: 'completed', has_sprint: true,  total_laps: 56 },
  { id: 'r03', round: 3,  name: 'Japanese Grand Prix',       location: 'Suzuka',      country: 'Japan',           race_date: '2026-03-29', race_time: '06:00', status: 'completed', has_sprint: false, total_laps: 53 },
  { id: 'r04', round: 4,  name: 'Miami Grand Prix',          location: 'Miami',       country: 'USA',             race_date: '2026-05-03', race_time: '20:00', status: 'completed', has_sprint: true,  total_laps: 57 },
  { id: 'r05', round: 5,  name: 'Canadian Grand Prix',       location: 'Montreal',    country: 'Canada',          race_date: '2026-05-24', race_time: '18:00', status: 'completed', has_sprint: true,  total_laps: 70 },
  { id: 'r06', round: 6,  name: 'Monaco Grand Prix',         location: 'Monte Carlo', country: 'Monaco',          race_date: '2026-06-07', race_time: '13:00', status: 'completed', has_sprint: false, total_laps: 78 },
  { id: 'r07', round: 7,  name: 'Barcelona Grand Prix',      location: 'Barcelona',   country: 'Spain',           race_date: '2026-06-14', race_time: '13:00', status: 'completed', has_sprint: false, total_laps: 66 },
  { id: 'r08', round: 8,  name: 'Austrian Grand Prix',       location: 'Spielberg',   country: 'Austria',         race_date: '2026-06-28', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
  { id: 'r09', round: 9,  name: 'British Grand Prix',        location: 'Silverstone', country: 'United Kingdom',  race_date: '2026-07-05', race_time: '14:00', status: 'upcoming',  has_sprint: true,  total_laps: 52 },
  { id: 'r10', round: 10, name: 'Belgian Grand Prix',        location: 'Spa-Francorchamps', country: 'Belgium', race_date: '2026-07-19', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 44 },
  { id: 'r11', round: 11, name: 'Hungarian Grand Prix',      location: 'Budapest',    country: 'Hungary',         race_date: '2026-07-26', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 70 },
  { id: 'r12', round: 12, name: 'Dutch Grand Prix',          location: 'Zandvoort',   country: 'Netherlands',     race_date: '2026-08-23', race_time: '13:00', status: 'upcoming',  has_sprint: true,  total_laps: 72 },
  { id: 'r13', round: 13, name: 'Italian Grand Prix',        location: 'Monza',       country: 'Italy',           race_date: '2026-09-06', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 53 },
  { id: 'r14', round: 14, name: 'Madrid Grand Prix',         location: 'Madrid',      country: 'Spain',           race_date: '2026-09-13', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 55 },
  { id: 'r15', round: 15, name: 'Azerbaijan Grand Prix',     location: 'Baku',        country: 'Azerbaijan',      race_date: '2026-09-27', race_time: '12:00', status: 'upcoming',  has_sprint: false, total_laps: 51 },
  { id: 'r16', round: 16, name: 'Singapore Grand Prix',      location: 'Marina Bay',  country: 'Singapore',       race_date: '2026-10-11', race_time: '12:00', status: 'upcoming',  has_sprint: true,  total_laps: 62 },
  { id: 'r17', round: 17, name: 'United States Grand Prix',  location: 'Austin',      country: 'USA',             race_date: '2026-10-25', race_time: '19:00', status: 'upcoming',  has_sprint: false, total_laps: 56 },
  { id: 'r18', round: 18, name: 'Mexico City Grand Prix',    location: 'Mexico City', country: 'Mexico',          race_date: '2026-11-01', race_time: '20:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
  { id: 'r19', round: 19, name: 'Brazilian Grand Prix',      location: 'Interlagos',  country: 'Brazil',          race_date: '2026-11-08', race_time: '17:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
  { id: 'r20', round: 20, name: 'Las Vegas Grand Prix',      location: 'Las Vegas',   country: 'USA',             race_date: '2026-11-21', race_time: '06:00', status: 'upcoming',  has_sprint: false, total_laps: 50 },
  { id: 'r21', round: 21, name: 'Qatar Grand Prix',          location: 'Lusail',      country: 'Qatar',           race_date: '2026-11-29', race_time: '17:00', status: 'upcoming',  has_sprint: false, total_laps: 57 },
  { id: 'r22', round: 22, name: 'Abu Dhabi Grand Prix',      location: 'Yas Marina',  country: 'UAE',             race_date: '2026-12-06', race_time: '14:00', status: 'upcoming',  has_sprint: false, total_laps: 58 },
];

async function main() {
  console.log('Populating 2026 F1 data via Supabase REST API...\n');

  // ---- STEP 1: Fix races table ----
  console.log('--- Step 1: Fixing races table ---');
  
  // Check existing races
  try {
    const existingRaces = await supabaseFetch('races?select=id,round,name,status&order=round.asc');
    console.log('Current races:');
    for (const r of (Array.isArray(existingRaces) ? existingRaces : [])) {
      console.log(`  ${r.id} (R${r.round}): ${r.name} [${r.status}]`);
    }
  } catch (e) {
    console.log('Could not read races:', e.message);
  }

  // Delete old races (except we need to handle FK constraints)
  // Since race_results references races, delete results first
  try {
    await supabaseFetch('race_results', { method: 'DELETE' });
    console.log('Cleared race_results.');
  } catch (e) {
    console.log('Could not clear race_results (may be empty):', e.message);
  }

  // Delete old races
  try {
    await supabaseFetch('races', { method: 'DELETE' });
    console.log('Cleared races.');
  } catch (e) {
    console.log('Could not clear races:', e.message);
  }

  // Insert correct races
  for (const race of CORRECT_RACES) {
    try {
      await supabaseFetch('races', {
        method: 'POST',
        body: JSON.stringify(race),
        headers: { 'Prefer': 'return=minimal' },
      });
    } catch (e) {
      console.log(`Error inserting race ${race.id}:`, e.message);
    }
  }
  console.log(`Inserted ${CORRECT_RACES.length} races.`);

  // ---- STEP 2: Add missing columns to race_results ----
  // NOTE: We can't ALTER TABLE via REST API. The columns need to exist already.
  // The supabase-schema.sql has: classification, fastest_lap_driver_id, dnf_driver_ids
  // We need to ensure dns_driver_ids and sprint_classification exist too.
  // If they don't, the inserts may fail. Let's try and handle errors.
  console.log('\n--- Step 2: Populating race_results ---');

  for (const [raceId, result] of Object.entries(RACE_RESULTS)) {
    const row = {
      race_id: raceId,
      classification: result.classification,
      fastest_lap_driver_id: result.fastest_lap_driver_id,
      dnf_driver_ids: result.dnf_driver_ids,
      dns_driver_ids: result.dns_driver_ids || [],
      sprint_classification: result.sprint_classification || [],
    };

    try {
      await supabaseFetch('race_results', {
        method: 'POST',
        body: JSON.stringify(row),
        headers: { 'Prefer': 'return=minimal' },
      });
      console.log(`  Inserted ${raceId}: ${result.classification.length} positions, FL=${result.fastest_lap_driver_id}`);
    } catch (e) {
      // Try without optional columns
      console.log(`  Error with full row for ${raceId}: ${e.message}`);
      try {
        const basicRow = {
          race_id: raceId,
          classification: result.classification,
          fastest_lap_driver_id: result.fastest_lap_driver_id,
          dnf_driver_ids: result.dnf_driver_ids,
        };
        await supabaseFetch('race_results', {
          method: 'POST',
          body: JSON.stringify(basicRow),
          headers: { 'Prefer': 'return=minimal' },
        });
        console.log(`  Inserted ${raceId} (basic): ${result.classification.length} positions`);
      } catch (e2) {
        console.log(`  FAILED ${raceId}: ${e2.message}`);
      }
    }
  }

  // ---- STEP 3: Verify ----
  console.log('\n--- Step 3: Verification ---');
  
  try {
    const races = await supabaseFetch('races?select=id,round,name,status&order=round.asc');
    console.log('Races:', (races || []).length);
    for (const r of (Array.isArray(races) ? races : [])) {
      console.log(`  ${r.id} (R${r.round}): ${r.name} [${r.status}]`);
    }
  } catch (e) {
    console.log('Races check failed:', e.message);
  }

  try {
    const results = await supabaseFetch('race_results?select=race_id,fastest_lap_driver_id&order=race_id.asc');
    console.log('\nRace results:', (results || []).length);
    for (const r of (Array.isArray(results) ? results : [])) {
      console.log(`  ${r.race_id}: FL=${r.fastest_lap_driver_id}`);
    }
  } catch (e) {
    console.log('Results check failed:', e.message);
  }

  console.log('\nDone!');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
