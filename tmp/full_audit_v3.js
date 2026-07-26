// Full audit: recompute every prediction's points from scratch against
// race_results, compare to what's stored in user_predictions.
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const BASE = 'https://fxwgbpassouaddakgyus.supabase.co/rest/v1';
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const F1_RACE = [25,18,15,12,10,8,6,4,2,1];
const F1_SPRINT = [8,7,6,5,4,3,2,1];
const MOTOGP_RACE = [25,20,16,13,11,10,9,8,7,6,5,4,3,2,1];
const MOTOGP_SPRINT = [12,9,7,6,5,4,3,2,1];
const FL_BONUS = 1;
const DNF_BONUS = 10;

async function fetchJSON(url) {
  const res = await fetch(`${BASE}${url}`, { headers });
  return res.json();
}

function scorePrediction(pred, result, seriesId) {
  const racePts = seriesId === 'motogp' ? MOTOGP_RACE : F1_RACE;
  const sprintPts = seriesId === 'motogp' ? MOTOGP_SPRINT : F1_SPRINT;

  let points = 0;
  let sprintPoints = 0;

  // Race position points (exact match by index)
  const classification = (result.classification || []).filter(e => e.status !== 'dns');
  const racePosMap = new Map();
  for (const e of classification) {
    if (!racePosMap.has(e.driverId)) racePosMap.set(e.driverId, e.position);
  }

  const seen = new Set();
  const top10 = pred.predicted_top10 || [];
  for (let i = 0; i < top10.length && i < racePts.length; i++) {
    const drv = top10[i];
    if (seen.has(drv)) continue;
    seen.add(drv);
    const actualPos = racePosMap.get(drv);
    if (actualPos === i + 1) {
      points += racePts[i];
    }
  }

  // Fastest lap bonus
  if (pred.predicted_fastest_lap && result.fastest_lap_driver_id &&
      pred.predicted_fastest_lap === result.fastest_lap_driver_id) {
    points += FL_BONUS;
  }

  // DNF bonus
  const dnfSet = new Set(result.dnf_driver_ids || []);
  // Also include classification entries with status 'dnf'
  for (const e of classification) {
    if (e.status === 'dnf') dnfSet.add(e.driverId);
  }
  if (pred.predicted_dnf) {
    if (dnfSet.has(pred.predicted_dnf)) {
      points += DNF_BONUS;
    }
  } else {
    // No DNF predicted: +10 if no true DNFs
    if (dnfSet.size === 0) {
      points += DNF_BONUS;
    }
  }

  // Sprint points
  const sprintClass = (result.sprint_classification || []).filter(e => e.status !== 'dns');
  if (sprintClass.length > 0 && pred.predicted_sprint_top8 && pred.predicted_sprint_top8.length > 0) {
    const sprintPosMap = new Map();
    for (const e of sprintClass) {
      if (!sprintPosMap.has(e.driverId)) sprintPosMap.set(e.driverId, e.position);
    }
    const seenS = new Set();
    for (let i = 0; i < pred.predicted_sprint_top8.length && i < sprintPts.length; i++) {
      const drv = pred.predicted_sprint_top8[i];
      if (seenS.has(drv)) continue;
      seenS.add(drv);
      const actualPos = sprintPosMap.get(drv);
      if (actualPos === i + 1) {
        sprintPoints += sprintPts[i];
      }
    }
  }

  return { points, sprintPoints };
}

