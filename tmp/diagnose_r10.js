// Investigate r10 (most recent completed race) for Carlos and Whitney.
// Fetch: race_results row, both users' predictions, then compute points by hand
// using the SAME logic as the Supabase scoring function, and compare.
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const BASE = 'https://fxwgbpassouaddakgyus.supabase.co/rest/v1';
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

const CARLOS = 'e11ea4f5-2ba4-4241-9791-b4b6a560534b';
const WHITNEY = '652154af-dc27-47b5-aa79-25903b9c4a1b';

const F1_RACE = [25,18,15,12,10,8,6,4,2,1];
const F1_SPRINT = [8,7,6,5,4,3,2,1];

function scoreRace(pred, results) {
  const actualTop = results.race_top10 || [];
  const actualFl = results.fastest_lap_driver_id;
  const actualDnf = results.dnf_driver_ids || [];
  const actualDns = results.dns_driver_ids || [];
  const predTop = pred.predicted_top10 || [];
  const predFl = pred.predicted_fastest_lap;
  const predDnf = pred.predicted_dnf;
  let pts = 0;
  const breakdown = [];
  for (let i = 0; i < Math.min(predTop.length, actualTop.length, 10); i++) {
    if (predTop[i] === actualTop[i]) {
      pts += F1_RACE[i];
      breakdown.push(`P${i+1} ${predTop[i]}: +${F1_RACE[i]}`);
    }
  }
  if (predFl && predFl === actualFl) { pts += 1; breakdown.push(`FL ${predFl}: +1`); }
  const trueDnf = actualDnf.filter(d => !actualDns.includes(d));
  if (predDnf) {
    if (trueDnf.includes(predDnf)) { pts += 10; breakdown.push(`DNF ${predDnf}: +10`); }
  } else {
    if (trueDnf.length === 0) { pts += 10; breakdown.push(`No DNF pred, none occurred: +10`); }
  }
  return { pts, breakdown };
}

function scoreSprint(pred, results) {
  const actualSprint = results.sprint_top8 || [];
  const predSprint = pred.predicted_sprint_top8 || [];
  let pts = 0;
  const breakdown = [];
  for (let i = 0; i < Math.min(predSprint.length, actualSprint.length, 8); i++) {
    if (predSprint[i] === actualSprint[i]) { pts += F1_SPRINT[i]; breakdown.push(`SP${i+1} ${predSprint[i]}: +${F1_SPRINT[i]}`); }
  }
  return { pts, breakdown };
}

async function main() {
  // 1. Race results for r10
  const rrRes = await fetch(`${BASE}/race_results?race_id=eq.r10&select=*`, { headers });
  const rr = await rrRes.json();
  console.log('=== r10 RACE RESULTS ROW ===');
  console.log(JSON.stringify(rr, null, 2));
  console.log();

  if (rr.length === 0) {
    console.log('NO RACE RESULTS ROW FOR r10 — this is the problem!');
    return;
  }
  const results = rr[0];

  // 2. Carlos & Whitney predictions for r10
  const predRes = await fetch(`${BASE}/user_predictions?race_id=eq.r10&user_id=in.(${CARLOS},${WHITNEY})&select=*`, { headers });
  const preds = await predRes.json();
  console.log('=== r10 PREDICTIONS ===');
  console.log(JSON.stringify(preds, null, 2));
  console.log();

  for (const p of preds) {
    const name = p.user_id === CARLOS ? 'CARLOS' : 'WHITNEY';
    console.log(`\n=== ${name} r10 ===`);
    console.log('predicted_top10:', p.predicted_top10);
    console.log('predicted_sprint_top8:', p.predicted_sprint_top8);
    console.log('predicted_fastest_lap:', p.predicted_fastest_lap);
    console.log('predicted_dnf:', p.predicted_dnf);
    console.log('STORED points_earned:', p.points_earned);
    console.log('STORED sprint_points_earned:', p.sprint_points_earned);
    console.log('series_id:', p.series_id);

    const r = scoreRace(p, results);
    const s = scoreSprint(p, results);
    console.log('COMPUTED race points:', r.pts, r.breakdown);
    console.log('COMPUTED sprint points:', s.pts, s.breakdown);
    console.log('COMPUTED total:', r.pts + s.pts);
  }

  // 3. Check what race the results row is linked to — series_id etc
  console.log('\n=== r10 results row fields used by scoring function ===');
  console.log('race_id:', results.race_id);
  console.log('series_id:', results.series_id);
  console.log('race_top10:', results.race_top10);
  console.log('sprint_top8:', results.sprint_top8);
  console.log('fastest_lap_driver_id:', results.fastest_lap_driver_id);
  console.log('dnf_driver_ids:', results.dnf_driver_ids);
  console.log('dns_driver_ids:', results.dns_driver_ids);
  console.log('has_results:', results.has_results);
}

main().catch(e => { console.error(e); process.exit(1); });
