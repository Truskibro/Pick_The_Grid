/**
 * FIX SUPABASE WITH SERVICE ROLE KEY
 * This bypasses RLS and can update any row.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

function norm(s) { return (s || '').trim().toUpperCase(); }

function calcMainPoints(raceResult, top10, fl, dnf) {
  if (!raceResult || !raceResult.classification || raceResult.classification.length === 0) return 0;
  let pts = 0;
  const scored = new Set();
  const resultTop10 = raceResult.classification.filter(e => e.position <= 10).sort((a,b) => a.position - b.position);
  for (let i = 0; i < Math.min(top10.length, 10); i++) {
    const p = norm(top10[i]);
    const a = norm(resultTop10[i]?.driverId || '');
    if (!p || scored.has(p)) continue;
    scored.add(p);
    if (p === a) pts += F1_POINTS[i];
  }
  if (norm(fl) === norm(raceResult.fastest_lap_driver_id)) pts += 1;
  const pDnf = norm(dnf);
  const dnsSet = new Set((raceResult.dns_driver_ids || []).map(norm));
  const dnfSet = new Set();
  for (const e of raceResult.classification) {
    const did = norm(e.driverId);
    if (dnsSet.has(did)) continue;
    if (['dnf','retired','ret'].includes((e.status||'').trim().toLowerCase())) dnfSet.add(did);
  }
  for (const did of (raceResult.dnf_driver_ids || [])) { const nd = norm(did); if (!dnsSet.has(nd)) dnfSet.add(nd); }
  if (!pDnf && dnfSet.size === 0) pts += 10;
  else if (pDnf && !dnsSet.has(pDnf) && dnfSet.has(pDnf)) pts += 10;
  return pts;
}

function calcSprintPoints(sprintClass, sprintTop8) {
  if (!sprintClass || sprintClass.length === 0 || sprintTop8.length === 0) return 0;
  let pts = 0;
  const scored = new Set();
  const resultTop8 = sprintClass.filter(e => e.position <= 8).sort((a,b) => a.position - b.position);
  for (let i = 0; i < Math.min(sprintTop8.length, 8); i++) {
    const p = norm(sprintTop8[i]);
    const a = norm(resultTop8[i]?.driverId || '');
    if (!p || scored.has(p)) continue;
    scored.add(p);
    if (p === a) pts += SPRINT_POINTS[i];
  }
  return pts;
}

// Data from seed-predictions.ts (matches spreadsheet)
const SEED = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': {
    r01: { top10: ['VER','RUS','ANT','PIA','LEC','NOR','HAM','HAD','LAW','SAI'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','BEA','GAS'], fl: 'RUS', dnf: 'ALO', sprint: ['RUS','ANT','HAM','NOR','LEC','PIA','VER','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','HAM','NOR','VER','HAD','GAS','LIN'], fl: 'ANT', dnf: 'BOT', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','HAM','PIA','HAD','GAS','BEA'], fl: 'VER', dnf: 'COL', sprint: ['ANT','NOR','PIA','RUS','LEC','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','PIA','NOR','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'ANT', dnf: 'COL', sprint: ['ANT','RUS','NOR','PIA','LEC','VER','HAM','HAD'] },
    r06: { top10: ['ANT','VER','RUS','LEC','HAM','PIA','HAD','NOR','GAS','COL'], fl: 'ANT', dnf: 'LAW', sprint: [] },
    r07: { top10: ['ANT','RUS','HAM','NOR','VER','PIA','LEC','HAD','HUL','GAS'], fl: 'ANT', dnf: 'LAW', sprint: [] },
  },
  '652154af-dc27-47b5-aa79-25903b9c4a1b': {
    r01: { top10: ['ANT','RUS','LEC','PIA','HAD','VER','NOR','HAM','LAW','HUL'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','VER','NOR','HAD','HUL','BEA'], fl: 'RUS', dnf: 'STR', sprint: ['ANT','RUS','NOR','HAM','VER','PIA','LEC','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','NOR','VER','HAM','GAS','HAD','HUL'], fl: 'PIA', dnf: 'PER', sprint: [] },
    r04: { top10: ['PIA','VER','NOR','ANT','LEC','RUS','HAM','COL','SAI','GAS'], fl: null, dnf: 'STR', sprint: ['NOR','LEC','ANT','PIA','VER','RUS','HAM','COL'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'STR', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['ANT','VER','HAM','LEC','HAD','PIA','RUS','NOR','GAS','SAI'], fl: 'ANT', dnf: 'STR', sprint: [] },
    r07: { top10: ['HAM','RUS','VER','LEC','PIA','HAD','GAS','LAW','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: [] },
  },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': {
    r01: { top10: ['RUS','ANT','PIA','LEC','NOR','HAM','HAD','VER','LAW','LIN'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','NOR','VER','HAD','BEA','GAS'], fl: 'RUS', dnf: 'PER', sprint: ['RUS','ANT','HAM','LEC','LEC','VER','NOR','HAD'] },
    r03: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','PIA','HAM','GAS','HAD','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','NOR','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'NOR', dnf: 'BOT', sprint: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD'] },
    r06: { top10: ['ANT','VER','LEC','HAM','RUS','PIA','NOR','GAS','LAW','ALB'], fl: 'ANT', dnf: 'HAD', sprint: [] },
    r07: { top10: ['RUS','ANT','HAM','VER','LEC','PIA','HAD','LAW','SAI','LIN'], fl: 'ANT', dnf: null, sprint: [] },
  },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': {
    r01: { top10: ['RUS','ANT','LEC','PIA','HAD','HAM','NOR','VER','LAW','HUL'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','HAM','LEC','NOR','PIA','VER','HAD','GAS','HUL'], fl: 'RUS', dnf: 'ALB', sprint: ['RUS','ANT','HAM','NOR','LEC','VER','PIA','GAS'] },
    r03: { top10: ['ANT','RUS','LEC','HAM','PIA','NOR','HAD','VER','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','LEC','PIA','HAM','GAS','HUL'], fl: 'VER', dnf: null, sprint: ['NOR','ANT','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['ANT','RUS','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['VER','ANT','HAM','LEC','HAD','RUS','PIA','NOR','GAS','LAW'], fl: 'VER', dnf: 'BOR', sprint: [] },
    r07: { top10: ['RUS','HAM','ANT','VER','NOR','LEC','HAD','PIA','HUL','LAW'], fl: 'RUS', dnf: null, sprint: [] },
  },
};

async function main() {
  console.log('Fetching race results and current predictions...\n');
  
  const { data: raceResults } = await supabase.from('race_results').select('*');
  const rrMap = {};
  for (const rr of raceResults) rrMap[rr.race_id] = rr;
  console.log(`Race results: ${raceResults.length} races`);

  const { data: preds } = await supabase.from('user_predictions').select('*');
  console.log(`Predictions: ${preds.length} rows\n`);

  // Compare and fix
  console.log('═══ APPLYING FIXES ═══\n');
  let fixedPicks = 0;
  let fixedPoints = 0;
  const userTotals = {};

  for (const [userId, races] of Object.entries(SEED)) {
    userTotals[userId] = 0;
    
    for (const [raceId, correctPicks] of Object.entries(races)) {
      const sb = preds.find(p => p.user_id === userId && p.race_id === raceId);
      if (!sb) {
        console.log(`  ⚠️  MISSING: ${userId.substring(0,8)} ${raceId}`);
        continue;
      }

      const sbTop10 = sb.predicted_top10 || [];
      const sbSprint = sb.predicted_sprint_top8 || [];
      
      const top10Match = JSON.stringify(correctPicks.top10) === JSON.stringify(sbTop10);
      const sprintMatch = JSON.stringify(correctPicks.sprint) === JSON.stringify(sbSprint);
      const flMatch = correctPicks.fl === sb.predicted_fastest_lap;
      const dnfMatch = correctPicks.dnf === sb.predicted_dnf;

      // Compute correct points from the correct picks
      const rr = rrMap[raceId];
      const correctMain = calcMainPoints(rr, correctPicks.top10, correctPicks.fl, correctPicks.dnf);
      const correctSprint = calcSprintPoints(rr?.sprint_classification || [], correctPicks.sprint);
      
      const storedMain = sb.points_earned || 0;
      const storedSprint = sb.sprint_points_earned || 0;
      const pointsMatch = correctMain === storedMain && correctSprint === storedSprint;

      if (!top10Match || !sprintMatch || !flMatch || !dnfMatch || !pointsMatch) {
        const parts = [];
        if (!top10Match) parts.push('Top10');
        if (!sprintMatch) parts.push('Sprint');
        if (!flMatch) parts.push('FL');
        if (!dnfMatch) parts.push('DNF');
        if (!pointsMatch) parts.push(`Points(${storedMain}/${storedSprint}→${correctMain}/${correctSprint})`);
        
        console.log(`  📝 ${userId.substring(0,8)} ${raceId}: Fixing ${parts.join(', ')}`);

        const { error } = await supabase
          .from('user_predictions')
          .update({
            predicted_top10: correctPicks.top10,
            predicted_fastest_lap: correctPicks.fl,
            predicted_dnf: correctPicks.dnf,
            predicted_sprint_top8: correctPicks.sprint,
            points_earned: correctMain,
            sprint_points_earned: correctSprint,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('race_id', raceId);

        if (error) {
          console.log(`    ❌ FAILED: ${error.message}`);
        } else {
          console.log(`    ✅ Done.`);
          if (!top10Match || !sprintMatch || !flMatch || !dnfMatch) fixedPicks++;
          if (!pointsMatch) fixedPoints++;
        }
      }
      
      userTotals[userId] += correctMain + correctSprint;
    }
  }

  console.log(`\nFixed ${fixedPicks} picks, ${fixedPoints} point values.`);

  // Update profiles
  console.log('\n═══ UPDATING PROFILES ═══');
  for (const [userId, total] of Object.entries(userTotals)) {
    const { error } = await supabase
      .from('profiles')
      .update({ total_points: total })
      .eq('id', userId);
    
    if (error) {
      console.log(`  ❌ ${userId.substring(0,8)}: ${error.message}`);
    } else {
      console.log(`  ✅ ${userId.substring(0,8)}: ${total} pts`);
    }
  }

  // Final verification
  console.log('\n═══ FINAL STATE ═══');
  const { data: finalPreds } = await supabase.from('user_predictions').select('user_id, race_id, points_earned, sprint_points_earned, predicted_top10');
  
  const finalTotals = {};
  for (const p of finalPreds) {
    finalTotals[p.user_id] = (finalTotals[p.user_id] || 0) + (p.points_earned || 0) + (p.sprint_points_earned || 0);
  }

  const { data: finalProfs } = await supabase.from('profiles').select('*').order('total_points', { ascending: false });
  for (const p of finalProfs) {
    const computed = finalTotals[p.id] || 0;
    const match = computed === (p.total_points || 0);
    console.log(`  ${match ? '✅' : '❌'} ${p.display_name || p.username || '?'}: stored=${p.total_points} computed=${computed}`);
  }
  
  // Also show per-race scores for each user
  console.log('\n═══ PER-RACE SCORES ═══');
  for (const p of finalPreds.sort((a,b) => a.user_id.localeCompare(b.user_id) || a.race_id.localeCompare(b.race_id))) {
    const name = p.user_id.substring(0,8);
    const total = (p.points_earned||0) + (p.sprint_points_earned||0);
    console.log(`  ${name} ${p.race_id}: ${p.points_earned} + ${p.sprint_points_earned} = ${total} | P1=${(p.predicted_top10||[])[0] || '?'}`);
  }

  console.log('\n✅ All done.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
