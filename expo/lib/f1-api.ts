import { Driver, RaceResult, ClassificationEntry } from '@/types';
import { DRIVERS, RACES } from '@/constants/f1-data';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const F1API_BASE = 'https://f1api.dev/api';

interface JolpicaDriverStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    permanentNumber: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructors: {
    constructorId: string;
    name: string;
  }[];
}

interface JolpicaStandingsResponse {
  MRData: {
    StandingsTable: {
      season: string;
      StandingsLists: {
        season: string;
        round: string;
        DriverStandings: JolpicaDriverStanding[];
      }[];
    };
  };
}

const DRIVER_CODE_MAP: Record<string, string> = {
  'norris': 'NOR',
  'piastri': 'PIA',
  'leclerc': 'LEC',
  'hamilton': 'HAM',
  'max_verstappen': 'VER',
  'verstappen': 'VER',
  'hadjar': 'HAD',
  'russell': 'RUS',
  'antonelli': 'ANT',
  'alonso': 'ALO',
  'stroll': 'STR',
  'gasly': 'GAS',
  'colapinto': 'COL',
  'albon': 'ALB',
  'sainz': 'SAI',
  'lawson': 'LAW',
  'hulkenberg': 'HUL',
  'bortoleto': 'BOR',
  'bearman': 'BEA',
  'ocon': 'OCO',
  'lindblad': 'LIN',
  'bottas': 'BOT',
  'perez': 'PER',
};

function mapJolpicaCodeToDriverId(driverId: string, code: string): string | null {
  const mapped = DRIVER_CODE_MAP[driverId];
  if (mapped) return mapped;

  const byCode = DRIVERS.find(d => d.shortName === code);
  if (byCode) return byCode.id;

  return null;
}

export async function fetchLiveDriverStandings(): Promise<Driver[] | null> {
  try {
    console.log('[F1 API] Fetching live driver standings from Jolpica...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(`${JOLPICA_BASE}/current/driverstandings.json`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.log('[F1 API] Jolpica fetch failed (network):', fetchErr?.message || fetchErr);
      return await safeFetchFromF1Api();
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('[F1 API] Jolpica response not OK:', response.status);
      return await safeFetchFromF1Api();
    }

    let data: JolpicaStandingsResponse;
    try {
      data = await response.json();
    } catch (jsonErr: any) {
      console.log('[F1 API] Jolpica JSON parse failed:', jsonErr?.message);
      return await safeFetchFromF1Api();
    }

    const standingsLists = data?.MRData?.StandingsTable?.StandingsLists;

    if (!standingsLists || standingsLists.length === 0) {
      console.log('[F1 API] No standings data available yet (season may not have started)');
      return null;
    }

    const standings = standingsLists[0].DriverStandings;
    console.log('[F1 API] Got', standings.length, 'driver standings from Jolpica, round', standingsLists[0].round);

    const updatedDrivers = DRIVERS.map(driver => {
      const standing = standings.find(s => {
        const mappedId = mapJolpicaCodeToDriverId(s.Driver.driverId, s.Driver.code);
        return mappedId === driver.id;
      });

      if (standing) {
        return {
          ...driver,
          championshipPoints: parseInt(standing.points, 10) || 0,
        };
      }
      return driver;
    });

    updatedDrivers.sort((a, b) => b.championshipPoints - a.championshipPoints);
    console.log('[F1 API] Successfully updated driver standings');
    return updatedDrivers;
  } catch (error: any) {
    console.log('[F1 API] Jolpica fetch error:', error?.message || error);
    return await safeFetchFromF1Api();
  }
}

async function safeFetchFromF1Api(): Promise<Driver[] | null> {
  try {
    return await fetchFromF1Api();
  } catch (e: any) {
    console.log('[F1 API] All API sources failed, returning null:', e?.message || e);
    return null;
  }
}

