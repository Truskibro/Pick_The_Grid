const SUPABASE_URL = process.env.SB_URL;
const SERVICE = process.env.SB_TOOL;

async function query(table, filters) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, {
    headers: { 'apikey': SERVICE, 'Authorization': `Bearer ${SERVICE}` },
  });
  return { status: res.status, body: await res.text() };
}

const SKYE = 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4';
const WHIT = '652154af-dc27-47b5-aa79-25903b9c4a1b';

(async () => {
  for (const [name, uid] of [['SKYE', SKYE], ['WHITNEY', WHIT]]) {
    console.log(`\n=== ${name} ===`);
    const r = await query('user_predictions', `user_id=eq.${uid}&series_id=eq.f1&select=race_id,top_10,fastest_lap_driver_id,dnf_driver_id,points_earned,sprint_top_8,sprint_points_earned&order=race_id.asc`);
    if (r.status !== 200) { console.log('ERR', r.status, r.body.slice(0, 500)); continue; }
    const rows = JSON.parse(r.body);
    let total = 0, sprintTotal = 0;
    for (const row of rows) {
      const p = Number(row.points_earned || 0);
      const sp = Number(row.sprint_points_earned || 0);
      total += p; sprintTotal += sp;
      console.log(`${row.race_id}  pts=${p}  sprint=${sp}  top10=${JSON.stringify(row.top_10)}  FL=${row.fastest_lap_driver_id}  DNF=${row.dnf_driver_id}  sTop8=${JSON.stringify(row.sprint_top_8)}`);
    }
    console.log(`TOTAL race=${total} sprint=${sprintTotal} grand=${total+sprintTotal}`);
  }

  console.log('\n=== profiles ===');
  const pr1 = await query('profiles', `id=eq.${SKYE}&select=username,total_points,motogp_total_points`);
  const pr2 = await query('profiles', `id=eq.${WHIT}&select=username,total_points,motogp_total_points`);
  console.log('SKYE:', pr1.body);
  console.log('WHITNEY:', pr2.body);

  console.log('\n=== race_results r07-r10 ===');
  const rr = await query('race_results', `race_id=in.(r07,r08,r09,r10)&select=race_id,classification,fastest_lap_driver_id,dnf_driver_ids,sprint_classification`);
  if (rr.status === 200) {
    const rows = JSON.parse(rr.body);
    for (const row of rows) {
      const cls = (row.classification || []).slice(0, 12).map(c => `${c.position}:${c.driver_id}`).join(' ');
      const sprint = row.sprint_classification ? row.sprint_classification.slice(0,10).map(c => `${c.position}:${c.driver_id}`).join(' ') : 'none';
      console.log(`${row.race_id}  top12=${cls}  FL=${row.fastest_lap_driver_id}  DNFs=${JSON.stringify(row.dnf_driver_ids)}  sprintTop10=${sprint}`);
    }
  } else {
    console.log('ERR', rr.status, rr.body.slice(0, 500));
  }
})();
