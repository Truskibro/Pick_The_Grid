const { Client } = require('pg');

const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const DB_USER = 'postgres.fxwgbpassouaddakgyus';
const DB_PASSWORD = 'Dkivail3025!';
const DB_NAME = 'postgres';
const DB_PORT = 6543;

// Sprint dates for 2026 sprint weekends (Saturdays, day before race)
// China (r02): 2026-03-14, Miami (r04): 2026-05-02, Canada (r05): 2026-05-23,
// Britain (r09): 2026-07-04, Netherlands (r12): 2026-08-22, Singapore (r16): 2026-10-10
const SPRINT_TIMES = {
  r02: { date: '2026-03-14', time: '07:00' },
  r04: { date: '2026-05-02', time: '20:00' },
  r05: { date: '2026-05-23', time: '18:00' },
  r09: { date: '2026-07-04', time: '14:00' },
  r12: { date: '2026-08-22', time: '13:00' },
  r16: { date: '2026-10-10', time: '12:00' },
};

async function main() {
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
    console.log('Connected to Supabase');

    // Add sprint_date and sprint_time columns
    await client.query('alter table races add column if not exists sprint_date date');
    await client.query('alter table races add column if not exists sprint_time text');
    console.log('Added sprint_date/sprint_time columns');

    // Populate sprint dates for sprint weekends
    for (const [raceId, { date, time }] of Object.entries(SPRINT_TIMES)) {
      await client.query(
        'update races set sprint_date = $1, sprint_time = $2 where id = $3',
        [date, time, raceId]
      );
      console.log(`Set ${raceId} sprint: ${date} ${time}`);
    }

    // Clear sprint date/time for non-sprint races
    await client.query(
      'update races set sprint_date = null, sprint_time = null where has_sprint = false'
    );

    // Verify
    const res = await client.query('select id, has_sprint, sprint_date, sprint_time from races order by round');
    console.log('\nFinal state:');
    for (const row of res.rows) {
      if (row.has_sprint) {
        console.log(`  ${row.id}: sprint ${row.sprint_date} ${row.sprint_time}`);
      }
    }

    console.log('Done');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}

main();