async function fetchFromF1Api(): Promise<Driver[] | null> {
  try {
    console.log('[F1 API] Trying fallback f1api.dev...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(`${F1API_BASE}/current/drivers-championship`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.log('[F1 API] f1api.dev fetch failed (network):', fetchErr?.message || fetchErr);
      return null;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('[F1 API] f1api.dev response not OK:', response.status);
      return null;
    }

    let data: any;
    try {
      data = await response.json();
    } catch (jsonErr: any) {
      console.log('[F1 API] f1api.dev JSON parse failed:', jsonErr?.message);
      return null;
    }

    const standings = data?.drivers_championship || data?.standings || [];

    if (!standings || standings.length === 0) {
      console.log('[F1 API] No standings from f1api.dev');
      return null;
    }

    console.log('[F1 API] Got', standings.length, 'standings from f1api.dev');

    const updatedDrivers = DRIVERS.map(driver => {
      const standing = standings.find((s: any) => {
        const code = s?.driver?.code || s?.code || '';
        const lastName = (s?.driver?.familyName || s?.driver?.last_name || '').toLowerCase();
        return code === driver.shortName || DRIVER_CODE_MAP[lastName] === driver.id;
      });

      if (standing) {
        const points = standing.points ?? standing.totalPoints ?? 0;
        return {
          ...driver,
          championshipPoints: typeof points === 'string' ? parseInt(points, 10) : points,
        };
      }
      return driver;
    });

    updatedDrivers.sort((a, b) => b.championshipPoints - a.championshipPoints);
    console.log('[F1 API] Successfully updated standings from f1api.dev');
    return updatedDrivers;
  } catch (error) {
    console.log('[F1 API] f1api.dev fetch error:', error);
    return null;
  }
}

export async function fetchCurrentSeason(): Promise<string> {
  return '2026';
}

interface JolpicaResultEntry {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: { driverId: string; code?: string; givenName: string; familyName: string };
  Constructor: { constructorId: string; name: string };
  grid: string;
  laps: string;
  status: string;
  Time?: { millis?: string; time: string };
  FastestLap?: { rank: string; lap: string; Time: { time: string } };
}

interface JolpicaRacesResponse {
  MRData: {
    RaceTable: {
      season: string;
      Races: {
        season: string;
        round: string;
        raceName: string;
        date?: string;
        Results?: JolpicaResultEntry[];
        SprintResults?: JolpicaResultEntry[];
      }[];
    };
  };
}

function statusToClassification(status: string): ClassificationEntry['status'] {
  const s = status.toLowerCase();
  if (s === 'finished' || s === 'lapped' || s.startsWith('+')) return 'finished';
  if (s === 'dnf' || s === 'did not finish') return 'dnf';
  if (s === 'did not start' || s === 'dns') return 'dns';
  return 'retired';
}

function parseResultsForRound(
  round: number,
  data: JolpicaRacesResponse,
): RaceResult | null {
  const raceEntry = data?.MRData?.RaceTable?.Races?.[0];
  if (!raceEntry || !raceEntry.Results || raceEntry.Results.length === 0) return null;

  const race = RACES.find(r => r.round === round);
  if (!race) return null;

  const classification: ClassificationEntry[] = [];
  const dnfDriverIds: string[] = [];
  const dnsDriverIds: string[] = [];
  let fastestLapDriverId = '';

  for (const r of raceEntry.Results) {
    const driverId = mapJolpicaCodeToDriverId(r.Driver.driverId, r.Driver.code || '');
    if (!driverId) continue;

    const position = parseInt(r.position, 10);
    const status = statusToClassification(r.status);
    const points = parseInt(r.points, 10) || 0;
    const time = r.Time?.time || '';
    const gap = position === 1 ? time : (status === 'finished' ? (r.status.startsWith('+') ? r.status : time) : '');

    classification.push({
      position,
      driverId,
      time,
      gap,
      points,
      status,
    });

    if (status === 'dns') {
      dnsDriverIds.push(driverId);
    } else if (status !== 'finished') {
      dnfDriverIds.push(driverId);
    }
    if (r.FastestLap && r.FastestLap.rank === '1') fastestLapDriverId = driverId;
  }

  classification.sort((a, b) => a.position - b.position);

  return {
    raceId: race.id,
    classification,
    fastestLapDriverId,
    dnfDriverIds,
    dnsDriverIds,
  };
}

/**
 * Fetch sprint results for a race by matching via /current/sprint.json.
 * Avoids the per-round endpoint which has the same numbering mismatch.
 */
