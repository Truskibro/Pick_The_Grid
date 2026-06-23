// Fix everything using Supabase REST API
// Uses bun to run (has supabase-js installed in expo/node_modules)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://fxwgbpassouaddakgyus.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8'
);

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// === Verified 2026 Race Results (Jolpica API verified June 23 2026) ===
// Each entry: [classification, fastestLap, dnfIds, dnsIds, sprintClassification|null]
function makeRaceResult(classArray, fl, dnf, dns, sprint) {
  const classification = classArray.map(c => ({
    position: c.p, driverId: c.d, time: c.t || '', gap: c.g || '',
    points: c.pts, status: c.s
  })).sort((a,b) => a.position - b.position);
  
  const sprintClassification = sprint ? sprint.map(s => ({
    position: s.p, driverId: s.d, time: '', gap: '', points: s.pts, status: 'finished'
  })) : null;
  
  return { classification, fastestLapDriverId: fl, dnfDriverIds: dnf, dnsDriverIds: dns, sprintClassification };
}

const RACE_RESULTS = {
  r01: makeRaceResult(
    [{p:1,d:'RUS',pts:25,s:'finished'},{p:2,d:'ANT',pts:18,s:'finished'},{p:3,d:'LEC',pts:15,s:'finished'},{p:4,d:'HAM',pts:12,s:'finished'},{p:5,d:'NOR',pts:10,s:'finished'},{p:6,d:'VER',pts:8,s:'finished'},{p:7,d:'BEA',pts:6,s:'finished'},{p:8,d:'LIN',pts:4,s:'finished'},{p:9,d:'BOR',pts:2,s:'finished'},{p:10,d:'GAS',pts:1,s:'finished'},{p:11,d:'OCO',pts:0,s:'finished'},{p:12,d:'ALB',pts:0,s:'finished'},{p:13,d:'LAW',pts:0,s:'finished'},{p:14,d:'COL',pts:0,s:'finished'},{p:15,d:'SAI',pts:0,s:'finished'},{p:16,d:'PER',pts:0,s:'finished'},{p:17,d:'STR',pts:0,s:'dnf'},{p:18,d:'ALO',pts:0,s:'dnf'},{p:19,d:'BOT',pts:0,s:'dnf'},{p:20,d:'HAD',pts:0,s:'dnf'},{p:21,d:'PIA',pts:0,s:'dns'},{p:22,d:'HUL',pts:0,s:'dns'}],
    'VER', ['STR','ALO','BOT','HAD'], ['PIA','HUL'], null
  ),
  r02: makeRaceResult(
    [{p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'RUS',pts:18,s:'finished'},{p:3,d:'HAM',pts:15,s:'finished'},{p:4,d:'LEC',pts:12,s:'finished'},{p:5,d:'BEA',pts:10,s:'finished'},{p:6,d:'GAS',pts:8,s:'finished'},{p:7,d:'LAW',pts:6,s:'finished'},{p:8,d:'HAD',pts:4,s:'finished'},{p:9,d:'SAI',pts:2,s:'finished'},{p:10,d:'COL',pts:1,s:'finished'},{p:11,d:'HUL',pts:0,s:'finished'},{p:12,d:'LIN',pts:0,s:'finished'},{p:13,d:'BOT',pts:0,s:'finished'},{p:14,d:'OCO',pts:0,s:'finished'},{p:15,d:'PER',pts:0,s:'finished'},{p:16,d:'VER',pts:0,s:'dnf'},{p:17,d:'ALO',pts:0,s:'dnf'},{p:18,d:'STR',pts:0,s:'dnf'},{p:19,d:'PIA',pts:0,s:'dns'},{p:20,d:'NOR',pts:0,s:'dns'},{p:21,d:'BOR',pts:0,s:'dns'},{p:22,d:'ALB',pts:0,s:'dns'}],
    'ANT', ['VER','ALO','STR'], ['PIA','NOR','BOR','ALB'],
    [{p:1,d:'RUS',pts:8},{p:2,d:'LEC',pts:7},{p:3,d:'HAM',pts:6},{p:4,d:'NOR',pts:5},{p:5,d:'ANT',pts:4},{p:6,d:'PIA',pts:3},{p:7,d:'LAW',pts:2},{p:8,d:'BEA',pts:1}]
  ),
  r03: makeRaceResult(
    [{p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'PIA',pts:18,s:'finished'},{p:3,d:'LEC',pts:15,s:'finished'},{p:4,d:'RUS',pts:12,s:'finished'},{p:5,d:'NOR',pts:10,s:'finished'},{p:6,d:'HAM',pts:8,s:'finished'},{p:7,d:'GAS',pts:6,s:'finished'},{p:8,d:'VER',pts:4,s:'finished'},{p:9,d:'LAW',pts:2,s:'finished'},{p:10,d:'OCO',pts:1,s:'finished'},{p:11,d:'HUL',pts:0,s:'finished'},{p:12,d:'HAD',pts:0,s:'finished'},{p:13,d:'BOR',pts:0,s:'finished'},{p:14,d:'LIN',pts:0,s:'finished'},{p:15,d:'SAI',pts:0,s:'finished'},{p:16,d:'COL',pts:0,s:'finished'},{p:17,d:'PER',pts:0,s:'finished'},{p:18,d:'ALO',pts:0,s:'finished'},{p:19,d:'BOT',pts:0,s:'finished'},{p:20,d:'ALB',pts:0,s:'finished'},{p:21,d:'STR',pts:0,s:'dnf'},{p:22,d:'BEA',pts:0,s:'dnf'}],
    'ANT', ['STR','BEA'], [], null
  ),
  r04: makeRaceResult(
    [{p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'NOR',pts:18,s:'finished'},{p:3,d:'PIA',pts:15,s:'finished'},{p:4,d:'RUS',pts:12,s:'finished'},{p:5,d:'VER',pts:10,s:'finished'},{p:6,d:'HAM',pts:8,s:'finished'},{p:7,d:'COL',pts:6,s:'finished'},{p:8,d:'LEC',pts:4,s:'finished'},{p:9,d:'SAI',pts:2,s:'finished'},{p:10,d:'ALB',pts:1,s:'finished'},{p:11,d:'BEA',pts:0,s:'finished'},{p:12,d:'BOR',pts:0,s:'finished'},{p:13,d:'OCO',pts:0,s:'finished'},{p:14,d:'LIN',pts:0,s:'finished'},{p:15,d:'ALO',pts:0,s:'finished'},{p:16,d:'PER',pts:0,s:'finished'},{p:17,d:'STR',pts:0,s:'finished'},{p:18,d:'BOT',pts:0,s:'finished'},{p:19,d:'HUL',pts:0,s:'dnf'},{p:20,d:'LAW',pts:0,s:'dnf'},{p:21,d:'GAS',pts:0,s:'dnf'},{p:22,d:'HAD',pts:0,s:'dnf'}],
    'NOR', ['HUL','LAW','GAS','HAD'], [],
    [{p:1,d:'NOR',pts:8},{p:2,d:'PIA',pts:7},{p:3,d:'LEC',pts:6},{p:4,d:'RUS',pts:5},{p:5,d:'VER',pts:4},{p:6,d:'ANT',pts:3},{p:7,d:'HAM',pts:2},{p:8,d:'GAS',pts:1}]
  ),
  r05: makeRaceResult(
    [{p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'HAM',pts:18,s:'finished'},{p:3,d:'VER',pts:15,s:'finished'},{p:4,d:'LEC',pts:12,s:'finished'},{p:5,d:'HAD',pts:10,s:'finished'},{p:6,d:'COL',pts:8,s:'finished'},{p:7,d:'LAW',pts:6,s:'finished'},{p:8,d:'GAS',pts:4,s:'finished'},{p:9,d:'SAI',pts:2,s:'finished'},{p:10,d:'BEA',pts:1,s:'finished'},{p:11,d:'PIA',pts:0,s:'finished'},{p:12,d:'HUL',pts:0,s:'finished'},{p:13,d:'BOR',pts:0,s:'finished'},{p:14,d:'OCO',pts:0,s:'finished'},{p:15,d:'STR',pts:0,s:'finished'},{p:16,d:'BOT',pts:0,s:'finished'},{p:17,d:'PER',pts:0,s:'dnf'},{p:18,d:'NOR',pts:0,s:'dnf'},{p:19,d:'RUS',pts:0,s:'dnf'},{p:20,d:'ALO',pts:0,s:'dnf'},{p:21,d:'ALB',pts:0,s:'dnf'},{p:22,d:'LIN',pts:0,s:'dns'}],
    'ANT', ['PER','NOR','RUS','ALO','ALB'], ['LIN'],
    [{p:1,d:'RUS',pts:8},{p:2,d:'NOR',pts:7},{p:3,d:'ANT',pts:6},{p:4,d:'PIA',pts:5},{p:5,d:'LEC',pts:4},{p:6,d:'HAM',pts:3},{p:7,d:'VER',pts:2},{p:8,d:'LIN',pts:1}]
  ),
  r06: makeRaceResult(
    [{p:1,d:'ANT',pts:25,s:'finished'},{p:2,d:'HAM',pts:18,s:'finished'},{p:3,d:'GAS',pts:15,s:'finished'},{p:4,d:'HAD',pts:12,s:'finished'},{p:5,d:'PIA',pts:10,s:'finished'},{p:6,d:'LAW',pts:8,s:'finished'},{p:7,d:'LIN',pts:6,s:'finished'},{p:8,d:'ALB',pts:4,s:'finished'},{p:9,d:'OCO',pts:2,s:'finished'},{p:10,d:'ALO',pts:1,s:'finished'},{p:11,d:'BOR',pts:0,s:'finished'},{p:12,d:'RUS',pts:0,s:'finished'},{p:13,d:'HUL',pts:0,s:'finished'},{p:14,d:'COL',pts:0,s:'finished'},{p:15,d:'PER',pts:0,s:'finished'},{p:16,d:'SAI',pts:0,s:'dnf'},{p:17,d:'LEC',pts:0,s:'dnf'},{p:18,d:'STR',pts:0,s:'dnf'},{p:19,d:'NOR',pts:0,s:'dnf'},{p:20,d:'BEA',pts:0,s:'dnf'},{p:21,d:'BOT',pts:0,s:'dnf'},{p:22,d:'VER',pts:0,s:'dnf'}],
    'ANT', ['SAI','LEC','STR','NOR','BEA','BOT','VER'], [], null
  ),
  r07: makeRaceResult(
    [{p:1,d:'HAM',pts:25,s:'finished'},{p:2,d:'RUS',pts:18,s:'finished'},{p:3,d:'NOR',pts:15,s:'finished'},{p:4,d:'VER',pts:12,s:'finished'},{p:5,d:'PIA',pts:10,s:'finished'},{p:6,d:'HAD',pts:8,s:'finished'},{p:7,d:'GAS',pts:6,s:'finished'},{p:8,d:'LAW',pts:4,s:'finished'},{p:9,d:'LIN',pts:2,s:'finished'},{p:10,d:'COL',pts:1,s:'finished'},{p:11,d:'BOR',pts:0,s:'finished'},{p:12,d:'SAI',pts:0,s:'finished'},{p:13,d:'OCO',pts:0,s:'finished'},{p:14,d:'PER',pts:0,s:'finished'},{p:15,d:'LEC',pts:0,s:'dnf'},{p:16,d:'ANT',pts:0,s:'dnf'},{p:17,d:'BEA',pts:0,s:'dnf'},{p:18,d:'ALB',pts:0,s:'finished'},{p:19,d:'ALO',pts:0,s:'dnf'},{p:20,d:'HUL',pts:0,s:'dnf'},{p:21,d:'BOT',pts:0,s:'dnf'},{p:22,d:'STR',pts:0,s:'dnf'}],
    'HAM', ['LEC','ANT','BEA','ALO','HUL','BOT','STR'], [], null
  ),
};

