const { Client } = require('pg');

async function main() {
  // Try direct connection (not pooler)
  const configs = [
    { host: 'db.fxwgbpassouaddakgyus.supabase.co', port: 5432, user: 'postgres', password: 'Dkivail3025!', database: 'postgres' },
    { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: 'postgres.fxwgbpassouaddakgyus', password: 'Dkivail3025!', database: 'postgres' },
    { host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543, user: 'postgres.fxwgbpassouaddakgyus', password: 'Dkivail3025!', database: 'postgres' },
  ];

  for (const cfg of configs) {
    try {
      console.log(`Trying ${cfg.user}@${cfg.host}:${cfg.port}...`);
      const client = new Client({ ...cfg, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
      await client.connect();
      console.log('Connected!');
      
      await client.query('alter table races add column if not exists sprint_date date');
      await client.query('alter table races add column if not exists sprint_time text');
      console.log('Added columns');

      const sprintData = [
        ['r02', '2026-03-14', '07:00'],
        ['r04', '2026-05-02', '20:00'],
        ['r05', '2026-05-23', '18:00'],
        ['r09', '2026-07-04', '14:00'],
        ['r12', '2026-08-22', '13:00'],
        ['r16', '2026-10-10', '12:00'],
      ];

      for (const [id, date, time] of sprintData) {
        await client.query('update races set sprint_date = $1, sprint_time = $2 where id = $3', [date, time, id]);
      }
      await client.query('update races set sprint_date = null, sprint_time = null where has_sprint = false');
      console.log('Populated sprint dates');

      const res = await client.query('select id, has_sprint, sprint_date, sprint_time from races where has_sprint = true order by round');
      for (const row of res.rows) {
        console.log(`  ${row.id}: ${row.sprint_date} ${row.sprint_time}`);
      }

      await client.end();
      return;
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }
  console.log('All connection attempts failed');
}

main();
