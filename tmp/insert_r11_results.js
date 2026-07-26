// Insert r11 (Hungarian GP 2026) results into Supabase race_results.
// Sources: formula1.com, racefans.net, autosport.com, motorsport.com, crash.net
// Winner: Norris, Fastest lap: Leclerc, DNFs: Piastri/Bottas/Perez
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const BASE = 'https://fxwgbpassouaddakgyus.supabase.co/rest/v1';
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

// Full classification for 2026 Hungarian GP (r11)
// 19 classified finishers + 3 DNFs = 22 entries
const classification = [
  { driverId: 'NOR', position: 1,  status: 'finished', points: 25, gap: '',        time: '1:39:56.180' },
  { driverId: 'VER', position: 2,  status: 'finished', points: 18, gap: '+15.080', time: '+15.080' },
  { driverId: 'ANT', position: 3,  status: 'finished', points: 15, gap: '+18.728', time: '+18.728' },
  { driverId: 'LEC', position: 4,  status: 'finished', points: 12, gap: '+23.840', time: '+23.840' },
  { driverId: 'HAM', position: 5,  status: 'finished', points: 10, gap: '+24.540', time: '+24.540' },
  { driverId: 'HAD', position: 6,  status: 'finished', points: 8,  gap: '+55.488', time: '+55.488' },
  { driverId: 'RUS', position: 7,  status: 'finished', points: 6,  gap: '+57.503', time: '+57.503' },
  { driverId: 'LAW', position: 8,  status: 'finished', points: 4,  gap: '+1 Lap',   time: '+1 Lap' },
  { driverId: 'HUL', position: 9,  status: 'finished', points: 2,  gap: '+1 Lap',   time: '+1 Lap' },
  { driverId: 'LIN', position: 10, status: 'finished', points: 1,  gap: '+1 Lap',   time: '+1 Lap' },
  { driverId: 'BOR', position: 11, status: 'finished', points: 0,  gap: '+1 Lap',   time: '+1 Lap' },
  { driverId: 'GAS', position: 12, status: 'finished', points: 0,  gap: '+1 Lap',   time: '+1 Lap' },
  { driverId: 'STR', position: 13, status: 'finished', points: 0,  gap: '+1 Lap',   time: '+1 Lap' },
  { driverId: 'ALO', position: 14, status: 'finished', points: 0,  gap: '+1 Lap',   time: '+1 Lap' },
  { driverId: 'COL', position: 15, status: 'finished', points: 0,  gap: '+2 Laps',  time: '+2 Laps' },
  { driverId: 'OCO', position: 16, status: 'finished', points: 0,  gap: '+2 Laps',  time: '+2 Laps' },
  { driverId: 'ALB', position: 17, status: 'finished', points: 0,  gap: '+2 Laps',  time: '+2 Laps' },
  { driverId: 'SAI', position: 18, status: 'finished', points: 0,  gap: '+2 Laps',  time: '+2 Laps' },
  { driverId: 'BEA', position: 19, status: 'finished', points: 0,  gap: '+2 Laps',  time: '+2 Laps' },
  { driverId: 'PIA', position: 20, status: 'dnf',      points: 0,  gap: '',         time: 'DNF' },
  { driverId: 'BOT', position: 21, status: 'dnf',      points: 0,  gap: '',         time: 'DNF' },
  { driverId: 'PER', position: 22, status: 'dnf',      points: 0,  gap: '',         time: 'DNF' },
];

const dnfIds = ['PIA', 'BOT', 'PER'];
const dnsIds = [];
const fastestLapId = 'LEC';

async function main() {
  console.log('=== Inserting r11 (Hungarian GP) results into Supabase ===');
  console.log(`Classification: ${classification.length} entries`);
  console.log(`Fastest lap: ${fastestLapId}`);
  console.log(`DNFs: [${dnfIds}]`);

  const row = {
    race_id: 'r11',
    classification,
    fastest_lap_driver_id: fastestLapId,
    dnf_driver_ids: dnfIds,
    dns_driver_ids: dnsIds,
    sprint_classification: null,
  };

  // Check if r11 already exists
  const checkRes = await fetch(`${BASE}/race_results?race_id=eq.r11&select=id`, { headers });
  const existing = await checkRes.json();

  let writeRes;
  if (existing && existing.length > 0) {
    console.log('r11 row exists — updating...');
    writeRes = await fetch(`${BASE}/race_results?race_id=eq.r11`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        classification: row.classification,
        fastest_lap_driver_id: row.fastest_lap_driver_id,
        dnf_driver_ids: row.dnf_driver_ids,
        dns_driver_ids: row.dns_driver_ids,
        sprint_classification: row.sprint_classification,
      }),
    });
  } else {
    console.log('r11 row does not exist — inserting...');
    writeRes = await fetch(`${BASE}/race_results`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
  }

  if (!writeRes.ok) {
    console.log(`FAILED: ${writeRes.status} ${await writeRes.text()}`);
    return;
  }
  const written = await writeRes.json();
  console.log(`OK — race_results for r11 saved (id: ${written[0]?.id})`);

  // The trigger should have auto-fired. Also manually call scoring to be sure.
  console.log('\n=== Triggering score_predictions_for_race(r11) ===');
  const scoreRes = await fetch(`${BASE}/rpc/score_predictions_for_race`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_race_id: 'r11' }),
  });
  console.log(`Score function: HTTP ${scoreRes.status}`);
  if (!scoreRes.ok) {
    console.log(`  Error: ${await scoreRes.text()}`);
  }

  // Verify r11 predictions now have points
  console.log('\n=== r11 PREDICTIONS AFTER SCORING ===');
  const predRes = await fetch(`${BASE}/user_predictions?race_id=eq.r11&select=user_id,username,predicted_top10,predicted_fastest_lap,predicted_dnf,points_earned,sprint_points_earned`, { headers });
  const preds = await predRes.json();
  for (const p of preds) {
    const total = (p.points_earned || 0) + (p.sprint_points_earned || 0);
    console.log(`  ${p.username}: pts=${p.points_earned} total=${total} top10=[${p.predicted_top10?.slice(0,5)}...] fl=${p.predicted_fastest_lap} dnf=${p.predicted_dnf}`);
  }

  // Mark r11 as completed in races table
  console.log('\n=== Marking r11 as completed in races table ===');
  const raceUpdateRes = await fetch(`${BASE}/races?race_id=eq.r11`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'completed', winner: 'NOR' }),
  });
  console.log(`Race status update: HTTP ${raceUpdateRes.status}`);

  // Final totals across ALL races
  console.log('\n=== FINAL USER TOTALS (all races) ===');
  const allPredRes = await fetch(`${BASE}/user_predictions?select=user_id,username,points_earned,sprint_points_earned&order=user_id.asc`, { headers });
  const allPreds = await allPredRes.json();
  const totals = {};
  for (const r of allPreds) {
    const key = r.username || r.user_id;
    if (!totals[key]) totals[key] = 0;
    totals[key] += (r.points_earned || 0) + (r.sprint_points_earned || 0);
  }
  for (const [name, total] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${total}`);
  }

  // Profile totals
  console.log('\n=== PROFILE TOTAL_POINTS ===');
  const profRes = await fetch(`${BASE}/profiles?select=username,total_points&order=total_points.desc`, { headers });
  const profiles = await profRes.json();
  for (const p of profiles) {
    if (p.total_points > 0) console.log(`  ${p.username}: ${p.total_points}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
