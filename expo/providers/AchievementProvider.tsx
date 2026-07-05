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
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { useF1Data } from '@/providers/F1DataProvider';
import type { Race } from '@/types';

// Bumped to v4 — the engine previously treated rank-based achievements
// (race-week-rival, season-champion) as higher-is-better, so the 999 "no rank"
// sentinel unlocked every tier mid-season. v4 purges that bad local state.
// v3 also wiped stale v2 state; both are listed as legacy for safety.
const STORAGE_KEY = 'apex_draft_achievements_v4';
const LEGACY_STORAGE_KEYS = [
  'apex_draft_achievements',
  'apex_draft_achievements_v1',
  'apex_draft_achievements_v2',
  'apex_draft_achievements_v3',
];

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
    editCounts = {},
    lockTimes = {},
    getLeagueMembers,
  } = useGame();

  const { raceResults = [], races = [] } = useF1Data();
  const { profile, isGuest } = useUser();

  const stateRef = useRef<AchievementState>(state);
  stateRef.current = state;

  // Auth gate: only evaluate/unlock when the user is signed in. Guest mode
  // and the pre-login boot window must never queue celebration animations,
  // otherwise the overlay fires before the user exists or with stale state.
  const isAuthenticated = !isGuest && !!profile && profile.id !== 'guest';
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;

  // Stable refs for callbacks to avoid context value recreation
  const evaluateRef = useRef<() => EvaluationResult>(() => ({ state: createEmptyAchievementState(), newlyUnlocked: [] }));
  const getProgressRef = useRef<(id: string) => AchievementProgress | undefined>(() => undefined);

  useEffect(() => {
    const load = async () => {
      // Purge legacy achievement storage from the previous (buggy) engine.
      // This guarantees a clean slate for every user on first load.
      await Promise.all(
        LEGACY_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key).catch(() => {})),
      );

      let localState: AchievementState = createEmptyAchievementState();

      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (raw) {
          const parsed: AchievementState = JSON.parse(raw);
          localState = fillMissingAchievements(parsed);
        }
      } catch (e) {
        console.log('Failed to load achievements from AsyncStorage:', e);
      }

      // Merge Supabase achievements (if authenticated) — take union of unlocked tiers
      // and max of current values so cross-device progress is never lost.
      if (isSupabaseConfigured && profile?.id) {
        try {
          const { data: remoteRows, error } = await supabase
            .from('user_achievements')
            .select('*')
            .eq('user_id', profile.id);

          if (!error && remoteRows && remoteRows.length > 0) {
            for (const row of remoteRows as any[]) {
              const achievementId: string = row.achievement_id;
              const remoteTiers: AchievementTier[] = Array.isArray(row.unlocked_tiers)
                ? row.unlocked_tiers.filter((t: string) =>
                    ['bronze', 'silver', 'gold', 'platinum'].includes(t)
                  )
                : [];
              const remoteValue: number = row.current_value ?? 0;
              const remoteUnlockedAt: Record<string, string> =
                typeof row.unlocked_at === 'object' && row.unlocked_at !== null
                  ? row.unlocked_at
                  : {};

              const local = localState[achievementId];

              if (local) {
                // Merge: union of tiers, max of current_value, latest unlocked_at
                const mergedTiers = [...new Set([...local.unlockedTiers, ...remoteTiers])];
                const mergedValue = Math.max(local.currentValue, remoteValue);
                const mergedUnlockedAt = { ...remoteUnlockedAt, ...local.unlockedAt };

                localState[achievementId] = {
                  ...local,
                  unlockedTiers: mergedTiers,
                  currentValue: mergedValue,
                  unlockedAt: mergedUnlockedAt,
                };
              } else {
                localState[achievementId] = {
                  achievementId,
                  unlockedTiers: remoteTiers,
                  currentValue: remoteValue,
                  unlockedAt: remoteUnlockedAt,
                };
              }
            }

            console.log(
              '[Achievements] Merged',
              remoteRows.length,
              'achievements from Supabase'
            );
          }
        } catch (e) {
          console.log('[Achievements] Supabase load failed:', e);
        }
      }

      const filled = fillMissingAchievements(localState);
      setState(filled);
      stateRef.current = filled;
      setIsLoaded(true);
    };

    void load();
  }, [profile?.id]);

  useEffect(() => {
    if (!isLoaded) return;

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)).catch(() => {});

    // Upsert to Supabase so achievements sync across devices.
    // Guard: only upsert if we have a valid session (skip guest/token-expired).
    if (!isSupabaseConfigured || !profile?.id || profile.id === 'guest') return;

    const currentState = stateRef.current;

    const upsertAll = async () => {
      // Check session validity before firing any requests.
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          console.log('[Achievements] No valid session, skipping Supabase sync');
          return;
        }
      } catch {
        console.log('[Achievements] Session check failed, skipping Supabase sync');
        return;
      }

      for (const [achievementId, progress] of Object.entries(currentState)) {
        if (!progress) continue;

        try {
          const { error } = await supabase.from('user_achievements').upsert(
            {
              user_id: profile.id,
              achievement_id: achievementId,
              unlocked_tiers: progress.unlockedTiers ?? [],
              current_value: progress.currentValue ?? 0,
              unlocked_at: progress.unlockedAt ?? {},
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,achievement_id' }
          );

          // Stop on auth errors — don't hammer the API.
          if (error && (error.code === '401' || error.message?.includes('JWT') || error.message?.includes('expired'))) {
            console.log('[Achievements] Auth error, stopping sync:', error.message);
            return;
          }
        } catch (e: any) {
          if (e?.message?.includes('JWT') || e?.message?.includes('expired') || e?.status === 401) {
            console.log('[Achievements] Auth error, stopping sync');
            return;
          }
          // Other errors: continue with next achievement
        }
      }
    };

    void upsertAll();
  }, [state, isLoaded, profile?.id]);

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
        // seasonRank is intentionally left undefined here — the engine gates
        // season-rank achievements on isSeasonComplete instead of relying on
        // the caller to withhold the value.
        seasonRank: seasonOver ? rank : undefined,
      });
    }

    return {
      predictions: predictions ?? [],
      raceResults: raceResultsById,
      totalPoints: totalPoints ?? 0,
      leagueMemberships,
      editCounts,
      lockTimes,
      // No per-race league placement data exists yet, so race-week-rival
      // cannot be legitimately unlocked. The engine treats undefined as a
      // sentinel that satisfies no tier.
      raceWeekRanks: undefined,
      isSeasonComplete: seasonOver,
    };
  }, [
    predictions,
    raceResults,
    races,
    totalPoints,
    leagues,
    editCounts,
    lockTimes,
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

    // Auth gate: never queue celebration animations before the user is signed
    // in. State still updates silently so progress isn't lost, but the overlay
    // is reserved for authenticated sessions only.
    if (!authRef.current) return;

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

  // Reset the celebration queue whenever the auth state changes. This clears
  // any unlock that was staged before login (e.g. a backfilled prediction
  // created while signed out) so the overlay never fires for a stale event,
  // and gives the authenticated session a clean starting queue.
  useEffect(() => {
    if (!isAuthenticated) {
      setUnlockQueue([]);
    }
  }, [isAuthenticated]);

  // One-time flush of any stale unlock queued during the previous session
  // (e.g. a backfilled prediction that fired checkUnlocks before the auth
  // gate existed). Runs once on mount so legitimate unlocks discovered
  // after this point still celebrate normally.
  useEffect(() => {
    setUnlockQueue([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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