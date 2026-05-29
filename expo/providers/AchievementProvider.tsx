import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  type AchievementState,
  type AchievementProgress,
  type AchievementTier,
  type AchievementDefinition,
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  createEmptyProgress,
} from '@/constants/achievements';
import {
  evaluateAll,
  buildMockInput,
  type AchievementInput,
  type EvaluationResult,
} from '@/lib/achievement-engine';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';

const STORAGE_KEY = 'apex_draft_achievements';

export interface AchievementUnlockEvent {
  achievementId: string;
  tier: AchievementTier;
  def: AchievementDefinition;
  dismissed: boolean;
}

export const [AchievementProvider, useAchievements] = createContextHook(() => {
  const [state, setState] = useState<AchievementState>({});
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [unlockQueue, setUnlockQueue] = useState<AchievementUnlockEvent[]>([]);

  const { predictions, leagues, leagueMembers, totalPoints } = useGame();
  const { profile } = useUser();

  const stateRef = useRef(state);
  stateRef.current = state;

  // Load persisted state from AsyncStorage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: AchievementState = JSON.parse(raw);
          // Ensure all known achievements have an entry
          const filled: AchievementState = {};
          for (const def of ALL_ACHIEVEMENTS) {
            filled[def.id] = parsed[def.id] ?? createEmptyProgress(def.id);
          }
          setState(filled);
        } else {
          const empty: AchievementState = {};
          for (const def of ALL_ACHIEVEMENTS) {
            empty[def.id] = createEmptyProgress(def.id);
          }
          setState(empty);
        }
      } catch (e) {
        console.log('Failed to load achievements:', e);
        const empty: AchievementState = {};
        for (const def of ALL_ACHIEVEMENTS) {
          empty[def.id] = createEmptyProgress(def.id);
        }
        setState(empty);
      } finally {
        setIsLoaded(true);
      }
    };
    void load();
  }, []);

  // Persist whenever state changes (after initial load)
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)).catch(() => {});
  }, [state, isLoaded]);

  /**
   * Build the evaluation input from live GameProvider data.
   * TODO: Wire real race results from F1DataProvider once scoring is re-enabled.
   * TODO: Wire edit counts and lock times from prediction flow metadata.
   */
  const buildInput = useCallback((): AchievementInput => {
    // For now, build mock input enriched with whatever real data we have.
    // The engine gracefully handles empty collections.
    return buildMockInput({
      predictions,
      totalPoints,
      // TODO: populate raceResults from F1DataProvider
      // TODO: populate leagueMemberships from leagueMembers data
      // TODO: populate editCounts from prediction save metadata
      // TODO: populate lockTimes from race calendar
    });
  }, [predictions, totalPoints]);

  /** Run evaluation and return newly unlocked achievements. */
  const evaluate = useCallback((): EvaluationResult => {
    const input = buildInput();
    const result = evaluateAll(input, stateRef.current);
    return result;
  }, [buildInput]);

  /** Check for new unlocks and queue them for toast display. */
  const checkUnlocks = useCallback(() => {
    const result = evaluate();
    if (result.newlyUnlocked.length === 0) return;

    // Update state
    setState(result.state);

    // Queue new unlock toasts
    setUnlockQueue((prev) => [
      ...prev,
      ...result.newlyUnlocked.map((u) => ({
        achievementId: u.achievementId,
        tier: u.tier,
        def: u.def,
        dismissed: false,
      })),
    ]);
  }, [evaluate]);

  /** Dismiss the front of the unlock queue. */
  const dismissUnlock = useCallback(() => {
    setUnlockQueue((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      return [{ ...head, dismissed: true }, ...rest];
    });
    // Remove fully after a short delay so the toast can animate out
    setTimeout(() => {
      setUnlockQueue((prev) => prev.filter((u) => !u.dismissed));
    }, 400);
  }, []);

  /** Get progress for a specific achievement. */
  const getProgress = useCallback(
    (achievementId: string): AchievementProgress | undefined => {
      return state[achievementId];
    },
    [state],
  );

  /** Count unlocked achievements (visible only). */
  const unlockedCount = useMemo(() => {
    let count = 0;
    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden) continue;
      const prog = state[def.id];
      if (prog && prog.unlockedTiers.length > 0) count++;
    }
    return count;
  }, [state]);

  /** Count total possible unlocks (all tiers across all visible achievements). */
  const totalTiersCount = useMemo(() => {
    let count = 0;
    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden || !def.tiers) continue;
      count += def.tiers.length;
    }
    return count;
  }, []);

  /** Count unlocked tiers across all visible achievements. */
  const unlockedTiersCount = useMemo(() => {
    let count = 0;
    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden) continue;
      const prog = state[def.id];
      if (prog) count += prog.unlockedTiers.length;
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
      evaluate,
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
      evaluate,
    ],
  );
});