async function fetchSprintResultsForRace(
  race: { raceDate: string; name: string },
): Promise<ClassificationEntry[] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(`${JOLPICA_BASE}/current/sprint.json?limit=100`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.log('[F1 API] Sprint /current fetch failed:', e?.message || e);
      return null;
    }
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data: any = await response.json();
    const apiRaces = data?.MRData?.RaceTable?.Races || [];

    // Match by date, then by name keyword fallback.
    let sprintRace = apiRaces.find((r: any) => r.date === race.raceDate);
    if (!sprintRace) {
      const apiNameLower = race.name.toLowerCase();
      sprintRace = apiRaces.find((r: any) => {
        const words = (r.raceName as string).toLowerCase().split(' ');
        return words.some((w: string) => w.length > 3 && apiNameLower.includes(w));
      });
    }

    if (!sprintRace) {
      console.log(`[F1 API] No sprint data match for ${race.name}`);
      return null;
    }

    const sprintResults = sprintRace.SprintResults;
    if (!sprintResults || sprintResults.length === 0) return null;

    const classification: ClassificationEntry[] = [];
    for (const r of sprintResults) {
      const driverId = mapJolpicaCodeToDriverId(r.Driver.driverId, r.Driver.code || '');
      if (!driverId) continue;
      const position = parseInt(r.position, 10);
      const status = statusToClassification(r.status);
      const points = parseInt(r.points, 10) || 0;
      const time = r.Time?.time || '';
      const gap = position === 1 ? time : (status === 'finished' ? (r.status.startsWith('+') ? r.status : time) : '');
      classification.push({ position, driverId, time, gap, points, status });
    }
    classification.sort((a, b) => a.position - b.position);
    console.log(`[F1 API] Got ${classification.length} sprint results for ${race.name}`);
    return classification;
  } catch (e: any) {
    console.log(`[F1 API] Sprint error for ${race.name}:`, e?.message || e);
    return null;
  }
}

async function fetchSprintResultsForRound(
  season: string,
  round: number,
): Promise<ClassificationEntry[] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(`${JOLPICA_BASE}/${season}/${round}/sprint.json?limit=30`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.log(`[F1 API] Sprint round ${round} fetch failed:`, e?.message || e);
      return null;
    }
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data: any = await response.json();
    const raceEntry = data?.MRData?.RaceTable?.Races?.[0];
    const sprintResults = raceEntry?.SprintResults;
    if (!sprintResults || sprintResults.length === 0) return null;

    const classification: ClassificationEntry[] = [];
    for (const r of sprintResults) {
      const driverId = mapJolpicaCodeToDriverId(r.Driver.driverId, r.Driver.code || '');
      if (!driverId) continue;
      const position = parseInt(r.position, 10);
      const status = statusToClassification(r.status);
      const points = parseInt(r.points, 10) || 0;
      const time = r.Time?.time || '';
      const gap = position === 1 ? time : (status === 'finished' ? (r.status.startsWith('+') ? r.status : time) : '');
      classification.push({ position, driverId, time, gap, points, status });
    }
    classification.sort((a, b) => a.position - b.position);
    console.log(`[F1 API] Got ${classification.length} sprint results for round ${round}`);
    return classification;
  } catch (e: any) {
    console.log(`[F1 API] Sprint round ${round} error:`, e?.message || e);
    return null;
  }
}

