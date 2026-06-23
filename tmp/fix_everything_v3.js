// Fix everything: races, race_results, points, profiles
const { Client } = require('pg');

const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_USER = 'postgres.fxwgbpassouaddakgyus';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 6543;

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// === Verified 2026 F1 Race Results (Jolpica API, June 23 2026) ===
const VERIFIED_RESULTS = [
  // R01 - Australian GP (2026-03-08) - no sprint
  [
    {p:1,d:'RUS',pts:25,s:'finished'},{p:2,d:'ANT',pts:18,s:'finished'},{p:3,d:'LEC',pts:15,s:'finished'},
    {p:4,d:'HAM',pts:12,s:'finished'},{p:5,d:'NOR',pts:10,s:'finished'},{p:6,d:'VER',pts:8,s:'finished'},
    {p:7,d:'BEA',pts:6,s:'finished'},{p:8,d:'LIN',pts:4,s:'finished'},{p:9,d:'BOR',pts:2,s:'finished'},
    {p:10,d:'GAS',pts:1,s:'finished'},{p:11,d:'OCO',pts:0,s:'finished'},{p:12,d:'ALB',pts:0,s:'finished'},
    {p:13,d:'LAW',pts:0,s:'finished'},{p:14,d:'COL',pts:0,s:'finished'},{p:15,d:'SAI',pts:0,s:'finished'},
    {p:16,d:'PER',pts:0,s:'finished'},{p:17,d:'STR',pts:0,s:'retired'},{p:18,d:'ALO',pts:0,s:'retired'},
    {p:19,d:'BOT',pts:0,s:'retired'},{p:20,d:'HAD',pts:0,s:'retired'},{p:21,d:'PIA',pts:0,s:'dns'},
    {p:22,d:'HUL',pts:0,s:'dns'}
  ], 'VER', ['STR','ALO','BOT','HAD'], ['PIA','HUL'], null,
  // R02 - Chinese GP (2026-03-15) - sprint
  [
    {p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'RUS',pts:18,s:'finished'},{p:3,d:'HAM',pts:15,s:'finished'},
    {p:4,d:'LEC',pts:12,s:'finished'},{p:5,d:'BEA',pts:10,s:'finished'},{p:6,d:'GAS',pts:8,s:'finished'},
    {p:7,d:'LAW',pts:6,s:'finished'},{p:8,d:'HAD',pts:4,s:'finished'},{p:9,d:'SAI',pts:2,s:'finished'},
    {p:10,d:'COL',pts:1,s:'finished'},{p:11,d:'HUL',pts:0,s:'finished'},{p:12,d:'LIN',pts:0,s:'finished'},
    {p:13,d:'BOT',pts:0,s:'finished'},{p:14,d:'OCO',pts:0,s:'finished'},{p:15,d:'PER',pts:0,s:'finished'},
    {p:16,d:'VER',pts:0,s:'retired'},{p:17,d:'ALO',pts:0,s:'retired'},{p:18,d:'STR',pts:0,s:'retired'},
    {p:19,d:'PIA',pts:0,s:'dns'},{p:20,d:'NOR',pts:0,s:'dns'},{p:21,d:'BOR',pts:0,s:'dns'},
    {p:22,d:'ALB',pts:0,s:'dns'}
  ], 'ANT', ['VER','ALO','STR'], ['PIA','NOR','BOR','ALB'],
  [{p:1,d:'RUS',pts:8},{p:2,d:'LEC',pts:7},{p:3,d:'HAM',pts:6},{p:4,d:'NOR',pts:5},{p:5,d:'ANT',pts:4},{p:6,d:'PIA',pts:3},{p:7,d:'LAW',pts:2},{p:8,d:'BEA',pts:1}],
  // R03 - Japanese GP (2026-03-29) - no sprint
  [
    {p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'PIA',pts:18,s:'finished'},{p:3,d:'LEC',pts:15,s:'finished'},
    {p:4,d:'RUS',pts:12,s:'finished'},{p:5,d:'NOR',pts:10,s:'finished'},{p:6,d:'HAM',pts:8,s:'finished'},
    {p:7,d:'GAS',pts:6,s:'finished'},{p:8,d:'VER',pts:4,s:'finished'},{p:9,d:'LAW',pts:2,s:'finished'},
    {p:10,d:'OCO',pts:1,s:'finished'},{p:11,d:'HUL',pts:0,s:'finished'},{p:12,d:'HAD',pts:0,s:'finished'},
    {p:13,d:'BOR',pts:0,s:'finished'},{p:14,d:'LIN',pts:0,s:'finished'},{p:15,d:'SAI',pts:0,s:'finished'},
    {p:16,d:'COL',pts:0,s:'finished'},{p:17,d:'PER',pts:0,s:'finished'},{p:18,d:'ALO',pts:0,s:'finished'},
    {p:19,d:'BOT',pts:0,s:'finished'},{p:20,d:'ALB',pts:0,s:'finished'},{p:21,d:'STR',pts:0,s:'retired'},
    {p:22,d:'BEA',pts:0,s:'retired'}
  ], 'ANT', ['STR','BEA'], [], null,
  // R04 - Miami GP (2026-05-03) - sprint
  [
    {p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'NOR',pts:18,s:'finished'},{p:3,d:'PIA',pts:15,s:'finished'},
    {p:4,d:'RUS',pts:12,s:'finished'},{p:5,d:'VER',pts:10,s:'finished'},{p:6,d:'HAM',pts:8,s:'finished'},
    {p:7,d:'COL',pts:6,s:'finished'},{p:8,d:'LEC',pts:4,s:'finished'},{p:9,d:'SAI',pts:2,s:'finished'},
    {p:10,d:'ALB',pts:1,s:'finished'},{p:11,d:'BEA',pts:0,s:'finished'},{p:12,d:'BOR',pts:0,s:'finished'},
    {p:13,d:'OCO',pts:0,s:'finished'},{p:14,d:'LIN',pts:0,s:'finished'},{p:15,d:'ALO',pts:0,s:'finished'},
    {p:16,d:'PER',pts:0,s:'finished'},{p:17,d:'STR',pts:0,s:'finished'},{p:18,d:'BOT',pts:0,s:'finished'},
    {p:19,d:'HUL',pts:0,s:'retired'},{p:20,d:'LAW',pts:0,s:'retired'},{p:21,d:'GAS',pts:0,s:'retired'},
    {p:22,d:'HAD',pts:0,s:'retired'}
  ], 'NOR', ['HUL','LAW','GAS','HAD'], [],
  [{p:1,d:'NOR',pts:8},{p:2,d:'PIA',pts:7},{p:3,d:'LEC',pts:6},{p:4,d:'RUS',pts:5},{p:5,d:'VER',pts:4},{p:6,d:'ANT',pts:3},{p:7,d:'HAM',pts:2},{p:8,d:'GAS',pts:1}],
  // R05 - Canadian GP (2026-05-24) - sprint
  [
    {p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'HAM',pts:18,s:'finished'},{p:3,d:'VER',pts:15,s:'finished'},
    {p:4,d:'LEC',pts:12,s:'finished'},{p:5,d:'HAD',pts:10,s:'finished'},{p:6,d:'COL',pts:8,s:'finished'},
    {p:7,d:'LAW',pts:6,s:'finished'},{p:8,d:'GAS',pts:4,s:'finished'},{p:9,d:'SAI',pts:2,s:'finished'},
    {p:10,d:'BEA',pts:1,s:'finished'},{p:11,d:'PIA',pts:0,s:'finished'},{p:12,d:'HUL',pts:0,s:'finished'},
    {p:13,d:'BOR',pts:0,s:'finished'},{p:14,d:'OCO',pts:0,s:'finished'},{p:15,d:'STR',pts:0,s:'finished'},
    {p:16,d:'BOT',pts:0,s:'finished'},{p:17,d:'PER',pts:0,s:'retired'},{p:18,d:'NOR',pts:0,s:'retired'},
    {p:19,d:'RUS',pts:0,s:'retired'},{p:20,d:'ALO',pts:0,s:'retired'},{p:21,d:'ALB',pts:0,s:'retired'},
    {p:22,d:'LIN',pts:0,s:'dns'}
  ], 'ANT', ['PER','NOR','RUS','ALO','ALB'], ['LIN'],
  [{p:1,d:'RUS',pts:8},{p:2,d:'NOR',pts:7},{p:3,d:'ANT',pts:6},{p:4,d:'PIA',pts:5},{p:5,d:'LEC',pts:4},{p:6,d:'HAM',pts:3},{p:7,d:'VER',pts:2},{p:8,d:'LIN',pts:1}],
  // R06 - Monaco GP (2026-06-07) - no sprint
  [
    {p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'HAM',pts:18,s:'finished'},{p:3,d:'GAS',pts:15,s:'finished'},
    {p:4,d:'HAD',pts:12,s:'finished'},{p:5,d:'PIA',pts:10,s:'finished'},{p:6,d:'LAW',pts:8,s:'finished'},
    {p:7,d:'LIN',pts:6,s:'finished'},{p:8,d:'ALB',pts:4,s:'finished'},{p:9,d:'OCO',pts:2,s:'finished'},
    {p:10,d:'ALO',pts:1,s:'finished'},{p:11,d:'BOR',pts:0,s:'finished'},{p:12,d:'RUS',pts:0,s:'finished'},
    {p:13,d:'HUL',pts:0,s:'finished'},{p:14,d:'COL',pts:0,s:'finished'},{p:15,d:'PER',pts:0,s:'finished'},
    {p:16,d:'SAI',pts:0,s:'retired'},{p:17,d:'LEC',pts:0,s:'retired'},{p:18,d:'STR',pts:0,s:'retired'},
    {p:19,d:'NOR',pts:0,s:'retired'},{p:20,d:'BEA',pts:0,s:'retired'},{p:21,d:'BOT',pts:0,s:'retired'},
    {p:22,d:'VER',pts:0,s:'retired'}
  ], 'ANT', ['SAI','LEC','STR','NOR','BEA','BOT','VER'], [], null,
  // R07 - Barcelona GP (2026-06-14) - no sprint
  [
    {p:1,d:'HAM',pts:25,s:'finished'},{p:2,d:'RUS',pts:18,s:'finished'},{p:3,d:'NOR',pts:15,s:'finished'},
    {p:4,d:'VER',pts:12,s:'finished'},{p:5,d:'PIA',pts:10,s:'finished'},{p:6,d:'HAD',pts:8,s:'finished'},
    {p:7,d:'GAS',pts:6,s:'finished'},{p:8,d:'LAW',pts:4,s:'finished'},{p:9,d:'LIN',pts:2,s:'finished'},
    {p:10,d:'COL',pts:1,s:'finished'},{p:11,d:'BOR',pts:0,s:'finished'},{p:12,d:'SAI',pts:0,s:'finished'},
    {p:13,d:'OCO',pts:0,s:'finished'},{p:14,d:'PER',pts:0,s:'finished'},
    // ALB P18 was LAPPED (finished), NOT retired!
    {p:18,d:'ALB',pts:0,s:'finished'},
    {p:15,d:'LEC',pts:0,s:'retired'},{p:16,d:'ANT',pts:0,s:'retired'},{p:17,d:'BEA',pts:0,s:'retired'},
    {p:19,d:'ALO',pts:0,s:'retired'},{p:20,d:'HUL',pts:0,s:'retired'},{p:21,d:'BOT',pts:0,s:'retired'},
    {p:22,d:'STR',pts:0,s:'retired'}
  ], 'HAM', ['LEC','ANT','BEA','ALO','HUL','BOT','STR'], [], null,
];

