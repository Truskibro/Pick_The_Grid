import { useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Team, Driver, Race, RaceResult } from '@/types';
import {
  MOTOGP_TEAMS,
  MOTOGP_RIDERS,
  MOTOGP_RACES,
  MOTOGP_RACE_RESULTS,
} from '@/constants/motogp-data';

/**
 * Compute the live status of a MotoGP race based on its date.
 * Same logic as F1DataProvider.computeRaceStatus.
 */
function computeRaceStatus(race: Race): Race['status'] {
  if (race.status === 'cancelled') return 'cancelled';

  const now = new Date();
  const raceStart = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
  const raceEnd = new Date(raceStart.getTime() + 2 * 60 * 60 * 1000);

  if (race.status === 'completed') return 'completed';
  if (now >= raceStart && now <= raceEnd) return 'live';
  if (now > raceEnd) return 'completed';
  return 'upcoming';
}

function updateRaceStatuses(races: Race[]): Race[] {
  return races.map(race => ({
    ...race,
    seriesId: 'motogp',
    status: computeRaceStatus(race),
  }));
}

const UPDATED_RACES = updateRaceStatuses(MOTOGP_RACES);

/**
 * MotoGPDataProvider provides MotoGP-specific data (manufacturers, riders,
 * races, results). Currently uses static fallback data only — no live API
 * or Supabase tables for MotoGP yet.
 *
 * The interface mirrors F1DataProvider so screens can use either through
 * the unified `useSeriesData` hook.
 */
export const [MotoGPDataProvider, useMotoGPData] = createContextHook(() => {
  const teams = useMemo<Team[]>(() => MOTOGP_TEAMS, []);
  const drivers = useMemo<Driver[]>(() => MOTOGP_RIDERS, []);
  const races = useMemo<Race[]>(() => UPDATED_RACES, []);
  const raceResults = useMemo<RaceResult[]>(() => MOTOGP_RACE_RESULTS, []);

  const nextRace = useMemo(() => {
    const live = races.filter(r => r.status === 'live');
    if (live.length > 0) return live[0];
    const upcoming = races.filter(r => r.status === 'upcoming');
    if (upcoming.length > 0) return upcoming[0];
    return undefined;
  }, [races]);

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
    // No-op for static MotoGP data.
  }, []);

  return useMemo(() => ({
    teams,
    drivers,
    races,
    raceResults,
    nextRace,
    isLoading: false,
    isRefreshing: false,
    isRaceDay: false,
    lastUpdated: new Date().toISOString(),
    getTeamById,
    getDriverById,
    getRaceById,
    getRaceResult,
    refreshAll,
  }), [teams, drivers, races, raceResults, nextRace, getTeamById, getDriverById, getRaceById, getRaceResult, refreshAll]);
});