async function main() {
  const results = await fetchJSON('/race_results?select=*');
  const predictions = await fetchJSON('/user_predictions?select=*&order=race_id.asc,user_id.asc');
  const profiles = await fetchJSON('/profiles?select=id,username,total_points,motogp_total_points');

  const resultByRace = new Map();
  for (const r of results) resultByRace.set(r.race_id, r);

  const profileMap = new Map();
  for (const p of profiles) profileMap.set(p.id, p);

  const userName = (uid) => profileMap.get(uid)?.username || uid.slice(0,8);

  console.log('=== PER-PREDICTION AUDIT ===');
  console.log('race | user | series | stored pts | sprint | computed pts | sprint | MATCH?');
  console.log('-'.repeat(90));

  const userTotals = new Map(); // uid -> { f1: {pts, sprint}, motogp: {pts, sprint} }
  const mismatches = [];

  for (const pred of predictions) {
    const result = resultByRace.get(pred.race_id);
    const seriesId = pred.series_id || 'f1';
    const storedPts = pred.points_earned || 0;
    const storedSprint = pred.sprint_points_earned || 0;

    if (!result) {
      // No result yet — should be 0
      if (storedPts !== 0 || storedSprint !== 0) {
        console.log(`${pred.race_id} | ${userName(pred.user_id).padEnd(14)} | ${seriesId} | ${String(storedPts).padStart(3)} | ${String(storedSprint).padStart(3)} |   N/A (no result) |  MISMATCH (should be 0)`);
        mismatches.push({ pred, storedPts, storedSprint, computedPts: 0, computedSprint: 0 });
      }
      // Still tally for total
      const ut = userTotals.get(pred.user_id) || { f1: {pts:0,sprint:0}, motogp: {pts:0,sprint:0} };
      ut[seriesId].pts += 0;
      ut[seriesId].sprint += 0;
      userTotals.set(pred.user_id, ut);
      continue;
    }

    const { points, sprintPoints } = scorePrediction(pred, result, seriesId);
    const match = (points === storedPts && sprintPoints === storedSprint);
    const flag = match ? 'OK' : '*** MISMATCH ***';
    console.log(`${pred.race_id} | ${userName(pred.user_id).padEnd(14)} | ${seriesId} | ${String(storedPts).padStart(3)} | ${String(storedSprint).padStart(3)} | ${String(points).padStart(3)} | ${String(sprintPoints).padStart(3)} | ${flag}`);

    if (!match) {
      mismatches.push({ pred, storedPts, storedSprint, computedPts: points, computedSprint: sprintPoints });
    }

    const ut = userTotals.get(pred.user_id) || { f1: {pts:0,sprint:0}, motogp: {pts:0,sprint:0} };
    ut[seriesId].pts += points;
    ut[seriesId].sprint += sprintPoints;
    userTotals.set(pred.user_id, ut);
  }

  console.log('\n=== USER TOTALS (computed from predictions) ===');
  console.log('user | F1 pts+sprint | MotoGP pts+sprint | profile.total_points | profile.motogp_total_points | MATCH?');
  console.log('-'.repeat(100));

  const profileMismatches = [];
  for (const [uid, totals] of userTotals) {
    const prof = profileMap.get(uid);
    const f1Total = totals.f1.pts + totals.f1.sprint;
    const motogpTotal = totals.motogp.pts + totals.motogp.sprint;
    const profF1 = prof?.total_points || 0;
    const profMotoGP = prof?.motogp_total_points || 0;
    const f1Match = f1Total === profF1;
    const motoMatch = motogpTotal === profMotoGP;
    const flag = (f1Match && motoMatch) ? 'OK' : '*** MISMATCH ***';
    console.log(`${userName(uid).padEnd(14)} | ${String(f1Total).padStart(3)} | ${String(motogpTotal).padStart(3)} | ${String(profF1).padStart(3)} | ${String(profMotoGP).padStart(3)} | ${flag}`);
    if (!f1Match || !motoMatch) {
      profileMismatches.push({ uid, computedF1: f1Total, computedMotoGP: motogpTotal, storedF1: profF1, storedMotoGP: profMotoGP });
    }
  }

  // Also check users with profiles but no predictions
  for (const [uid, prof] of profileMap) {
    if (!userTotals.has(uid)) {
      const f1Match = (prof.total_points || 0) === 0;
      const motoMatch = (prof.motogp_total_points || 0) === 0;
      if (!f1Match || !motoMatch) {
        console.log(`${userName(uid).padEnd(14)} |   0 |   0 | ${String(prof.total_points||0).padStart(3)} | ${String(prof.motogp_total_points||0).padStart(3)} | *** MISMATCH (no preds) ***`);
        profileMismatches.push({ uid, computedF1: 0, computedMotoGP: 0, storedF1: prof.total_points||0, storedMotoGP: prof.motogp_total_points||0 });
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Prediction mismatches: ${mismatches.length}`);
  console.log(`Profile total mismatches: ${profileMismatches.length}`);

  if (mismatches.length > 0) {
    console.log('\n--- Prediction mismatches detail ---');
    for (const m of mismatches) {
      console.log(`  ${m.pred.race_id} ${userName(m.pred.user_id)}: stored=(${m.storedPts}+${m.storedSprint}) computed=(${m.computedPts}+${m.computedSprint})`);
    }
  }
  if (profileMismatches.length > 0) {
    console.log('\n--- Profile mismatches detail ---');
    for (const m of profileMismatches) {
      console.log(`  ${userName(m.uid)}: F1 stored=${m.storedF1} computed=${m.computedF1}, MotoGP stored=${m.storedMotoGP} computed=${m.computedMotoGP}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
