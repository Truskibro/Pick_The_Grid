import { useEffect, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Team, Driver, Race, RaceResult } from '@/types';
import {
  TEAMS as FALLBACK_TEAMS,
  DRIVERS as FALLBACK_DRIVERS,
  RACES as FALLBACK_RACES,
  MOCK_RACE_RESULTS as FALLBACK_RESULTS,
} from '@/constants/f1-data';
import { fetchLiveDriverStandings, fetchLiveRaceResults } from '@/lib/f1-api';
import { registerForPushNotifications, scheduleRaceReminders } from '@/lib/notifications';

const POLL_INTERVAL = 60_000;

/** No cancelled races in the 2025 season. */
const CANCELLED_RACE_IDS = new Set<string>([]);

function computeRaceStatus(race: Race): Race['status'] {
  // Cancelled races stay cancelled — never override with date-based logic.
  if (race.status === 'cancelled' || CANCELLED_RACE_IDS.has(race.id)) return 'cancelled';

  const now = new Date();
  const raceStart = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
  const raceEnd = new Date(raceStart.getTime() + 3 * 60 * 60 * 1000);

  if (race.status === 'completed') return 'completed';
  if (now >= raceStart && now <= raceEnd) return 'live';
  if (now > raceEnd) return 'completed';
  return 'upcoming';
}

function updateRaceStatuses(races: Race[]): Race[] {
  return races.map(race => ({
    ...race,
    status: computeRaceStatus(race),
  }));
}

async function fetchTeams(): Promise<Team[]> {
  if (!isSupabaseConfigured) {
    console.log('Teams: Supabase not configured, using fallback data');
    return FALLBACK_TEAMS;
  }
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error || !data || data.length === 0) {
      console.log('Teams: using fallback data', error?.message);
      return FALLBACK_TEAMS;
    }

    console.log('Teams: loaded', data.length, 'from Supabase');
    return data.map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color || '#666',
      shortName: t.short_name || t.name.substring(0, 3).toUpperCase(),
    }));
  } catch (e) {
    console.log('Teams fetch error, using fallback:', e);
    return FALLBACK_TEAMS;
  }
}

async function fetchDrivers(): Promise<Driver[]> {
  try {
    const liveStandings = await fetchLiveDriverStandings();
    if (liveStandings && liveStandings.length > 0) {
      console.log('Drivers: loaded live standings from F1 API');
      return liveStandings;
    }
    console.log('Drivers: live standings returned null/empty, trying fallback');
  } catch (e: any) {
    console.log('Live standings fetch failed, trying Supabase:', e?.message || e);
  }

  if (!isSupabaseConfigured) {
    console.log('Drivers: Supabase not configured, using fallback data');
    return FALLBACK_DRIVERS;
  }

  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('championship_points', { ascending: false });

    if (error || !data || data.length === 0) {
      console.log('Drivers: using fallback data', error?.message);
      return FALLBACK_DRIVERS;
    }

    console.log('Drivers: loaded', data.length, 'from Supabase');
    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      shortName: d.short_name || d.id,
      number: d.number || 0,
      teamId: d.team_id,
      championshipPoints: d.championship_points || 0,
    }));
  } catch (e) {
    console.log('Drivers fetch error, using fallback:', e);
    return FALLBACK_DRIVERS;
  }
}

async function fetchRaces(): Promise<Race[]> {
  if (!isSupabaseConfigured) {
    console.log('Races: Supabase not configured, using fallback data');
    return updateRaceStatuses(FALLBACK_RACES);
  }
  try {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .order('race_date');

    if (error || !data || data.length === 0) {
      console.log('Races: using fallback data', error?.message);
      return updateRaceStatuses(FALLBACK_RACES);
    }

    console.log('Races: loaded', data.length, 'from Supabase');
    const races: Race[] = data.map((r: any) => ({
      id: r.id,
      round: r.round || 0,
      name: r.name,
      location: r.location || '',
      country: r.country || '',
      countryFlag: r.country_flag || '🏁',
      raceDate: r.race_date,
      raceTime: r.race_time || '14:00',
      status: r.status || 'upcoming',
      hasSprint: r.has_sprint || false,
      winner: r.winner || undefined,
      currentLap: r.current_lap || undefined,
      totalLaps: r.total_laps || undefined,
    }));

    return updateRaceStatuses(races);
  } catch (e) {
    console.log('Races fetch error, using fallback:', e);
    return updateRaceStatuses(FALLBACK_RACES);
  }
}

