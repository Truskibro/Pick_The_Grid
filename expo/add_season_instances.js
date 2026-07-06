const https = require('https');
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

// Try the Supabase SQL endpoint variants
const sql = 'ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS season_instances jsonb DEFAULT NULL;';

const paths = ['/rest/v1/rpc/execute_sql', '/rest/v1/rpc/run_sql', '/rest/v1/rpc/exec_sql', '/rest/v1/rpc/eval_sql'];
let i = 0;
function tryNext() {
  if (i >= paths.length) {
    // Last resort: use the PostgREST RPC with a known function name from apply-admin-functions.js
    console.log('All direct SQL paths failed. Trying RPC approach...');
    return tryRpc();
  }
  const p = paths[i++];
  const body = JSON.stringify({ sql_query: sql });
  const req = https.request(`${SUPABASE_URL}${p}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'public',
    },
  }, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
      console.log(`${p} -> status=${res.statusCode} body=${data.slice(0,200)}`);
      if (res.statusCode < 400) { console.log('SUCCESS'); return; }
      tryNext();
    });
  });
  req.on('error', (e) => { console.error(e); tryNext(); });
  req.write(body);
  req.end();
}
tryNext();

function tryRpc() {
  // Use the admin function approach — but we need a function to execute raw SQL.
  // Supabase doesn't expose one by default. We'll need to create one first via the management API.
  console.log('No SQL execution endpoint available. Column must be added manually.');
}
