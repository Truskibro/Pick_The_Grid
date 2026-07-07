import { useMemo } from 'react';
import { useSeries } from '@/providers/SeriesProvider';
import { useF1Data } from '@/providers/F1DataProvider';
import { useMotoGPData } from '@/providers/MotoGPDataProvider';
import { Team, Driver, Race, RaceResult } from '@/types';

/**
 * Unified series-aware data interface.
 *
 * Both F1DataProvider and MotoGPDataProvider expose the same shape, so this
 * hook simply picks the right one based on the currently-selected series and
 * returns it with a consistent interface. Screens call `useSeriesData()`
 * instead of `useF1Data()` directly, making them series-agnostic.
 */
export interface SeriesData {
  teams: Team[];
  drivers: Driver[];
  races: Race[];
  raceResults: RaceResult[];
  nextRace: Race | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isRaceDay: boolean;
  lastUpdated: string;
  getTeamById: (id: string) => Team | undefined;
  getDriverById: (id: string) => Driver | undefined;
  getRaceById: (id: string) => Race | undefined;
  getRaceResult: (raceId: string) => RaceResult | undefined;
  refreshAll: () => void;
}

export function useSeriesData(): SeriesData {
  const { currentSeries } = useSeries();
  const f1Data = useF1Data();
  const motogpData = useMotoGPData();

  return useMemo(() => {
    if (currentSeries === 'motogp') {
      return motogpData as SeriesData;
    }
    return f1Data as SeriesData;
  }, [currentSeries, f1Data, motogpData]);
}
