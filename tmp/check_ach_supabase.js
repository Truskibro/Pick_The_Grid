const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const DB = process.env.SUPABASE_DB_URL;

const { Pool } = require('pg');
const pool = new Pool({ connectionString: DB });

(async () => {
  const client = await pool.connect();
  try {
    console.log('=== user_achievements rows ===');
    const { rows } = await client.query('SELECT user_id, achievement_id, unlocked_tiers, current_value, unlocked_at FROM user_achievements ORDER BY user_id, achievement_id');
    console.log('Total rows:', rows.length);
    for (const r of rows) {
      console.log(JSON.stringify(r));
    }
    console.log('\n=== profiles ===');
    const p = await client.query('SELECT id, display_name, total_points FROM profiles ORDER BY display_name');
    for (const r of p.rows) console.log(JSON.stringify(r));
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.error(e); process.exit(1); });
