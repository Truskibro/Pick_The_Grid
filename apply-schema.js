const { Client } = require('pg');
const fs = require('fs');

const SQL = fs.readFileSync('/home/user/rork-app/expo/lib/supabase-fix-predictions.sql', 'utf8');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const HOST = 'db.fxwgbpassouaddakgyus.supabase.co';

async function tryConnect(port, user, password, useSSL) {
  console.log(`\nTrying: ${user}@${HOST}:${port} ssl=${useSSL} pass=${password ? password.substring(0,20)+'...' : '(empty)'}`);
  const client = new Client({
    host: HOST,
    port: port,
    user: user,
    password: password || undefined,
    database: 'postgres',
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT current_user, current_database(), version()');
    console.log('SUCCESS:', res.rows[0]);
    return client;
  } catch(e) {
    console.log('FAILED:', e.message);
    return null;
  }
}

async function main() {
  const combos = [
    [6543, 'postgres', SERVICE_KEY, true],
    [5432, 'postgres', SERVICE_KEY, true],
    [6543, 'postgres', ANON_KEY, true],
    [5432, 'postgres', ANON_KEY, true],
    [6543, 'postgres', '', true],
    [5432, 'postgres', '', true],
    [6543, 'authenticator', SERVICE_KEY, true],
    [5432, 'authenticator', SERVICE_KEY, true],
  ];
  
  for (const [port, user, pass, ssl] of combos) {
    const client = await tryConnect(port, user, pass, ssl);
    if (client) {
      console.log('\nConnected! Running schema...');
      try {
        await client.query(SQL);
        console.log('Schema applied successfully!');
      } catch(e) {
        console.log('SQL error:', e.message);
      }
      await client.end();
      return;
    }
  }
  console.log('\nAll connection attempts failed.');
}

main().catch(e => console.error('Fatal:', e));
