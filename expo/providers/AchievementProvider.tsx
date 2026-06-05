import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

import {
  type AchievementState,
  type AchievementProgress,
  type AchievementTier,
  type AchievementDefinition,
  ALL_ACHIEVEMENTS,
  createEmptyProgress,
} from '@/constants/achievements';
import {
  evaluateAll,
  type AchievementInput,
  type EvaluationResult,
} from '@/lib/achievement-engine';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { useF1Data } from '@/providers/F1DataProvider';
import type { Race } from '@/types';

const STORAGE_KEY = 'apex_draft_achievements';

/** Returns true only when every non-cancelled race is completed. */
function isSeasonOver(races: Race[] | undefined | null): boolean {
  if (!races || races.length === 0) return false;
  return races.every((r) => r.status === 'completed' || r.status === 'cancelled');
}

export interface AchievementUnlockEvent {
  achievementId: string;
  tier: AchievementTier;
  def: AchievementDefinition;
  dismissed: boolean;
}

function createEmptyAchievementState(): AchievementState {
  const empty: AchievementState = {};

  for (const def of ALL_ACHIEVEMENTS) {
    empty[def.id] = createEmptyProgress(def.id);
  }

  return empty;
}

function fillMissingAchievements(parsed: AchievementState | null | undefined): AchievementState {
  const filled: AchievementState = {};
  const safeParsed = parsed ?? {};

  for (const def of ALL_ACHIEVEMENTS) {
    const existing = safeParsed[def.id];

    if (existing && Array.isArray(existing.unlockedTiers)) {
      // Normalise fields that may be missing from older persisted data.
      filled[def.id] = {
        achievementId: existing.achievementId ?? def.id,
        unlockedTiers: existing.unlockedTiers,
        currentValue: existing.currentValue ?? 0,
        unlockedAt: existing.unlockedAt ?? {},
      };
    } else {
      filled[def.id] = createEmptyProgress(def.id);
    }
  }

  return filled;
}

function areAchievementStatesEqual(
  a: AchievementState | null | undefined,
  b: AchievementState | null | undefined
): boolean {
  if (!a || !b) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    const aProg = a[key];
    const bProg = b[key];

    if (!aProg || !bProg) return false;

    if (aProg.currentValue !== bProg.currentValue) return false;

    const aTiers = aProg.unlockedTiers ?? [];
    const bTiers = bProg.unlockedTiers ?? [];

    if (aTiers.length !== bTiers.length) return false;

    for (let i = 0; i < aTiers.length; i++) {
      if (aTiers[i] !== bTiers[i]) return false;
    }
  }

  return true;
}

