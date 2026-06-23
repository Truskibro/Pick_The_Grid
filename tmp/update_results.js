// Update race_results with verified 2026 data
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.substring(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

const UPDATES = {
  r01: {
    classification: [
      {position:1,driverId:'RUS',status:'finished'},{position:2,driverId:'ANT',status:'finished'},{position:3,driverId:'LEC',status:'finished'},
      {position:4,driverId:'HAM',status:'finished'},{position:5,driverId:'NOR',status:'finished'},{position:6,driverId:'VER',status:'finished'},
      {position:7,driverId:'BEA',status:'finished'},{position:8,driverId:'LIN',status:'finished'},{position:9,driverId:'BOR',status:'finished'},
      {position:10,driverId:'GAS',status:'finished'},{position:11,driverId:'OCO',status:'finished'},{position:12,driverId:'ALB',status:'finished'},
      {position:13,driverId:'LAW',status:'finished'},{position:14,driverId:'COL',status:'finished'},{position:15,driverId:'SAI',status:'finished'},
      {position:16,driverId:'PER',status:'finished'},{position:17,driverId:'STR',status:'finished'},{position:18,driverId:'ALO',status:'dnf'},
      {position:19,driverId:'BOT',status:'dnf'},{position:20,driverId:'HAD',status:'dnf'},{position:21,driverId:'PIA',status:'dns'},
      {position:22,driverId:'HUL',status:'dns'},
    ],
    fastest_lap_driver_id: 'VER',
    dnf_driver_ids: ['ALO','BOT','HAD'],
    dns_driver_ids: ['PIA','HUL'],
    sprint_classification: [],
  },
  r02: {
    classification: [
      {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'RUS',status:'finished'},{position:3,driverId:'HAM',status:'finished'},
      {position:4,driverId:'LEC',status:'finished'},{position:5,driverId:'BEA',status:'finished'},{position:6,driverId:'GAS',status:'finished'},
      {position:7,driverId:'LAW',status:'finished'},{position:8,driverId:'HAD',status:'finished'},{position:9,driverId:'SAI',status:'finished'},
      {position:10,driverId:'COL',status:'finished'},{position:11,driverId:'HUL',status:'finished'},{position:12,driverId:'LIN',status:'finished'},
      {position:13,driverId:'BOT',status:'finished'},{position:14,driverId:'OCO',status:'finished'},{position:15,driverId:'PER',status:'finished'},
      {position:16,driverId:'VER',status:'dnf'},{position:17,driverId:'ALO',status:'dnf'},{position:18,driverId:'STR',status:'dnf'},
      {position:19,driverId:'PIA',status:'dns'},{position:20,driverId:'NOR',status:'dns'},{position:21,driverId:'BOR',status:'dns'},
      {position:22,driverId:'ALB',status:'dns'},
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['VER','ALO','STR'],
    dns_driver_ids: ['PIA','NOR','BOR','ALB'],
    sprint_classification: [
      {position:1,driverId:'RUS',status:'finished'},{position:2,driverId:'LEC',status:'finished'},{position:3,driverId:'HAM',status:'finished'},
      {position:4,driverId:'NOR',status:'finished'},{position:5,driverId:'ANT',status:'finished'},{position:6,driverId:'PIA',status:'finished'},
      {position:7,driverId:'LAW',status:'finished'},{position:8,driverId:'BEA',status:'finished'},
    ],
  },
  r03: {
    classification: [
      {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'PIA',status:'finished'},{position:3,driverId:'LEC',status:'finished'},
      {position:4,driverId:'RUS',status:'finished'},{position:5,driverId:'NOR',status:'finished'},{position:6,driverId:'HAM',status:'finished'},
      {position:7,driverId:'GAS',status:'finished'},{position:8,driverId:'VER',status:'finished'},{position:9,driverId:'LAW',status:'finished'},
      {position:10,driverId:'OCO',status:'finished'},{position:11,driverId:'HUL',status:'finished'},{position:12,driverId:'HAD',status:'finished'},
      {position:13,driverId:'BOR',status:'finished'},{position:14,driverId:'LIN',status:'finished'},{position:15,driverId:'SAI',status:'finished'},
      {position:16,driverId:'COL',status:'finished'},{position:17,driverId:'PER',status:'finished'},{position:18,driverId:'ALO',status:'finished'},
      {position:19,driverId:'BOT',status:'finished'},{position:20,driverId:'ALB',status:'finished'},{position:21,driverId:'STR',status:'dnf'},
      {position:22,driverId:'BEA',status:'dnf'},
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['STR','BEA'],
    dns_driver_ids: [],
    sprint_classification: [],
  },
  r04: {
    classification: [
      {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'NOR',status:'finished'},{position:3,driverId:'PIA',status:'finished'},
      {position:4,driverId:'RUS',status:'finished'},{position:5,driverId:'VER',status:'finished'},{position:6,driverId:'HAM',status:'finished'},
      {position:7,driverId:'COL',status:'finished'},{position:8,driverId:'LEC',status:'finished'},{position:9,driverId:'SAI',status:'finished'},
      {position:10,driverId:'ALB',status:'finished'},{position:11,driverId:'BEA',status:'finished'},{position:12,driverId:'BOR',status:'finished'},
      {position:13,driverId:'OCO',status:'finished'},{position:14,driverId:'LIN',status:'finished'},{position:15,driverId:'ALO',status:'finished'},
      {position:16,driverId:'PER',status:'finished'},{position:17,driverId:'STR',status:'finished'},{position:18,driverId:'BOT',status:'finished'},
      {position:19,driverId:'HUL',status:'dnf'},{position:20,driverId:'LAW',status:'dnf'},{position:21,driverId:'GAS',status:'dnf'},
      {position:22,driverId:'HAD',status:'dnf'},
    ],
    fastest_lap_driver_id: 'NOR',
    dnf_driver_ids: ['HUL','LAW','GAS','HAD'],
    dns_driver_ids: [],
    sprint_classification: [
      {position:1,driverId:'NOR',status:'finished'},{position:2,driverId:'PIA',status:'finished'},{position:3,driverId:'LEC',status:'finished'},
      {position:4,driverId:'RUS',status:'finished'},{position:5,driverId:'VER',status:'finished'},{position:6,driverId:'ANT',status:'finished'},
      {position:7,driverId:'HAM',status:'finished'},{position:8,driverId:'GAS',status:'finished'},
    ],
  },
  r05: {
    classification: [
      {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'HAM',status:'finished'},{position:3,driverId:'VER',status:'finished'},
      {position:4,driverId:'LEC',status:'finished'},{position:5,driverId:'HAD',status:'finished'},{position:6,driverId:'COL',status:'finished'},
      {position:7,driverId:'LAW',status:'finished'},{position:8,driverId:'GAS',status:'finished'},{position:9,driverId:'SAI',status:'finished'},
      {position:10,driverId:'BEA',status:'finished'},{position:11,driverId:'PIA',status:'finished'},{position:12,driverId:'HUL',status:'finished'},
      {position:13,driverId:'BOR',status:'finished'},{position:14,driverId:'OCO',status:'finished'},{position:15,driverId:'STR',status:'finished'},
      {position:16,driverId:'BOT',status:'finished'},{position:17,driverId:'PER',status:'dnf'},{position:18,driverId:'NOR',status:'dnf'},
      {position:19,driverId:'RUS',status:'dnf'},{position:20,driverId:'ALO',status:'dnf'},{position:21,driverId:'ALB',status:'dnf'},
      {position:22,driverId:'LIN',status:'dns'},
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['PER','NOR','RUS','ALO','ALB'],
    dns_driver_ids: ['LIN'],
    sprint_classification: [
      {position:1,driverId:'RUS',status:'finished'},{position:2,driverId:'NOR',status:'finished'},{position:3,driverId:'ANT',status:'finished'},
      {position:4,driverId:'PIA',status:'finished'},{position:5,driverId:'LEC',status:'finished'},{position:6,driverId:'HAM',status:'finished'},
      {position:7,driverId:'VER',status:'finished'},{position:8,driverId:'LIN',status:'finished'},
    ],
  },
  r06: {
    classification: [
      {position:1,driverId:'ANT',status:'finished'},{position:2,driverId:'HAM',status:'finished'},{position:3,driverId:'GAS',status:'finished'},
      {position:4,driverId:'HAD',status:'finished'},{position:5,driverId:'PIA',status:'finished'},{position:6,driverId:'LAW',status:'finished'},
      {position:7,driverId:'LIN',status:'finished'},{position:8,driverId:'ALB',status:'finished'},{position:9,driverId:'OCO',status:'finished'},
      {position:10,driverId:'ALO',status:'finished'},{position:11,driverId:'BOR',status:'finished'},{position:12,driverId:'RUS',status:'finished'},
      {position:13,driverId:'HUL',status:'finished'},{position:14,driverId:'COL',status:'finished'},{position:15,driverId:'PER',status:'finished'},
      {position:16,driverId:'SAI',status:'dnf'},{position:17,driverId:'LEC',status:'dnf'},{position:18,driverId:'STR',status:'dnf'},
      {position:19,driverId:'NOR',status:'dnf'},{position:20,driverId:'BEA',status:'dnf'},{position:21,driverId:'BOT',status:'dnf'},
      {position:22,driverId:'VER',status:'dnf'},
    ],
    fastest_lap_driver_id: 'ANT',
    dnf_driver_ids: ['SAI','LEC','STR','NOR','BEA','BOT','VER'],
    dns_driver_ids: [],
    sprint_classification: [],
  },
  r07: {
    classification: [
      {position:1,driverId:'HAM',status:'finished'},{position:2,driverId:'RUS',status:'finished'},{position:3,driverId:'NOR',status:'finished'},
      {position:4,driverId:'VER',status:'finished'},{position:5,driverId:'PIA',status:'finished'},{position:6,driverId:'HAD',status:'finished'},
      {position:7,driverId:'GAS',status:'finished'},{position:8,driverId:'LAW',status:'finished'},{position:9,driverId:'LIN',status:'finished'},
      {position:10,driverId:'COL',status:'finished'},{position:11,driverId:'BOR',status:'finished'},{position:12,driverId:'SAI',status:'finished'},
      {position:13,driverId:'OCO',status:'finished'},{position:14,driverId:'PER',status:'finished'},{position:15,driverId:'LEC',status:'dnf'},
      {position:16,driverId:'ANT',status:'dnf'},{position:17,driverId:'BEA',status:'dnf'},{position:18,driverId:'ALB',status:'finished'},
      {position:19,driverId:'ALO',status:'dnf'},{position:20,driverId:'HUL',status:'dnf'},{position:21,driverId:'BOT',status:'dnf'},
      {position:22,driverId:'STR',status:'dnf'},
    ],
    fastest_lap_driver_id: 'HAM',
    dnf_driver_ids: ['LEC','ANT','BEA','ALO','HUL','BOT','STR'],
    dns_driver_ids: [],
    sprint_classification: [],
  },
};

async function main() {
  console.log('Updating race_results with verified 2026 data...\n');

  for (const [raceId, data] of Object.entries(UPDATES)) {
    try {
      await supabaseFetch(`race_results?race_id=eq.${raceId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      const sc = data.sprint_classification || [];
      console.log(`  Updated ${raceId}: ${data.classification.length} pos, FL=${data.fastest_lap_driver_id}, DNF=${data.dnf_driver_ids.length}, DNS=${data.dns_driver_ids.length}, Sprint=${sc.length}`);
    } catch (e) {
      console.log(`  ERROR ${raceId}: ${e.message}`);
    }
  }

  // Verify
  console.log('\n--- Verification ---');
  try {
    const results = await supabaseFetch('race_results?select=race_id,fastest_lap_driver_id,dnf_driver_ids&order=race_id.asc');
    for (const r of (Array.isArray(results) ? results : [])) {
      console.log(`  ${r.race_id}: FL=${r.fastest_lap_driver_id}, DNF=[${(r.dnf_driver_ids||[]).join(',')}]`);
    }
  } catch (e) {
    console.log('Verify error:', e.message);
  }

  console.log('\nDone!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
