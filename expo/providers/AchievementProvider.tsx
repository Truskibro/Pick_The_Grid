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
  type RaceWeekRankEntry,
} from '@/lib/achievement-engine';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { useF1Data } from '@/providers/F1DataProvider';
import type { Race } from '@/types';

// Bumped to v10 — achievement engine fixes (Golden Goose Egg now computes
// points fresh from results instead of stale pointsEarned; Box Box Box now
// has real lock times from the race calendar) plus a full reset of undeserved
// unlocks. v9 caches may hold the Golden Goose Egg badge awarded incorrectly.
const STORAGE_KEY = 'apex_draft_achievements_v10';
// Persisted set of "achievementId:tier[:season]" keys that have already had
// their celebration animation play. This guarantees the overlay only fires
// ONCE per tier per device, even across reloads, remounts, or re-evaluations.
const CELEBRATED_KEY = 'apex_draft_celebrated_v2';
const LEGACY_STORAGE_KEYS = [
  'apex_draft_achievements',
  'apex_draft_achievements_v1',
  'apex_draft_achievements_v2',
  'apex_draft_achievements_v3',
  'apex_draft_achievements_v4',
  'apex_draft_achievements_v5',
  'apex_draft_achievements_v6',
  'apex_draft_achievements_v7',
  'apex_draft_achievements_v9',
];

/** Returns true only when every non-cancelled race is completed. */
function isSeasonOver(races: Race[] | undefined | null): boolean {
  if (!races || races.length === 0) return false;
  return races.every((r) => r.status === 'completed' || r.status === 'cancelled');
}