/**
 * Race IDs that have verified mock data available as a fallback.
 * Used only when the live API returns no results for these races.
 */
const FALLBACK_RACE_IDS_SET = new Set([
  'r01','r02','r03','r04','r05','r06','r07','r08','r09',
  'r10','r11','r12','r13','r14','r15','r16','r17','r18',
  'r19','r20','r21','r22','r23','r24',
]);

async function fetchRaceResults(): Promise<RaceResult[]> {
  // Primary: live API is the source of truth for all race results.
  // Fallback: mock data only fills in when the live API has nothing.
  let results: RaceResult[] = [];
  const liveRaceIds = new Set<string>();

  // 1. Try live API — this is the authoritative source.
  try {
    const live = await fetchLiveRaceResults();
    if (live && live.length > 0) {
      for (const r of live) {
        liveRaceIds.add(r.raceId);
      }
      results.push(...live);
      console.log('Race results: loaded', live.length, 'from live API:', [...liveRaceIds].join(', '));
    }
  } catch (e) {
    console.log('Race results: live API failed:', e);
  }

  // 2. Fill gaps with mock data for races the live API didn't return.
  const mockFallbacks = FALLBACK_RESULTS.filter(r => !liveRaceIds.has(r.raceId));
  if (mockFallbacks.length > 0) {
    console.log('Race results: adding', mockFallbacks.length, 'mock fallbacks:', mockFallbacks.map(r => r.raceId).join(', '));
    results.push(...mockFallbacks);
  }

  // 3. Try Supabase for any remaining gaps (races not in live or mock).
  if (isSupabaseConfigured) {
    const coveredIds = new Set(results.map(r => r.raceId));
    try {
      const { data, error } = await supabase
        .from('race_results')
        .select('*');

      if (!error && data && data.length > 0) {
        const supabaseResults = data
          .map((r: any) => ({
            raceId: r.race_id,
            classification: r.classification || [],
            fastestLapDriverId: r.fastest_lap_driver_id || '',
            dnfDriverIds: r.dnf_driver_ids || [],
          }))
          .filter(r => !coveredIds.has(r.raceId));
        if (supabaseResults.length > 0) {
          console.log('Race results: adding', supabaseResults.length, 'from Supabase:', supabaseResults.map(r => r.raceId).join(', '));
          results.push(...supabaseResults);
        }
      }
    } catch (e) {
      console.log('Race results: Supabase fetch error:', e);
    }
  }

  console.log('Race results: returning', results.length, 'total');
  return results;
}

