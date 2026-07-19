const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const USERS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'Skye',
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 'Whitney',
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'Bryan',
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'Carlos',
};
(async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?race_id=in.(r08,r09,r10)&select=user_id,race_id,predicted_top10,predicted_sprint_top8,predicted_fastest_lap,predicted_dnf,points_earned,sprint_points_earned`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const rows = await res.json();
  console.log(`Found ${rows.length} prediction rows for r08/r09/r10`);
  for (const r of rows) {
    console.log(`${USERS[r.user_id]||r.user_id} ${r.race_id}: top10=${JSON.stringify(r.predicted_top10)} sprint=${JSON.stringify(r.predicted_sprint_top8)} fl=${r.predicted_fastest_lap} dnf=${r.predicted_dnf} pts=${r.points_earned} spts=${r.sprint_points_earned}`);
  }
})();
