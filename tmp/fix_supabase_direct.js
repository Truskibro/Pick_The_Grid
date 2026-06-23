const { Client } = require('pg');

const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_USER = 'postgres.fxwgbpassouaddakgyus';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 6543;

// ---- SCORING ENGINE ----
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// Race results
const MOCK_RESULTS = {
  r01: {
    top10: ['RUS','ANT','LEC','HAM','NOR','VER','BEA','LIN','BOR','GAS'],
    fl: 'VER',
    dnf: ['ALO','BOT','HAD'],
    dns: ['PIA','HUL'],
    sprint: null,
  },
  r02: {
    top10: ['ANT','RUS','HAM','LEC','BEA','GAS','LAW','HAD','SAI','COL'],
    fl: 'ANT',
    dnf: ['VER','ALO','STR'],
    dns: ['PIA','NOR','BOR','ALB'],
    sprint: { top8: ['RUS','LEC','HAM','NOR','ANT','PIA','LAW','BEA'] },
  },
  r03: {
    top10: ['ANT','PIA','LEC','RUS','NOR','HAM','GAS','VER','LAW','OCO'],
    fl: 'ANT',
    dnf: ['STR','BEA'],
    dns: [],
    sprint: null,
  },
  r04: {
    top10: ['ANT','NOR','PIA','RUS','VER','HAM','COL','LEC','SAI','ALB'],
    fl: 'NOR',
    dnf: ['HUL','LAW','GAS','HAD'],
    dns: [],
    sprint: { top8: ['NOR','PIA','LEC','RUS','VER','ANT','HAM','GAS'] },
  },
  r05: {
    top10: ['ANT','HAM','VER','LEC','HAD','COL','LAW','GAS','SAI','BEA'],
    fl: 'ANT',
    dnf: ['PER','NOR','RUS','ALO','ALB'],
    dns: ['LIN'],
    sprint: { top8: ['RUS','NOR','ANT','PIA','LEC','HAM','VER','LIN'] },
  },
  r06: {
    top10: ['ANT','HAM','GAS','HAD','PIA','LAW','LIN','ALB','OCO','ALO'],
    fl: 'ANT',
    dnf: ['SAI','LEC','STR','NOR','BEA','BOT','VER'],
    dns: [],
    sprint: null,
  },
};

function scoreRace(top10, fl, dnf, result) {
  let pts = 0;
  for (let i = 0; i < Math.min(top10.length, 10); i++) {
    if (top10[i] === result.top10[i]) pts += F1_POINTS[i];
  }
  if (fl && fl === result.fl) pts += FASTEST_LAP_BONUS;
  if (!dnf) {
    if (result.dnf.length === 0) pts += DNF_BONUS;
  } else if (!result.dns.includes(dnf) && result.dnf.includes(dnf)) {
    pts += DNF_BONUS;
  }
  return pts;
}

function scoreSprint(top8, sprint) {
  if (!sprint) return 0;
  let pts = 0;
  for (let i = 0; i < Math.min(top8.length, 8); i++) {
    if (top8[i] === sprint.top8[i]) pts += SPRINT_POINTS[i];
  }
  return pts;
}

