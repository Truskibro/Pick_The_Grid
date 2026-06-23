/**
 * Fix Supabase predictions using the save_user_prediction RPC function.
 * Direct PATCH is blocked by RLS; the RPC is SECURITY DEFINER.
 */
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// Correct predictions from the spreadsheet
const CORRECTIONS = [
  // Skye Leach r02
  {
    userId: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
    username: 'skyeleach',
    displayName: 'Skye Leach',
    raceId: 'r02',
    top10: ['RUS', 'ANT', 'LEC', 'HAM', 'VER', 'PIA', 'NOR', 'HAD', 'BEA', 'GAS'],
    fastestLap: 'RUS',
    dnf: 'ALO',
    pointsEarned: 14,
    sprintTop8: ['RUS', 'ANT', 'HAM', 'NOR', 'LEC', 'PIA', 'VER', 'HAD'],
    sprintPointsEarned: 22,
  },
  // Skye Leach r03
  {
    userId: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
    username: 'skyeleach',
    displayName: 'Skye Leach',
    raceId: 'r03',
    top10: ['ANT', 'RUS', 'LEC', 'PIA', 'HAM', 'NOR', 'VER', 'HAD', 'GAS', 'LIN'],
    fastestLap: 'ANT',
    dnf: 'BOT',
    pointsEarned: 41,
    sprintTop8: [],
    sprintPointsEarned: 0,
  },
  // Skye Leach r05
  {
    userId: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
    username: 'skyeleach',
    displayName: 'Skye Leach',
    raceId: 'r05',
    top10: ['RUS', 'ANT', 'PIA', 'NOR', 'HAM', 'LEC', 'VER', 'HAD', 'LIN', 'LAW'],
    fastestLap: 'ANT',
    dnf: 'COL',
    pointsEarned: 1,
    sprintTop8: ['ANT', 'RUS', 'NOR', 'PIA', 'LEC', 'VER', 'HAM', 'HAD'],
    sprintPointsEarned: 9,
  },
  // Skye Leach r06
  {
    userId: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
    username: 'skyeleach',
    displayName: 'Skye Leach',
    raceId: 'r06',
    top10: ['ANT', 'VER', 'RUS', 'LEC', 'HAM', 'PIA', 'HAD', 'NOR', 'GAS', 'COL'],
    fastestLap: 'ANT',
    dnf: 'LAW',
    pointsEarned: 26,
    sprintTop8: [],
    sprintPointsEarned: 0,
  },
  // Whitney Trujillo r06
  {
    userId: '652154af-dc27-47b5-aa79-25903b9c4a1b',
    username: 'whitney',
    displayName: 'Whitney Trujillo',
    raceId: 'r06',
    top10: ['ANT', 'VER', 'HAM', 'LEC', 'HAD', 'PIA', 'RUS', 'NOR', 'GAS', 'SAI'],
    fastestLap: 'ANT',
    dnf: 'STR',
    pointsEarned: 36,
    sprintTop8: [],
    sprintPointsEarned: 0,
  },
  // Bryan Leach r06
  {
    userId: 'f35417e9-4f0d-4def-9c2f-c81276863fc0',
    username: 'bryanleach',
    displayName: 'Bryan Leach',
    raceId: 'r06',
    top10: ['ANT', 'VER', 'LEC', 'HAM', 'RUS', 'PIA', 'NOR', 'GAS', 'LAW', 'ALB'],
    fastestLap: 'ANT',
    dnf: 'HAD',
    pointsEarned: 26,
    sprintTop8: [],
    sprintPointsEarned: 0,
  },
];

const PROFILE_TOTALS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 147,  // Skye
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 228,  // Whitney
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 165,  // Bryan
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 230,  // Carlos
};

async function callRpc(method, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${method}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const text = await res.text();
  if (!res.ok) {
    console.log(`  RPC ${method} FAILED [${res.status}]: ${text.substring(0, 200)}`);
    return null;
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  console.log('Fixing predictions via RPC...\n');

  for (const corr of CORRECTIONS) {
    console.log(`${corr.username} ${corr.raceId}:`);
    
    // Delete old row first, then re-insert
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_predictions?user_id=eq.${corr.userId}&race_id=eq.${corr.raceId}`,
      { method: 'DELETE', headers }
    );
    console.log(`  Delete: ${delRes.status} ${delRes.ok ? 'OK' : await delRes.text()}`);
    
    // Insert new row via REST
    const insertBody = {
      user_id: corr.userId,
      race_id: corr.raceId,
      username: corr.username,
      display_name: corr.displayName,
      predicted_top10: corr.top10,
      predicted_fastest_lap: corr.fastestLap,
      predicted_dnf: corr.dnf,
      points_earned: corr.pointsEarned,
      predicted_sprint_top8: corr.sprintTop8,
      sprint_points_earned: corr.sprintPointsEarned,
    };

    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(insertBody),
    });
    console.log(`  Insert: ${insRes.status} ${insRes.ok ? 'OK' : await insRes.text()}`);
  }

  // Update profiles
  console.log('\nUpdating profiles...');
  for (const [userId, total] of Object.entries(PROFILE_TOTALS)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ total_points: total }),
    });
    console.log(`  ${userId.substring(0,8)}: ${res.status} ${res.ok ? 'OK' : await res.text()}`);
  }

  console.log('\nDone!');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
