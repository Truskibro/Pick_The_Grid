const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const CARLOS = 'e11ea4f5-2ba4-4241-9791-b4b6a560534b';

// Carlos r07 (Spain) spreadsheet picks: RUS,HAM,ANT,VER,NOR,LEC,HAD,PIA,HUL,LAW  FL=RUS  DNF=null
// "I. Hadkar" at pos 7 was misspelled → dropped. Fix: add HAD at position 7.
async function patchRow(table, filters, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public', 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.text() };
}

(async () => {
  const pr = await patchRow('user_predictions', `user_id=eq.${CARLOS}&race_id=eq.r07`, {
    predicted_top10: ['RUS','HAM','ANT','VER','NOR','LEC','HAD','PIA','HUL','LAW'],
    predicted_fastest_lap: 'RUS',
    predicted_dnf: null,
  });
  console.log('Carlos r07 fix:', pr.status, pr.body.slice(0, 200));

  // Trigger rescore
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/race_results?race_id=eq.r07&select=fastest_lap_driver_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const rrows = await rr.json();
  if (rrows.length > 0) {
    const fl = rrows[0].fastest_lap_driver_id;
    const tr = await patchRow('race_results', `race_id=eq.r07`, { fastest_lap_driver_id: fl });
    console.log('Rescore r07:', tr.status);
  }
  await new Promise(r => setTimeout(r, 2000));

  // Verify
  const v = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?user_id=eq.${CARLOS}&race_id=eq.r07&select=predicted_top10,points_earned,sprint_points_earned`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const vrows = await v.json();
  console.log('Verified:', JSON.stringify(vrows[0]));
})();