// Updated races matching f1-data.ts
const UPDATED_RACES = [
  {id:'r01',round:1,name:'Australian Grand Prix',location:'Melbourne',country:'Australia',country_flag:'🇦🇺',race_date:'2026-03-08',race_time:'05:00',status:'completed',has_sprint:false,total_laps:58},
  {id:'r02',round:2,name:'Chinese Grand Prix',location:'Shanghai',country:'China',country_flag:'🇨🇳',race_date:'2026-03-15',race_time:'07:00',status:'completed',has_sprint:true,total_laps:56},
  {id:'r03',round:3,name:'Japanese Grand Prix',location:'Suzuka',country:'Japan',country_flag:'🇯🇵',race_date:'2026-03-29',race_time:'06:00',status:'completed',has_sprint:false,total_laps:53},
  {id:'r04',round:4,name:'Miami Grand Prix',location:'Miami',country:'USA',country_flag:'🇺🇸',race_date:'2026-05-03',race_time:'20:00',status:'completed',has_sprint:true,total_laps:57},
  {id:'r05',round:5,name:'Canadian Grand Prix',location:'Montreal',country:'Canada',country_flag:'🇨🇦',race_date:'2026-05-24',race_time:'18:00',status:'completed',has_sprint:true,total_laps:70},
  {id:'r06',round:6,name:'Monaco Grand Prix',location:'Monte Carlo',country:'Monaco',country_flag:'🇲🇨',race_date:'2026-06-07',race_time:'13:00',status:'completed',has_sprint:false,total_laps:78},
  {id:'r07',round:7,name:'Barcelona Grand Prix',location:'Barcelona',country:'Spain',country_flag:'🇪🇸',race_date:'2026-06-14',race_time:'13:00',status:'completed',has_sprint:false,total_laps:66},
  {id:'r08',round:8,name:'Austrian Grand Prix',location:'Spielberg',country:'Austria',country_flag:'🇦🇹',race_date:'2026-06-28',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:71},
  {id:'r09',round:9,name:'British Grand Prix',location:'Silverstone',country:'United Kingdom',country_flag:'🇬🇧',race_date:'2026-07-05',race_time:'14:00',status:'upcoming',has_sprint:true,total_laps:52},
  {id:'r10',round:10,name:'Belgian Grand Prix',location:'Spa-Francorchamps',country:'Belgium',country_flag:'🇧🇪',race_date:'2026-07-19',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:44},
  {id:'r11',round:11,name:'Hungarian Grand Prix',location:'Budapest',country:'Hungary',country_flag:'🇭🇺',race_date:'2026-07-26',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:70},
  {id:'r12',round:12,name:'Dutch Grand Prix',location:'Zandvoort',country:'Netherlands',country_flag:'🇳🇱',race_date:'2026-08-23',race_time:'13:00',status:'upcoming',has_sprint:true,total_laps:72},
  {id:'r13',round:13,name:'Italian Grand Prix',location:'Monza',country:'Italy',country_flag:'🇮🇹',race_date:'2026-09-06',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:53},
  {id:'r14',round:14,name:'Spanish Grand Prix',location:'Madrid',country:'Spain',country_flag:'🇪🇸',race_date:'2026-09-13',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:66},
  {id:'r15',round:15,name:'Azerbaijan Grand Prix',location:'Baku',country:'Azerbaijan',country_flag:'🇦🇿',race_date:'2026-09-26',race_time:'12:00',status:'upcoming',has_sprint:false,total_laps:51},
  {id:'r16',round:16,name:'Singapore Grand Prix',location:'Marina Bay',country:'Singapore',country_flag:'🇸🇬',race_date:'2026-10-11',race_time:'12:00',status:'upcoming',has_sprint:true,total_laps:62},
  {id:'r17',round:17,name:'United States Grand Prix',location:'Austin',country:'USA',country_flag:'🇺🇸',race_date:'2026-10-25',race_time:'19:00',status:'upcoming',has_sprint:false,total_laps:56},
  {id:'r18',round:18,name:'Mexico City Grand Prix',location:'Mexico City',country:'Mexico',country_flag:'🇲🇽',race_date:'2026-11-01',race_time:'20:00',status:'upcoming',has_sprint:false,total_laps:71},
  {id:'r19',round:19,name:'Brazilian Grand Prix',location:'Interlagos',country:'Brazil',country_flag:'🇧🇷',race_date:'2026-11-08',race_time:'17:00',status:'upcoming',has_sprint:false,total_laps:71},
  {id:'r20',round:20,name:'Las Vegas Grand Prix',location:'Las Vegas',country:'USA',country_flag:'🇺🇸',race_date:'2026-11-22',race_time:'06:00',status:'upcoming',has_sprint:false,total_laps:50},
  {id:'r21',round:21,name:'Qatar Grand Prix',location:'Lusail',country:'Qatar',country_flag:'🇶🇦',race_date:'2026-11-29',race_time:'17:00',status:'upcoming',has_sprint:false,total_laps:57},
  {id:'r22',round:22,name:'Abu Dhabi Grand Prix',location:'Yas Marina',country:'UAE',country_flag:'🇦🇪',race_date:'2026-12-06',race_time:'14:00',status:'upcoming',has_sprint:false,total_laps:58},
];

