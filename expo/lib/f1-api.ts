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
  'arvid_lindblad': 'LIN',
  'lindblad': 'LIN',
  'hulkenberg': 'HUL',
  'bortoleto': 'BOR',
  'bearman': 'BEA',
  'ocon': 'OCO',
  'perez': 'PER',
  'bottas': 'BOT',
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
  return new Date().getFullYear().toString();
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
        Results?: JolpicaResultEntry[];
      }[];
    };
  };
}

function statusToClassification(status: string): ClassificationEntry['status'] {
  const s = status.toLowerCase();
  if (s === 'finished' || s === 'lapped' || s.startsWith('+')) return 'finished';
  if (s === 'dnf' || s === 'did not finish') return 'dnf';
  if (s === 'did not start' || s === 'dns') return 'dnf';
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

    if (status !== 'finished') dnfDriverIds.push(driverId);
    if (r.FastestLap && r.FastestLap.rank === '1') fastestLapDriverId = driverId;
  }

  classification.sort((a, b) => a.position - b.position);

  return {
    raceId: race.id,
    classification,
    fastestLapDriverId,
    dnfDriverIds,
  };
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

/**
 * Fetch full classification for all completed races in the current season
 * from the Jolpica/Ergast API. Races without data are simply skipped.
 */
export async function fetchLiveRaceResults(): Promise<RaceResult[]> {
  const season = new Date().getFullYear().toString();
  console.log('[F1 API] Fetching live race results for season', season);

  const now = new Date();
  const completedRounds = RACES.filter(r => {
    const raceEnd = new Date(`${r.raceDate}T${r.raceTime}:00Z`).getTime() + 3 * 60 * 60 * 1000;
    return now.getTime() > raceEnd;
  }).map(r => r.round);

  if (completedRounds.length === 0) {
    console.log('[F1 API] No completed rounds to fetch yet');
    return [];
  }

  console.log('[F1 API] Fetching results for', completedRounds.length, 'completed rounds:', completedRounds);

  const results = await Promise.all(
    completedRounds.map(async round => {
      const race = RACES.find(r => r.round === round);
      const [live, sprint] = await Promise.all([
        fetchResultsForRound(season, round),
        race?.hasSprint ? fetchSprintResultsForRound(season, round) : Promise.resolve(null),
      ]);
      if (!live) {
        console.log(`[F1 API] No live data for round ${round}, skipping`);
        return null;
      }
      if (sprint && sprint.length > 0) {
        return { ...live, sprintClassification: sprint } as RaceResult;
      }
      return live;
    }),
  );

  const valid = results.filter((r): r is RaceResult => r !== null);
  console.log('[F1 API] Got', valid.length, 'race results from live API');
  return valid;
}