// Spreadsheet predictions
const PREDS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': {
    r01: { top10: ['VER','RUS','ANT','PIA','LEC','NOR','HAM','HAD','LAW','SAI'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','BEA','GAS'], fl: 'RUS', dnf: 'ALO', sprint: ['RUS','ANT','HAM','NOR','LEC','PIA','VER','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','HAM','NOR','VER','HAD','GAS','LIN'], fl: 'ANT', dnf: 'BOT', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','HAM','PIA','HAD','GAS','BEA'], fl: 'VER', dnf: 'COL', sprint: ['ANT','NOR','PIA','RUS','LEC','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','PIA','NOR','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'ANT', dnf: 'COL', sprint: ['ANT','RUS','NOR','PIA','LEC','VER','HAM','HAD'] },
    r06: { top10: ['ANT','VER','RUS','LEC','HAM','PIA','HAD','NOR','GAS','COL'], fl: 'ANT', dnf: 'LAW', sprint: [] },
  },
  '652154af-dc27-47b5-aa79-25903b9c4a1b': {
    r01: { top10: ['ANT','RUS','LEC','PIA','HAD','VER','NOR','HAM','LAW','HUL'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','VER','NOR','HAD','HUL','BEA'], fl: 'RUS', dnf: 'STR', sprint: ['ANT','RUS','NOR','HAM','VER','PIA','LEC','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','NOR','VER','HAM','GAS','HAD','HUL'], fl: 'PIA', dnf: 'PER', sprint: [] },
    r04: { top10: ['PIA','VER','NOR','ANT','LEC','RUS','HAM','COL','SAI','GAS'], fl: null, dnf: 'STR', sprint: ['NOR','LEC','ANT','PIA','VER','RUS','HAM','COL'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'STR', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['ANT','VER','HAM','LEC','HAD','PIA','RUS','NOR','GAS','SAI'], fl: 'ANT', dnf: 'STR', sprint: [] },
  },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': {
    r01: { top10: ['RUS','ANT','PIA','LEC','NOR','HAM','HAD','VER','LAW','LIN'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','NOR','VER','HAD','BEA','GAS'], fl: 'RUS', dnf: 'PER', sprint: ['RUS','ANT','HAM','LEC','LEC','VER','NOR','HAD'] },
    r03: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','PIA','HAM','GAS','HAD','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','NOR','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'NOR', dnf: 'BOT', sprint: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD'] },
    r06: { top10: ['ANT','VER','LEC','HAM','RUS','PIA','NOR','GAS','LAW','ALB'], fl: 'ANT', dnf: 'HAD', sprint: [] },
  },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': {
    r01: { top10: ['RUS','ANT','LEC','PIA','HAD','HAM','NOR','VER','LAW','HUL'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','HAM','LEC','NOR','PIA','VER','HAD','GAS','HUL'], fl: 'RUS', dnf: 'ALB', sprint: ['RUS','ANT','HAM','NOR','LEC','VER','PIA','GAS'] },
    r03: { top10: ['ANT','RUS','LEC','HAM','PIA','NOR','HAD','VER','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','LEC','PIA','HAM','GAS','HUL'], fl: 'VER', dnf: null, sprint: ['NOR','ANT','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['ANT','RUS','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['VER','ANT','HAM','LEC','HAD','RUS','PIA','NOR','GAS','LAW'], fl: 'VER', dnf: 'BOR', sprint: [] },
  },
};

// Display names
const DISPLAY_NAMES = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': { username: 'skyeleach', displayName: 'Skye Leach' },
  '652154af-dc27-47b5-aa79-25903b9c4a1b': { username: 'whitney', displayName: 'Whitney Trujillo' },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': { username: 'bryanleach', displayName: 'Bryan Leach' },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': { username: 'sainz4ever55', displayName: 'Carlos Trujillo' },
};

async function main() {
  const client = new Client({
    host: HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
  });
  
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');
    
    // 1. DELETE all existing predictions for these users
    const userIds = Object.keys(PREDS);
    const deleteResult = await client.query(
      'DELETE FROM user_predictions WHERE user_id = ANY($1::uuid[])',
      [userIds]
    );
    console.log(`Deleted ${deleteResult.rowCount} existing prediction rows`);
    
    // 2. INSERT correct predictions with computed points
    let totalInserted = 0;
    const userTotals = {};
    
    for (const [userId, races] of Object.entries(PREDS)) {
      let userTotal = 0;
      
      for (const [raceId, preds] of Object.entries(races)) {
        const result = MOCK_RESULTS[raceId];
        if (!result) { console.log(`  SKIP ${raceId}: no results`); continue; }
        
        const racePts = scoreRace(preds.top10, preds.fl, preds.dnf, result);
        const sprintPts = scoreSprint(preds.sprint, result.sprint);
        
        const names = DISPLAY_NAMES[userId];
        
        await client.query(
          `INSERT INTO user_predictions (user_id, race_id, username, display_name, predicted_top10, predicted_fastest_lap, predicted_dnf, points_earned, predicted_sprint_top8, sprint_points_earned)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [userId, raceId, names.username, names.displayName, preds.top10, preds.fl, preds.dnf, racePts, preds.sprint, sprintPts]
        );
        
        userTotal += racePts + sprintPts;
        totalInserted++;
        console.log(`  INSERT ${userId.substring(0,8)} ${raceId}: race=${racePts} sprint=${sprintPts}`);
      }
      
      userTotals[userId] = userTotal;
      console.log(`  TOTAL ${userId.substring(0,8)}: ${userTotal}`);
    }
    
    console.log(`\nInserted ${totalInserted} prediction rows`);
    
    // 3. Update profile totals
    for (const [userId, total] of Object.entries(userTotals)) {
      await client.query(
        'UPDATE profiles SET total_points = $1 WHERE id = $2',
        [total, userId]
      );
      console.log(`  Profile ${userId.substring(0,8)}: total_points = ${total}`);
    }
    
    // 4. Verify
    console.log('\n=== VERIFICATION ===');
    const verify = await client.query(
      `SELECT user_id, race_id, points_earned, sprint_points_earned, predicted_top10 
       FROM user_predictions 
       WHERE user_id = ANY($1::uuid[]) 
       ORDER BY user_id, race_id`,
      [userIds]
    );
    
    for (const row of verify.rows) {
      const total = (row.points_earned || 0) + (row.sprint_points_earned || 0);
      const top3 = (row.predicted_top10 || []).slice(0, 3).join(', ');
      console.log(`  ${row.user_id.substring(0,8)} ${row.race_id}: race=${row.points_earned} sprint=${row.sprint_points_earned} total=${total} | ${top3}...`);
    }
    
    // Also verify profiles
    const profVerify = await client.query(
      'SELECT id, total_points FROM profiles WHERE id = ANY($1::uuid[])',
      [userIds]
    );
    for (const row of profVerify.rows) {
      console.log(`  Profile ${row.id.substring(0,8)}: total=${row.total_points}`);
    }
    
    await client.end();
    console.log('\nDone!');
  } catch(e) {
    console.error('Error:', e.message);
    if (client) await client.end().catch(() => {});
    process.exit(1);
  }
}

main();