// Scoring helpers
function isDnf(s) { return ['dnf','retired','ret'].includes((s||'').trim().toLowerCase()); }
function isDns(s) { return ['dns','did not start','did_not_start'].includes((s||'').trim().toLowerCase()); }

function computeGpScore(top10, fastestLap, dnfPick, result) {
  let posPts = 0;
  const scored = new Set();
  const resultTop10 = result.classification
    .filter(e => e.position <= 10)
    .sort((a,b) => a.position - b.position)
    .map(e => e.driverId);
  for (let i = 0; i < (top10||[]).length && i < 10; i++) {
    if (!top10[i] || scored.has(top10[i])) continue;
    scored.add(top10[i]);
    if (top10[i] === resultTop10[i]) posPts += F1_POINTS[i];
  }
  let flPts = (fastestLap && fastestLap === result.fastestLapDriverId) ? FASTEST_LAP_BONUS : 0;
  let dnfPts = 0;
  const dnsIds = new Set(result.dnsDriverIds || []);
  for (const e of result.classification) { if (isDns(e.status)) dnsIds.add(e.driverId); }
  const dnfIds = new Set();
  for (const e of result.classification) { if (isDnf(e.status) && !dnsIds.has(e.driverId)) dnfIds.add(e.driverId); }
  for (const d of (result.dnfDriverIds || [])) { if (!dnsIds.has(d)) dnfIds.add(d); }
  if (!dnfPick && dnfIds.size === 0) dnfPts = DNF_BONUS;
  else if (dnfPick && !dnsIds.has(dnfPick) && dnfIds.has(dnfPick)) dnfPts = DNF_BONUS;
  return { total: posPts + flPts + dnfPts, posPts, flPts, dnfPts };
}

