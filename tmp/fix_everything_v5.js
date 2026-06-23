// Fix everything via Supabase REST API
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://fxwgbpassouaddakgyus.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8'
);

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// Verified 2026 results from Jolpica API (June 23 2026)
// Format: { classification: [...], fastestLapDriverId, dnfDriverIds, sprintClassification }
const RACE_RESULTS = {
  r01: {
    classification: [
      {position:1,driverId:'RUS',points:25,status:'finished'},{position:2,driverId:'ANT',points:18,status:'finished'},{position:3,driverId:'LEC',points:15,status:'finished'},{position:4,driverId:'HAM',points:12,status:'finished'},{position:5,driverId:'NOR',points:10,status:'finished'},{position:6,driverId:'VER',points:8,status:'finished'},{position:7,driverId:'BEA',points:6,status:'finished'},{position:8,driverId:'LIN',points:4,status:'finished'},{position:9,driverId:'BOR',points:2,status:'finished'},{position:10,driverId:'GAS',points:1,status:'finished'},{position:11,driverId:'OCO',points:0,status:'finished'},{position:12,driverId:'ALB',points:0,status:'finished'},{position:13,driverId:'LAW',points:0,status:'finished'},{position:14,driverId:'COL',points:0,status:'finished'},{position:15,driverId:'SAI',points:0,status:'finished'},{position:16,driverId:'PER',points:0,status:'finished'},{position:17,driverId:'STR',points:0,status:'dnf'},{position:18,driverId:'ALO',points:0,status:'dnf'},{position:19,driverId:'BOT',points:0,status:'dnf'},{position:20,driverId:'HAD',points:0,status:'dnf'},{position:21,driverId:'PIA',points:0,status:'dns'},{position:22,driverId:'HUL',points:0,status:'dns'}
    ], fastestLapDriverId:'VER', dnfDriverIds:['STR','ALO','BOT','HAD'], sprintClassification:null
  },
  r02: {
    classification: [
      {position:1,driverId:'ANT',points:25,status:'finished'},{position:2,driverId:'RUS',points:18,status:'finished'},{position:3,driverId:'HAM',points:15,status:'finished'},{position:4,driverId:'LEC',points:12,status:'finished'},{position:5,driverId:'BEA',points:10,status:'finished'},{position:6,driverId:'GAS',points:8,status:'finished'},{position:7,driverId:'LAW',points:6,status:'finished'},{position:8,driverId:'HAD',points:4,status:'finished'},{position:9,driverId:'SAI',points:2,status:'finished'},{position:10,driverId:'COL',points:1,status:'finished'},{position:11,driverId:'HUL',points:0,status:'finished'},{position:12,driverId:'LIN',points:0,status:'finished'},{position:13,driverId:'BOT',points:0,status:'finished'},{position:14,driverId:'OCO',points:0,status:'finished'},{position:15,driverId:'PER',points:0,status:'finished'},{position:16,driverId:'VER',points:0,status:'dnf'},{position:17,driverId:'ALO',points:0,status:'dnf'},{position:18,driverId:'STR',points:0,status:'dnf'},{position:19,driverId:'PIA',points:0,status:'dns'},{position:20,driverId:'NOR',points:0,status:'dns'},{position:21,driverId:'BOR',points:0,status:'dns'},{position:22,driverId:'ALB',points:0,status:'dns'}
    ], fastestLapDriverId:'ANT', dnfDriverIds:['VER','ALO','STR'],
    sprintClassification: [
      {position:1,driverId:'RUS',points:8,status:'finished'},{position:2,driverId:'LEC',points:7,status:'finished'},{position:3,driverId:'HAM',points:6,status:'finished'},{position:4,driverId:'NOR',points:5,status:'finished'},{position:5,driverId:'ANT',points:4,status:'finished'},{position:6,driverId:'PIA',points:3,status:'finished'},{position:7,driverId:'LAW',points:2,status:'finished'},{position:8,driverId:'BEA',points:1,status:'finished'}
    ]
  },
  r03: {
    classification: [
      {position:1,driverId:'ANT',points:25,status:'finished'},{position:2,driverId:'PIA',points:18,status:'finished'},{position:3,driverId:'LEC',points:15,status:'finished'},{position:4,driverId:'RUS',points:12,status:'finished'},{position:5,driverId:'NOR',points:10,status:'finished'},{position:6,driverId:'HAM',points:8,status:'finished'},{position:7,driverId:'GAS',points:6,status:'finished'},{position:8,driverId:'VER',points:4,status:'finished'},{position:9,driverId:'LAW',points:2,status:'finished'},{position:10,driverId:'OCO',points:1,status:'finished'},{position:11,driverId:'HUL',points:0,status:'finished'},{position:12,driverId:'HAD',points:0,status:'finished'},{position:13,driverId:'BOR',points:0,status:'finished'},{position:14,driverId:'LIN',points:0,status:'finished'},{position:15,driverId:'SAI',points:0,status:'finished'},{position:16,driverId:'COL',points:0,status:'finished'},{position:17,driverId:'PER',points:0,status:'finished'},{position:18,driverId:'ALO',points:0,status:'finished'},{position:19,driverId:'BOT',points:0,status:'finished'},{position:20,driverId:'ALB',points:0,status:'finished'},{position:21,driverId:'STR',points:0,status:'dnf'},{position:22,driverId:'BEA',points:0,status:'dnf'}
    ], fastestLapDriverId:'ANT', dnfDriverIds:['STR','BEA'], sprintClassification:null
  },
  r04: {
    classification: [
      {position:1,driverId:'ANT',points:25,status:'finished'},{position:2,driverId:'NOR',points:18,status:'finished'},{position:3,driverId:'PIA',points:15,status:'finished'},{position:4,driverId:'RUS',points:12,status:'finished'},{position:5,driverId:'VER',points:10,status:'finished'},{position:6,driverId:'HAM',points:8,status:'finished'},{position:7,driverId:'COL',points:6,status:'finished'},{position:8,driverId:'LEC',points:4,status:'finished'},{position:9,driverId:'SAI',points:2,status:'finished'},{position:10,driverId:'ALB',points:1,status:'finished'},{position:11,driverId:'BEA',points:0,status:'finished'},{position:12,driverId:'BOR',points:0,status:'finished'},{position:13,driverId:'OCO',points:0,status:'finished'},{position:14,driverId:'LIN',points:0,status:'finished'},{position:15,driverId:'ALO',points:0,status:'finished'},{position:16,driverId:'PER',points:0,status:'finished'},{position:17,driverId:'STR',points:0,status:'finished'},{position:18,driverId:'BOT',points:0,status:'finished'},{position:19,driverId:'HUL',points:0,status:'dnf'},{position:20,driverId:'LAW',points:0,status:'dnf'},{position:21,driverId:'GAS',points:0,status:'dnf'},{position:22,driverId:'HAD',points:0,status:'dnf'}
    ], fastestLapDriverId:'NOR', dnfDriverIds:['HUL','LAW','GAS','HAD'],
    sprintClassification: [
      {position:1,driverId:'NOR',points:8,status:'finished'},{position:2,driverId:'PIA',points:7,status:'finished'},{position:3,driverId:'LEC',points:6,status:'finished'},{position:4,driverId:'RUS',points:5,status:'finished'},{position:5,driverId:'VER',points:4,status:'finished'},{position:6,driverId:'ANT',points:3,status:'finished'},{position:7,driverId:'HAM',points:2,status:'finished'},{position:8,driverId:'GAS',points:1,status:'finished'}
    ]
  },
  r05: {
    classification: [
      {position:1,driverId:'ANT',points:25,status:'finished'},{position:2,driverId:'HAM',points:18,status:'finished'},{position:3,driverId:'VER',points:15,status:'finished'},{position:4,driverId:'LEC',points:12,status:'finished'},{position:5,driverId:'HAD',points:10,status:'finished'},{position:6,driverId:'COL',points:8,status:'finished'},{position:7,driverId:'LAW',points:6,status:'finished'},{position:8,driverId:'GAS',points:4,status:'finished'},{position:9,driverId:'SAI',points:2,status:'finished'},{position:10,driverId:'BEA',points:1,status:'finished'},{position:11,driverId:'PIA',points:0,status:'finished'},{position:12,driverId:'HUL',points:0,status:'finished'},{position:13,driverId:'BOR',points:0,status:'finished'},{position:14,driverId:'OCO',points:0,status:'finished'},{position:15,driverId:'STR',points:0,status:'finished'},{position:16,driverId:'BOT',points:0,status:'finished'},{position:17,driverId:'PER',points:0,status:'dnf'},{position:18,driverId:'NOR',points:0,status:'dnf'},{position:19,driverId:'RUS',points:0,status:'dnf'},{position:20,driverId:'ALO',points:0,status:'dnf'},{position:21,driverId:'ALB',points:0,status:'dnf'},{position:22,driverId:'LIN',points:0,status:'dns'}
    ], fastestLapDriverId:'ANT', dnfDriverIds:['PER','NOR','RUS','ALO','ALB'],
    sprintClassification: [
      {position:1,driverId:'RUS',points:8,status:'finished'},{position:2,driverId:'NOR',points:7,status:'finished'},{position:3,driverId:'ANT',points:6,status:'finished'},{position:4,driverId:'PIA',points:5,status:'finished'},{position:5,driverId:'LEC',points:4,status:'finished'},{position:6,driverId:'HAM',points:3,status:'finished'},{position:7,driverId:'VER',points:2,status:'finished'},{position:8,driverId:'LIN',points:1,status:'finished'}
    ]
  },
  r06: {
    classification: [
      {position:1,driverId:'ANT',points:25,status:'finished'},{position:2,driverId:'HAM',points:18,status:'finished'},{position:3,driverId:'GAS',points:15,status:'finished'},{position:4,driverId:'HAD',points:12,status:'finished'},{position:5,driverId:'PIA',points:10,status:'finished'},{position:6,driverId:'LAW',points:8,status:'finished'},{position:7,driverId:'LIN',points:6,status:'finished'},{position:8,driverId:'ALB',points:4,status:'finished'},{position:9,driverId:'OCO',points:2,status:'finished'},{position:10,driverId:'ALO',points:1,status:'finished'},{position:11,driverId:'BOR',points:0,status:'finished'},{position:12,driverId:'RUS',points:0,status:'finished'},{position:13,driverId:'HUL',points:0,status:'finished'},{position:14,driverId:'COL',points:0,status:'finished'},{position:15,driverId:'PER',points:0,status:'finished'},{position:16,driverId:'SAI',points:0,status:'dnf'},{position:17,driverId:'LEC',points:0,status:'dnf'},{position:18,driverId:'STR',points:0,status:'dnf'},{position:19,driverId:'NOR',points:0,status:'dnf'},{position:20,driverId:'BEA',points:0,status:'dnf'},{position:21,driverId:'BOT',points:0,status:'dnf'},{position:22,driverId:'VER',points:0,status:'dnf'}
    ], fastestLapDriverId:'ANT', dnfDriverIds:['SAI','LEC','STR','NOR','BEA','BOT','VER'], sprintClassification:null
  },
  r07: {
    // NOTE: ALB P18 was LAPPED (finished) - VERIFIED against Jolpica API
    classification: [
      {position:1,driverId:'HAM',points:25,status:'finished'},{position:2,driverId:'RUS',points:18,status:'finished'},{position:3,driverId:'NOR',points:15,status:'finished'},{position:4,driverId:'VER',points:12,status:'finished'},{position:5,driverId:'PIA',points:10,status:'finished'},{position:6,driverId:'HAD',points:8,status:'finished'},{position:7,driverId:'GAS',points:6,status:'finished'},{position:8,driverId:'LAW',points:4,status:'finished'},{position:9,driverId:'LIN',points:2,status:'finished'},{position:10,driverId:'COL',points:1,status:'finished'},{position:11,driverId:'BOR',points:0,status:'finished'},{position:12,driverId:'SAI',points:0,status:'finished'},{position:13,driverId:'OCO',points:0,status:'finished'},{position:14,driverId:'PER',points:0,status:'finished'},{position:15,driverId:'LEC',points:0,status:'dnf'},{position:16,driverId:'ANT',points:0,status:'dnf'},{position:17,driverId:'BEA',points:0,status:'dnf'},{position:18,driverId:'ALB',points:0,status:'finished'},{position:19,driverId:'ALO',points:0,status:'dnf'},{position:20,driverId:'HUL',points:0,status:'dnf'},{position:21,driverId:'BOT',points:0,status:'dnf'},{position:22,driverId:'STR',points:0,status:'dnf'}
    ], fastestLapDriverId:'HAM', dnfDriverIds:['LEC','ANT','BEA','ALO','HUL','BOT','STR'], sprintClassification:null
  },
};

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
  const dnsIds = new Set();
  const dnfIds = new Set();
  for (const e of result.classification) {
    if (isDns(e.status)) dnsIds.add(e.driverId);
    else if (isDnf(e.status)) dnfIds.add(e.driverId);
  }
  // Also include dnfDriverIds list
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
  console.log('=== FIX EVERYTHING v5 ===\n');

  // 1. Populate race_results using existing columns
  console.log('1. Populating race_results...');
  
  // Delete existing
  const { data: existing } = await supabase.from('race_results').select('race_id');
  if (existing && existing.length > 0) {
    console.log(`   Clearing ${existing.length} existing race_results...`);
    for (const r of existing) {
      await supabase.from('race_results').delete().eq('race_id', r.race_id);
    }
  }

  for (const [raceId, result] of Object.entries(RACE_RESULTS)) {
    const { error } = await supabase.from('race_results').insert({
      race_id: raceId,
      classification: result.classification,
      fastest_lap_driver_id: result.fastestLapDriverId,
      dnf_driver_ids: result.dnfDriverIds,
    });
    if (error) {
      console.log(`   ERROR inserting ${raceId}: ${error.message} (code: ${error.code}, details: ${error.details})`);
    } else {
      console.log(`   Inserted ${raceId}: ${result.classification.length} entries, FL=${result.fastestLapDriverId}, DNFs=${result.dnfDriverIds.length}`);
    }
  }
  console.log('   Done.');

  // 2. Recompute all points
  console.log('\n2. Recomputing points...');
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

    const curGp = row.points_earned || 0;
    const curSp = row.sprint_points_earned || 0;

    if (gpScore.total !== curGp || sprintScore !== curSp) {
      console.log(`   FIX ${row.username} ${row.race_id}: GP ${curGp}→${gpScore.total} Sprint ${curSp}→${sprintScore} (P:${gpScore.posPts} FL:${gpScore.flPts} DNF:${gpScore.dnfPts}/${result.dnfDriverIds.length} dnfs)`);
      
      const { error } = await supabase
        .from('user_predictions')
        .update({ points_earned: gpScore.total, sprint_points_earned: sprintScore })
        .eq('id', row.id);
      if (error) console.log(`      ERROR updating: ${error.message}`);
      else fixedCount++;
    } else {
      console.log(`   OK  ${row.username} ${row.race_id}: GP ${gpScore.total} Sprint ${sprintScore}`);
    }
  }
  console.log(`   Fixed ${fixedCount} rows.`);

  // 3. Update profiles.total_points
  console.log('\n3. Updating profile totals...');
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
    if (error) console.log(`   ERROR: ${error.message}`);
    else console.log(`   ${userId.substring(0,12)}: ${total} pts`);
  }

  // Reset admin
  await supabase.from('profiles').update({ total_points: 0 }).eq('id', 'ec85e5ec-edca-4196-91a6-56b19bfff6c7');

  // 4. Final leaderboard
  console.log('\n4. === FINAL LEADERBOARD ===');
  const { data: finalPreds } = await supabase
    .from('user_predictions')
    .select('user_id, username, display_name, points_earned, sprint_points_earned, race_id')
    .order('user_id');
  
  const lb = {};
  for (const p of (finalPreds || [])) {
    if (!lb[p.user_id]) lb[p.user_id] = { name: p.display_name || p.username, total: 0 };
    lb[p.user_id].total += (p.points_earned || 0) + (p.sprint_points_earned || 0);
  }

  const sorted = Object.entries(lb).filter(([uid]) => uid !== 'ec85e5ec-edca-4196-91a6-56b19bfff6c7').sort((a,b) => b[1].total - a[1].total);
  let rank = 0;
  for (const [uid, info] of sorted) {
    rank++;
    console.log(`#${rank} ${info.name} (${uid.substring(0,12)}): ${info.total} pts`);
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
