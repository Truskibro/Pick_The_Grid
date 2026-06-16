// Direct PostgreSQL fix: race IDs, Admin, recompute points
const { Client } = require('pg');

const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_USER = 'postgres.fxwgbpassouaddakgyus';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 6543;

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FL_BONUS = 1;
const DNF_BONUS = 10;

const RESULTS = {
  r01: { class: [{p:1,d:'RUS'},{p:2,d:'ANT'},{p:3,d:'LEC'},{p:4,d:'HAM'},{p:5,d:'NOR'},{p:6,d:'VER'},{p:7,d:'BEA'},{p:8,d:'LIN'},{p:9,d:'BOR'},{p:10,d:'GAS'},{p:11,d:'OCO'},{p:12,d:'ALB'},{p:13,d:'LAW'},{p:14,d:'COL'},{p:15,d:'SAI'},{p:16,d:'PER'},{p:17,d:'STR',s:'dnf'},{p:18,d:'ALO',s:'dnf'},{p:19,d:'BOT',s:'dnf'},{p:20,d:'HAD',s:'dnf'},{p:21,d:'PIA',s:'dns'},{p:22,d:'HUL',s:'dns'}], fl:'VER' },
  r02: { class: [{p:1,d:'ANT'},{p:2,d:'RUS'},{p:3,d:'HAM'},{p:4,d:'LEC'},{p:5,d:'BEA'},{p:6,d:'GAS'},{p:7,d:'LAW'},{p:8,d:'HAD'},{p:9,d:'SAI'},{p:10,d:'COL'},{p:11,d:'HUL'},{p:12,d:'LIN'},{p:13,d:'BOT'},{p:14,d:'OCO'},{p:15,d:'PER'},{p:16,d:'VER',s:'dnf'},{p:17,d:'ALO',s:'dnf'},{p:18,d:'STR',s:'dnf'},{p:19,d:'PIA',s:'dns'},{p:20,d:'NOR',s:'dns'},{p:21,d:'BOR',s:'dns'},{p:22,d:'ALB',s:'dns'}], fl:'ANT', sprint:[{p:1,d:'RUS'},{p:2,d:'LEC'},{p:3,d:'HAM'},{p:4,d:'NOR'},{p:5,d:'ANT'},{p:6,d:'PIA'},{p:7,d:'LAW'},{p:8,d:'BEA'}] },
  r03: { class: [{p:1,d:'ANT'},{p:2,d:'PIA'},{p:3,d:'LEC'},{p:4,d:'RUS'},{p:5,d:'NOR'},{p:6,d:'HAM'},{p:7,d:'GAS'},{p:8,d:'VER'},{p:9,d:'LAW'},{p:10,d:'OCO'},{p:11,d:'HUL'},{p:12,d:'HAD'},{p:13,d:'BOR'},{p:14,d:'LIN'},{p:15,d:'SAI'},{p:16,d:'COL'},{p:17,d:'PER'},{p:18,d:'ALO'},{p:19,d:'BOT'},{p:20,d:'ALB'},{p:21,d:'STR',s:'dnf'},{p:22,d:'BEA',s:'dnf'}], fl:'ANT' },
  r04: { class: [{p:1,d:'ANT'},{p:2,d:'NOR'},{p:3,d:'PIA'},{p:4,d:'RUS'},{p:5,d:'VER'},{p:6,d:'HAM'},{p:7,d:'COL'},{p:8,d:'LEC'},{p:9,d:'SAI'},{p:10,d:'ALB'},{p:11,d:'BEA'},{p:12,d:'BOR'},{p:13,d:'OCO'},{p:14,d:'LIN'},{p:15,d:'ALO'},{p:16,d:'PER'},{p:17,d:'STR'},{p:18,d:'BOT'},{p:19,d:'HUL',s:'dnf'},{p:20,d:'LAW',s:'dnf'},{p:21,d:'GAS',s:'dnf'},{p:22,d:'HAD',s:'dnf'}], fl:'NOR', sprint:[{p:1,d:'NOR'},{p:2,d:'PIA'},{p:3,d:'LEC'},{p:4,d:'RUS'},{p:5,d:'VER'},{p:6,d:'ANT'},{p:7,d:'HAM'},{p:8,d:'GAS'}] },
  r05: { class: [{p:1,d:'ANT'},{p:2,d:'HAM'},{p:3,d:'VER'},{p:4,d:'LEC'},{p:5,d:'HAD'},{p:6,d:'COL'},{p:7,d:'LAW'},{p:8,d:'GAS'},{p:9,d:'SAI'},{p:10,d:'BEA'},{p:11,d:'PIA'},{p:12,d:'HUL'},{p:13,d:'BOR'},{p:14,d:'OCO'},{p:15,d:'STR'},{p:16,d:'BOT'},{p:17,d:'PER',s:'dnf'},{p:18,d:'NOR',s:'dnf'},{p:19,d:'RUS',s:'dnf'},{p:20,d:'ALO',s:'dnf'},{p:21,d:'ALB',s:'dnf'},{p:22,d:'LIN',s:'dns'}], fl:'ANT', sprint:[{p:1,d:'RUS'},{p:2,d:'NOR'},{p:3,d:'ANT'},{p:4,d:'PIA'},{p:5,d:'LEC'},{p:6,d:'HAM'},{p:7,d:'VER'},{p:8,d:'LIN'}] },
  r06: { class: [{p:1,d:'ANT'},{p:2,d:'HAM'},{p:3,d:'GAS'},{p:4,d:'HAD'},{p:5,d:'PIA'},{p:6,d:'LAW'},{p:7,d:'LIN'},{p:8,d:'ALB'},{p:9,d:'OCO'},{p:10,d:'ALO'},{p:11,d:'BOR'},{p:12,d:'RUS'},{p:13,d:'HUL'},{p:14,d:'COL'},{p:15,d:'PER'},{p:16,d:'SAI',s:'dnf'},{p:17,d:'LEC',s:'dnf'},{p:18,d:'STR',s:'dnf'},{p:19,d:'NOR',s:'dnf'},{p:20,d:'BEA',s:'dnf'},{p:21,d:'BOT',s:'dnf'},{p:22,d:'VER',s:'dnf'}], fl:'ANT' },
  r07: { class: [{p:1,d:'HAM'},{p:2,d:'RUS'},{p:3,d:'NOR'},{p:4,d:'VER'},{p:5,d:'PIA'},{p:6,d:'HAD'},{p:7,d:'GAS'},{p:8,d:'LAW'},{p:9,d:'LIN'},{p:10,d:'COL'},{p:11,d:'BOR'},{p:12,d:'SAI'},{p:13,d:'OCO'},{p:14,d:'PER'},{p:15,d:'LEC',s:'dnf'},{p:16,d:'ANT',s:'dnf'},{p:17,d:'BEA',s:'dnf'},{p:18,d:'ALB',s:'dnf'},{p:19,d:'ALO',s:'dnf'},{p:20,d:'HUL',s:'dnf'},{p:21,d:'BOT',s:'dnf'},{p:22,d:'STR',s:'dnf'}], fl:'HAM' },
};