function computeSprintScore(sprintTop8, sprintResult) {
  if (!sprintResult || sprintResult.length === 0 || !sprintTop8 || sprintTop8.length === 0) return 0;
  let posPts = 0;
  const scored = new Set();
  const resultTop8 = sprintResult.filter(e => e.position <= 8).sort((a,b) => a.position - b.position).map(e => e.driverId);
  for (let i = 0; i < sprintTop8.length && i < 8; i++) {
    if (!sprintTop8[i] || scored.has(sprintTop8[i])) continue;
    scored.add(sprintTop8[i]);
    if (sprintTop8[i] === resultTop8[i]) posPts += SPRINT_POINTS[i];
  }
  return posPts;
}

async function main() {
  console.log('=== FIX EVERYTHING v4 ===\n');

  // 1. Update races table (UPDATE each row, keeping same IDs to preserve FKs)
  console.log('1. Updating races table...');
  for (const r of UPDATED_RACES) {
    const { error } = await supabase
      .from('races')
      .upsert({
        id: r.id, round: r.round, name: r.name, location: r.location,
        country: r.country, country_flag: r.country_flag, race_date: r.race_date,
        race_time: r.race_time, status: r.status, has_sprint: r.has_sprint,
        total_laps: r.total_laps
      }, { onConflict: 'id' });
    if (error) console.log(`   ERROR updating ${r.id}: ${error.message}`);
  }
  
  // Remove extra races (r23, r24 that don't exist in the app's 22-race calendar)
  const { error: delErr } = await supabase.from('races').delete().in('id', ['r23','r24']);
  if (delErr) console.log(`   Could not delete r23/r24 (may have FK refs): ${delErr.message}`);
  else console.log('   Removed extra races r23, r24.');
  
  console.log('   Races updated.');

  // 2. Populate race_results
  console.log('2. Populating race_results...');
  
  // Delete existing first
  await supabase.from('race_results').delete().neq('race_id', '__none__');
  
  for (const [raceId, result] of Object.entries(RACE_RESULTS)) {
    const { error } = await supabase.from('race_results').upsert({
      race_id: raceId,
      classification: result.classification,
      fastest_lap_driver_id: result.fastestLapDriverId,
      dnf_driver_ids: result.dnfDriverIds,
      dns_driver_ids: result.dnsDriverIds,
      sprint_classification: result.sprintClassification || null,
    }, { onConflict: 'race_id' });
    if (error) console.log(`   ERROR upserting ${raceId}: ${error.message}`);
  }
  console.log('   Populated 7 race results.');

  // 3. Recompute all points
  console.log('3. Recomputing points...');
  const { data: predictions, error: predErr } = await supabase
    .from('user_predictions')
    .select('*')
    .order('user_id, race_id');
  
  if (predErr) { console.error('Failed to fetch predictions:', predErr.message); return; }
  console.log(`   Found ${predictions.length} predictions.`);

  let fixedCount = 0;
  for (const row of predictions) {
    const result = RACE_RESULTS[row.race_id];
    if (!result) {
      console.log(`   SKIP ${row.username} ${row.race_id} - no result data`);
      continue;
    }

    const gpScore = computeGpScore(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, result);
    let sprintScore = 0;
    if (row.predicted_sprint_top8 && row.predicted_sprint_top8.length > 0 && result.sprintClassification) {
      sprintScore = computeSprintScore(row.predicted_sprint_top8, result.sprintClassification);
    }

    if (gpScore.total !== (row.points_earned || 0) || sprintScore !== (row.sprint_points_earned || 0)) {
      console.log(`   FIX ${row.username} ${row.race_id}: GP ${row.points_earned||0}→${gpScore.total} Sprint ${row.sprint_points_earned||0}→${sprintScore} (P:${gpScore.posPts} FL:${gpScore.flPts} DNF:${gpScore.dnfPts})`);
      
      const { error } = await supabase
        .from('user_predictions')
        .update({ points_earned: gpScore.total, sprint_points_earned: sprintScore })
        .eq('id', row.id);
      if (error) console.log(`      ERROR: ${error.message}`);
      else fixedCount++;
    } else {
      console.log(`   OK  ${row.username} ${row.race_id}: GP ${gpScore.total} Sprint ${sprintScore}`);
    }
  }
  console.log(`   Fixed ${fixedCount} rows.`);

  // 4. Update profiles.total_points
  console.log('4. Updating profiles.total_points...');
  
  // Get fresh totals after recompute
  const { data: freshPreds } = await supabase
    .from('user_predictions')
    .select('user_id, points_earned, sprint_points_earned');
  
  const userTotals = {};
  for (const p of (freshPreds || [])) {
    if (!userTotals[p.user_id]) userTotals[p.user_id] = 0;
    userTotals[p.user_id] += (p.points_earned || 0) + (p.sprint_points_earned || 0);
  }

  for (const [userId, total] of Object.entries(userTotals)) {
    const { error } = await supabase
      .from('profiles')
      .update({ total_points: total })
      .eq('id', userId);
    if (error) console.log(`   ERROR updating profile ${userId}: ${error.message}`);
    else console.log(`   Profile ${userId.substring(0,12)}: ${total} pts`);
  }

  // Reset admin test account
  await supabase.from('profiles').update({ total_points: 0 }).eq('id', 'ec85e5ec-edca-4196-91a6-56b19bfff6c7');

  // 5. Print final leaderboard
  console.log('\n5.=== FINAL LEADERBOARD ===');
  const { data: finalPreds } = await supabase
    .from('user_predictions')
    .select('user_id, username, display_name, points_earned, sprint_points_earned, race_id')
    .order('user_id');
  
  const leaderboard = {};
  for (const p of (finalPreds || [])) {
    if (!leaderboard[p.user_id]) {
      leaderboard[p.user_id] = { name: p.display_name || p.username, total: 0, races: {} };
    }
    leaderboard[p.user_id].total += (p.points_earned || 0) + (p.sprint_points_earned || 0);
    leaderboard[p.user_id].races[p.race_id] = { gp: p.points_earned || 0, sp: p.sprint_points_earned || 0 };
  }

  const sorted = Object.entries(leaderboard).sort((a,b) => b[1].total - a[1].total);
  let rank = 0;
  for (const [uid, info] of sorted) {
    rank++;
    console.log(`#${rank} ${info.name} (${uid.substring(0,12)}): ${info.total} pts`);
    for (const [rid, pts] of Object.entries(info.races).sort()) {
      console.log(`     ${rid}: GP ${pts.gp} + Sprint ${pts.sp}`);
    }
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
