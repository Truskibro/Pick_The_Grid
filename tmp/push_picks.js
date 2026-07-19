const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

const fs = require('fs');
const extracted = JSON.parse(fs.readFileSync('tmp/extracted_picks_v2.json','utf8'));

const USERS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'Skye',
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 'Whitney',
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'Bryan',
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'Carlos',
};

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Profile': 'public',
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=representation',
};

// Build rows to upsert. r09 merges race + sprint into one row.
function buildRow(uid, raceId, racePicks, sprintPicks) {
  const row = {
    user_id: uid,
    race_id: raceId,
    series_id: 'f1',
    predicted_top10: racePicks.top,
    predicted_sprint_top8: sprintPicks ? sprintPicks.top : [],
    predicted_fastest_lap: racePicks.fl,
    predicted_dnf: racePicks.dnf,
  };
  return row;
}

const rows = [];
// r08 Austria — Skye has no picks
const r08 = extracted['r08'];
for (const uid of Object.keys(USERS)) {
  if (uid === 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4') continue; // Skye: no picks
  if (r08[uid].top.length === 0) continue;
  rows.push(buildRow(uid, 'r08', r08[uid], null));
}
// r09 British — merge race + sprint
const r09race = extracted['r09'];
const r09sprint = extracted['r09_sprint'];
for (const uid of Object.keys(USERS)) {
  if (r09race[uid].top.length === 0) continue;
  rows.push(buildRow(uid, 'r09', r09race[uid], r09sprint[uid]));
}
// r10 Belgian
const r10 = extracted['r10'];
for (const uid of Object.keys(USERS)) {
  if (r10[uid].top.length === 0) continue;
  rows.push(buildRow(uid, 'r10', r10[uid], null));
}

// Also delete any existing Skye r08 row (she has no picks)
async function deleteRow(uid, raceId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?user_id=eq.${uid}&race_id=eq.${raceId}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=representation' },
  });
  const body = await res.text();
  console.log(`  DELETE Skye r08: ${res.status} ${body.slice(0,100)}`);
}

(async () => {
  console.log(`Upserting ${rows.length} rows...`);
  for (const row of rows) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?on_conflict=user_id,series_id,race_id`, {
      method: 'POST',
      headers,
      body: JSON.stringify(row),
    });
    const body = await res.text();
    const ok = res.ok;
    console.log(`  ${USERS[row.user_id]} ${row.race_id}: ${res.status} ${ok ? 'OK' : body.slice(0,200)}`);
  }

  // Delete Skye r08 (no picks in spreadsheet)
  await deleteRow('cb7536a7-ad8b-44d4-981b-4b24c19abcc4', 'r08');

  // Trigger rescore by touching race_results for r08, r09, r10
  for (const raceId of ['r08','r09','r10']) {
    const rr = await fetch(`${SUPABASE_URL}/rest/v1/race_results?race_id=eq.${raceId}&select=fastest_lap_driver_id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
    });
    const rrows = await rr.json();
    if (rrows.length > 0) {
      const fl = rrows[0].fastest_lap_driver_id;
      const tr = await fetch(`${SUPABASE_URL}/rest/v1/race_results?race_id=eq.${raceId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ fastest_lap_driver_id: fl }),
      });
      console.log(`  Rescore trigger ${raceId}: ${tr.status}`);
    } else {
      console.log(`  Rescore trigger ${raceId}: NO race_results row`);
    }
  }

  // Wait for triggers to settle
  await new Promise(r => setTimeout(r, 2500));

  // Verify final state
  console.log('\n=== FINAL STATE r08/r09/r10 ===');
  const v = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?race_id=in.(r08,r09,r10)&select=user_id,race_id,predicted_top10,predicted_sprint_top8,predicted_fastest_lap,predicted_dnf,points_earned,sprint_points_earned&order=user_id,race_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const vrows = await v.json();
  for (const r of vrows) {
    console.log(`${USERS[r.user_id]||r.user_id.slice(0,8)} ${r.race_id}: top10=${JSON.stringify(r.predicted_top10)} sprint=${JSON.stringify(r.predicted_sprint_top8)} fl=${r.predicted_fastest_lap} dnf=${r.predicted_dnf} pts=${r.points_earned} spts=${r.sprint_points_earned}`);
  }

  // Profile totals
  console.log('\n=== PROFILE TOTALS ===');
  const p = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=username,display_name,total_points&order=total_points.desc`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const prows = await p.json();
  for (const pr of prows) {
    console.log(`  ${pr.username}: ${pr.total_points}`);
  }
})();