export const [AchievementProvider, useAchievements] = createContextHook(() => {
  const [state, setState] = useState<AchievementState>(() => createEmptyAchievementState());
  const [isLoaded, setIsLoaded] = useState(false);
  const [unlockQueue, setUnlockQueue] = useState<AchievementUnlockEvent[]>([]);

  const {
    predictions = [],
    leagues = [],
    totalPoints = 0,
    getLeagueMembers,
  } = useGame();

  const { raceResults = [], races = [] } = useF1Data();
  const { profile } = useUser();

  const stateRef = useRef<AchievementState>(state);
  stateRef.current = state;

  // Stable refs for callbacks to avoid context value recreation
  const evaluateRef = useRef<() => EvaluationResult>(() => ({ state: createEmptyAchievementState(), newlyUnlocked: [] }));
  const getProgressRef = useRef<(id: string) => AchievementProgress | undefined>(() => undefined);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (raw) {
          const parsed: AchievementState = JSON.parse(raw);
          const filled = fillMissingAchievements(parsed);

          setState(filled);
          stateRef.current = filled;
        } else {
          const empty = createEmptyAchievementState();

          setState(empty);
          stateRef.current = empty;
        }
      } catch (e) {
        console.log('Failed to load achievements:', e);

        const empty = createEmptyAchievementState();

        setState(empty);
        stateRef.current = empty;
      } finally {
        setIsLoaded(true);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)).catch(() => {});
  }, [state, isLoaded]);

  const buildInput = useCallback((): AchievementInput => {
    const raceResultsById: AchievementInput['raceResults'] = {};

    for (const result of raceResults ?? []) {
      if (!result?.raceId) continue;

      raceResultsById[result.raceId] = result;
    }

    /** Season is over only when every non-cancelled race is completed. */
    const seasonOver = isSeasonOver(races);

    const leagueMemberships: AchievementInput['leagueMemberships'] = [];

    for (const league of leagues ?? []) {
      if (!league?.id) continue;

      const members = getLeagueMembers?.(league.id) ?? [];

      if (!Array.isArray(members) || members.length === 0) continue;

      const sortedMembers = [...members].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
      const currentIndex = sortedMembers.findIndex((member) => member.userId === profile.id);

      if (currentIndex === -1) continue;

      const rank = currentIndex + 1;

      leagueMemberships.push({
        leagueId: league.id,
        rank,
        // Only include seasonRank when the season has concluded.
        // Otherwise the engine would award Season Champion mid-season.
        seasonRank: seasonOver ? rank : undefined,
      });
    }

    return {
      predictions: predictions ?? [],
      raceResults: raceResultsById,
      totalPoints: totalPoints ?? 0,
      leagueMemberships,
      editCounts: {},
      lockTimes: {},
    };
  }, [
    predictions,
    raceResults,
    races,
    totalPoints,
    leagues,
    getLeagueMembers,
    profile.id,
  ]);

  // Always-available evaluate that reads latest state via refs — avoids
  // being a dependency for the context value useMemo.
  evaluateRef.current = (): EvaluationResult => {
    const input = buildInput();
    const safeExistingState = fillMissingAchievements(stateRef.current);

    try {
      return evaluateAll(input, safeExistingState);
    } catch (e) {
      console.log('Achievement evaluation failed:', e);

      return {
        state: safeExistingState,
        newlyUnlocked: [],
      };
    }
  };

  const checkUnlocks = useCallback(() => {
    if (!isLoaded) return;

    const result = evaluateRef.current();
    const previousState = fillMissingAchievements(stateRef.current);
    const nextState = fillMissingAchievements(result.state);

    const stateChanged = !areAchievementStatesEqual(previousState, nextState);

    if (stateChanged) {
      setState(nextState);
      stateRef.current = nextState;
    }

    const newlyUnlocked = result.newlyUnlocked ?? [];

    if (newlyUnlocked.length === 0) return;

    setUnlockQueue((prev) => [
      ...prev,
      ...newlyUnlocked.map((u) => ({
        achievementId: u.achievementId,
        tier: u.tier,
        def: u.def,
        dismissed: false,
      })),
    ]);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    checkUnlocks();
  }, [
    isLoaded,
    predictions,
    raceResults,
    races,
    totalPoints,
    leagues,
    checkUnlocks,
  ]);

  const dismissUnlock = useCallback(() => {
    setUnlockQueue((prev) => {
      if (prev.length === 0) return prev;

      const [head, ...rest] = prev;

      return [{ ...head, dismissed: true }, ...rest];
    });

    setTimeout(() => {
      setUnlockQueue((prev) => prev.filter((u) => !u.dismissed));
    }, 400);
  }, []);

  getProgressRef.current = (achievementId: string): AchievementProgress | undefined => {
    return stateRef.current[achievementId];
  };

  const getProgress = useCallback(
    (achievementId: string): AchievementProgress | undefined => {
      return getProgressRef.current(achievementId);
    },
    []
  );

  const unlockedCount = useMemo(() => {
    let count = 0;

    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden) continue;

      const progress = state[def.id];

      if (progress && (progress.unlockedTiers ?? []).length > 0) {
        count++;
      }
    }

    return count;
  }, [state]);

  const totalTiersCount = useMemo(() => {
    let count = 0;

    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden || !def.tiers) continue;

      count += def.tiers.length;
    }

    return count;
  }, []);

  const unlockedTiersCount = useMemo(() => {
    let count = 0;

    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden) continue;

      const progress = state[def.id];

      if (progress) {
        count += (progress.unlockedTiers ?? []).length;
      }
    }

    return count;
  }, [state]);

  return useMemo(
    () => ({
      state,
      isLoaded,
      unlockQueue,
      unlockedCount,
      totalTiersCount,
      unlockedTiersCount,
      checkUnlocks,
      dismissUnlock,
      getProgress,
      evaluate: evaluateRef.current,
    }),
    [
      state,
      isLoaded,
      unlockQueue,
      unlockedCount,
      totalTiersCount,
      unlockedTiersCount,
      checkUnlocks,
      dismissUnlock,
      getProgress,
    ]
  );
});