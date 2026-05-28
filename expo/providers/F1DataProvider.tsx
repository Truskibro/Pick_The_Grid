import { useEffect, useState, useCallback, useMemo } from 'react';
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

const POLL_INTERVAL = 60_000;
const RACE_DAY_POLL_INTERVAL = 15_000;

function computeRaceStatus(race: Race): Race['status'] {
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

async function fetchRaceResults(): Promise<RaceResult[]> {
  // 1. Try live API first — it returns full classification for every completed round.
  try {
    const live = await fetchLiveRaceResults();
    if (live && live.length > 0) {
      console.log('Race results: loaded', live.length, 'from live API');
      return live;
    }
  } catch (e) {
    console.log('Race results: live API failed, trying Supabase', e);
  }

  // 2. Fall back to Supabase if configured.
  if (!isSupabaseConfigured) {
    console.log('Race results: Supabase not configured, using fallback data');
    return FALLBACK_RESULTS;
  }
  try {
    const { data, error } = await supabase
      .from('race_results')
      .select('*');

    if (error || !data || data.length === 0) {
      console.log('Race results: using fallback data', error?.message);
      return FALLBACK_RESULTS;
    }

    console.log('Race results: loaded', data.length, 'from Supabase');
    return data.map((r: any) => ({
      raceId: r.race_id,
      classification: r.classification || [],
      fastestLapDriverId: r.fastest_lap_driver_id || '',
      dnfDriverIds: r.dnf_driver_ids || [],
    }));
  } catch (e) {
    console.log('Race results fetch error, using fallback:', e);
    return FALLBACK_RESULTS;
  }
}

export const [F1DataProvider, useF1Data] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isRaceDay, setIsRaceDay] = useState<boolean>(false);

  const teamsQuery = useQuery({
    queryKey: ['f1-teams'],
    queryFn: fetchTeams,
    staleTime: 5 * 60_000,
    refetchInterval: POLL_INTERVAL * 5,
    retry: 1,
  });

  const driversQuery = useQuery({
    queryKey: ['f1-drivers'],
    queryFn: fetchDrivers,
    staleTime: 60_000,
    refetchInterval: POLL_INTERVAL * 2,
    retry: 1,
  });

  const racesQuery = useQuery({
    queryKey: ['f1-races'],
    queryFn: fetchRaces,
    staleTime: 30_000,
    refetchInterval: isRaceDay ? RACE_DAY_POLL_INTERVAL : POLL_INTERVAL,
    retry: 1,
  });

  const resultsQuery = useQuery({
    queryKey: ['f1-results'],
    queryFn: fetchRaceResults,
    staleTime: 60_000,
    refetchInterval: POLL_INTERVAL * 2,
    retry: 1,
  });

  const teams = useMemo(() => teamsQuery.data ?? FALLBACK_TEAMS, [teamsQuery.data]);
  const drivers = useMemo(() => driversQuery.data ?? FALLBACK_DRIVERS, [driversQuery.data]);
  const races = useMemo(() => racesQuery.data ?? updateRaceStatuses(FALLBACK_RACES), [racesQuery.data]);
  const raceResults = useMemo(() => resultsQuery.data ?? FALLBACK_RESULTS, [resultsQuery.data]);

  const nextRace = useMemo(() => {
    const upcoming = races.filter(r => r.status === 'upcoming');
    if (upcoming.length > 0) return upcoming[0];
    const live = races.filter(r => r.status === 'live');
    if (live.length > 0) return live[0];
    return undefined;
  }, [races]);

  useEffect(() => {
    if (!nextRace) {
      setIsRaceDay(false);
      return;
    }
    const now = new Date();
    const raceDate = new Date(`${nextRace.raceDate}T${nextRace.raceTime}:00Z`);
    const hoursUntilRace = (raceDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    setIsRaceDay(hoursUntilRace <= 4 && hoursUntilRace >= -3);
  }, [nextRace]);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      if (racesQuery.data) {
        const updated = updateRaceStatuses(racesQuery.data);
        const hasChanged = updated.some((r, i) => r.status !== racesQuery.data![i]?.status);
        if (hasChanged) {
          console.log('Race statuses updated based on current time');
          queryClient.setQueryData(['f1-races'], updated);
        }
      }
    }, 30_000);

    return () => clearInterval(statusInterval);
  }, [racesQuery.data, queryClient]);

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
