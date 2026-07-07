import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { SeriesId, getSeriesConfig, isValidSeriesId, SeriesConfig } from '@/constants/series';

const STORAGE_KEY = 'apex_draft_selected_series_v1';

const DEFAULT_SERIES: SeriesId = 'f1';

/**
 * SeriesProvider manages the currently-selected racing series (F1 or MotoGP).
 *
 * The selected series is persisted in AsyncStorage so it survives app restarts.
 * On first launch (no series selected), the app shows the Series Select landing
 * page. Once a series is chosen, the app enters the main tab experience.
 *
 * The provider also exposes the full `SeriesConfig` for the active series so
 * screens can access labels, colors, scoring, and pick limits without importing
 * series-specific constants directly.
 */
export const [SeriesProvider, useSeries] = createContextHook(() => {
  const [selectedSeries, setSelectedSeries] = useState<SeriesId | null>(null);
  const [hasChosen, setHasChosen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load persisted series selection on mount.
  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && isValidSeriesId(stored)) {
          setSelectedSeries(stored);
          setHasChosen(true);
        }
      } catch (e) {
        console.log('[SeriesProvider] Error loading series:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const selectSeries = useCallback(async (seriesId: SeriesId): Promise<void> => {
    setSelectedSeries(seriesId);
    setHasChosen(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, seriesId);
    } catch (e) {
      console.log('[SeriesProvider] Error persisting series:', e);
    }
  }, []);

  const switchSeries = useCallback(async (seriesId: SeriesId): Promise<void> => {
    setSelectedSeries(seriesId);
    setHasChosen(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, seriesId);
    } catch (e) {
      console.log('[SeriesProvider] Error switching series:', e);
    }
  }, []);

  const clearSeries = useCallback(async (): Promise<void> => {
    setSelectedSeries(null);
    setHasChosen(false);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.log('[SeriesProvider] Error clearing series:', e);
    }
  }, []);

  const currentSeries: SeriesId = selectedSeries ?? DEFAULT_SERIES;
  const config: SeriesConfig = useMemo(() => getSeriesConfig(currentSeries), [currentSeries]);

  return useMemo(() => ({
    selectedSeries: hasChosen ? currentSeries : null,
    currentSeries,
    config,
    hasChosen,
    isLoading,
    selectSeries,
    switchSeries,
    clearSeries,
  }), [hasChosen, currentSeries, config, isLoading, selectSeries, switchSeries, clearSeries]);
});