export const [F1DataProvider, useF1Data] = createContextHook(() => {
  const queryClient = useQueryClient();

  // ---- polling gate -------------------------------------------------------
  // Only poll when today IS a race day AND we are at least 1 hour past the
  // race start (waiting for results to start appearing).  Computed inline —
  // it's just date arithmetic so useMemo has no real benefit here.
  // React Query restarts its refetch timer when refetchInterval changes,
  // so the gate will flip on automatically once the hour passes.
  // -------------------------------------------------------------------------
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const todaysRace = FALLBACK_RACES.find(
    (r) => r.raceDate === today && r.status !== 'cancelled',
  );

  const isRaceDay = !!todaysRace;

  let shouldPoll = false;
  if (todaysRace) {
    const raceStart = new Date(`${todaysRace.raceDate}T${todaysRace.raceTime}:00Z`);
    const oneHourAfterStart = raceStart.getTime() + 60 * 60 * 1000;
    shouldPoll = now.getTime() >= oneHourAfterStart;
  }

  const teamsQuery = useQuery({
    queryKey: ['f1-teams'],
    queryFn: fetchTeams,
    staleTime: 5 * 60_000,
    refetchInterval: shouldPoll ? POLL_INTERVAL * 5 : false,
    retry: 1,
  });

  const driversQuery = useQuery({
    queryKey: ['f1-drivers'],
    queryFn: fetchDrivers,
    staleTime: 60_000,
    refetchInterval: shouldPoll ? POLL_INTERVAL * 2 : false,
    retry: 1,
  });

  const racesQuery = useQuery({
    queryKey: ['f1-races'],
    queryFn: fetchRaces,
    staleTime: 30_000,
    refetchInterval: shouldPoll ? POLL_INTERVAL : false,
    retry: 1,
  });

  const resultsQuery = useQuery({
    queryKey: ['f1-results'],
    queryFn: fetchRaceResults,
    staleTime: 60_000,
    refetchInterval: shouldPoll ? POLL_INTERVAL * 2 : false,
    retry: 1,
  });

  const teams = useMemo(() => teamsQuery.data ?? FALLBACK_TEAMS, [teamsQuery.data]);
  const drivers = useMemo(() => driversQuery.data ?? FALLBACK_DRIVERS, [driversQuery.data]);
  const races = useMemo(() => racesQuery.data ?? updateRaceStatuses(FALLBACK_RACES), [racesQuery.data]);
  const raceResults = useMemo(() => resultsQuery.data ?? FALLBACK_RESULTS, [resultsQuery.data]);

  // Register for push notifications on first load.
  useEffect(() => {
    void registerForPushNotifications();
  }, []);

  // Schedule race reminder notifications whenever race data changes.
  useEffect(() => {
    if (races.length === 0) return;
    void scheduleRaceReminders(races);
  }, [races]);

  const nextRace = useMemo(() => {
    const live = races.filter(r => r.status === 'live');
    if (live.length > 0) return live[0];
    const upcoming = races.filter(r => r.status === 'upcoming');
    if (upcoming.length > 0) return upcoming[0];
    return undefined;
  }, [races]);

  // Status-update interval only runs when polling is active.
  useEffect(() => {
    if (!shouldPoll) return;

    const statusInterval = setInterval(() => {
      if (racesQuery.data) {
        const updated = updateRaceStatuses(racesQuery.data);
        const hasChanged = updated.some((r, i) => r.status !== racesQuery.data![i]?.status);
        if (hasChanged) {
          console.log('[F1Data] Race statuses updated based on current time');
          queryClient.setQueryData(['f1-races'], updated);
        }
      }
    }, 30_000);

    return () => clearInterval(statusInterval);
  }, [shouldPoll, racesQuery.data, queryClient]);

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        console.log('App foregrounded, refreshing F1 data');
        void queryClient.invalidateQueries({ queryKey: ['f1-races'] });
        void queryClient.invalidateQueries({ queryKey: ['f1-drivers'] });
        void queryClient.invalidateQueries({ queryKey: ['f1-results'] });
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [queryClient]);

  const getTeamById = useCallback((id: string): Team | undefined => {
    return teams.find(t => t.id === id);
  }, [teams]);

  const getDriverById = useCallback((id: string): Driver | undefined => {
    return drivers.find(d => d.id === id);
  }, [drivers]);

  const getRaceById = useCallback((id: string): Race | undefined => {
    return races.find(r => r.id === id);
  }, [races]);

  const getRaceResult = useCallback((raceId: string): RaceResult | undefined => {
    return raceResults.find(r => r.raceId === raceId);
  }, [raceResults]);

  const refreshAll = useCallback(() => {
    console.log('Manual refresh of all F1 data');
    void queryClient.invalidateQueries({ queryKey: ['f1-teams'] });
    void queryClient.invalidateQueries({ queryKey: ['f1-drivers'] });
    void queryClient.invalidateQueries({ queryKey: ['f1-races'] });
    void queryClient.invalidateQueries({ queryKey: ['f1-results'] });
    void queryClient.invalidateQueries({ queryKey: ['f1-live-standings'] });
  }, [queryClient]);

  const isLoading = teamsQuery.isLoading || driversQuery.isLoading || racesQuery.isLoading;
  const isRefreshing = teamsQuery.isFetching || driversQuery.isFetching || racesQuery.isFetching;
  const lastUpdated = new Date().toISOString();

  return useMemo(() => ({
    teams,
    drivers,
    races,
    raceResults,
    nextRace,
    isLoading,
    isRefreshing,
    isRaceDay,
    lastUpdated,
    getTeamById,
    getDriverById,
    getRaceById,
    getRaceResult,
    refreshAll,
  }), [teams, drivers, races, raceResults, nextRace, isLoading, isRefreshing, isRaceDay, lastUpdated, getTeamById, getDriverById, getRaceById, getRaceResult, refreshAll]);
});
