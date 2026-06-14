const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'expo', 'lib', 'create-missing-tables.sql'), 'utf8');

const pool = new Pool({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.fxwgbpassouaddakgyus',
  password: 'Dkivail3025!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {
  try {
    console.log('Connecting to Supabase pooler...');
    const client = await pool.connect();
    console.log('Connected. Running SQL...');
    await client.query(sql);
    console.log('SQL executed successfully!');
    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
  }
}

main();
