const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

async function query(table, filters) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  return { status: res.status, body: await res.text() };
}

const SKYE = 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4';
const WHIT = '652154af-dc27-47b5-aa79-25903b9c4a1b';

(async () => {
  for (const [name, uid] of [['SKYE', SKYE], ['WHITNEY', WHIT]]) {
    console.log(`\n=== ${name} ===`);
    const r = await query('user_predictions', `user_id=eq.${uid}&series_id=eq.f1&select=race_id,predicted_top10,predicted_fastest_lap,predicted_dnf,predicted_sprint_top8,points_earned,sprint_points_earned,updated_at&order=race_id.asc`);
    if (r.status !== 200) { console.log('ERR', r.status, r.body.slice(0, 500)); continue; }
    const rows = JSON.parse(r.body);
    let total = 0, sprintTotal = 0;
    for (const row of rows) {
      const p = Number(row.points_earned || 0);
      const sp = Number(row.sprint_points_earned || 0);
      total += p; sprintTotal += sp;
      console.log(`${row.race_id}  pts=${p}  sprint=${sp}  top10=${JSON.stringify(row.predicted_top10)}  FL=${row.predicted_fastest_lap}  DNF=${row.predicted_dnf}  sTop8=${JSON.stringify(row.predicted_sprint_top8)}`);
    }
    console.log(`TOTAL race=${total} sprint=${sprintTotal} grand=${total+sprintTotal}  (rows=${rows.length})`);
  }

  console.log('\n=== profiles.total_points ===');
  const pr1 = await query('profiles', `id=eq.${SKYE}&select=username,total_points,motogp_total_points`);
  const pr2 = await query('profiles', `id=eq.${WHIT}&select=username,total_points,motogp_total_points`);
  console.log('SKYE:', pr1.body);
  console.log('WHITNEY:', pr2.body);

  console.log('\n=== race_results r01-r10 (winner + FL + DNFs + sprint winner) ===');
  const rr = await query('race_results', `race_id=in.(r01,r02,r03,r04,r05,r06,r07,r08,r09,r10)&select=race_id,classification,fastest_lap_driver_id,dnf_driver_ids,sprint_classification&order=race_id.asc`);
  if (rr.status === 200) {
    const rows = JSON.parse(rr.body);
    for (const row of rows) {
      const cls = row.classification || [];
      const top5 = cls.slice(0, 5).map(c => `${c.position}:${c.driver_id}`).join(' ');
      const dnfs = JSON.stringify(row.dnf_driver_ids);
      const sprint = row.sprint_classification ? row.sprint_classification.slice(0,3).map(c => `${c.position}:${c.driver_id}`).join(' ') : 'none';
      console.log(`${row.race_id}  top5=${top5}  FL=${row.fastest_lap_driver_id}  DNFs=${dnfs}  sprintPodium=${sprint}`);
    }
  } else {
    console.log('ERR', rr.status, rr.body.slice(0, 500));
  }
})();
