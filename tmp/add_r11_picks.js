// Add Bryan & Skye's r11 (Hungarian GP) picks from spreadsheet to Supabase.
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const BASE = 'https://fxwgbpassouaddakgyus.supabase.co/rest/v1';
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function main() {
  // 1. Find user_ids for bryanleach and skyeleach
  console.log('=== Looking up user IDs ===');
  const profRes = await fetch(`${BASE}/profiles?select=id,username`, { headers });
  const profiles = await profRes.json();
  const bryan = profiles.find(p => p.username === 'bryanleach');
  const skye = profiles.find(p => p.username === 'skyeleach');
  console.log('bryanleach:', bryan?.id);
  console.log('skyeleach:', skye?.id);
  if (!bryan || !skye) { console.log('MISSING USER'); return; }

  // 2. Check existing r11 predictions
  const existRes = await fetch(`${BASE}/user_predictions?race_id=eq.r11&select=user_id,username,predicted_top10,predicted_fastest_lap,predicted_dnf,points_earned,sprint_points_earned`, { headers });
  const existing = await existRes.json();
  console.log('\n=== Existing r11 predictions ===');
  for (const p of existing) {
    console.log(`  ${p.username} (${p.user_id.slice(0,8)}): top10=[${p.predicted_top10}] fl=${p.predicted_fastest_lap} dnf=${p.predicted_dnf} pts=${p.points_earned}`);
  }

  // 3. Bryan's picks (col J in spreadsheet):
  //    P1 NOR, P2 PIA, P3 LEC, P4 HAM, P5 RUS, P6 ANT, P7 VER, P8 HAD, P9 LIN, P10 GAS
  //    FL = VER, DNF = "No One" (null)
  const bryanPicks = {
    user_id: bryan.id,
    username: 'bryanleach',
    race_id: 'r11',
    series_id: 'f1',
    predicted_top10: ['NOR','PIA','LEC','HAM','RUS','ANT','VER','HAD','LIN','GAS'],
    predicted_fastest_lap: 'VER',
    predicted_dnf: null,   // "No One"
    predicted_sprint_top8: [],
    points_earned: 0,
    sprint_points_earned: 0,
  };

  // 4. Skye's picks (col F in spreadsheet):
  //    P1 NOR, P2 PIA, P3 LEC, P4 ANT, P5 HAM, P6 RUS, P7 VER, P8 HAD, P9 LIN, P10 LAW
  //    FL = NOR, DNF = Hulkenberg (HUL)
  const skyePicks = {
    user_id: skye.id,
    username: 'skyeleach',
    race_id: 'r11',
    series_id: 'f1',
    predicted_top10: ['NOR','PIA','LEC','ANT','HAM','RUS','VER','HAD','LIN','LAW'],
    predicted_fastest_lap: 'NOR',
    predicted_dnf: 'HUL',
    predicted_sprint_top8: [],
    points_earned: 0,
    sprint_points_earned: 0,
  };

  // 5. Upsert each
  for (const [label, picks] of [['Bryan', bryanPicks], ['Skye', skyePicks]]) {
    console.log(`\n=== Upserting ${label}'s r11 picks ===`);
    console.log(`  top10=[${picks.predicted_top10}] fl=${picks.predicted_fastest_lap} dnf=${picks.predicted_dnf}`);
    // Check if row exists
    const check = await fetch(`${BASE}/user_predictions?race_id=eq.r11&user_id=eq.${picks.user_id}&select=id`, { headers });
    const checkData = await check.json();
    let res;
    if (checkData && checkData.length > 0) {
      console.log(`  row exists — updating`);
      res = await fetch(`${BASE}/user_predictions?race_id=eq.r11&user_id=eq.${picks.user_id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          predicted_top10: picks.predicted_top10,
          predicted_fastest_lap: picks.predicted_fastest_lap,
          predicted_dnf: picks.predicted_dnf,
          predicted_sprint_top8: picks.predicted_sprint_top8,
          series_id: 'f1',
        }),
      });
    } else {
      console.log(`  no row — inserting`);
      res = await fetch(`${BASE}/user_predictions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(picks),
      });
    }
    console.log(`  HTTP ${res.status}`);
    if (!res.ok) { console.log(`  ERROR: ${await res.text()}`); }
  }

  // 6. Re-score r11
  console.log('\n=== Triggering score_predictions_for_race(r11) ===');
  const scoreRes = await fetch(`${BASE}/rpc/score_predictions_for_race`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_race_id: 'r11' }),
  });
  console.log(`Score function: HTTP ${scoreRes.status}`);

  // 7. Verify
  console.log('\n=== r11 PREDICTIONS AFTER SCORING ===');
  const predRes = await fetch(`${BASE}/user_predictions?race_id=eq.r11&select=user_id,username,predicted_top10,predicted_fastest_lap,predicted_dnf,points_earned,sprint_points_earned`, { headers });
  const preds = await predRes.json();
  for (const p of preds) {
    const total = (p.points_earned || 0) + (p.sprint_points_earned || 0);
    console.log(`  ${p.username}: pts=${p.points_earned} total=${total} top10=[${p.predicted_top10?.slice(0,5)}...] fl=${p.predicted_fastest_lap} dnf=${p.predicted_dnf}`);
  }

  // 8. Final totals
  console.log('\n=== FINAL USER TOTALS (all races) ===');
  const allRes = await fetch(`${BASE}/user_predictions?select=username,points_earned,sprint_points_earned`, { headers });
  const allPreds = await allRes.json();
  const totals = {};
  for (const r of allPreds) {
    const k = r.username || 'unknown';
    if (!totals[k]) totals[k] = 0;
    totals[k] += (r.points_earned || 0) + (r.sprint_points_earned || 0);
  }
  for (const [name, total] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${total}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
