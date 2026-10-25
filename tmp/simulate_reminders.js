// Simulate notification scheduling from the app's data sources to verify
// reminders fire for the right races at the right times.
// Mirrors lib/notifications.ts computeRaceEvents (time-gated, UTC).
const now = new Date();

function buildUtcDate(date, time) {
  const [h, m] = String(time).split(':');
  return new Date(`${date}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00Z`);
}

const LOCK = 120, START = 10, RACE_END = 120, SPRINT_END = 45;

function events(race) {
  const out = [];
  const push = (event, t) => {
    if (t > now) out.push(`${event} @ ${t.toISOString()}`);
  };
  if (race.sprint) {
    const s = buildUtcDate(race.sprintDate, race.sprintTime);
    push('sprint_lock', new Date(s.getTime() - LOCK * 60000));
    push('sprint_start', new Date(s.getTime() - START * 60000));
    push('sprint_end', new Date(s.getTime() + SPRINT_END * 60000));
  }
  const r = buildUtcDate(race.date, race.time);
  push('race_lock', new Date(r.getTime() - LOCK * 60000));
  push('race_start', new Date(r.getTime() - START * 60000));
  push('race_end', new Date(r.getTime() + RACE_END * 60000));
  return out;
}

const f1 = [
  { id: 'r12', name: 'Dutch GP', date: '2026-08-23', time: '13:00' },
  { id: 'r13', name: 'Italian GP', date: '2026-09-06', time: '13:00' },
  { id: 'r14', name: 'Madrid GP', date: '2026-09-13', time: '13:00' },
  { id: 'r15', name: 'Azerbaijan GP', date: '2026-09-26', time: '12:00' },
  { id: 'r15b', name: 'Bahrain GP', date: '2026-10-04', time: '15:00' },
  { id: 'r16', name: 'Singapore GP', date: '2026-10-11', time: '12:00', sprint: true, sprintDate: '2026-10-10', sprintTime: '12:00' },
  { id: 'r17', name: 'United States GP', date: '2026-10-25', time: '19:00' },
  { id: 'r18', name: 'Mexico City GP', date: '2026-11-01', time: '20:00' },
  { id: 'r19', name: 'Brazilian GP', date: '2026-11-08', time: '17:00' },
  { id: 'r20', name: 'Las Vegas GP', date: '2026-11-22', time: '06:00' },
  { id: 'r21', name: 'Qatar GP', date: '2026-11-29', time: '17:00' },
  { id: 'r22', name: 'Abu Dhabi GP', date: '2026-12-06', time: '14:00' },
];

const motogp = [
  { id: 'm08', name: 'Dutch TT', date: '2026-06-28', time: '13:00', sprint: true, sprintDate: '2026-06-27', sprintTime: '14:00' },
  { id: 'm09', name: 'German GP', date: '2026-07-12', time: '13:00' },
  { id: 'm10', name: 'Czech GP', date: '2026-07-26', time: '14:00', sprint: true, sprintDate: '2026-07-25', sprintTime: '14:00' },
  { id: 'm11', name: 'Austrian GP', date: '2026-08-16', time: '13:00', sprint: true, sprintDate: '2026-08-15', sprintTime: '13:00' },
  { id: 'm12', name: 'Aragon GP', date: '2026-09-06', time: '13:00' },
  { id: 'm13', name: 'San Marino GP', date: '2026-09-20', time: '13:00', sprint: true, sprintDate: '2026-09-19', sprintTime: '13:00' },
  { id: 'm14', name: 'Emilia-Romagna GP', date: '2026-10-04', time: '13:00' },
  { id: 'm15', name: 'Indonesian GP', date: '2026-10-18', time: '08:00', sprint: true, sprintDate: '2026-10-17', sprintTime: '08:00' },
  { id: 'm16', name: 'Japanese GP', date: '2026-10-25', time: '04:00', sprint: true, sprintDate: '2026-10-24', sprintTime: '04:00' },
  { id: 'm17', name: 'Australian GP', date: '2026-11-08', time: '04:00', sprint: true, sprintDate: '2026-11-07', sprintTime: '04:00' },
  { id: 'm18', name: 'Malaysian GP', date: '2026-11-15', time: '08:00' },
  { id: 'm19', name: 'Valencia GP', date: '2026-11-22', time: '14:00', sprint: true, sprintDate: '2026-11-21', sprintTime: '14:00' },
];

console.log('=== NOW:', now.toISOString(), '===');
for (const [label, list] of [['F1', f1], ['MotoGP', motogp]]) {
  console.log(`\n--- ${label} reminders that will be scheduled ---`);
  let count = 0;
  for (const race of list) {
    const evs = events(race);
    if (evs.length) {
      console.log(race.id, race.name);
      evs.forEach((e) => console.log('   ', e));
      count += evs.length;
    }
  }
  console.log(`total: ${count}`);
}