// Build proper records from verified data
function buildRaceResult(idx, raceId) {
  const entry = VERIFIED_RESULTS[idx];
  const classification = entry[0];
  const fl = entry[1];
  const dnfs = entry[2];
  const dnss = entry[3];
  const sprint = entry[4]; // sprintClassification or null
  
  const classificationJson = classification.map(c => ({
    position: c.p,
    driverId: c.d,
    time: '',
    gap: '',
    points: c.pts,
    status: c.s === 'finished' ? 'finished' : c.s === 'retired' ? 'dnf' : c.s
  })).sort((a,b) => a.position - b.position);
  
  return {
    race_id: raceId,
    classification: JSON.stringify(classificationJson),
    fastest_lap_driver_id: fl,
    dnf_driver_ids: '{' + dnfs.join(',') + '}',
    dns_driver_ids: '{' + dnss.join(',') + '}',
    sprint_classification: sprint ? JSON.stringify(sprint.map(s => ({
      position: s.p,
      driverId: s.d,
      time: '',
      gap: '',
      points: s.pts,
      status: 'finished'
    }))) : null
  };
}

// === Updated Races (matches app's f1-data.ts) ===
const UPDATED_RACES = [
  { id:'r01', round:1,  name:'Australian Grand Prix',     location:'Melbourne',       country:'Australia',      race_date:'2026-03-08', race_time:'05:00', status:'completed', has_sprint:false, total_laps:58 },
  { id:'r02', round:2,  name:'Chinese Grand Prix',         location:'Shanghai',        country:'China',          race_date:'2026-03-15', race_time:'07:00', status:'completed', has_sprint:true,  total_laps:56 },
  { id:'r03', round:3,  name:'Japanese Grand Prix',        location:'Suzuka',          country:'Japan',          race_date:'2026-03-29', race_time:'06:00', status:'completed', has_sprint:false, total_laps:53 },
  { id:'r04', round:4,  name:'Miami Grand Prix',           location:'Miami',           country:'USA',            race_date:'2026-05-03', race_time:'20:00', status:'completed', has_sprint:true,  total_laps:57 },
  { id:'r05', round:5,  name:'Canadian Grand Prix',        location:'Montreal',        country:'Canada',         race_date:'2026-05-24', race_time:'18:00', status:'completed', has_sprint:true,  total_laps:70 },
  { id:'r06', round:6,  name:'Monaco Grand Prix',          location:'Monte Carlo',     country:'Monaco',         race_date:'2026-06-07', race_time:'13:00', status:'completed', has_sprint:false, total_laps:78 },
  { id:'r07', round:7,  name:'Barcelona Grand Prix',       location:'Barcelona',       country:'Spain',          race_date:'2026-06-14', race_time:'13:00', status:'completed', has_sprint:false, total_laps:66 },
  { id:'r08', round:8,  name:'Austrian Grand Prix',        location:'Spielberg',       country:'Austria',        race_date:'2026-06-28', race_time:'13:00', status:'upcoming',  has_sprint:false, total_laps:71 },
  { id:'r09', round:9,  name:'British Grand Prix',         location:'Silverstone',     country:'United Kingdom', race_date:'2026-07-05', race_time:'14:00', status:'upcoming',  has_sprint:true,  total_laps:52 },
  { id:'r10', round:10, name:'Belgian Grand Prix',         location:'Spa-Francorchamps',country:'Belgium',       race_date:'2026-07-19', race_time:'13:00', status:'upcoming',  has_sprint:false, total_laps:44 },
  { id:'r11', round:11, name:'Hungarian Grand Prix',       location:'Budapest',        country:'Hungary',        race_date:'2026-07-26', race_time:'13:00', status:'upcoming',  has_sprint:false, total_laps:70 },
  { id:'r12', round:12, name:'Dutch Grand Prix',           location:'Zandvoort',       country:'Netherlands',    race_date:'2026-08-23', race_time:'13:00', status:'upcoming',  has_sprint:true,  total_laps:72 },
  { id:'r13', round:13, name:'Italian Grand Prix',         location:'Monza',           country:'Italy',          race_date:'2026-09-06', race_time:'13:00', status:'upcoming',  has_sprint:false, total_laps:53 },
  { id:'r14', round:14, name:'Spanish Grand Prix',         location:'Madrid',          country:'Spain',          race_date:'2026-09-13', race_time:'13:00', status:'upcoming',  has_sprint:false, total_laps:66 },
  { id:'r15', round:15, name:'Azerbaijan Grand Prix',      location:'Baku',            country:'Azerbaijan',     race_date:'2026-09-26', race_time:'12:00', status:'upcoming',  has_sprint:false, total_laps:51 },
  { id:'r16', round:16, name:'Singapore Grand Prix',       location:'Marina Bay',      country:'Singapore',      race_date:'2026-10-11', race_time:'12:00', status:'upcoming',  has_sprint:true,  total_laps:62 },
  { id:'r17', round:17, name:'United States Grand Prix',   location:'Austin',          country:'USA',            race_date:'2026-10-25', race_time:'19:00', status:'upcoming',  has_sprint:false, total_laps:56 },
  { id:'r18', round:18, name:'Mexico City Grand Prix',     location:'Mexico City',     country:'Mexico',         race_date:'2026-11-01', race_time:'20:00', status:'upcoming',  has_sprint:false, total_laps:71 },
  { id:'r19', round:19, name:'Brazilian Grand Prix',       location:'Interlagos',      country:'Brazil',         race_date:'2026-11-08', race_time:'17:00', status:'upcoming',  has_sprint:false, total_laps:71 },
  { id:'r20', round:20, name:'Las Vegas Grand Prix',       location:'Las Vegas',       country:'USA',            race_date:'2026-11-22', race_time:'06:00', status:'upcoming',  has_sprint:false, total_laps:50 },
  { id:'r21', round:21, name:'Qatar Grand Prix',           location:'Lusail',          country:'Qatar',          race_date:'2026-11-29', race_time:'17:00', status:'upcoming',  has_sprint:false, total_laps:57 },
  { id:'r22', round:22, name:'Abu Dhabi Grand Prix',       location:'Yas Marina',      country:'UAE',            race_date:'2026-12-06', race_time:'14:00', status:'upcoming',  has_sprint:false, total_laps:58 },
];

