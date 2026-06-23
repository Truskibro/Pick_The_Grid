// Recompute all points using verified Supabase race_results
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function api(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.substring(0, 300)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

// ============================================================
// SCORING ENGINE — matches expo/lib/scoring.ts exactly
// ============================================================
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

function norm(id) { return String(id || '').trim().toUpperCase(); }

function isDns(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'dns' || s === 'did not start' || s === 'did_not_start';
}

function isTrueDnf(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'dnf' || s === 'retired' || s === 'ret' || s === 'did not finish' || s === 'did_not_finish';
}

function getDnsDriverIds(result) {
  const dnsIds = new Set();
  if (Array.isArray(result.dnsDriverIds)) {
    for (const d of result.dnsDriverIds) { const n = norm(d); if (n) dnsIds.add(n); }
  }
  if (Array.isArray(result.classification)) {
    for (const e of result.classification) {
      const n = norm(e.driverId);
      if (n && isDns(e.status)) dnsIds.add(n);
    }
  }
  return dnsIds;
}

function getTrueDnfDriverIds(result) {
  const trueDnfIds = new Set();
  const dnsIds = getDnsDriverIds(result);
  if (Array.isArray(result.classification)) {
    for (const e of result.classification) {
      const n = norm(e.driverId);
      if (!n || dnsIds.has(n)) continue;
      if (isTrueDnf(e.status)) trueDnfIds.add(n);
    }
  }
  if (Array.isArray(result.dnfDriverIds)) {
    for (const d of result.dnfDriverIds) {
      const n = norm(d);
      if (!n || dnsIds.has(n)) continue;
      trueDnfIds.add(n);
    }
  }
  return trueDnfIds;
}

function calculatePoints(prediction, result) {
  let positionPoints = 0;
  const correctPositions = [];
  const alreadyScored = new Set();

  const resultTop10 = (result.classification || [])
    .filter(e => e.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map(e => norm(e.driverId));

  const top10 = prediction.predicted_top10 || [];
  for (let i = 0; i < top10.length && i < 10; i++) {
    const pred = norm(top10[i]);
    const actual = resultTop10[i];
    if (!pred) continue;
    if (alreadyScored.has(pred)) continue;
    alreadyScored.add(pred);
    if (pred === actual) {
      positionPoints += F1_POINTS[i];
      correctPositions.push(i);
    }
  }

  let fastestLapPoints = 0;
  const predFL = norm(prediction.predicted_fastest_lap);
  const actualFL = norm(result.fastestLapDriverId);
  if (predFL && predFL === actualFL) fastestLapPoints = FASTEST_LAP_BONUS;

  let dnfPoints = 0;
  const predDnf = norm(prediction.predicted_dnf);
  const actualDns = getDnsDriverIds(result);
  const actualDnf = getTrueDnfDriverIds(result);

  if (!predDnf && actualDnf.size === 0) {
    dnfPoints = DNF_BONUS;
  } else if (predDnf && actualDns.has(predDnf)) {
    // DNS — no points
  } else if (predDnf && actualDnf.has(predDnf)) {
    dnfPoints = DNF_BONUS;
  }

  return positionPoints + fastestLapPoints + dnfPoints;
}

function calculateSprintPoints(sprintTop8, sprintClassification) {
  let positionPoints = 0;
  const alreadyScored = new Set();

  const resultTop8 = (sprintClassification || [])
    .filter(e => e.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map(e => norm(e.driverId));

  const top8 = sprintTop8 || [];
  for (let i = 0; i < top8.length && i < 8; i++) {
    const pred = norm(top8[i]);
    const actual = resultTop8[i];
    if (!pred) continue;
    if (alreadyScored.has(pred)) continue;
    alreadyScored.add(pred);
    if (pred === actual) positionPoints += SPRINT_POINTS[i];
  }

  return positionPoints;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('=== Recomputing all points from verified Supabase data ===\n');

  // 1. Fetch all race results
  console.log('Fetching race results...');
  const rawResults = await api('race_results?select=*');
  const resultsByRaceId = {};
  for (const r of rawResults) {
    resultsByRaceId[r.race_id] = {
      raceId: r.race_id,
      classification: r.classification || [],
      fastestLapDriverId: r.fastest_lap_driver_id,
      dnfDriverIds: r.dnf_driver_ids || [],
      dnsDriverIds: r.dns_driver_ids || [],
      sprintClassification: r.sprint_classification || [],
    };
  }
  console.log(`Loaded ${Object.keys(resultsByRaceId).length} race results:`, Object.keys(resultsByRaceId).join(', '));

  // 2. Fetch all user predictions
  console.log('\nFetching user predictions...');
  const rawPredictions = await api('user_predictions?select=*');
  console.log(`Loaded ${rawPredictions.length} predictions`);

  // 3. Recompute points
  console.log('\nRecomputing points...');
  const updates = [];
  const userTotals = {}; // userId -> total points

  for (const pred of rawPredictions) {
    const result = resultsByRaceId[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) {
      // No result available for this race — keep existing points
      if (userTotals[pred.user_id] === undefined) userTotals[pred.user_id] = 0;
      userTotals[pred.user_id] += (pred.points_earned || 0) + (pred.sprint_points_earned || 0);
      continue;
    }

    if (!pred.predicted_top10 || pred.predicted_top10.length === 0) {
      if (userTotals[pred.user_id] === undefined) userTotals[pred.user_id] = 0;
      continue;
    }

    const newRacePoints = calculatePoints(pred, result);
    const newSprintPoints = (result.sprintClassification && result.sprintClassification.length > 0 && pred.predicted_sprint_top8 && pred.predicted_sprint_top8.length > 0)
      ? calculateSprintPoints(pred.predicted_sprint_top8, result.sprintClassification)
      : 0;

    const oldTotal = (pred.points_earned || 0) + (pred.sprint_points_earned || 0);
    const newTotal = newRacePoints + newSprintPoints;

    if (userTotals[pred.user_id] === undefined) userTotals[pred.user_id] = 0;
    userTotals[pred.user_id] += newTotal;

    if (newRacePoints !== (pred.points_earned || 0) || newSprintPoints !== (pred.sprint_points_earned || 0)) {
      console.log(`  ${pred.username} | ${pred.race_id}: race ${pred.points_earned}→${newRacePoints}, sprint ${pred.sprint_points_earned}→${newSprintPoints} (total ${oldTotal}→${newTotal})`);
      updates.push({ id: pred.id, points_earned: newRacePoints, sprint_points_earned: newSprintPoints });
    }
  }

  console.log(`\n${updates.length} predictions need updating`);

  // 4. Update predictions
  if (updates.length > 0) {
    console.log('\nUpdating predictions...');
    for (const u of updates) {
      try {
        await api(`user_predictions?id=eq.${u.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            points_earned: u.points_earned,
            sprint_points_earned: u.sprint_points_earned,
          }),
          headers: { ...headers, 'Prefer': 'return=minimal' },
        });
      } catch (e) {
        console.log(`  ERROR updating ${u.id}: ${e.message}`);
      }
    }
    console.log(`Updated ${updates.length} predictions`);
  }

  // 5. Update profiles.total_points
  console.log('\nUpdating profile totals...');
  const profiles = await api('profiles?select=id,username,display_name,total_points');
  for (const p of profiles) {
    const computed = userTotals[p.id] || 0;
    if (computed !== (p.total_points || 0)) {
      console.log(`  ${p.username}: ${p.total_points}→${computed}`);
      try {
        await api(`profiles?id=eq.${p.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ total_points: computed }),
          headers: { ...headers, 'Prefer': 'return=minimal' },
        });
      } catch (e) {
        console.log(`  ERROR updating profile ${p.username}: ${e.message}`);
      }
    }
  }

  // 6. Summary
  console.log('\n=== FINAL LEADERBOARD ===');
  const sortedUsers = [];
  for (const p of profiles) {
    const total = userTotals[p.id] || 0;
    sortedUsers.push({ username: p.username, display: p.display_name || p.username, total });
  }
  sortedUsers.sort((a, b) => b.total - a.total);
  sortedUsers.forEach((u, i) => {
    console.log(`  ${i+1}. ${u.display} (${u.username}): ${u.total} pts`);
  });

  const allUserIds = new Set(profiles.map(p => p.id));
  for (const [userId, total] of Object.entries(userTotals)) {
    if (!allUserIds.has(userId)) {
      console.log(`  ?? unknown user ${userId}: ${total} pts (no profile)`);
    }
  }

  console.log('\nDone!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
