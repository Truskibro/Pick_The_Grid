// Simulate the scoring logic exactly as it runs in the app

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

interface ClassificationEntry {
  position: number;
  driverId: string;
  time: string;
  gap: string;
  points: number;
  status: string;
}

interface RaceResult {
  raceId: string;
  classification: ClassificationEntry[];
  fastestLapDriverId: string;
  dnfDriverIds: string[];
  sprintClassification?: ClassificationEntry[];
}

// Driver mapping: spreadsheet → app ID
const D: Record<string, string> = {
  'M. Verstappen': 'VER', 'G. Russell': 'RUS', 'K. Antonelli': 'ANT',
  'O. Piastri': 'PIA', 'C. Leclerc': 'LEC', 'L. Norris': 'NOR',
  'L. Hamilton': 'HAM', 'I. Hadjar': 'HAD', 'L. Lawson': 'LAW',
  'C. Sainz': 'SAI', 'N. Hulkenberg': 'HUL', 'A. Lindblad': 'LIN',
  'P. Gasly': 'GAS', 'O. Bearman': 'BEA', 'F. Colapinto': 'COL',
};

function map(names: string[]): string[] { return names.map(n => D[n] ?? n); }
function mapOne(name: string | null): string | null { if (!name) return null; return D[name] ?? name; }