function isDnf(s) { return ['dnf','retired','ret','did not finish','did_not_finish'].includes((s||'').trim().toLowerCase()); }
function isDns(s) { return ['dns','did not start','did_not_start'].includes((s||'').trim().toLowerCase()); }

function computeGp(top10, fl, dnfPick, result) {
  let posPts=0; const scored=new Set();
  const rTop10=result.class.filter(e=>e.p<=10).sort((a,b)=>a.p-b.p).map(e=>e.d);
  for (let i=0;i<(top10||[]).length&&i<10;i++) {
    if (!top10[i]||scored.has(top10[i])) continue;
    scored.add(top10[i]);
    if (top10[i]===rTop10[i]) posPts+=F1_POINTS[i];
  }
  let flPts=(fl&&fl===result.fl)?FL_BONUS:0;
  const dnsSet=new Set(), dnfSet=new Set();
  for (const e of result.class) {
    if (isDns(e.s)) dnsSet.add(e.d);
    if (isDnf(e.s)&&!dnsSet.has(e.d)) dnfSet.add(e.d);
  }
  let dnfPts=0;
  if (!dnfPick&&dnfSet.size===0) dnfPts=DNF_BONUS;
  else if (dnfPick&&dnsSet.has(dnfPick)) {}
  else if (dnfPick&&dnfSet.has(dnfPick)) dnfPts=DNF_BONUS;
  return {gp:posPts+flPts+dnfPts,posPts,flPts,dnfPts};
}

