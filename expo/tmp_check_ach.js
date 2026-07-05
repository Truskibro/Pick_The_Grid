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
  console.log('=== user_achievements ===');
  const { rows } = await client.query('SELECT user_id, achievement_id, unlocked_tiers, current_value, unlocked_at FROM user_achievements ORDER BY user_id, achievement_id');
  console.log('Total rows:', rows.length);
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }
  console.log('\n=== profiles ===');
  const { rows: p } = await client.query('SELECT id, username, display_name, total_points FROM profiles ORDER BY total_points DESC');
  for (const r of p) console.log(JSON.stringify(r));
  console.log('\n=== race_results ===');
  const { rows: rr } = await client.query('SELECT race_id, classification IS NOT NULL as has_class, sprint_classification IS NOT NULL as has_sprint FROM race_results ORDER BY race_id');
  for (const r of rr) console.log(JSON.stringify(r));
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
