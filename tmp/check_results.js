const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
(async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/race_results?race_id=in.(r08,r09,r10)&select=race_id,classification,dnf_driver_ids,dns_driver_ids,fastest_lap_driver_id,sprint_classification`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const rows = await res.json();
  for (const r of rows) {
    console.log(`\n${r.race_id}:`);
    console.log(`  classification: ${JSON.stringify(r.classification)}`);
    console.log(`  dnf_driver_ids: ${JSON.stringify(r.dnf_driver_ids)}`);
    console.log(`  dns_driver_ids: ${JSON.stringify(r.dns_driver_ids)}`);
    console.log(`  fastest_lap: ${r.fastest_lap_driver_id}`);
    console.log(`  sprint: ${JSON.stringify(r.sprint_classification)}`);
  }
})();
