const { Client } = require('pg');
const fs = require('fs');

const SQL = fs.readFileSync('/home/user/rork-app/expo/lib/supabase-fix-predictions.sql', 'utf8');

const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_USER = 'postgres.fxwgbpassouaddakgyus';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 6543;

async function main() {
  console.log(`Connecting to ${DB_USER}@${HOST}:${DB_PORT}/${DB_NAME}...`);
  const client = new Client({
    host: HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,

  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT current_user, current_database(), version()');
    console.log('Connected!', res.rows[0]);
    
    console.log('Applying schema (supabase-fix-predictions.sql)...');
    await client.query(SQL);
    console.log('Schema applied successfully!');
    
    // Verify tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('\nTables in public schema:', tables.rows.map(r => r.table_name).join(', '));
    
    await client.end();
    console.log('Done.');
  } catch(e) {
    console.error('Error:', e.message);
    if (client) await client.end();
    process.exit(1);
  }
}

main();
