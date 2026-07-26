// RESTORE original predictions from /tmp/supabase_preds.json (saved before the bad overwrite).
// This pushes the original correct picks back to Supabase, then re-scores everything.
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const BASE = 'https://fxwgbpassouaddakgyus.supabase.co/rest/v1';
const fs = require('fs');

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const USER_NAMES = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'skyeleach',
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 'whitney',
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'bryanleach',
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'sainz4ever55',
  'ec85e5ec-edca-4196-91a6-56b19bfff6c7': 'Admin',
};

const DISPLAY_NAMES = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'Skye Leach',
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 'Whitney Trujillo',
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'Bryan Leach',
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'Carlos Trujillo',
  'ec85e5ec-edca-4196-91a6-56b19bfff6c7': 'Oscar',
};

async function main() {
  // Load the ORIGINAL correct predictions (saved before any corruption)
  const original = JSON.parse(fs.readFileSync('/tmp/supabase_preds.json', 'utf8'));
  console.log(`Loaded ${original.length} original predictions to restore\n`);

  console.log('=== RESTORING ORIGINAL PREDICTIONS ===');
  for (const pred of original) {
    const name = USER_NAMES[pred.user_id] || pred.user_id.slice(0, 8);
    const payload = {
      user_id: pred.user_id,
      race_id: pred.race_id,
      series_id: pred.series_id || 'f1',
      username: pred.username || USER_NAMES[pred.user_id] || `user_${pred.user_id.slice(0, 8)}`,
      display_name: pred.display_name || DISPLAY_NAMES[pred.user_id] || name,
      predicted_top10: pred.predicted_top10 || [],
      predicted_fastest_lap: pred.predicted_fastest_lap || null,
      predicted_dnf: pred.predicted_dnf || null,
      predicted_sprint_top8: pred.predicted_sprint_top8 || [],
      points_earned: 0,  // will be recomputed by scoring function
      sprint_points_earned: 0,
    };

    const res = await fetch(`${BASE}/user_predictions?on_conflict=user_id,series_id,race_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.log(`  ${pred.race_id} ${name}: FAILED ${res.status} ${await res.text()}`);
    } else {
      console.log(`  ${pred.race_id} ${name}: restored top10(${(pred.predicted_top10||[]).length}) sprint(${(pred.predicted_sprint_top8||[]).length})`);
    }
  }

  // Re-score all races
  console.log('\n=== RE-SCORING ALL RACES ===');
  for (const raceId of ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10']) {
    const res = await fetch(`${BASE}/rpc/score_predictions_for_race`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_race_id: raceId }),
    });
    console.log(`  ${raceId}: HTTP ${res.status}`);
  }

  // Verify totals
  console.log('\n=== POST-RESTORE VERIFICATION ===');
  const predRes = await fetch(`${BASE}/user_predictions?select=user_id,race_id,points_earned,sprint_points_earned&order=race_id.asc,user_id.asc`, { headers });
  const preds = await predRes.json();

  const totals = {};
  for (const r of preds) {
    if (!totals[r.user_id]) totals[r.user_id] = 0;
    totals[r.user_id] += (r.points_earned || 0) + (r.sprint_points_earned || 0);
  }

  console.log('\nPrediction totals (should match original):');
  for (const [uid, total] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${USER_NAMES[uid] || uid.slice(0, 8)}: ${total}`);
  }

  // Check profiles
  const profRes = await fetch(`${BASE}/profiles?select=id,username,total_points`, { headers });
  const profiles = await profRes.json();
  console.log('\nProfile totals:');
  for (const p of profiles) {
    if (p.total_points > 0 || p.username === 'remy_trujillo') {
      console.log(`  ${p.username}: ${p.total_points}`);
    }
  }

  // Expected: Carlos=312, Bryan=270, Whitney=262, Skye=214, Admin=164
  console.log('\nExpected: Carlos=312, Bryan=270, Whitney=262, Skye=214, Admin=164');
}

main().catch(e => { console.error(e); process.exit(1); });