/** Build an ISO timestamp (UTC) from a race date + time, or null if invalid. */
function buildLockIso(raceDate: string, raceTime: string): string | null {
  const cleanDate = String(raceDate).trim();
  const cleanTime = String(raceTime).trim();
  if (!cleanDate || !cleanTime) return null;
  const timeWithSeconds = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
  const hasTimezone =
    timeWithSeconds.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(timeWithSeconds);
  const isoString = hasTimezone
    ? `${cleanDate}T${timeWithSeconds}`
    : `${cleanDate}T${timeWithSeconds}Z`;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** Derive the current season label (e.g. "2026") from the race calendar. */
function deriveCurrentSeason(races: Race[] | undefined | null): string {
  if (!races || races.length === 0) return '';
  // Use the most recent completed race's year; fall back to the latest race year.
  const sorted = [...races].sort((a, b) => a.raceDate.localeCompare(b.raceDate));
  const completed = sorted.filter((r) => r.status === 'completed');
  const ref = completed.length > 0 ? completed[completed.length - 1] : sorted[sorted.length - 1];
  return ref?.raceDate?.slice(0, 4) ?? '';
}

export interface AchievementUnlockEvent {
  achievementId: string;
  tier: AchievementTier;
  def: AchievementDefinition;
  dismissed: boolean;
  /** Season label for season-based achievements, e.g. "2026". */
  season?: string;
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
      filled[def.id] = {
        achievementId: existing.achievementId ?? def.id,
        unlockedTiers: existing.unlockedTiers,
        currentValue: existing.currentValue ?? 0,
        unlockedAt: existing.unlockedAt ?? {},
        seasonInstances: Array.isArray(existing.seasonInstances)
          ? existing.seasonInstances
          : undefined,
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

    // Compare season instances for season-based achievements.
    const aInst = aProg.seasonInstances ?? [];
    const bInst = bProg.seasonInstances ?? [];
    if (aInst.length !== bInst.length) return false;
    for (let i = 0; i < aInst.length; i++) {
      if (aInst[i].season !== bInst[i].season) return false;
      if (aInst[i].currentValue !== bInst[i].currentValue) return false;
      if ((aInst[i].unlockedTiers ?? []).length !== (bInst[i].unlockedTiers ?? []).length)
        return false;
    }
  }

  return true;
}

export const [AchievementProvider, useAchievements] = createContextHook(() => {
  const [state, setState] = useState<AchievementState>(() => createEmptyAchievementState());
  const [isLoaded, setIsLoaded] = useState(false);
  const [unlockQueue, setUnlockQueue] = useState<AchievementUnlockEvent[]>([]);
  // Set of "achievementId:tier[:season]" keys already celebrated on this device.
  const celebratedRef = useRef<Set<string>>(new Set());

  const {
    predictions = [],
    leagues = [],
    totalPoints = 0,
    editCounts = {},
    getLeagueMembers,
    fetchGlobalLeaderboard,
  } = useGame();

  const { raceResults = [], races = [] } = useF1Data();
  const { profile, isGuest } = useUser();

  // Compute per-race lock times from the race calendar. Picks lock at the
  // race start time (or the sprint start time on sprint weekends — whichever
  // comes first, since editing either side is blocked once that session starts).
  // The GameProvider's lockTimes memo is a stub (always {}), so without this
  // the Box Box Box hidden achievement could never fire.
  const lockTimes = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const race of races ?? []) {
      if (!race?.id || !race.raceDate || !race.raceTime) continue;
      const raceLock = buildLockIso(race.raceDate, race.raceTime);
      if (raceLock) map[race.id] = raceLock;
      // Sprint weekends: the sprint start is also a lock boundary for the
      // sprint side of the prediction. We key the sprint lock under a derived
      // id so it can be matched against sprint edits if we ever track them
      // separately. For now, the earliest lock boundary governs the race edit.
      if (race.hasSprint && race.sprintDate && race.sprintTime) {
        const sprintLock = buildLockIso(race.sprintDate, race.sprintTime);
        if (sprintLock) {
          // Keep the earlier of the two as the race's effective lock — an edit
          // within 60s of EITHER start counts.
          const existing = map[race.id];
          if (!existing || sprintLock < existing) {
            // Only override if the sprint starts before the race (normal case).
            // We still want the race lock available for race-side edits, so we
            // store the race lock under a secondary key too.
            if (existing) map[`${race.id}:sprint`] = existing;
            map[race.id] = sprintLock;
          } else {
            map[`${race.id}:sprint`] = sprintLock;
          }
        }
      }
    }
    return map;
  }, [races]);

  const stateRef = useRef<AchievementState>(state);
  stateRef.current = state;

  // Auth gate: only evaluate/unlock when the user is signed in.
  const isAuthenticated = !isGuest && !!profile && profile.id !== 'guest';
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;

  const evaluateRef = useRef<() => EvaluationResult>(() => ({ state: createEmptyAchievementState(), newlyUnlocked: [] }));
  const getProgressRef = useRef<(id: string) => AchievementProgress | undefined>(() => undefined);

  // Per-race league placements + pre-weekend rank for comeback tracking.
  const [raceWeekRanks, setRaceWeekRanks] = useState<RaceWeekRankEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      await Promise.all(
        LEGACY_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key).catch(() => {})),
      );

      try {
        const rawCelebrated = await AsyncStorage.getItem(CELEBRATED_KEY);
        if (rawCelebrated) {
          const parsed = JSON.parse(rawCelebrated) as string[];
          celebratedRef.current = new Set(Array.isArray(parsed) ? parsed : []);
        }
      } catch (e) {
        console.log('Failed to load celebrated set:', e);
      }

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

      // Merge Supabase achievements (if authenticated) — take union of unlocked
      // tiers, max of current values, and union of season instances.
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
              const remoteSeasonInstances = Array.isArray(row.season_instances)
                ? row.season_instances
                : undefined;

              const local = localState[achievementId];

              if (local) {
                const mergedTiers = [...new Set([...local.unlockedTiers, ...remoteTiers])];
                const mergedValue = Math.max(local.currentValue, remoteValue);
                const mergedUnlockedAt = { ...remoteUnlockedAt, ...local.unlockedAt };

                // Merge season instances by season label.
                let mergedInstances = local.seasonInstances;
                if (remoteSeasonInstances || local.seasonInstances) {
                  const bySeason = new Map<string, any>();
                  for (const inst of local.seasonInstances ?? []) bySeason.set(inst.season, inst);
                  for (const inst of remoteSeasonInstances ?? []) {
                    const existing = bySeason.get(inst.season);
                    if (!existing) {
                      bySeason.set(inst.season, inst);
                    } else {
                      bySeason.set(inst.season, {
                        season: inst.season,
                        unlockedTiers: [
                          ...new Set([
                            ...(existing.unlockedTiers ?? []),
                            ...(inst.unlockedTiers ?? []),
                          ]),
                        ],
                        currentValue: Math.max(existing.currentValue ?? 0, inst.currentValue ?? 0),
                        unlockedAt: { ...(existing.unlockedAt ?? {}), ...(inst.unlockedAt ?? {}) },
                      });
                    }
                  }
                  mergedInstances = Array.from(bySeason.values()).sort((a, b) =>
                    a.season.localeCompare(b.season),
                  );
                }

                localState[achievementId] = {
                  ...local,
                  unlockedTiers: mergedTiers,
                  currentValue: mergedValue,
                  unlockedAt: mergedUnlockedAt,
                  seasonInstances: mergedInstances,
                };
              } else {
                localState[achievementId] = {
                  achievementId,
                  unlockedTiers: remoteTiers,
                  currentValue: remoteValue,
                  unlockedAt: remoteUnlockedAt,
                  seasonInstances: remoteSeasonInstances,
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

    if (!isSupabaseConfigured || !profile?.id || profile.id === 'guest') return;

    const currentState = stateRef.current;

    const upsertAll = async () => {
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

      // If the live table doesn't yet have the season_instances column, the
      // first upsert including it will fail. We detect that and retry once
      // without the column so achievements still sync.
      let includeSeasonInstances = true;

      for (const [achievementId, progress] of Object.entries(currentState)) {
        if (!progress) continue;

        const basePayload = {
          user_id: profile.id,
          achievement_id: achievementId,
          unlocked_tiers: progress.unlockedTiers ?? [],
          current_value: progress.currentValue ?? 0,
          unlocked_at: progress.unlockedAt ?? {},
          updated_at: new Date().toISOString(),
        };

        try {
          const payload = includeSeasonInstances
            ? { ...basePayload, season_instances: progress.seasonInstances ?? null }
            : basePayload;
          const { error } = await supabase.from('user_achievements').upsert(payload, {
            onConflict: 'user_id,achievement_id',
          });

          if (error) {
            // If the error is about the season_instances column, retry without it.
            const msg = error.message ?? '';
            if (
              includeSeasonInstances &&
              (msg.includes('season_instances') ||
                error.code === '42703' ||
                msg.includes('column'))
            ) {
              includeSeasonInstances = false;
              const { error: retryError } = await supabase
                .from('user_achievements')
                .upsert(basePayload, { onConflict: 'user_id,achievement_id' });
              if (retryError && (retryError.code === '401' || retryError.message?.includes('JWT') || retryError.message?.includes('expired'))) {
                console.log('[Achievements] Auth error, stopping sync:', retryError.message);
                return;
              }
              continue;
            }
            if (error.code === '401' || msg.includes('JWT') || msg.includes('expired')) {
              console.log('[Achievements] Auth error, stopping sync:', msg);
              return;
            }
          }
        } catch (e: any) {
          if (e?.message?.includes('JWT') || e?.message?.includes('expired') || e?.status === 401) {
            console.log('[Achievements] Auth error, stopping sync');
            return;
          }
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

    const racesById: AchievementInput['racesById'] = {};
    for (const race of races ?? []) {
      if (!race?.id) continue;
      racesById[race.id] = race;
    }

    const seasonOver = isSeasonOver(races);
    const currentSeason = deriveCurrentSeason(races);

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
        seasonRank: seasonOver ? rank : undefined,
        memberCount: members.length,
      });
    }

    return {
      predictions: predictions ?? [],
      raceResults: raceResultsById,
      racesById,
      totalPoints: totalPoints ?? 0,
      leagueMemberships,
      editCounts,
      lockTimes,
      raceWeekRanks,
      globalLeaderboard: [], // populated lazily below when season is over
      currentSeason,
      isSeasonComplete: seasonOver,
      userId: profile.id,
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
    raceWeekRanks,
  ]);

  // Lazily fetch the global leaderboard when the season is over so that
  // season-end achievements can be evaluated. This is fetched once and cached.
  const [globalLeaderboard, setGlobalLeaderboard] = useState<
    { userId: string; totalPoints: number }[]
  >([]);

  useEffect(() => {
    if (!isLoaded) return;
    const seasonOver = isSeasonOver(races);
    if (!seasonOver) {
      if (globalLeaderboard.length > 0) setGlobalLeaderboard([]);
      return;
    }
    if (!fetchGlobalLeaderboard) return;

    let cancelled = false;
    const load = async () => {
      try {
        const lb = await fetchGlobalLeaderboard();
        if (cancelled) return;
        setGlobalLeaderboard(
          (lb ?? []).map((e) => ({ userId: e.userId, totalPoints: e.totalPoints })),
        );
      } catch (e) {
        console.log('[Achievements] global leaderboard load failed:', e);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, races, fetchGlobalLeaderboard]);

  // Inject the global leaderboard into the built input.
  const buildInputWithLeaderboard = useCallback((): AchievementInput => {
    const base = buildInput();
    return { ...base, globalLeaderboard };
  }, [buildInput, globalLeaderboard]);

  evaluateRef.current = (): EvaluationResult => {
    const input = buildInputWithLeaderboard();
    const safeExistingState = fillMissingAchievements(stateRef.current);

    try {
      return evaluateAll(input, safeExistingState);
    } catch (e) {
      console.log('Achievement evaluation failed:', e);
      return { state: safeExistingState, newlyUnlocked: [] };
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

    if (!authRef.current) return;

    const newlyUnlocked = result.newlyUnlocked ?? [];
    if (newlyUnlocked.length === 0) return;

    // Filter out any tier that has already had its celebration play on this
    // device. Season-based achievements include the season in the key so the
    // same tier in a different season still celebrates.
    const freshUnlocks = newlyUnlocked.filter((u) => {
      const key = u.season
        ? `${u.achievementId}:${u.tier}:${u.season}`
        : `${u.achievementId}:${u.tier}`;
      return !celebratedRef.current.has(key);
    });

    if (freshUnlocks.length === 0) return;

    const newKeys = freshUnlocks.map((u) =>
      u.season
        ? `${u.achievementId}:${u.tier}:${u.season}`
        : `${u.achievementId}:${u.tier}`,
    );
    for (const k of newKeys) celebratedRef.current.add(k);
    AsyncStorage.setItem(
      CELEBRATED_KEY,
      JSON.stringify(Array.from(celebratedRef.current)),
    ).catch(() => {});

    setUnlockQueue((prev) => [
      ...prev,
      ...freshUnlocks.map((u) => ({
        achievementId: u.achievementId,
        tier: u.tier,
        def: u.def,
        dismissed: false,
        season: u.season,
      })),
    ]);
  }, [isLoaded]);

  // Compute per-race league placements from Supabase for comeback-drive.
  // This is independent of season completion — comeback is a per-race metric.
  useEffect(() => {
    if (!isSupabaseConfigured || !profile?.id || profile.id === 'guest') {
      setRaceWeekRanks([]);
      return;
    }

    let cancelled = false;

    const compute = async () => {
      try {
        const { data: membershipRows, error: mErr } = await supabase
          .from('league_members')
          .select('league_id, user_id')
          .eq('user_id', profile.id);

        if (mErr || !membershipRows || membershipRows.length === 0) {
          if (!cancelled) setRaceWeekRanks([]);
          return;
        }

        const leagueIds = Array.from(
          new Set(membershipRows.map((r: any) => r.league_id).filter(Boolean)),
        ) as string[];
        if (leagueIds.length === 0) {
          if (!cancelled) setRaceWeekRanks([]);
          return;
        }

        const { data: allMembers, error: amErr } = await supabase
          .from('league_members')
          .select('league_id, user_id')
          .in('league_id', leagueIds);
        if (amErr || !allMembers) {
          if (!cancelled) setRaceWeekRanks([]);
          return;
        }

        const memberUserIds = Array.from(
          new Set(allMembers.map((m: any) => m.user_id).filter(Boolean)),
        ) as string[];
        if (memberUserIds.length === 0) {
          if (!cancelled) setRaceWeekRanks([]);
          return;
        }

        const { data: allPreds, error: pErr } = await supabase
          .from('user_predictions')
          .select('user_id, race_id, points_earned, sprint_points_earned, updated_at')
          .in('user_id', memberUserIds);
        if (pErr || !allPreds) {
          if (!cancelled) setRaceWeekRanks([]);
          return;
        }

        const completedRaceIds = new Set(
          (raceResults ?? []).map((r) => r?.raceId).filter(Boolean),
        );

        // Group members by league.
        const leaguesToUserIds = new Map<string, Set<string>>();
        for (const m of allMembers as any[]) {
          if (!m.league_id || !m.user_id) continue;
          let set = leaguesToUserIds.get(m.league_id);
          if (!set) {
            set = new Set();
            leaguesToUserIds.set(m.league_id, set);
          }
          set.add(m.user_id);
        }

        // Group predictions by race -> userId -> points.
        const raceToUserPoints = new Map<string, Map<string, number>>();
        for (const p of allPreds as any[]) {
          if (!p.race_id || !p.user_id) continue;
          if (!completedRaceIds.has(p.race_id)) continue;
          let userMap = raceToUserPoints.get(p.race_id);
          if (!userMap) {
            userMap = new Map();
            raceToUserPoints.set(p.race_id, userMap);
          }
          const pts = (p.points_earned ?? 0) + (p.sprint_points_earned ?? 0);
          const prev = userMap.get(p.user_id) ?? -1;
          if (pts > prev) userMap.set(p.user_id, pts);
        }

        // Sort completed races chronologically for pre-weekend rank computation.
        const sortedRaces = (races ?? [])
          .filter((r) => completedRaceIds.has(r.id))
          .sort((a, b) => a.raceDate.localeCompare(b.raceDate));

        // For each league + race, compute the user's rank and pre-weekend rank.
        const entries: RaceWeekRankEntry[] = [];
        for (const [leagueId, userIds] of leaguesToUserIds) {
          // Track running cumulative points per user (for pre-weekend rank).
          const cumulativePoints = new Map<string, number>();
          for (const uid of userIds) cumulativePoints.set(uid, 0);

          for (const race of sortedRaces) {
            const userMap = raceToUserPoints.get(race.id);
            if (!userMap) continue;

            // Pre-weekend rank = rank by cumulative points BEFORE this race.
            const preScored = [] as Array<{ userId: string; pts: number }>;
            for (const uid of userIds) {
              preScored.push({ userId: uid, pts: cumulativePoints.get(uid) ?? 0 });
            }
            preScored.sort((a, b) => b.pts - a.pts);
            const preIdx = preScored.findIndex((s) => s.userId === profile.id);
            const preWeekendRank = preIdx >= 0 ? preIdx + 1 : undefined;

            // Post-race rank = rank by points earned in THIS race.
            const scored = [] as Array<{ userId: string; pts: number }>;
            for (const uid of userIds) {
              const pts = userMap.get(uid);
              if (pts == null) continue;
              scored.push({ userId: uid, pts });
            }
            if (scored.length === 0) continue;
            scored.sort((a, b) => b.pts - a.pts);
            const idx = scored.findIndex((s) => s.userId === profile.id);
            if (idx === -1) continue;

            entries.push({
              leagueId,
              raceId: race.id,
              rank: idx + 1,
              preWeekendRank,
              memberCount: userIds.size,
            });

            // Update cumulative points for the next race's pre-weekend rank.
            for (const s of scored) {
              cumulativePoints.set(s.userId, (cumulativePoints.get(s.userId) ?? 0) + s.pts);
            }
          }
        }

        if (!cancelled) setRaceWeekRanks(entries);
      } catch (e) {
        console.log('[Achievements] raceWeekRanks compute failed:', e);
        if (!cancelled) setRaceWeekRanks([]);
      }
    };

    void compute();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, leagues, raceResults, races]);

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
    raceWeekRanks,
    globalLeaderboard,
    checkUnlocks,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnlockQueue([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setUnlockQueue([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset the celebrated set when the authenticated user identity changes.
  const prevProfileIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentId = profile?.id;
    if (prevProfileIdRef.current !== currentId) {
      celebratedRef.current = new Set();
      AsyncStorage.removeItem(CELEBRATED_KEY).catch(() => {});
      prevProfileIdRef.current = currentId;
    }
  }, [profile?.id]);

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
    // Only count Bronze/Silver/Gold for the total until Platinum is revealed.
    // This keeps the progress bar denominator consistent with what's shown.
    let count = 0;
    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden || !def.tiers) continue;
      const progress = state[def.id];
      const platinumUnlocked = progress?.unlockedTiers?.includes('platinum');
      count += platinumUnlocked ? def.tiers.length : 3;
    }
    return count;
  }, [state]);

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
