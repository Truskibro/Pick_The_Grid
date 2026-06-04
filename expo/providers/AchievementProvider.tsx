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

const STORAGE_KEY = 'apex_draft_achievements';

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

function fillMissingAchievements(parsed: AchievementState): AchievementState {
  const filled: AchievementState = {};

  for (const def of ALL_ACHIEVEMENTS) {
    filled[def.id] = parsed[def.id] ?? createEmptyProgress(def.id);
  }

  return filled;
}

function areAchievementStatesEqual(a: AchievementState, b: AchievementState): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    const aProg = a[key];
    const bProg = b[key];

    if (!bProg) return false;

    if (aProg.currentValue !== bProg.currentValue) return false;

    if (aProg.unlockedTiers.length !== bProg.unlockedTiers.length) return false;

    for (let i = 0; i < aProg.unlockedTiers.length; i++) {
      if (aProg.unlockedTiers[i] !== bProg.unlockedTiers[i]) return false;
    }
  }

  return true;
}

export const [AchievementProvider, useAchievements] = createContextHook(() => {
  const [state, setState] = useState<AchievementState>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [unlockQueue, setUnlockQueue] = useState<AchievementUnlockEvent[]>([]);

  const { predictions, leagues, leagueMembers, totalPoints } = useGame();
  const { raceResults } = useF1Data();
  const { profile } = useUser();

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (raw) {
          const parsed: AchievementState = JSON.parse(raw);
          setState(fillMissingAchievements(parsed));
        } else {
          setState(createEmptyAchievementState());
        }
      } catch (e) {
        console.log('Failed to load achievements:', e);
        setState(createEmptyAchievementState());
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

    for (const result of raceResults) {
      raceResultsById[result.raceId] = result;
    }

    const leagueMemberships: AchievementInput['leagueMemberships'] = [];

    for (const league of leagues) {
      const members = leagueMembers[league.id] || [];

      if (members.length === 0) continue;

      const sortedMembers = [...members].sort((a, b) => b.points - a.points);
      const currentIndex = sortedMembers.findIndex((member) => member.userId === profile.id);

      if (currentIndex === -1) continue;

      const rank = currentIndex + 1;

      leagueMemberships.push({
        leagueId: league.id,
        rank,
        seasonRank: rank,
      });
    }

    return {
      predictions,
      raceResults: raceResultsById,
      totalPoints,
      leagueMemberships,
      editCounts: {},
      lockTimes: {},
    };
  }, [predictions, raceResults, totalPoints, leagues, leagueMembers, profile.id]);

  const evaluate = useCallback((): EvaluationResult => {
    const input = buildInput();
    return evaluateAll(input, stateRef.current);
  }, [buildInput]);

  const checkUnlocks = useCallback(() => {
    if (!isLoaded) return;

    const result = evaluate();
    const previousState = stateRef.current;

    const stateChanged = !areAchievementStatesEqual(previousState, result.state);

    if (stateChanged) {
      setState(result.state);
      stateRef.current = result.state;
    }

    if (result.newlyUnlocked.length === 0) return;

    setUnlockQueue((prev) => [
      ...prev,
      ...result.newlyUnlocked.map((u) => ({
        achievementId: u.achievementId,
        tier: u.tier,
        def: u.def,
        dismissed: false,
      })),
    ]);
  }, [evaluate, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    checkUnlocks();
  }, [isLoaded, predictions, raceResults, totalPoints, leagues, leagueMembers, checkUnlocks]);

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

  const getProgress = useCallback(
    (achievementId: string): AchievementProgress | undefined => {
      return state[achievementId];
    },
    [state]
  );

  const unlockedCount = useMemo(() => {
    let count = 0;

    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden) continue;

      const progress = state[def.id];

      if (progress && progress.unlockedTiers.length > 0) {
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
        count += progress.unlockedTiers.length;
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
    ]
  );
});