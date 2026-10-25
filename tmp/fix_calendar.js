// Fix the F1 race calendar to match the revised official 2026 calendar:
// 1. Insert the missing Bahrain Grand Prix (real Round 16, Oct 2-4, race Oct 4).
// 2. Renumber later rounds (Singapore 16->17 ... Abu Dhabi 22->23).
// 3. Mark r11 Hungarian GP completed with winner NOR (results exist).
// 4. Backfill winners for r01-r07 from race_results.
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function rest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.status === 204 || text.length === 0 ? null : JSON.parse(text);
}

async function main() {
  // 1. Insert the missing Bahrain GP (non-sprint weekend).
  const bahrain = {
    id: 'r15b',
    round: 16,
    name: 'Bahrain Grand Prix',
    location: 'Sakhir',
    country: 'Bahrain',
    country_flag: '🇧🇭',
    race_date: '2026-10-04',
    race_time: '15:00',
    status: 'upcoming',
    has_sprint: false,
    series_id: 'f1',
  };
  // Idempotency: only insert when absent.
  const existing = await rest('GET', "races?id=eq.r15b&select=id");
  if (existing.length === 0) {
    await rest('POST', 'races', bahrain);
    console.log('Inserted Bahrain GP (r15b, round 16, 2026-10-04 15:00 UTC)');
  } else {
    console.log('Bahrain GP already present — skipping insert');
  }

  // 2. Renumber later rounds, descending to avoid transient duplicates.
  for (const [id, round] of [
    ['r22', 23], ['r21', 22], ['r20', 21], ['r19', 20],
    ['r18', 19], ['r17', 18], ['r16', 17],
  ]) {
    await rest('PATCH', `races?id=eq.${id}`, { round });
    console.log(`Renumbered ${id} -> round ${round}`);
  }

  // 3. r11 Hungarian: results exist, flip status + winner.
  await rest('PATCH', 'races?id=eq.r11', { status: 'completed', winner: 'NOR' });
  console.log('r11 Hungarian -> completed, winner NOR');

  // 4. Backfill winners for completed races missing a winner.
  const races = await rest('GET', 'races?select=id,name,winner,status&winner=is.null');
  for (const race of races.filter((r) => r.status === 'completed')) {
    const results = await rest(
      'GET',
      `race_results?race_id=eq.${race.id}&select=classification`,
    );
    const winner = results[0]?.classification?.find((e) => e.position === 1)?.driverId;
    if (winner) {
      await rest('PATCH', `races?id=eq.${race.id}`, { winner });
      console.log(`${race.id} ${race.name}: winner ${winner}`);
    } else {
      console.log(`${race.id} ${race.name}: no classification found, skipped`);
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
