/**
 * FIX SUPABASE TO MATCH SPREADSHEET
 * 
 * 1. Reads seed-predictions.ts (authoritative spreadsheet data)
 * 2. Updates Supabase user_predictions table via PostgreSQL
 * 3. Recomputes all points against Supabase race_results
 * 4. Updates profiles.total_points
 */
const { Client } = require('pg');
const path = require('path');

// ── Database connection ───────────────────────────────────────────────────
const DB = {
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.fxwgbpassouaddakgyus',
  password: 'Dkivail3025!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
};

// ── Scoring engine ─────────────────────────────────────────────────────────
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

function norm(str) { return (str || '').trim().toUpperCase(); }

function calcMainPoints(predTop10, predFL, predDNF, classification, flDriverId, dnfDriverIds, dnsDriverIds) {
  let posPts = 0;
  const scored = new Set();
  const resultTop10 = classification.filter(e => e.position <= 10).sort((a,b) => a.position - b.position);
  
  for (let i = 0; i < Math.min(predTop10.length, 10); i++) {
    const p = norm(predTop10[i]);
    const a = norm(resultTop10[i]?.driverId || '');
    if (!p) continue;
    if (scored.has(p)) continue;
    scored.add(p);
    if (p === a) posPts += F1_POINTS[i];
  }
  
  // FL
  let flPts = 0;
  if (norm(predFL) === norm(flDriverId)) flPts = FASTEST_LAP_BONUS;
  
  // DNF
  let dnfPts = 0;
  const pDnf = norm(predDNF);
  const dnsSet = new Set((dnsDriverIds || []).map(norm));
  const dnfSet = new Set();
  for (const entry of classification) {
    const did = norm(entry.driverId);
    const status = (entry.status || '').trim().toLowerCase();
    if (dnsSet.has(did)) continue;
    if (['dnf','retired','ret'].includes(status)) dnfSet.add(did);
  }
  // Also add from dnfDriverIds array
  for (const did of (dnfDriverIds || [])) {
    const nd = norm(did);
    if (!dnsSet.has(nd)) dnfSet.add(nd);
  }
  
  if (!pDnf && dnfSet.size === 0) dnfPts = DNF_BONUS;
  else if (pDnf && !dnsSet.has(pDnf) && dnfSet.has(pDnf)) dnfPts = DNF_BONUS;
  
  return posPts + flPts + dnfPts;
}

function calcSprintPoints(predSprint, sprintClass) {
  if (!sprintClass || sprintClass.length === 0 || predSprint.length === 0) return 0;
  let pts = 0;
  const scored = new Set();
  const resultTop8 = sprintClass.filter(e => e.position <= 8).sort((a,b) => a.position - b.position);
  
  for (let i = 0; i < Math.min(predSprint.length, 8); i++) {
    const p = norm(predSprint[i]);
    const a = norm(resultTop8[i]?.driverId || '');
    if (!p) continue;
    if (scored.has(p)) continue;
    scored.add(p);
    if (p === a) pts += SPRINT_POINTS[i];
  }
  return pts;
}

