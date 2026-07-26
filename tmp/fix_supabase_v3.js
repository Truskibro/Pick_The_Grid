// Compare ground_truth_picks.json against Supabase predictions, then push corrections.
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const BASE = 'https://fxwgbpassouaddakgyus.supabase.co/rest/v1';
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const USER_NAMES = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'skye',
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 'whitney',
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'bryan',
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'carlos',
};

async function main() {
  const fs = await import('fs');
  const groundTruth = JSON.parse(fs.readFileSync('tmp/ground_truth_picks.json', 'utf8'));

  // Fetch all Supabase predictions
  const supaRes = await fetch(`${BASE}/user_predictions?select=*&order=race_id.asc,user_id.asc`, { headers });
  const supaPreds = await supaRes.json();

  // Build lookup: (user_id, race_id) → pred
  const supaMap = new Map();
  for (const p of supaPreds) {
    supaMap.set(`${p.user_id}:${p.race_id}`, p);
  }

  const corrections = [];

  console.log('=== COMPARING GROUND TRUTH vs SUPABASE ===\n');

  for (const raceId of Object.keys(groundTruth).sort()) {
    for (const [uid, gt] of Object.entries(groundTruth[raceId])) {
      const name = USER_NAMES[uid] || uid.slice(0, 8);
      const supa = supaMap.get(`${uid}:${raceId}`);

      const gtTop = gt.top || [];
      const gtSprint = gt.sprint_top || [];
      const gtFl = gt.fl || null;
      const gtDnf = gt.dnf || null;

      if (!supa) {
        // Missing prediction — needs to be added (only if there are picks)
        if (gtTop.length > 0) {
          console.log(`${raceId} ${name}: MISSING from Supabase — needs insert`);
          console.log(`  GT: top10(${gtTop.length})=[${gtTop}] fl=${gtFl} dnf=${gtDnf} sprint(${gtSprint.length})=[${gtSprint}]`);
          corrections.push({ raceId, uid, gt, action: 'insert' });
        }
        continue;
      }

      const supaTop = supa.predicted_top10 || [];
      const supaSprint = supa.predicted_sprint_top8 || [];
      const supaFl = supa.predicted_fastest_lap || null;
      const supaDnf = supa.predicted_dnf || null;

      const topMismatch = JSON.stringify(supaTop) !== JSON.stringify(gtTop);
      const sprintMismatch = JSON.stringify(supaSprint) !== JSON.stringify(gtSprint);
      const flMismatch = (supaFl || '') !== (gtFl || '');
      const dnfMismatch = (supaDnf || '') !== (gtDnf || '');

      if (topMismatch || sprintMismatch || flMismatch || dnfMismatch) {
        console.log(`${raceId} ${name}: MISMATCH`);
        if (topMismatch) console.log(`  top10: supa=[${supaTop}] gt=[${gtTop}]`);
        if (sprintMismatch) console.log(`  sprint: supa=[${supaSprint}] gt=[${gtSprint}]`);
        if (flMismatch) console.log(`  fl: supa=${supaFl} gt=${gtFl}`);
        if (dnfMismatch) console.log(`  dnf: supa=${supaDnf} gt=${gtDnf}`);
        corrections.push({ raceId, uid, gt, action: 'update', supaId: supa.id });
      }
    }
  }

  console.log(`\n=== ${corrections.length} corrections needed ===\n`);

  if (corrections.length === 0) {
    console.log('No corrections needed — Supabase matches ground truth!');
    return;
  }

  // Apply corrections via save_user_prediction RPC (handles upsert)
  for (const c of corrections) {
    const name = USER_NAMES[c.uid] || c.uid.slice(0, 8);
    const gt = c.gt;
    const payload = {
      p_race_id: c.raceId,
      p_predicted_top10: gt.top || [],
      p_predicted_fastest_lap: gt.fl || null,
      p_predicted_dnf: gt.dnf || null,
      p_predicted_sprint_top8: gt.sprint_top || [],
      p_series_id: 'f1',
    };

    // save_user_prediction uses auth.uid() — we can't call it as service role.
    // Instead, do a direct upsert via REST.
    const upsertPayload = {
      user_id: c.uid,
      race_id: c.raceId,
      series_id: 'f1',
      predicted_top10: gt.top || [],
      predicted_fastest_lap: gt.fl || null,
      predicted_dnf: gt.dnf || null,
      predicted_sprint_top8: gt.sprint_top || [],
      // Don't set points — the scoring function will compute them
    };

    console.log(`Pushing correction: ${c.raceId} ${name}...`);

    // First try upsert with service role (bypasses RLS)
    const upsertRes = await fetch(`${BASE}/user_predictions?on_conflict=user_id,series_id,race_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        ...upsertPayload,
        username: USER_NAMES[c.uid] || `user_${c.uid.slice(0, 8)}`,
        display_name: name.charAt(0).toUpperCase() + name.slice(1),
        points_earned: 0,
        sprint_points_earned: 0,
      }),
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      console.log(`  FAILED: ${upsertRes.status} ${errText}`);
    } else {
      console.log(`  OK`);
    }
  }

  // Now re-score all races
  console.log('\n=== RE-SCORING ALL RACES ===');
  for (const raceId of ['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10']) {
    const res = await fetch(`${BASE}/rpc/score_predictions_for_race`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_race_id: raceId }),
    });
    console.log(`  ${raceId}: ${res.status}`);
  }

  // Re-run audit
  console.log('\n=== POST-CORRECTION AUDIT ===');
  const auditRes = await fetch(`${BASE}/user_predictions?select=user_id,race_id,points_earned,sprint_points_earned&order=race_id.asc,user_id.asc`, { headers });
  const auditData = await auditRes.json();

  const totals = {};
  for (const r of auditData) {
    if (!totals[r.user_id]) totals[r.user_id] = 0;
    totals[r.user_id] += (r.points_earned || 0) + (r.sprint_points_earned || 0);
  }

  console.log('\nFinal totals:');
  for (const [uid, total] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${USER_NAMES[uid] || uid.slice(0, 8)}: ${total}`);
  }

  // Check profiles
  const profRes = await fetch(`${BASE}/profiles?select=id,username,total_points`, { headers });
  const profiles = await profRes.json();
  console.log('\nProfile totals:');
  for (const p of profiles) {
    if (p.total_points > 0) {
      console.log(`  ${p.username}: ${p.total_points}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