function calculatePoints(prediction: { top10: string[], fastestLap: string | null, dnf: string | null }, result: RaceResult) {
  let positionPoints = 0;
  const resultTop10 = result.classification
    .filter(c => c.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map(c => c.driverId);

  const alreadyScored = new Set<string>();

  for (let i = 0; i < prediction.top10.length && i < 10; i++) {
    const predictedDriverId = prediction.top10[i];
    const actualDriverId = resultTop10[i];

    if (!predictedDriverId) continue;
    if (alreadyScored.has(predictedDriverId)) continue;
    alreadyScored.add(predictedDriverId);

    // Exact position match only — no partial credit.
    if (predictedDriverId === actualDriverId) {
      positionPoints += F1_POINTS[i];
    }
  }

  let fastestLapPoints = 0;
  if (prediction.fastestLap && prediction.fastestLap === result.fastestLapDriverId) {
    fastestLapPoints = FASTEST_LAP_BONUS;
  }

  let dnfPoints = 0;
  // Use the real DNF detection: classification status + dnfDriverIds array.
  const dnsIds = new Set<string>();
  for (const c of result.classification) {
    const status = (c.status || '').trim().toLowerCase();
    if (status === 'dns' || status === 'did not start' || status === 'did_not_start') {
      dnsIds.add(c.driverId);
    }
  }
  // Also collect from dnsDriverIds if present.
  if ('dnsDriverIds' in result && Array.isArray((result as any).dnsDriverIds)) {
    for (const id of (result as any).dnsDriverIds) dnsIds.add(id);
  }

  const trueDnfIds = new Set<string>();
  for (const c of result.classification) {
    if (dnsIds.has(c.driverId)) continue;
    const status = (c.status || '').trim().toLowerCase();
    if (status === 'dnf' || status === 'retired' || status === 'ret' || status === 'did not finish' || status === 'did_not_finish') {
      trueDnfIds.add(c.driverId);
    }
  }
  for (const id of result.dnfDriverIds) {
    if (!dnsIds.has(id)) trueDnfIds.add(id);
  }

  if (prediction.dnf && trueDnfIds.has(prediction.dnf)) {
    dnfPoints = DNF_BONUS;
  }

  return { positionPoints, fastestLapPoints, dnfPoints, totalPoints: positionPoints + fastestLapPoints + dnfPoints };
}

function calculateSprintPoints(sprintTop8: string[], sprintResult: ClassificationEntry[]) {
  let positionPoints = 0;
  const resultTop8 = sprintResult
    .filter(c => c.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map(c => c.driverId);

  const alreadyScored = new Set<string>();

  for (let i = 0; i < sprintTop8.length && i < 8; i++) {
    const predictedDriverId = sprintTop8[i];
    const actualDriverId = resultTop8[i];

    if (!predictedDriverId) continue;
    if (alreadyScored.has(predictedDriverId)) continue;
    alreadyScored.add(predictedDriverId);

    // Exact position match only — no partial credit.
    if (predictedDriverId === actualDriverId) {
      positionPoints += SPRINT_POINTS[i];
    }
  }

  return { positionPoints, totalPoints: positionPoints };
}

// ===== MOCK RACE RESULTS =====
const MOCK_RACE_RESULTS: RaceResult[] = [
  {
    raceId: 'r01',
    classification: [
      { position: 1, driverId: 'RUS', time: '', gap: 'Leader', points: 25, status: 'finished' },
      { position: 2, driverId: 'ANT', time: '', gap: '+2.974s', points: 18, status: 'finished' },
      { position: 3, driverId: 'LEC', time: '', gap: '+15.519s', points: 15, status: 'finished' },
      { position: 4, driverId: 'HAM', time: '', gap: '+16.144s', points: 12, status: 'finished' },
      { position: 5, driverId: 'NOR', time: '', gap: '+51.741s', points: 10, status: 'finished' },
      { position: 6, driverId: 'VER', time: '', gap: '+54.617s', points: 8, status: 'finished' },
      { position: 7, driverId: 'BEA', time: '', gap: '+1 lap', points: 6, status: 'finished' },
      { position: 8, driverId: 'LIN', time: '', gap: '+1 lap', points: 4, status: 'finished' },
      { position: 9, driverId: 'BOR', time: '', gap: '+1 lap', points: 2, status: 'finished' },
      { position: 10, driverId: 'GAS', time: '', gap: '+1 lap', points: 1, status: 'finished' },
      { position: 11, driverId: 'OCO', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 12, driverId: 'ALB', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 13, driverId: 'LAW', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 14, driverId: 'COL', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 15, driverId: 'SAI', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 16, driverId: 'PER', time: '', gap: '+3 laps', points: 0, status: 'finished' },
      { position: 17, driverId: 'STR', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 18, driverId: 'ALO', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 19, driverId: 'BOT', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 20, driverId: 'HAD', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 21, driverId: 'PIA', time: '', gap: 'DNS', points: 0, status: 'dns' },
      { position: 22, driverId: 'HUL', time: '', gap: 'DNS', points: 0, status: 'dns' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR', 'ALO', 'BOT', 'HAD'],
    dnsDriverIds: ['PIA', 'HUL'],
  },
  {
    raceId: 'r02',
    classification: [
      { position: 1, driverId: 'ANT', time: '', gap: 'Leader', points: 25, status: 'finished' },
      { position: 2, driverId: 'RUS', time: '', gap: '+5.515s', points: 18, status: 'finished' },
      { position: 3, driverId: 'HAM', time: '', gap: '+25.267s', points: 15, status: 'finished' },
      { position: 4, driverId: 'LEC', time: '', gap: '+28.894s', points: 12, status: 'finished' },
      { position: 5, driverId: 'BEA', time: '', gap: '+57.268s', points: 10, status: 'finished' },
      { position: 6, driverId: 'GAS', time: '', gap: '+59.647s', points: 8, status: 'finished' },
      { position: 7, driverId: 'LAW', time: '', gap: '+80.588s', points: 6, status: 'finished' },
      { position: 8, driverId: 'HAD', time: '', gap: '+87.247s', points: 4, status: 'finished' },
      { position: 9, driverId: 'SAI', time: '', gap: '+1 lap', points: 2, status: 'finished' },
      { position: 10, driverId: 'COL', time: '', gap: '+1 lap', points: 1, status: 'finished' },
      { position: 11, driverId: 'HUL', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 12, driverId: 'LIN', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 13, driverId: 'BOT', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 14, driverId: 'OCO', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 15, driverId: 'PER', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 16, driverId: 'VER', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 17, driverId: 'ALO', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 18, driverId: 'STR', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 19, driverId: 'PIA', time: '', gap: 'DNS', points: 0, status: 'dns' },
      { position: 20, driverId: 'NOR', time: '', gap: 'DNS', points: 0, status: 'dns' },
      { position: 21, driverId: 'BOR', time: '', gap: 'DNS', points: 0, status: 'dns' },
      { position: 22, driverId: 'ALB', time: '', gap: 'DNS', points: 0, status: 'dns' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['VER', 'ALO', 'STR'],
    dnsDriverIds: ['PIA', 'NOR', 'BOR', 'ALB'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', time: '', gap: 'Leader', points: 8, status: 'finished' },
      { position: 2, driverId: 'LEC', time: '', gap: '+0.674s', points: 7, status: 'finished' },
      { position: 3, driverId: 'HAM', time: '', gap: '+2.554s', points: 6, status: 'finished' },
      { position: 4, driverId: 'NOR', time: '', gap: '+4.433s', points: 5, status: 'finished' },
      { position: 5, driverId: 'ANT', time: '', gap: '+5.688s', points: 4, status: 'finished' },
      { position: 6, driverId: 'PIA', time: '', gap: '+6.809s', points: 3, status: 'finished' },
      { position: 7, driverId: 'LAW', time: '', gap: '+10.900s', points: 2, status: 'finished' },
      { position: 8, driverId: 'BEA', time: '', gap: '+11.271s', points: 1, status: 'finished' },
    ],
  },
  {
    raceId: 'r03',
    classification: [
      { position: 1, driverId: 'ANT', time: '', gap: 'Leader', points: 25, status: 'finished' },
      { position: 2, driverId: 'PIA', time: '', gap: '+13.722s', points: 18, status: 'finished' },
      { position: 3, driverId: 'LEC', time: '', gap: '+15.270s', points: 15, status: 'finished' },
      { position: 4, driverId: 'RUS', time: '', gap: '+15.754s', points: 12, status: 'finished' },
      { position: 5, driverId: 'NOR', time: '', gap: '+23.479s', points: 10, status: 'finished' },
      { position: 6, driverId: 'HAM', time: '', gap: '+25.037s', points: 8, status: 'finished' },
      { position: 7, driverId: 'GAS', time: '', gap: '+32.340s', points: 6, status: 'finished' },
      { position: 8, driverId: 'VER', time: '', gap: '+32.677s', points: 4, status: 'finished' },
      { position: 9, driverId: 'LAW', time: '', gap: '+50.180s', points: 2, status: 'finished' },
      { position: 10, driverId: 'OCO', time: '', gap: '+51.216s', points: 1, status: 'finished' },
      { position: 11, driverId: 'HUL', time: '', gap: '+52.280s', points: 0, status: 'finished' },
      { position: 12, driverId: 'HAD', time: '', gap: '+56.154s', points: 0, status: 'finished' },
      { position: 13, driverId: 'BOR', time: '', gap: '+59.078s', points: 0, status: 'finished' },
      { position: 14, driverId: 'LIN', time: '', gap: '+59.848s', points: 0, status: 'finished' },
      { position: 15, driverId: 'SAI', time: '', gap: '+65.008s', points: 0, status: 'finished' },
      { position: 16, driverId: 'COL', time: '', gap: '+65.773s', points: 0, status: 'finished' },
      { position: 17, driverId: 'PER', time: '', gap: '+92.453s', points: 0, status: 'finished' },
      { position: 18, driverId: 'ALO', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 19, driverId: 'BOT', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 20, driverId: 'ALB', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 21, driverId: 'STR', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 22, driverId: 'BEA', time: '', gap: 'DNF', points: 0, status: 'dnf' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR', 'BEA'],
  },
  {
    raceId: 'r06',
    classification: [
      { position: 1, driverId: 'ANT', time: '', gap: 'Leader', points: 25, status: 'finished' },
      { position: 2, driverId: 'NOR', time: '', gap: '+3.264s', points: 18, status: 'finished' },
      { position: 3, driverId: 'PIA', time: '', gap: '+27.092s', points: 15, status: 'finished' },
      { position: 4, driverId: 'RUS', time: '', gap: '+43.051s', points: 12, status: 'finished' },
      { position: 5, driverId: 'VER', time: '', gap: '+43.949s', points: 10, status: 'finished' },
      { position: 6, driverId: 'HAM', time: '', gap: '+53.753s', points: 8, status: 'finished' },
      { position: 7, driverId: 'COL', time: '', gap: '+61.871s', points: 6, status: 'finished' },
      { position: 8, driverId: 'LEC', time: '', gap: '+64.245s', points: 4, status: 'finished' },
      { position: 9, driverId: 'SAI', time: '', gap: '+82.072s', points: 2, status: 'finished' },
      { position: 10, driverId: 'ALB', time: '', gap: '+90.972s', points: 1, status: 'finished' },
      { position: 11, driverId: 'BEA', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 12, driverId: 'BOR', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 13, driverId: 'OCO', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 14, driverId: 'LIN', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 15, driverId: 'ALO', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 16, driverId: 'PER', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 17, driverId: 'STR', time: '', gap: '+1 lap', points: 0, status: 'finished' },
      { position: 18, driverId: 'BOT', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 19, driverId: 'HUL', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 20, driverId: 'LAW', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 21, driverId: 'GAS', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 22, driverId: 'HAD', time: '', gap: 'DNF', points: 0, status: 'dnf' },
    ],
    fastestLapDriverId: 'NOR',
    dnfDriverIds: ['HUL', 'LAW', 'GAS', 'HAD'],
    sprintClassification: [
      { position: 1, driverId: 'NOR', time: '', gap: 'Leader', points: 8, status: 'finished' },
      { position: 2, driverId: 'PIA', time: '', gap: '+3.766s', points: 7, status: 'finished' },
      { position: 3, driverId: 'LEC', time: '', gap: '+6.251s', points: 6, status: 'finished' },
      { position: 4, driverId: 'RUS', time: '', gap: '+12.951s', points: 5, status: 'finished' },
      { position: 5, driverId: 'VER', time: '', gap: '+13.639s', points: 4, status: 'finished' },
      { position: 6, driverId: 'ANT', time: '', gap: '+13.777s', points: 3, status: 'finished' },
      { position: 7, driverId: 'HAM', time: '', gap: '+21.665s', points: 2, status: 'finished' },
      { position: 8, driverId: 'GAS', time: '', gap: '+30.525s', points: 1, status: 'finished' },
    ],
  },
  {
    raceId: 'r07',
    classification: [
      { position: 1, driverId: 'ANT', time: '', gap: 'Leader', points: 25, status: 'finished' },
      { position: 2, driverId: 'HAM', time: '', gap: '+10.768s', points: 18, status: 'finished' },
      { position: 3, driverId: 'VER', time: '', gap: '+11.276s', points: 15, status: 'finished' },
      { position: 4, driverId: 'LEC', time: '', gap: '+44.151s', points: 12, status: 'finished' },
      { position: 5, driverId: 'HAD', time: '', gap: '+1 lap', points: 10, status: 'finished' },
      { position: 6, driverId: 'COL', time: '', gap: '+1 lap', points: 8, status: 'finished' },
      { position: 7, driverId: 'LAW', time: '', gap: '+1 lap', points: 6, status: 'finished' },
      { position: 8, driverId: 'GAS', time: '', gap: '+1 lap', points: 4, status: 'finished' },
      { position: 9, driverId: 'SAI', time: '', gap: '+1 lap', points: 2, status: 'finished' },
      { position: 10, driverId: 'BEA', time: '', gap: '+1 lap', points: 1, status: 'finished' },
      { position: 11, driverId: 'PIA', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 12, driverId: 'HUL', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 13, driverId: 'BOR', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 14, driverId: 'OCO', time: '', gap: '+2 laps', points: 0, status: 'finished' },
      { position: 15, driverId: 'STR', time: '', gap: '+4 laps', points: 0, status: 'finished' },
      { position: 16, driverId: 'BOT', time: '', gap: '+4 laps', points: 0, status: 'finished' },
      { position: 17, driverId: 'PER', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 18, driverId: 'NOR', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 19, driverId: 'RUS', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 20, driverId: 'ALO', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 21, driverId: 'ALB', time: '', gap: 'DNF', points: 0, status: 'dnf' },
      { position: 22, driverId: 'LIN', time: '', gap: 'DNS', points: 0, status: 'dns' },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['PER', 'NOR', 'RUS', 'ALO', 'ALB'],
    dnsDriverIds: ['LIN'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', time: '', gap: 'Leader', points: 8, status: 'finished' },
      { position: 2, driverId: 'NOR', time: '', gap: '+1.272s', points: 7, status: 'finished' },
      { position: 3, driverId: 'ANT', time: '', gap: '+1.843s', points: 6, status: 'finished' },
      { position: 4, driverId: 'PIA', time: '', gap: '+9.797s', points: 5, status: 'finished' },
      { position: 5, driverId: 'LEC', time: '', gap: '+9.929s', points: 4, status: 'finished' },
      { position: 6, driverId: 'HAM', time: '', gap: '+10.545s', points: 3, status: 'finished' },
      { position: 7, driverId: 'VER', time: '', gap: '+15.935s', points: 2, status: 'finished' },
      { position: 8, driverId: 'LIN', time: '', gap: '+29.710s', points: 1, status: 'finished' },
    ],
  },
];

// ===== SEED PREDICTIONS =====
const USERS: Record<string, {name: string, predictions: Record<string, any>}> = {
  'cb7536a7': {
    name: 'Skye Leach',
    predictions: {
      r01: { top10: map(['M. Verstappen','G. Russell','K. Antonelli','O. Piastri','C. Leclerc','L. Norris','L. Hamilton','I. Hadjar','L. Lawson','C. Sainz']), fastestLap: mapOne('M. Verstappen'), dnf: null, sprintTop8: [] },
      r02: { top10: map(['G. Russell','K. Antonelli','C. Leclerc','L. Hamilton','M. Verstappen','O. Piastri','L. Norris','I. Hadjar','O. Bearman','P. Gasly']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: map(['G. Russell','K. Antonelli','L. Hamilton','L. Norris','C. Leclerc','O. Piastri','M. Verstappen','I. Hadjar']) },
      r03: { top10: map(['K. Antonelli','G. Russell','C. Leclerc','O. Piastri','L. Hamilton','L. Norris','M. Verstappen','I. Hadjar','P. Gasly','A. Lindblad']), fastestLap: mapOne('K. Antonelli'), dnf: null, sprintTop8: [] },
      r06: { top10: map(['M. Verstappen','K. Antonelli','L. Norris','C. Leclerc','G. Russell','L. Hamilton','O. Piastri','I. Hadjar','P. Gasly','O. Bearman']), fastestLap: mapOne('M. Verstappen'), dnf: null, sprintTop8: map(['K. Antonelli','L. Norris','O. Piastri','G. Russell','C. Leclerc','M. Verstappen','L. Hamilton','I. Hadjar']) },
      r07: { top10: map(['G. Russell','K. Antonelli','O. Piastri','L. Norris','L. Hamilton','C. Leclerc','M. Verstappen','I. Hadjar','A. Lindblad','L. Lawson']), fastestLap: mapOne('K. Antonelli'), dnf: null, sprintTop8: map(['K. Antonelli','G. Russell','L. Norris','O. Piastri','C. Leclerc','M. Verstappen','L. Hamilton','I. Hadjar']) },
    }
  },
  '652154af': {
    name: 'Whitney Trujillo',
    predictions: {
      r01: { top10: map(['K. Antonelli','G. Russell','C. Leclerc','O. Piastri','I. Hadjar','M. Verstappen','L. Norris','L. Hamilton','L. Lawson','N. Hulkenberg']), fastestLap: mapOne('M. Verstappen'), dnf: null, sprintTop8: [] },
      r02: { top10: map(['G. Russell','K. Antonelli','C. Leclerc','L. Hamilton','O. Piastri','M. Verstappen','L. Norris','I. Hadjar','N. Hulkenberg','O. Bearman']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: map(['K. Antonelli','G. Russell','L. Norris','L. Hamilton','M. Verstappen','O. Piastri','C. Leclerc','I. Hadjar']) },
      r03: { top10: map(['K. Antonelli','G. Russell','C. Leclerc','O. Piastri','L. Norris','M. Verstappen','L. Hamilton','P. Gasly','I. Hadjar','N. Hulkenberg']), fastestLap: mapOne('O. Piastri'), dnf: null, sprintTop8: [] },
      r06: { top10: map(['O. Piastri','M. Verstappen','L. Norris','K. Antonelli','C. Leclerc','G. Russell','L. Hamilton','F. Colapinto','C. Sainz','P. Gasly']), fastestLap: null, dnf: null, sprintTop8: map(['L. Norris','C. Leclerc','K. Antonelli','O. Piastri','M. Verstappen','G. Russell','L. Hamilton','F. Colapinto']) },
      r07: { top10: map(['G. Russell','K. Antonelli','L. Norris','O. Piastri','M. Verstappen','C. Leclerc','L. Hamilton','I. Hadjar','A. Lindblad','F. Colapinto']), fastestLap: mapOne('K. Antonelli'), dnf: null, sprintTop8: map(['K. Antonelli','G. Russell','O. Piastri','L. Norris','M. Verstappen','C. Leclerc','L. Hamilton','I. Hadjar']) },
    }
  },
  'f35417e9': {
    name: 'Bryan Leach',
    predictions: {
      r01: { top10: map(['G. Russell','K. Antonelli','O. Piastri','C. Leclerc','L. Norris','L. Hamilton','I. Hadjar','M. Verstappen','L. Lawson','A. Lindblad']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: [] },
      r02: { top10: map(['G. Russell','K. Antonelli','C. Leclerc','L. Hamilton','O. Piastri','L. Norris','M. Verstappen','I. Hadjar','O. Bearman','P. Gasly']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: map(['G. Russell','K. Antonelli','L. Hamilton','C. Leclerc','C. Leclerc','M. Verstappen','L. Norris','I. Hadjar']) },
      r03: { top10: map(['G. Russell','K. Antonelli','C. Leclerc','L. Hamilton','M. Verstappen','O. Piastri','L. Norris','I. Hadjar','P. Gasly','A. Lindblad']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: [] },
      r06: { top10: map(['M. Verstappen','K. Antonelli','L. Norris','C. Leclerc','G. Russell','O. Piastri','L. Hamilton','P. Gasly','I. Hadjar','F. Colapinto']), fastestLap: mapOne('K. Antonelli'), dnf: null, sprintTop8: map(['K. Antonelli','L. Norris','O. Piastri','C. Leclerc','G. Russell','M. Verstappen','L. Hamilton','I. Hadjar']) },
      r07: { top10: map(['G. Russell','K. Antonelli','L. Norris','O. Piastri','L. Hamilton','C. Leclerc','M. Verstappen','I. Hadjar','A. Lindblad','L. Lawson']), fastestLap: mapOne('L. Norris'), dnf: null, sprintTop8: map(['G. Russell','K. Antonelli','L. Norris','O. Piastri','L. Hamilton','C. Leclerc','M. Verstappen','I. Hadjar']) },
    }
  },
  'e11ea4f5': {
    name: 'Carlos Trujillo',
    predictions: {
      r01: { top10: map(['G. Russell','K. Antonelli','C. Leclerc','O. Piastri','I. Hadjar','L. Hamilton','L. Norris','M. Verstappen','L. Lawson','N. Hulkenberg']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: [] },
      r02: { top10: map(['G. Russell','K. Antonelli','L. Hamilton','C. Leclerc','L. Norris','O. Piastri','M. Verstappen','I. Hadjar','P. Gasly','N. Hulkenberg']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: map(['G. Russell','K. Antonelli','L. Hamilton','L. Norris','C. Leclerc','M. Verstappen','O. Piastri','P. Gasly']) },
      r03: { top10: map(['K. Antonelli','G. Russell','C. Leclerc','L. Hamilton','O. Piastri','L. Norris','I. Hadjar','M. Verstappen','P. Gasly','A. Lindblad']), fastestLap: mapOne('G. Russell'), dnf: null, sprintTop8: [] },
      r06: { top10: map(['M. Verstappen','K. Antonelli','L. Norris','C. Leclerc','G. Russell','C. Leclerc','O. Piastri','L. Hamilton','P. Gasly','N. Hulkenberg']), fastestLap: mapOne('M. Verstappen'), dnf: null, sprintTop8: map(['L. Norris','K. Antonelli','O. Piastri','C. Leclerc','G. Russell','M. Verstappen','L. Hamilton','I. Hadjar']) },
      r07: { top10: map(['K. Antonelli','G. Russell','L. Norris','O. Piastri','M. Verstappen','C. Leclerc','L. Hamilton','I. Hadjar','A. Lindblad','F. Colapinto']), fastestLap: mapOne('K. Antonelli'), dnf: null, sprintTop8: map(['K. Antonelli','G. Russell','O. Piastri','L. Norris','M. Verstappen','C. Leclerc','L. Hamilton','I. Hadjar']) },
    }
  },
};

console.log('=== SCORING VERIFICATION ===\n');

const raceIds = ['r01', 'r02', 'r03', 'r06', 'r07'];
const raceNames: Record<string, string> = {r01:'Australia', r02:'China', r03:'Japan', r06:'Miami', r07:'Canada'};

for (const [userId, user] of Object.entries(USERS)) {
  console.log(`\n=== ${user.name} (${userId}) ===`);
  let grandTotal = 0;

  for (const raceId of raceIds) {
    const pred = user.predictions[raceId];
    if (!pred) continue;
    const result = MOCK_RACE_RESULTS.find(r => r.raceId === raceId);
    if (!result) continue;

    let raceTotal = 0;

    if (pred.top10.length > 0 && result.classification.length > 0) {
      const gpScore = calculatePoints(pred, result);
      raceTotal += gpScore.totalPoints;
      console.log(`  ${raceNames[raceId]} GP: pos=${gpScore.positionPoints} fl=${gpScore.fastestLapPoints} dnf=${gpScore.dnfPoints} = ${gpScore.totalPoints}`);
    }

    if (pred.sprintTop8.length > 0 && result.sprintClassification && result.sprintClassification.length > 0) {
      const sprintScore = calculateSprintPoints(pred.sprintTop8, result.sprintClassification);
      raceTotal += sprintScore.totalPoints;
      console.log(`  ${raceNames[raceId]} Sprint: pos=${sprintScore.positionPoints} = ${sprintScore.totalPoints}`);
    }

    grandTotal += raceTotal;
  }

  console.log(`  TOTAL: ${grandTotal}`);
}