async function fetchResultsForRound(
  season: string,
  round: number,
): Promise<RaceResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(`${JOLPICA_BASE}/${season}/${round}/results.json?limit=30`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.log(`[F1 API] Results round ${round} fetch failed:`, e?.message || e);
      return null;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[F1 API] Results round ${round} not OK:`, response.status);
      return null;
    }

    const data: JolpicaRacesResponse = await response.json();
    return parseResultsForRound(round, data);
  } catch (e: any) {
    console.log(`[F1 API] Results round ${round} error:`, e?.message || e);
    return null;
  }
}

/** No cancelled rounds in the 2026 season. */
const CANCELLED_ROUNDS = new Set<number>([]);

/**
 * Convert our round number to the Jolpica API round number.
 * The API skips cancelled races, so e.g. our r09 (Spain) is API round 7.
 */
function getApiRound(ourRound: number): number {
  let apiRound = 0;
  for (let i = 1; i <= ourRound; i++) {
    if (!CANCELLED_ROUNDS.has(i)) apiRound++;
  }
  return apiRound;
}

/**
 * Fetch full classification for all completed races in the current season
 * from the Jolpica/Ergast API.
 *
 * Strategy:
 * 1. Try /current/results.json for bulk data (fast, single request).
 * 2. For completed races NOT covered by step 1, try per-round endpoints
 *    using the corrected API round number (skips cancelled races).
 * 3. Matches API races to our RACES by date and name, then fetches sprint
 *    results for sprint weekends.
 */
export async function fetchLiveRaceResults(): Promise<RaceResult[]> {
  const season = new Date().getFullYear().toString();
  console.log('[F1 API] Fetching live race results for season', season);

  const results: RaceResult[] = [];
  const coveredRaceIds = new Set<string>();

  // --- Phase 1: /current/results.json (bulk) ---
  console.log('[F1 API] Phase 1: /current/results.json');
  let allRaceData: JolpicaRacesResponse = { MRData: { RaceTable: { season: '', Races: [] } } };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response: Response | undefined;
    try {
      response = await fetch(`${JOLPICA_BASE}/current/results.json?limit=200`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.log('[F1 API] /current/results.json fetch failed:', e?.message || e);
    }
    clearTimeout(timeoutId);

    if (response?.ok) {
      allRaceData = await response.json();
    } else if (response) {
      console.log('[F1 API] /current/results.json not OK:', response.status);
    }
  } catch (e: any) {
    console.log('[F1 API] /current/results.json parse error:', e?.message || e);
  }

  const bulkApiRaces = allRaceData.MRData.RaceTable.Races || [];
  console.log('[F1 API] Phase 1: got', bulkApiRaces.length, 'races');

  // Parse bulk results.
  for (const apiRace of bulkApiRaces) {
    if (!apiRace.Results || apiRace.Results.length === 0) continue;
    const matchedRace = matchApiRace(apiRace);
    if (!matchedRace) continue;

    const parsed = parseAndAddResult(apiRace, matchedRace);
    if (parsed) {
      results.push(parsed);
      coveredRaceIds.add(matchedRace.id);
    }
  }

  // --- Phase 2: per-round fallback for completed races not yet covered ---
  const today = new Date().toISOString().split('T')[0];
  const missingCompleted = RACES.filter(r => {
    if (coveredRaceIds.has(r.id)) return false;
    if (r.status === 'cancelled' || CANCELLED_ROUNDS.has(r.round)) return false;
    // Race must have already happened (date <= today).
    return r.raceDate <= today;
  });

  if (missingCompleted.length > 0) {
    console.log('[F1 API] Phase 2: per-round fallback for', missingCompleted.map(r => `${r.id} (round ${r.round})`).join(', '));

    for (const race of missingCompleted) {
      const apiRound = getApiRound(race.round);
      console.log(`[F1 API] Trying API round ${apiRound} for ${race.id} (our round ${race.round})`);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        let response: Response;
        try {
          response = await fetch(`${JOLPICA_BASE}/${season}/${apiRound}/results.json?limit=30`, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.log(`[F1 API] Per-round ${apiRound} fetch failed:`, e?.message || e);
          continue;
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.log(`[F1 API] Per-round ${apiRound} not OK:`, response.status);
          continue;
        }

        const data: JolpicaRacesResponse = await response.json();
        const apiRace = data?.MRData?.RaceTable?.Races?.[0];
        if (!apiRace || !apiRace.Results || apiRace.Results.length === 0) {
          console.log(`[F1 API] Per-round ${apiRound}: no results`);
          continue;
        }

        const parsed = parseAndAddResult(apiRace, race);
        if (parsed) {
          results.push(parsed);
          coveredRaceIds.add(race.id);
          console.log(`[F1 API] Per-round ${apiRound} → ${race.name}: ${parsed.classification.length} results`);
        }
      } catch (e: any) {
        console.log(`[F1 API] Per-round ${apiRound} error:`, e?.message || e);
      }
    }
  }

  // --- Phase 3: fetch sprint results for sprint weekends ---
  for (let i = 0; i < results.length; i++) {
    const race = RACES.find(r => r.id === results[i].raceId);
    if (race?.hasSprint) {
      const sprint = await fetchSprintResultsForRace(race);
      if (sprint && sprint.length > 0) {
        results[i] = { ...results[i], sprintClassification: sprint };
      }
    }
  }

  console.log('[F1 API] Returning', results.length, 'race results total');
  return results;
}

/** Match an API race to our RACES entry by date, then by name keyword. */
function matchApiRace(apiRace: { raceName: string; date?: string }): typeof RACES[0] | undefined {
  const apiDate = apiRace.date;
  let matched = RACES.find(r => r.raceDate === apiDate);
  if (matched) return matched;

  const apiName = apiRace.raceName.toLowerCase();
  matched = RACES.find(r => {
    const ourName = r.name.toLowerCase();
    const apiWords = apiName.split(' ');
    return apiWords.some((w: string) => w.length > 3 && ourName.includes(w));
  });
  if (!matched) {
    console.log(`[F1 API] No match for API race: ${apiRace.raceName} (${apiDate})`);
  }
  return matched;
}

/** Parse an API race entry into a RaceResult for a matched RACES entry. */
function parseAndAddResult(
  apiRace: { season: string; Results?: JolpicaResultEntry[] },
  matchedRace: typeof RACES[0],
): RaceResult | null {
  const tempResponse: JolpicaRacesResponse = {
    MRData: {
      RaceTable: {
        season: apiRace.season,
        Races: [apiRace as any],
      },
    },
  };

  const live = parseResultsForRound(matchedRace.round, tempResponse);
  if (!live) {
    console.log(`[F1 API] Failed to parse results for ${matchedRace.name}`);
    return null;
  }

  console.log(`[F1 API] Parsed ${matchedRace.name}: ${live.classification.length} results`);
  return live;
}
