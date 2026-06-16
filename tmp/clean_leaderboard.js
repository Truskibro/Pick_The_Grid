// Clean up placeholder/test data from Supabase
const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.fxwgbpassouaddakgyus',
  password: 'Dkivail3025!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {
  await client.connect();
  console.log('Connected.\n');

  // 1. Find Admin user's data
  const { rows: adminPreds } = await client.query(
    "SELECT id, user_id, username, race_id FROM user_predictions WHERE username = 'Admin' OR user_id = 'ec85e5ec-edca-4196-91a6-56b19bfff6c7'"
  );
  console.log('Admin prediction rows:', adminPreds.length);
  for (const r of adminPreds) {
    console.log('  id:', r.id, 'user_id:', r.user_id, 'race:', r.race_id);
    await client.query('DELETE FROM user_predictions WHERE id = $1', [r.id]);
    console.log('  Deleted.');
  }

  // 2. Delete Admin profile
  const { rows: adminProfiles } = await client.query(
    "SELECT id, username FROM profiles WHERE username = 'Admin' OR id = 'ec85e5ec-edca-4196-91a6-56b19bfff6c7'"
  );
  console.log('\nAdmin profile rows:', adminProfiles.length);
  for (const p of adminProfiles) {
    console.log('  id:', p.id, 'username:', p.username);
    await client.query('DELETE FROM profiles WHERE id = $1', [p.id]);
    console.log('  Deleted.');
  }

  // 3. Verify remaining data
  const { rows: remaining } = await client.query(
    'SELECT username, COUNT(*) as races, SUM(COALESCE(points_earned,0)) as gp, SUM(COALESCE(sprint_points_earned,0)) as sprint FROM user_predictions GROUP BY username ORDER BY username'
  );
  console.log('\n=== REMAINING LEADERBOARD ===');
  for (const r of remaining) {
    console.log(`${r.username}: ${r.races} races, GP=${r.gp} Sprint=${r.sprint} TOTAL=${r.gp + r.sprint}`);
  }

  // 4. Show profiles
  const { rows: profiles } = await client.query(
    'SELECT username, display_name, total_points FROM profiles ORDER BY total_points DESC'
  );
  console.log('\n=== PROFILES ===');
  for (const p of profiles) {
    console.log(`${p.username || p.display_name || '(unnamed)'}: ${p.total_points}`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