function buildRaceResultForScoring(raceId) {
  const idx = parseInt(raceId.substring(1)) - 1;
  const entry = VERIFIED_RESULTS[idx];
  if (!entry) return null;
  
  const classificationRaw = entry[0];
  const fl = entry[1];
  const dnfs = entry[2];
  const dnss = entry[3];
  const sprintRaw = entry[4];
  
  const classification = classificationRaw
    .map(c => ({ position: c.p, driverId: c.d, time: '', gap: '', points: c.pts, status: c.s === 'finished' ? 'finished' : c.s === 'retired' ? 'dnf' : c.s }))
    .sort((a, b) => a.position - b.position);
  
  const sprintClassification = sprintRaw
    ? sprintRaw.map(s => ({ position: s.p, driverId: s.d, time: '', gap: '', points: s.pts, status: 'finished' }))
    : null;
  
  return { classification, fastestLapDriverId: fl, dnfDriverIds: dnfs, dnsDriverIds: dnss, sprintClassification };
}

function isDnf(s) { return ['dnf','retired','ret','did not finish','did_not_finish'].includes((s||'').trim().toLowerCase()); }
function isDns(s) { return ['dns','did not start','did_not_start'].includes((s||'').trim().toLowerCase()); }

function computeGpScore(top10, fastestLap, dnfPick, result) {
  let posPts = 0;
  const scored = new Set();
  const resultTop10 = result.classification
    .filter(e => e.position <= 10)
    .sort((a,b) => a.position - b.position)
    .map(e => e.driverId);
  
  for (let i = 0; i < (top10||[]).length && i < 10; i++) {
    const pred = top10[i];
    if (!pred) continue;
    if (scored.has(pred)) continue;
    scored.add(pred);
    if (pred === resultTop10[i]) posPts += F1_POINTS[i];
  }

  let flPts = 0;
  if (fastestLap && fastestLap === result.fastestLapDriverId) flPts = FASTEST_LAP_BONUS;

  let dnfPts = 0;
  const dnsIds = new Set(result.dnsDriverIds || []);
  for (const e of result.classification) { if (isDns(e.status)) dnsIds.add(e.driverId); }
  const dnfIds = new Set();
  for (const e of result.classification) { if (isDnf(e.status) && !dnsIds.has(e.driverId)) dnfIds.add(e.driverId); }
  for (const d of (result.dnfDriverIds || [])) { if (!dnsIds.has(d)) dnfIds.add(d); }

  if (!dnfPick && dnfIds.size === 0) dnfPts = DNF_BONUS;
  else if (dnfPick && dnsIds.has(dnfPick)) { /* DNS = 0 */ }
  else if (dnfPick && dnfIds.has(dnfPick)) dnfPts = DNF_BONUS;

  return { gp: posPts + flPts + dnfPts, posPts, flPts, dnfPts };
}