// ── Source of truth: seed-predictions.ts ──────────────────────────────────
// Extracted from spreadsheet. These are the CORRECT predictions.
const SEED = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': { // Skye Leach
    r01: { top10: ['VER','RUS','ANT','PIA','LEC','NOR','HAM','HAD','LAW','SAI'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','BEA','GAS'], fl: 'RUS', dnf: 'ALO', sprint: ['RUS','ANT','HAM','NOR','LEC','PIA','VER','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','HAM','NOR','VER','HAD','GAS','LIN'], fl: 'ANT', dnf: 'BOT', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','HAM','PIA','HAD','GAS','BEA'], fl: 'VER', dnf: 'COL', sprint: ['ANT','NOR','PIA','RUS','LEC','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','PIA','NOR','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'ANT', dnf: 'COL', sprint: ['ANT','RUS','NOR','PIA','LEC','VER','HAM','HAD'] },
    r06: { top10: ['ANT','VER','RUS','LEC','HAM','PIA','HAD','NOR','GAS','COL'], fl: 'ANT', dnf: 'LAW', sprint: [] },
    r07: { top10: ['ANT','RUS','HAM','NOR','VER','PIA','LEC','HAD','HUL','GAS'], fl: 'ANT', dnf: 'LAW', sprint: [] },
  },
  '652154af-dc27-47b5-aa79-25903b9c4a1b': { // Whitney Trujillo
    r01: { top10: ['ANT','RUS','LEC','PIA','HAD','VER','NOR','HAM','LAW','HUL'], fl: 'VER', dnf: 'STR', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','VER','NOR','HAD','HUL','BEA'], fl: 'RUS', dnf: 'STR', sprint: ['ANT','RUS','NOR','HAM','VER','PIA','LEC','HAD'] },
    r03: { top10: ['ANT','RUS','LEC','PIA','NOR','VER','HAM','GAS','HAD','HUL'], fl: 'PIA', dnf: 'PER', sprint: [] },
    r04: { top10: ['PIA','VER','NOR','ANT','LEC','RUS','HAM','COL','SAI','GAS'], fl: null, dnf: 'STR', sprint: ['NOR','LEC','ANT','PIA','VER','RUS','HAM','COL'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'STR', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['ANT','VER','HAM','LEC','HAD','PIA','RUS','NOR','GAS','SAI'], fl: 'ANT', dnf: 'STR', sprint: [] },
    r07: { top10: ['HAM','RUS','VER','LEC','PIA','HAD','GAS','LAW','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: [] },
  },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': { // Bryan Leach
    r01: { top10: ['RUS','ANT','PIA','LEC','NOR','HAM','HAD','VER','LAW','LIN'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','LEC','HAM','PIA','NOR','VER','HAD','BEA','GAS'], fl: 'RUS', dnf: 'PER', sprint: ['RUS','ANT','HAM','LEC','LEC','VER','NOR','HAD'] },
    r03: { top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','PIA','HAM','GAS','HAD','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','NOR','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD','LIN','LAW'], fl: 'NOR', dnf: 'BOT', sprint: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD'] },
    r06: { top10: ['ANT','VER','LEC','HAM','RUS','PIA','NOR','GAS','LAW','ALB'], fl: 'ANT', dnf: 'HAD', sprint: [] },
    r07: { top10: ['RUS','ANT','HAM','VER','LEC','PIA','HAD','LAW','SAI','LIN'], fl: 'ANT', dnf: null, sprint: [] },
  },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': { // Carlos Trujillo
    r01: { top10: ['RUS','ANT','LEC','PIA','HAD','HAM','NOR','VER','LAW','HUL'], fl: 'RUS', dnf: 'ALO', sprint: [] },
    r02: { top10: ['RUS','ANT','HAM','LEC','NOR','PIA','VER','HAD','GAS','HUL'], fl: 'RUS', dnf: 'ALB', sprint: ['RUS','ANT','HAM','NOR','LEC','VER','PIA','GAS'] },
    r03: { top10: ['ANT','RUS','LEC','HAM','PIA','NOR','HAD','VER','GAS','LIN'], fl: 'RUS', dnf: 'STR', sprint: [] },
    r04: { top10: ['VER','ANT','NOR','LEC','RUS','LEC','PIA','HAM','GAS','HUL'], fl: 'VER', dnf: null, sprint: ['NOR','ANT','PIA','LEC','RUS','VER','HAM','HAD'] },
    r05: { top10: ['ANT','RUS','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'], fl: 'ANT', dnf: 'ALO', sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'] },
    r06: { top10: ['VER','ANT','HAM','LEC','HAD','RUS','PIA','NOR','GAS','LAW'], fl: 'VER', dnf: 'BOR', sprint: [] },
    r07: { top10: ['RUS','HAM','ANT','VER','NOR','LEC','HAD','PIA','HUL','LAW'], fl: 'RUS', dnf: null, sprint: [] },
  },
};

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client(DB);
  await client.connect();
  console.log('Connected to Supabase PostgreSQL.\n');

  // 1. Fetch current race_results
  const rrRes = await client.query('SELECT race_id, classification, fastest_lap_driver_id, dnf_driver_ids, dns_driver_ids, sprint_classification FROM race_results');
  const raceResults = {};
  for (const row of rrRes.rows) {
    raceResults[row.race_id] = row;
  }
  console.log(`Loaded ${Object.keys(raceResults).length} race results.`);

  // 2. Fetch current user_predictions
  const predRes = await client.query('SELECT id, user_id, race_id, predicted_top10, predicted_fastest_lap, predicted_dnf, predicted_sprint_top8, points_earned, sprint_points_earned FROM user_predictions ORDER BY user_id, race_id');
  const supabasePreds = {};
  for (const row of predRes.rows) {
    supabasePreds[`${row.user_id}:${row.race_id}`] = row;
  }
  console.log(`Loaded ${predRes.rows.length} Supabase predictions.`);

  // 3. Compare seed vs Supabase and build update list
  const updates = [];
  let matchCount = 0;
  let mismatchCount = 0;

  for (const [userId, races] of Object.entries(SEED)) {
    for (const [raceId, picks] of Object.entries(races)) {
      const key = `${userId}:${raceId}`;
      const sb = supabasePreds[key];

      const seedTop10 = picks.top10;
      const seedSprint = picks.sprint;
      const seedFl = picks.fl;
      const seedDnf = picks.dnf;

      if (!sb) {
        console.log(`  MISSING in Supabase: ${userId.substring(0,8)} ${raceId}`);
        continue;
      }

      const sbTop10 = sb.predicted_top10 || [];
      const sbSprint = sb.predicted_sprint_top8 || [];
      const sbFl = sb.predicted_fastest_lap;
      const sbDnf = sb.predicted_dnf;

      const top10Match = JSON.stringify(seedTop10) === JSON.stringify(sbTop10);
      const sprintMatch = JSON.stringify(seedSprint) === JSON.stringify(sbSprint);
      const flMatch = seedFl === sbFl;
      const dnfMatch = seedDnf === sbDnf;

      if (top10Match && sprintMatch && flMatch && dnfMatch) {
        matchCount++;
      } else {
        mismatchCount++;
        console.log(`  FIXING ${userId.substring(0,8)} ${raceId}:`);
        if (!top10Match) console.log(`    Top10: SB=${sbTop10.slice(0,3).join(',')}... → Seed=${seedTop10.slice(0,3).join(',')}...`);
        if (!sprintMatch) console.log(`    Sprint: SB=${sbSprint.slice(0,3).join(',')}... → Seed=${seedSprint.slice(0,3).join(',')}...`);
        if (!flMatch) console.log(`    FL: SB=${sbFl} → Seed=${seedFl}`);
        if (!dnfMatch) console.log(`    DNF: SB=${sbDnf} → Seed=${seedDnf}`);

        // Compute new points
        const rr = raceResults[raceId];
        let newMainPts = 0;
        let newSprintPts = 0;

        if (rr && rr.classification && rr.classification.length > 0 && seedTop10.length > 0) {
          newMainPts = calcMainPoints(
            seedTop10, seedFl, seedDnf,
            rr.classification, rr.fastest_lap_driver_id,
            rr.dnf_driver_ids, rr.dns_driver_ids
          );
        }

        if (rr && rr.sprint_classification && rr.sprint_classification.length > 0 && seedSprint.length > 0) {
          newSprintPts = calcSprintPoints(seedSprint, rr.sprint_classification);
        }

        updates.push({
          userId,
          raceId,
          top10: seedTop10,
          fl: seedFl,
          dnf: seedDnf,
          sprint: seedSprint,
          mainPts: newMainPts,
          sprintPts: newSprintPts,
        });
      }
    }
  }

  console.log(`\nMatches: ${matchCount}, Mismatches: ${mismatchCount}\n`);

  // 4. Apply updates
  if (updates.length > 0) {
    console.log(`Applying ${updates.length} updates...`);
    for (const u of updates) {
      await client.query(
        `UPDATE user_predictions 
         SET predicted_top10 = $1, 
             predicted_fastest_lap = $2, 
             predicted_dnf = $3, 
             predicted_sprint_top8 = $4,
             points_earned = $5,
             sprint_points_earned = $6,
             updated_at = NOW()
         WHERE user_id = $7 AND race_id = $8`,
        [u.top10, u.fl, u.dnf, u.sprint, u.mainPts, u.sprintPts, u.userId, u.raceId]
      );
      console.log(`  ✅ Updated ${u.userId.substring(0,8)} ${u.raceId}: Main=${u.mainPts} Sprint=${u.sprintPts}`);
    }
  }

  // 5. Also recompute points for races that DID match (points might be stale)
  console.log('\nRecomputing all points (even for matches)...');
  let pointsChanged = 0;
  for (const [key, sb] of Object.entries(supabasePreds)) {
    const rr = raceResults[sb.race_id];
    if (!rr || !rr.classification || rr.classification.length === 0) continue;
    if (sb.predicted_top10.length === 0) continue;

    const newMain = calcMainPoints(
      sb.predicted_top10, sb.predicted_fastest_lap, sb.predicted_dnf,
      rr.classification, rr.fastest_lap_driver_id,
      rr.dnf_driver_ids, rr.dns_driver_ids
    );
    
    const newSprint = calcSprintPoints(
      sb.predicted_sprint_top8 || [],
      rr.sprint_classification || []
    );

    if (newMain !== (sb.points_earned || 0) || newSprint !== (sb.sprint_points_earned || 0)) {
      await client.query(
        `UPDATE user_predictions SET points_earned = $1, sprint_points_earned = $2, updated_at = NOW()
         WHERE user_id = $3 AND race_id = $4`,
        [newMain, newSprint, sb.user_id, sb.race_id]
      );
      console.log(`  📊 Re-scored ${sb.user_id.substring(0,8)} ${sb.race_id}: ${sb.points_earned}→${newMain} S:${sb.sprint_points_earned}→${newSprint}`);
      pointsChanged++;
    }
  }
  console.log(`Points recalculated for ${pointsChanged} predictions.`);

  // 6. Update profile totals
  console.log('\nUpdating profile totals...');
  const totalsRes = await client.query(
    `SELECT user_id, SUM(COALESCE(points_earned,0) + COALESCE(sprint_points_earned,0)) as total
     FROM user_predictions GROUP BY user_id`
  );
  
  for (const row of totalsRes.rows) {
    await client.query(
      `UPDATE profiles SET total_points = $1, updated_at = NOW() WHERE id = $2`,
      [row.total, row.user_id]
    );
    console.log(`  Profile ${row.user_id.substring(0,8)}: total_points = ${row.total}`);
  }

  // 7. Final verification
  console.log('\n═══ FINAL STATE ═══');
  const finalRes = await client.query(
    `SELECT p.id, p.username, p.display_name, p.total_points,
            COUNT(up.id) as num_preds,
            SUM(COALESCE(up.points_earned,0) + COALESCE(up.sprint_points_earned,0)) as computed_total
     FROM profiles p
     LEFT JOIN user_predictions up ON up.user_id = p.id
     GROUP BY p.id, p.username, p.display_name, p.total_points
     ORDER BY p.total_points DESC`
  );
  
  for (const row of finalRes.rows) {
    const name = row.display_name || row.username || '?';
    console.log(`  ${name}: ${row.total_points} pts (${row.num_preds} predictions, computed=${row.computed_total})`);
  }

  await client.end();
  console.log('\n✅ Done.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
