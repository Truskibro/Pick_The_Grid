const { Client } = require('pg');
const fs = require('fs');

const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_USER = 'postgres.fxwgbpassouaddakgyus';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 6543;

// ============================================================
// VERIFIED 2026 RACE RESULTS — sourced from Jolpica/Ergast API
// and cross-checked against formula1.com
// ============================================================

const RACE_RESULTS = {
  // ── R01 — Australian GP — 2026-03-08 ──────────────────────
  r01: {
    race_id: 'r01',
    fastest_lap_driver_id: 'VER',
    dnf_driver_ids: ['ALO', 'BOT', 'HAD'],
    dns_driver_ids: ['PIA', 'HUL'],
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
  },

  // ── R02 — Chinese GP — 2026-03-15 — SPRINT ────────────────
  r02: {
    race_id: 'r02',
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['VER', 'ALO', 'STR'],
    dns_driver_ids: ['PIA', 'NOR', 'BOR', 'ALB'],
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

  // ── R03 — Japanese GP — 2026-03-29 ────────────────────────
  r03: {
    race_id: 'r03',
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['STR', 'BEA'],
    dns_driver_ids: [],
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
  },

  // ── R04 — Miami GP — 2026-05-03 — SPRINT ──────────────────
  r04: {
    race_id: 'r04',
    fastest_lap_driver_id: 'NOR',
    dnf_driver_ids: ['HUL', 'LAW', 'GAS', 'HAD'],
    dns_driver_ids: [],
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

  // ── R05 — Canadian GP — 2026-05-24 — SPRINT ───────────────
  r05: {
    race_id: 'r05',
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'],
    dns_driver_ids: ['LIN'],
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

  // ── R06 — Monaco GP — 2026-06-07 ──────────────────────────
  r06: {
    race_id: 'r06',
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['SAI', 'LEC', 'STR', 'NOR', 'BEA', 'BOT', 'VER'],
    dns_driver_ids: [],
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
  },

  // ── R07 — Barcelona GP — 2026-06-14 ───────────────────────
  r07: {
    race_id: 'r07',
    fastest_lap_driver_id: 'HAM',
    dnf_driver_ids: ['LEC', 'ANT', 'BEA', 'ALO', 'HUL', 'BOT', 'STR'],
    dns_driver_ids: [],
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
  },
};

// Correct 2026 race calendar (what f1-data.ts uses)
const CORRECT_RACES = [
  { id: 'r01', round: 1,  name: 'Australian Grand Prix',     location: 'Melbourne',   country: 'Australia',      race_date: '2026-03-08', race_time: '05:00', status: 'completed', has_sprint: false, total_laps: 58 },
  { id: 'r02', round: 2,  name: 'Chinese Grand Prix',        location: 'Shanghai',    country: 'China',          race_date: '2026-03-15', race_time: '07:00', status: 'completed', has_sprint: true,  total_laps: 56 },
  { id: 'r03', round: 3,  name: 'Japanese Grand Prix',       location: 'Suzuka',      country: 'Japan',          race_date: '2026-03-29', race_time: '06:00', status: 'completed', has_sprint: false, total_laps: 53 },
  { id: 'r04', round: 4,  name: 'Miami Grand Prix',           location: 'Miami',       country: 'USA',            race_date: '2026-05-03', race_time: '20:00', status: 'completed', has_sprint: true,  total_laps: 57 },
  { id: 'r05', round: 5,  name: 'Canadian Grand Prix',        location: 'Montreal',    country: 'Canada',         race_date: '2026-05-24', race_time: '18:00', status: 'completed', has_sprint: true,  total_laps: 70 },
  { id: 'r06', round: 6,  name: 'Monaco Grand Prix',          location: 'Monte Carlo', country: 'Monaco',         race_date: '2026-06-07', race_time: '13:00', status: 'completed', has_sprint: false, total_laps: 78 },
  { id: 'r07', round: 7,  name: 'Barcelona Grand Prix',       location: 'Barcelona',   country: 'Spain',          race_date: '2026-06-14', race_time: '13:00', status: 'completed', has_sprint: false, total_laps: 66 },
  { id: 'r08', round: 8,  name: 'Austrian Grand Prix',        location: 'Spielberg',   country: 'Austria',        race_date: '2026-06-28', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
  { id: 'r09', round: 9,  name: 'British Grand Prix',         location: 'Silverstone', country: 'United Kingdom', race_date: '2026-07-05', race_time: '14:00', status: 'upcoming',  has_sprint: true,  total_laps: 52 },
  { id: 'r10', round: 10, name: 'Belgian Grand Prix',         location: 'Spa-Francorchamps', country: 'Belgium',  race_date: '2026-07-19', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 44 },
  { id: 'r11', round: 11, name: 'Hungarian Grand Prix',       location: 'Budapest',    country: 'Hungary',        race_date: '2026-07-26', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 70 },
  { id: 'r12', round: 12, name: 'Dutch Grand Prix',           location: 'Zandvoort',   country: 'Netherlands',    race_date: '2026-08-23', race_time: '13:00', status: 'upcoming',  has_sprint: true,  total_laps: 72 },
  { id: 'r13', round: 13, name: 'Italian Grand Prix',         location: 'Monza',       country: 'Italy',          race_date: '2026-09-06', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 53 },
  { id: 'r14', round: 14, name: 'Madrid Grand Prix',          location: 'Madrid',      country: 'Spain',          race_date: '2026-09-13', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 55 },
  { id: 'r15', round: 15, name: 'Azerbaijan Grand Prix',      location: 'Baku',        country: 'Azerbaijan',     race_date: '2026-09-27', race_time: '12:00', status: 'upcoming',  has_sprint: false, total_laps: 51 },
  { id: 'r16', round: 16, name: 'Singapore Grand Prix',       location: 'Marina Bay',  country: 'Singapore',      race_date: '2026-10-11', race_time: '12:00', status: 'upcoming',  has_sprint: true,  total_laps: 62 },
  { id: 'r17', round: 17, name: 'United States Grand Prix',   location: 'Austin',      country: 'USA',            race_date: '2026-10-25', race_time: '19:00', status: 'upcoming',  has_sprint: false, total_laps: 56 },
  { id: 'r18', round: 18, name: 'Mexico City Grand Prix',     location: 'Mexico City', country: 'Mexico',         race_date: '2026-11-01', race_time: '20:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
  { id: 'r19', round: 19, name: 'Brazilian Grand Prix',       location: 'Interlagos',  country: 'Brazil',         race_date: '2026-11-08', race_time: '17:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
  { id: 'r20', round: 20, name: 'Las Vegas Grand Prix',       location: 'Las Vegas',   country: 'USA',            race_date: '2026-11-21', race_time: '06:00', status: 'upcoming',  has_sprint: false, total_laps: 50 },
  { id: 'r21', round: 21, name: 'Qatar Grand Prix',           location: 'Lusail',      country: 'Qatar',          race_date: '2026-11-29', race_time: '17:00', status: 'upcoming',  has_sprint: false, total_laps: 57 },
  { id: 'r22', round: 22, name: 'Abu Dhabi Grand Prix',       location: 'Yas Marina',  country: 'UAE',            race_date: '2026-12-06', race_time: '14:00', status: 'upcoming',  has_sprint: false, total_laps: 58 },
];

async function main() {
  console.log(`Connecting to ${DB_USER}@${HOST}:${DB_PORT}/${DB_NAME}...`);
  const client = new Client({
    host: HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('Connected!');

    // ============================================================
    // STEP 1: Add missing columns to race_results table
    // ============================================================
    console.log('\n--- Step 1: Adding missing columns to race_results ---');
    await client.query(`
      ALTER TABLE race_results ADD COLUMN IF NOT EXISTS dns_driver_ids TEXT[] DEFAULT '{}';
      ALTER TABLE race_results ADD COLUMN IF NOT EXISTS sprint_classification JSONB DEFAULT '[]';
    `);
    console.log('Columns ensured.');

    // ============================================================
    // STEP 2: Fix the races table — remove cancelled Bahrain/Saudi
    // and align IDs with what the app uses
    // ============================================================
    console.log('\n--- Step 2: Fixing races table ---');
    
    // First check what races exist
    const existingRaces = await client.query('SELECT id, round, name, status FROM races ORDER BY round');
    console.log('Existing races:');
    for (const r of existingRaces.rows) {
      console.log(`  ${r.id} (R${r.round}): ${r.name} [${r.status}]`);
    }

    // Delete the old races and re-insert with correct IDs
    await client.query('DELETE FROM races');
    console.log('Cleared old races.');

    for (const race of CORRECT_RACES) {
      await client.query(`
        INSERT INTO races (id, round, name, location, country, race_date, race_time, status, has_sprint, total_laps)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          round = $2, name = $3, location = $4, country = $5,
          race_date = $6, race_time = $7, status = $8, has_sprint = $9, total_laps = $10
      `, [race.id, race.round, race.name, race.location, race.country, race.race_date, race.race_time, race.status, race.has_sprint, race.total_laps]);
    }
    console.log(`Inserted ${CORRECT_RACES.length} races with correct IDs.`);

    // ============================================================
    // STEP 3: Populate race_results with verified 2026 data
    // ============================================================
    console.log('\n--- Step 3: Populating race_results ---');
    
    // Clear existing race_results
    await client.query('DELETE FROM race_results');
    
    for (const [raceId, result] of Object.entries(RACE_RESULTS)) {
      await client.query(`
        INSERT INTO race_results (race_id, classification, fastest_lap_driver_id, dnf_driver_ids, dns_driver_ids, sprint_classification)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (race_id) DO UPDATE SET
          classification = $2,
          fastest_lap_driver_id = $3,
          dnf_driver_ids = $4,
          dns_driver_ids = $5,
          sprint_classification = $6
      `, [
        raceId,
        JSON.stringify(result.classification),
        result.fastest_lap_driver_id,
        result.dnf_driver_ids,
        result.dns_driver_ids || [],
        JSON.stringify(result.sprint_classification || []),
      ]);
      console.log(`  Inserted ${raceId}: ${result.classification.length} positions, FL=${result.fastest_lap_driver_id}, DNF=${result.dnf_driver_ids.length}, DNS=${(result.dns_driver_ids || []).length}`);
    }

    // ============================================================
    // STEP 4: Verify
    // ============================================================
    console.log('\n--- Step 4: Verification ---');
    
    const raceCheck = await client.query('SELECT id, round, name, status FROM races ORDER BY round');
    console.log('Races after fix:');
    for (const r of raceCheck.rows) {
      console.log(`  ${r.id} (R${r.round}): ${r.name} [${r.status}]`);
    }

    const resultsCheck = await client.query('SELECT race_id, fastest_lap_driver_id, jsonb_array_length(classification) as pos_count FROM race_results ORDER BY race_id');
    console.log('\nRace results:');
    for (const r of resultsCheck.rows) {
      console.log(`  ${r.race_id}: ${r.pos_count} positions, FL=${r.fastest_lap_driver_id}`);
    }

    const profilesCheck = await client.query('SELECT id, username, display_name, total_points FROM profiles WHERE total_points > 0 ORDER BY total_points DESC');
    console.log('\nProfiles with points:');
    for (const p of profilesCheck.rows) {
      console.log(`  ${p.username} (${p.display_name}): ${p.total_points} pts`);
    }

    // Also show all profiles (even 0-point ones) to find missing users
    const allProfiles = await client.query('SELECT id, username, display_name, total_points FROM profiles ORDER BY created_at');
    console.log('\nAll profiles:');
    for (const p of allProfiles.rows) {
      console.log(`  ${p.username} (${p.display_name}): ${p.total_points} pts [id: ${p.id}]`);
    }

    const predictionCount = await client.query('SELECT COUNT(*) as cnt FROM user_predictions');
    console.log(`\nTotal user_predictions rows: ${predictionCount.rows[0].cnt}`);

    await client.end();
    console.log('\nDone!');
  } catch (e) {
    console.error('Error:', e.message);
    if (client) await client.end();
    process.exit(1);
  }
}

main();