function computeSprintScore(sprintTop8, sprintResult) {
  if (!sprintResult || sprintResult.length === 0) return 0;
  let posPts = 0;
  const scored = new Set();
  const resultTop8 = sprintResult
    .filter(e => e.position <= 8)
    .sort((a,b) => a.position - b.position)
    .map(e => e.driverId);
  
  for (let i = 0; i < (sprintTop8||[]).length && i < 8; i++) {
    const pred = sprintTop8[i];
    if (!pred) continue;
    if (scored.has(pred)) continue;
    scored.add(pred);
    if (pred === resultTop8[i]) posPts += SPRINT_POINTS[i];
  }
  return posPts;
}

async function main() {
  const client = new Client({
    host: HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD,
    database: DB_NAME, ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PG.');

    // 1. Add needed columns to race_results
    await client.query(`ALTER TABLE race_results ADD COLUMN IF NOT EXISTS dns_driver_ids text[] DEFAULT '{}'`);
    await client.query(`ALTER TABLE race_results ADD COLUMN IF NOT EXISTS sprint_classification jsonb`);
    console.log('1. Added race_results columns (dns_driver_ids, sprint_classification).');

    // 2. Update the races table to match app numbering
    // First, temporarily handle the FK: delete all rows in tables that reference races via FK
    console.log('2. Updating races table...');
    
    // Drop the FK on user_predictions temporarily
    await client.query(`ALTER TABLE user_predictions DROP CONSTRAINT IF EXISTS user_predictions_race_id_fkey`);
    
    // Delete all existing races
    await client.query(`DELETE FROM races`);
    
    // Insert corrected races
    for (const r of UPDATED_RACES) {
      await client.query(
        `INSERT INTO races (id, round, name, location, country, race_date, race_time, status, has_sprint, total_laps)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET
         round=$2, name=$3, location=$4, country=$5, race_date=$6, race_time=$7, status=$8, has_sprint=$9, total_laps=$10`,
        [r.id, r.round, r.name, r.location, r.country, r.race_date, r.race_time, r.status, r.has_sprint, r.total_laps]
      );
    }
    console.log(`   Inserted ${UPDATED_RACES.length} races.`);
    
    // Re-add the FK
    await client.query(`
      ALTER TABLE user_predictions 
      ADD CONSTRAINT user_predictions_race_id_fkey 
      FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
    `);
    console.log('   FK restored.');

    // 3. Truncate and repopulate race_results
    console.log('3. Populating race_results...');
    await client.query(`DELETE FROM race_results`);
    
    for (let i = 0; i < 7; i++) {
      const raceId = `r0${i+1}`;
      const rr = buildRaceResult(i, raceId);
      await client.query(
        `INSERT INTO race_results (race_id, classification, fastest_lap_driver_id, dnf_driver_ids, dns_driver_ids, sprint_classification)
         VALUES ($1, $2::jsonb, $3, $4, $5, $6::jsonb)`,
        [rr.race_id, rr.classification, rr.fastest_lap_driver_id, rr.dnf_driver_ids, rr.dns_driver_ids, rr.sprint_classification]
      );
    }
    console.log('   Populated 7 race results.');

    // 4. Recompute points for all user_predictions
    console.log('4. Recomputing points...');
    const { rows: predictions } = await client.query(
      `SELECT id, user_id, race_id, username, predicted_top10, predicted_fastest_lap, predicted_dnf,
              points_earned, predicted_sprint_top8, sprint_points_earned
       FROM user_predictions ORDER BY user_id, race_id`
    );
    console.log(`   Found ${predictions.length} predictions.`);

    let fixedCount = 0;
    for (const row of predictions) {
      const result = buildRaceResultForScoring(row.race_id);
      if (!result) {
        console.log(`   SKIP ${row.username} ${row.race_id} - no race result`);
        continue;
      }

      const gpScore = computeGpScore(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result);
      let sprintScore = 0;
      if (row.predicted_sprint_top8 && row.predicted_sprint_top8.length > 0 && result.sprintClassification) {
        sprintScore = computeSprintScore(row.predicted_sprint_top8, result.sprintClassification);
      }

      const correctGp = gpScore.gp;
      const correctSprint = sprintScore;
      const dbGp = row.points_earned || 0;
      const dbSprint = row.sprint_points_earned || 0;

      if (correctGp !== dbGp || correctSprint !== dbSprint) {
        const status = correctGp !== dbGp ? `GP ${dbGp}→${correctGp}` : '';
        const sprintStatus = correctSprint !== dbSprint ? ` Sprint ${dbSprint}→${correctSprint}` : '';
        console.log(`   FIX ${row.username} ${row.race_id}: ${status}${sprintStatus} (P:${gpScore.posPts} FL:${gpScore.flPts} DNF:${gpScore.dnfPts})`);
        
        await client.query(
          `UPDATE user_predictions SET points_earned = $1, sprint_points_earned = $2 WHERE id = $3`,
          [correctGp, correctSprint, row.id]
        );
        fixedCount++;
      }
    }
    console.log(`   Fixed ${fixedCount} rows.`);

    // 5. Update profiles.total_points
    console.log('5. Updating profiles.total_points...');
    const { rows: totals } = await client.query(`
      SELECT up.user_id, 
             COALESCE(SUM(up.points_earned),0) + COALESCE(SUM(up.sprint_points_earned),0) as total
      FROM user_predictions up
      GROUP BY up.user_id
    `);

    for (const t of totals) {
      await client.query(
        `UPDATE profiles SET total_points = $1 WHERE id = $2`,
        [parseInt(t.total), t.user_id]
      );
      console.log(`   Profile ${t.user_id.substring(0,12)}: total_points = ${t.total}`);
    }
    
    // Also update admin test account to 0
    await client.query(`UPDATE profiles SET total_points = 0 WHERE id = 'ec85e5ec-edca-4196-91a6-56b19bfff6c7'`);

    // 6. Verify leaderboard
    console.log('\n6. Final Leaderboard:');
    const { rows: leaderboard } = await client.query(`
      SELECT up.user_id, MIN(up.display_name) as display_name, MIN(up.username) as username,
             COALESCE(SUM(up.points_earned),0) + COALESCE(SUM(up.sprint_points_earned),0) as total,
             COUNT(*) as race_count
      FROM user_predictions up
      JOIN profiles p ON p.id = up.user_id
      WHERE p.username != 'admin'
      GROUP BY up.user_id
      ORDER BY total DESC
    `);
    for (const l of leaderboard) {
      console.log(`   ${l.display_name || l.username} (${l.user_id.substring(0,12)}): ${l.total} pts across ${l.race_count} races`);
    }

    console.log('\n=== DONE ===');
    await client.end();
  } catch(e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    if (client) await client.end();
    process.exit(1);
  }
}

main();