function computeSprint(top8, sprintRes) {
  if (!sprintRes||sprintRes.length===0) return 0;
  let pts=0; const scored=new Set();
  const rTop8=sprintRes.filter(e=>e.p<=8).sort((a,b)=>a.p-b.p).map(e=>e.d);
  for (let i=0;i<(top8||[]).length&&i<8;i++) {
    if (!top8[i]||scored.has(top8[i])) continue;
    scored.add(top8[i]);
    if (top8[i]===rTop8[i]) pts+=SPRINT_POINTS[i];
  }
  return pts;
}

const RACE_ID_MAP = { r06:'r04', r07:'r05', r08:'r06', r09:'r07' };
function getRealRaceId(dbId) { return RACE_ID_MAP[dbId] || dbId; }

async function main() {
  const client = new Client({ host: HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await client.connect();
  console.log('Connected to PostgreSQL');

  // 1. Delete Admin
  const delRes = await client.query("DELETE FROM user_predictions WHERE username = 'Admin'");
  console.log(`Deleted Admin rows: ${delRes.rowCount}`);

  // 2. Fix race IDs
  for (const [oldId, newId] of Object.entries(RACE_ID_MAP)) {
    const updRes = await client.query('UPDATE user_predictions SET race_id = $1 WHERE race_id = $2', [newId, oldId]);
    console.log(`Race ID ${oldId}→${newId}: ${updRes.rowCount} rows updated`);
  }

  // 3. Fetch all rows
  const { rows } = await client.query('SELECT * FROM user_predictions ORDER BY user_id, race_id');
  console.log(`\nFetched ${rows.length} rows`);

  // Show current state
  console.log('\n=== Current DB state ===');
  for (const r of rows) console.log(`  ${r.username.padEnd(15)} ${r.race_id} GP=${r.points_earned||0} SP=${r.sprint_points_earned||0}`);

  // 4. Recompute
  console.log('\n=== Recomputing ===');
  let fixed = 0;
  for (const row of rows) {
    const realRaceId = getRealRaceId(row.race_id);
    const res = RESULTS[realRaceId];
    if (!res) { console.log(`  SKIP ${row.username} ${row.race_id} (no result for ${realRaceId})`); continue; }

    const gpSc = computeGp(row.predicted_top10, row.predicted_fastest_lap, row.predicted_dnf, res);
    let spSc = 0;
    if (row.predicted_sprint_top8?.length && res.sprint) spSc = computeSprint(row.predicted_sprint_top8, res.sprint);

    const dbGp = row.points_earned||0, dbSp = row.sprint_points_earned||0;
    if (gpSc.gp !== dbGp || spSc !== dbSp) {
      console.log(`  FIX ${row.username} ${row.race_id}→${realRaceId}: GP ${dbGp}→${gpSc.gp} SP ${dbSp}→${spSc} (P:${gpSc.posPts} FL:${gpSc.flPts} DNF:${gpSc.dnfPts})`);
      await client.query('UPDATE user_predictions SET points_earned = $1, sprint_points_earned = $2 WHERE id = $3', [gpSc.gp, spSc, row.id]);
      fixed++;
    } else {
      console.log(`  OK  ${row.username} ${row.race_id}→${realRaceId}: GP ${gpSc.gp} SP ${spSc} (P:${gpSc.posPts} FL:${gpSc.flPts} DNF:${gpSc.dnfPts})`);
    }
  }

  // 5. Final leaderboard
  const { rows: finalRows } = await client.query('SELECT * FROM user_predictions ORDER BY user_id, race_id');
  const totals = {};
  const VALID = ['r01','r02','r03','r04','r05','r06','r07'];
  for (const r of finalRows) {
    if (!VALID.includes(r.race_id)) continue;
    const uid = r.user_id;
    if (!totals[uid]) totals[uid] = { name: r.username, gp:0, sp:0, count:0 };
    totals[uid].gp += (r.points_earned||0);
    totals[uid].sp += (r.sprint_points_earned||0);
    totals[uid].count++;
  }

  console.log(`\n=== ${fixed} rows fixed ===\n`);
  console.log('=== FINAL LEADERBOARD ===');
  const sorted = Object.entries(totals).sort((a,b) => (b[1].gp+b[1].sp) - (a[1].gp+a[1].sp));
  let rank = 1;
  for (const [,v] of sorted) {
    console.log(`  #${rank} ${v.name.padEnd(15)} GP:${String(v.gp).padStart(3)} SP:${String(v.sp).padStart(2)} Total:${String(v.gp+v.sp).padStart(3)} (${v.count} races)`);
    rank++;
  }

  await client.end();
  console.log('\nDone. Database is now correct.');
}

main().catch(e => { console.error(e); process.exit(1); });
