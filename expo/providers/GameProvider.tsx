import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useUser } from '@/providers/UserProvider';
import { useF1Data } from '@/providers/F1DataProvider';
import {
  Prediction,
  League,
  LeagueMember,
  RaceResult,
  LeaderboardEntry,
} from '@/types';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';
import {
  SEED_PREDICTIONS,
  COMPLETED_RACE_IDS,
  SEED_USERS,
  scoreSeededPredictions,
} from '@/constants/seed-predictions';
import {
  MOCK_LEAGUE_MEMBERS,
  scoreMockMember,
} from '@/constants/mock-members';
import { MOCK_RACE_RESULTS, RACES } from '@/constants/f1-data';

const SEED_USER_IDS = new Set(SEED_USERS.map((u) => u.userId.toLowerCase()));

function normId(id: string): string {
  return id.toLowerCase();
}

const STORAGE_KEYS = {
  predictions: 'apex_draft_predictions',
  leagues: 'apex_draft_leagues',
  leagueMembers: 'apex_draft_league_members',
  editCounts: 'apex_draft_edit_counts',
} as const;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T>,
  ms: number,
  fallback: T
): Promise<T> {
  const promise = Promise.resolve(promiseOrThenable);

  return Promise.race([
    promise.catch((err: any) => {
      console.log('withTimeout: promise rejected:', err?.message || err);
      return fallback;
    }),
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.log('withTimeout: timed out after', ms, 'ms');
        resolve(fallback);
      }, ms)
    ),
  ]);
}

function normalizePrediction(prediction: Prediction): Prediction {
  return {
    ...prediction,
    top10: prediction.top10 ?? [],
    fastestLap: prediction.fastestLap ?? null,
    dnf: prediction.dnf ?? null,
    pointsEarned: prediction.pointsEarned ?? 0,
    sprintTop8: prediction.sprintTop8 ?? [],
    sprintPointsEarned: prediction.sprintPointsEarned ?? 0,
    updatedAt: prediction.updatedAt ?? new Date().toISOString(),
    username: prediction.username ?? null,
    displayName: prediction.displayName ?? null,
  };
}

function mapMemberRows(
  rows: any[],
  currentUserId: string,
  localProfile: { username: string; displayName: string; totalPoints: number },
  currentUserPointsOverride?: number
): LeagueMember[] {
  return rows.map((m: any) => {
    const memberId = String(m.user_id);
    const isCurrentUser = memberId === currentUserId;

    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;

    const username = isCurrentUser
      ? localProfile.username
      : profile?.username?.trim() || 'player';

    const displayName = isCurrentUser
      ? localProfile.displayName
      : profile?.display_name?.trim() || profile?.username?.trim() || 'Player';

    let points = 0;

    if (SEED_USER_IDS.has(normId(memberId))) {
      points = scoreSeededPredictions(normId(memberId), MOCK_RACE_RESULTS);
    } else if (isCurrentUser) {
      // Prefer the computed prediction-based total (always up-to-date)
      // over localProfile.totalPoints which may be stale during startup.
      points =
        currentUserPointsOverride != null
          ? currentUserPointsOverride
          : localProfile.totalPoints;
    } else {
      points = profile?.total_points ?? 0;
    }

    return {
      userId: memberId,
      username,
      displayName,
      role: m.role || 'member',
      points,
      joinedAt: m.joined_at || new Date().toISOString(),
    };
  });
}

async function fetchLeagueMembersJoined(leagueId: string): Promise<any[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('league_members')
      .select('user_id, role, joined_at, profiles(username, display_name, total_points)')
      .eq('league_id', leagueId),
    10000,
    { data: null, error: { message: 'timeout' } } as any
  );

  if (error || !data) {
    console.log('fetchLeagueMembersJoined: error', error?.message || 'no data');
    return [];
  }

  return data as any[];
}

async function fetchAllProfilesSorted(): Promise<
  { userId: string; username: string; displayName: string; totalPoints: number }[]
> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, username, display_name, total_points')
        .order('total_points', { ascending: false })
        .limit(100),
      15000,
      { data: null, error: { message: 'timeout' } } as any
    );

    if (error || !data) {
      console.log('fetchAllProfilesSorted: error', error?.message || 'no data');
      return [];
    }

    return data.map((p: any) => ({
      userId: p.id,
      username: p.username?.trim() || 'unknown',
      displayName: p.display_name?.trim() || p.username?.trim() || 'Unknown Player',
      totalPoints: p.total_points || 0,
    }));
  } catch (e) {
    console.log('fetchAllProfilesSorted: exception', e);
    return [];
  }
}

export const [GameProvider, useGame] = createContextHook(() => {
  const { session, profile: localProfile, updateProfile } = useUser();

  const { getRaceById } = useF1Data();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<Record<string, LeagueMember[]>>({});
  const [editCounts, setEditCounts] = useState<Record<string, { count: number; lastEditAt: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastScoredAt, setLastScoredAt] = useState<string | null>(null);

  const localProfileRef = useRef(localProfile);
  localProfileRef.current = localProfile;

  const updateProfileRef = useRef(updateProfile);
  updateProfileRef.current = updateProfile;

  const predictionsRef = useRef(predictions);
  predictionsRef.current = predictions;

  const leagueMembersRef = useRef(leagueMembers);
  leagueMembersRef.current = leagueMembers;

  const editCountsRef = useRef(editCounts);
  editCountsRef.current = editCounts;

  // Guard against reloading from Supabase right after a local save.
  // When a save just completed (within 5s), stale remote data could
  // overwrite the fresh local prediction during the merge.
  const lastSaveTimeRef = useRef<number>(0);

  const loadFromSupabase = useCallback(async () => {
    if (!session?.user) return;

    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, skipping remote load');
      return;
    }

    // Skip if a save just completed — prevents stale remote data from
    // overwriting fresh local predictions during merge.
    const msSinceLastSave = Date.now() - lastSaveTimeRef.current;
    if (msSinceLastSave < 5000) {
      console.log('[loadFromSupabase] Skipping — save completed', msSinceLastSave, 'ms ago');
      return;
    }

    const userId = session.user.id;

    try {
      const predResult = await withTimeout(
        supabase.from('user_predictions').select('*').eq('user_id', userId),
        10000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (predResult.error) {
        console.log('Predictions load error:', predResult.error.message);
      }

      // Read local predictions so we can merge instead of replace.
      let localPreds: Prediction[] = [];
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.predictions);
        if (raw) {
          localPreds = (JSON.parse(raw) as Prediction[]).map(normalizePrediction);
        }
      } catch {
        // Ignore corrupt local data — remote/Supabase is source of truth.
      }

      const remoteMap = new Map<string, Prediction>();

      if (predResult.data && predResult.data.length > 0) {
        for (const p of predResult.data as any[]) {
          const pred = normalizePrediction({
            id: p.id,
            raceId: p.race_id,
            top10: p.predicted_top10 || [],
            fastestLap: p.predicted_fastest_lap || null,
            dnf: p.predicted_dnf || null,
            pointsEarned: p.points_earned || 0,
            sprintTop8: p.predicted_sprint_top8 || [],
            sprintPointsEarned: p.sprint_points_earned || 0,
            updatedAt: p.updated_at,
            username: p.username ?? null,
            displayName: p.display_name ?? null,
          });
          remoteMap.set(pred.raceId, pred);
        }
      }

      let preds: Prediction[] = [...remoteMap.values()];

      // Backfill missing usernames and display names from the local profile.
      const myUsername = localProfileRef.current.username;
      const myDisplayName = localProfileRef.current.displayName;
      if (myUsername && myUsername !== 'guest') {
        for (const p of preds) {
          if (!p.username) p.username = myUsername;
          if (!p.displayName) p.displayName = myDisplayName;
        }
      }

      // Merge local predictions, preferring whichever is newer.
      // This prevents stale Supabase data from overwriting freshly saved
      // local predictions when the Supabase upsert in savePrediction fails.
      for (const lp of localPreds) {
        const remote = remoteMap.get(lp.raceId);

        if (!remote) {
          // Local-only prediction — add it and sync to Supabase.
          preds.push(lp);

          void (async () => {
            try {
              const { error } = await supabase
                .from('user_predictions')
                .upsert(
                  {
                    user_id: userId,
                    race_id: lp.raceId,
                    predicted_top10: lp.top10,
                    predicted_fastest_lap: lp.fastestLap,
                    predicted_dnf: lp.dnf,
                    predicted_sprint_top8: lp.sprintTop8,
                    points_earned: lp.pointsEarned ?? 0,
                    sprint_points_earned: lp.sprintPointsEarned ?? 0,
                    username: myUsername || localProfileRef.current.username,
                    display_name: localProfileRef.current.displayName,
                    updated_at: lp.updatedAt,
                  },
                  { onConflict: 'user_id,race_id' }
                );
              if (error) {
                console.log('[loadFromSupabase] Sync upsert error for', lp.raceId, ':', error.message);
              } else {
                console.log('[loadFromSupabase] Synced local prediction to Supabase:', lp.raceId);
              }
            } catch {}
          })();
        } else if (lp.updatedAt && (!remote.updatedAt || new Date(lp.updatedAt) > new Date(remote.updatedAt))) {
          // Local is newer — replace the stale remote entry and sync to Supabase.
          const idx = preds.findIndex((p) => p.raceId === lp.raceId);
          if (idx >= 0) {
            preds[idx] = lp;
          }

          console.log('[loadFromSupabase] Local prediction newer than remote for', lp.raceId, '— using local');

          void (async () => {
            try {
              const { error } = await supabase
                .from('user_predictions')
                .upsert(
                  {
                    user_id: userId,
                    race_id: lp.raceId,
                    predicted_top10: lp.top10,
                    predicted_fastest_lap: lp.fastestLap,
                    predicted_dnf: lp.dnf,
                    predicted_sprint_top8: lp.sprintTop8,
                    points_earned: lp.pointsEarned ?? 0,
                    sprint_points_earned: lp.sprintPointsEarned ?? 0,
                    username: myUsername || localProfileRef.current.username,
                    display_name: localProfileRef.current.displayName,
                    updated_at: lp.updatedAt,
                  },
                  { onConflict: 'user_id,race_id' }
                );
              if (error) {
                console.log('[loadFromSupabase] Local-newer upsert error for', lp.raceId, ':', error.message);
              } else {
                console.log('[loadFromSupabase] Synced newer local prediction to Supabase:', lp.raceId);
              }
            } catch {}
          })();
        }
      }

      const seedForUser = SEED_PREDICTIONS[normId(userId)];

      if (seedForUser) {
        const seedUser = SEED_USERS.find((u) => normId(u.userId) === normId(userId));
        let rescored = false;

        for (const raceId of COMPLETED_RACE_IDS) {
          const rawPred = seedForUser[raceId];

          if (!rawPred) continue;

          preds = preds.filter((p) => p.raceId !== raceId);

          const raceResult = MOCK_RACE_RESULTS.find((r) => r.raceId === raceId);

          let gpPoints = 0;
          let sprintPts = 0;

          const seedUsername = seedUser?.username ?? null;

          if (raceResult && raceResult.classification.length > 0 && rawPred.top10.length > 0) {
            const scoringPred: Prediction = normalizePrediction({
              id: generateUuid(),
              raceId: rawPred.raceId,
              top10: rawPred.top10,
              fastestLap: rawPred.fastestLap,
              dnf: rawPred.dnf,
              pointsEarned: 0,
              sprintTop8: rawPred.sprintTop8,
              sprintPointsEarned: 0,
              updatedAt: '2026-01-01T00:00:00Z',
              username: seedUsername,
              displayName: seedUser?.displayName ?? null,
            });

            const breakdown = calculatePoints(scoringPred, raceResult);
            gpPoints = breakdown.totalPoints;
          }

          if (
            raceResult &&
            raceResult.sprintClassification &&
            raceResult.sprintClassification.length > 0 &&
            rawPred.sprintTop8.length > 0
          ) {
            const sprintBreakdown = calculateSprintPoints(
              rawPred.sprintTop8,
              raceResult.sprintClassification
            );

            sprintPts = sprintBreakdown.totalPoints;
          }

          const fullPred: Prediction = normalizePrediction({
            id: generateUuid(),
            raceId: rawPred.raceId,
            top10: rawPred.top10,
            fastestLap: rawPred.fastestLap,
            dnf: rawPred.dnf,
            pointsEarned: gpPoints,
            sprintTop8: rawPred.sprintTop8,
            sprintPointsEarned: sprintPts,
            updatedAt: '2026-01-01T00:00:00Z',
            username: seedUsername,
            displayName: seedUser?.displayName ?? null,
          });

          preds.push(fullPred);
          rescored = true;

          console.log(
            '[Seed]',
            seedUser?.displayName ?? 'seed user',
            raceId,
            'GP:',
            gpPoints,
            'Sprint:',
            sprintPts
          );

          void (async () => {
            try {
              const { error } = await supabase
                .from('user_predictions')
                .upsert(
                  {
                    user_id: userId,
                    race_id: fullPred.raceId,
                    predicted_top10: fullPred.top10,
                    predicted_fastest_lap: fullPred.fastestLap,
                    predicted_dnf: fullPred.dnf,
                    predicted_sprint_top8: fullPred.sprintTop8,
                    points_earned: fullPred.pointsEarned,
                    sprint_points_earned: fullPred.sprintPointsEarned,
                    username: localProfileRef.current.username,
                    display_name: localProfileRef.current.displayName,
                    updated_at: fullPred.updatedAt,
                  },
                  { onConflict: 'user_id,race_id' }
                );
              if (error) {
                console.log('[Seed] Upsert error for', raceId, ':', error.message);
              }
            } catch {}
          })();
        }

        if (rescored) {
          const seedTotal = preds.reduce(
            (sum, p) => sum + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
            0
          );

          await updateProfileRef.current({ totalPoints: seedTotal }).catch(() => {});
        }
      }

      // Re-score all predictions against the current race results so that
      // stale points_earned from Supabase are always corrected. This runs
      // synchronously after the merge & before the state is persisted,
      // guaranteeing every screen sees consistent, freshly-computed points.
      const currentResults = MOCK_RACE_RESULTS; // Always use canonical mock results
      let rescoredCount = 0;

      for (const p of preds) {
        if (p.top10.length === 0) continue;
        const result = currentResults.find((r) => r.raceId === p.raceId);
        if (!result || result.classification.length === 0) continue;

        const breakdown = calculatePoints(p, result);
        const sprintBreakdown =
          p.sprintTop8.length > 0 &&
          result.sprintClassification &&
          result.sprintClassification.length > 0
            ? calculateSprintPoints(p.sprintTop8, result.sprintClassification)
            : null;

        const newGpPoints = breakdown.totalPoints;
        const newSprintPoints = sprintBreakdown?.totalPoints ?? 0;

        if (
          newGpPoints === (p.pointsEarned ?? 0) &&
          newSprintPoints === (p.sprintPointsEarned ?? 0)
        ) {
          continue;
        }

        p.pointsEarned = newGpPoints;
        p.sprintPointsEarned = newSprintPoints;
        rescoredCount++;

        console.log(
          '[loadFromSupabase] Rescored', p.raceId,
          'GP:', newGpPoints, 'Sprint:', newSprintPoints
        );
      }

      if (rescoredCount > 0) {
        console.log('[loadFromSupabase] Rescored', rescoredCount, 'predictions');

        // Push corrected points back to Supabase so the next load is clean.
        for (const p of preds) {
          if (p.top10.length === 0) continue;
          void (async () => {
            try {
              const { error } = await supabase
                .from('user_predictions')
                .update({
                  points_earned: p.pointsEarned ?? 0,
                  sprint_points_earned: p.sprintPointsEarned ?? 0,
                })
                .eq('user_id', userId)
                .eq('race_id', p.raceId);
              if (error) {
                console.log('[loadFromSupabase] Supabase rescore update error for', p.raceId, ':', error.message);
              }
            } catch {}
          })();
        }

        const rescoredTotal = preds.reduce(
          (sum, p) => sum + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
          0
        );

        await updateProfileRef.current({ totalPoints: rescoredTotal }).catch(() => {});
        void (async () => {
          try {
            const { error } = await supabase
              .from('profiles')
              .update({ total_points: rescoredTotal })
              .eq('id', userId);
            if (error) console.log('[loadFromSupabase] Profile update error:', error.message);
          } catch {}
        })();
      }

      setPredictions(preds);
      predictionsRef.current = preds;

      await AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(preds)).catch(() => {});

      const membershipResult = await withTimeout(
        supabase.from('league_members').select('league_id').eq('user_id', userId),
        10000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (membershipResult.error) {
        console.log('Membership query error:', membershipResult.error.message);
      }

      const myLeagueIds: string[] = (membershipResult.data || []).map((m: any) => m.league_id);

      let allLeagueData: any[] = [];

      if (myLeagueIds.length > 0) {
        const memberLeaguesResult = await withTimeout(
          supabase.from('leagues').select('*').in('id', myLeagueIds),
          10000,
          { data: null, error: { message: 'timeout' } } as any
        );

        if (!memberLeaguesResult.error && memberLeaguesResult.data) {
          allLeagueData = [...memberLeaguesResult.data];
        }
      }

      const ownedResult = await withTimeout(
        supabase.from('leagues').select('*').eq('owner_id', userId),
        10000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (!ownedResult.error && ownedResult.data) {
        for (const ol of ownedResult.data) {
          if (!allLeagueData.some((l: any) => l.id === ol.id)) {
            allLeagueData.push(ol);
          }
        }
      }

      const mapped: League[] = allLeagueData.map((l: any) => ({
        id: l.id,
        name: l.name,
        description: l.description || '',
        visibility: l.visibility,
        joinCode: l.join_code,
        ownerId: l.owner_id,
        memberCount: l.member_count || 1,
        createdAt: l.created_at,
      }));

      const uniqueLeagues = mapped.filter(
        (l, i, arr) => arr.findIndex((x) => x.id === l.id) === i
      );

      const membersMap: Record<string, LeagueMember[]> = {};

      const memberPromises = uniqueLeagues.map(async (league) => {
        try {
          const rows = await fetchLeagueMembersJoined(league.id);

          if (rows.length === 0) {
            membersMap[league.id] = [
              {
                userId: league.ownerId,
                username:
                  league.ownerId === userId ? localProfileRef.current.username : 'player',
                displayName:
                  league.ownerId === userId
                    ? localProfileRef.current.displayName
                    : 'League Owner',
                role: 'owner',
                points: league.ownerId === userId ? localProfileRef.current.totalPoints : 0,
                joinedAt: league.createdAt,
              },
            ];
            return;
          }

          const predictorTotal = predictionsRef.current.reduce(
            (s, p) => s + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
            0
          );

          membersMap[league.id] = mapMemberRows(
            rows,
            userId,
            localProfileRef.current,
            predictorTotal
          );
        } catch (e) {
          console.log('Error loading members for league', league.id, e);
          membersMap[league.id] = [];
        }
      });

      await withTimeout(Promise.all(memberPromises), 20000, []);

      const leaguesWithCounts = uniqueLeagues.map((l) => ({
        ...l,
        memberCount: membersMap[l.id]?.length ?? 1,
      }));

      setLeagues(leaguesWithCounts);
      setLeagueMembers(membersMap);

      await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(leaguesWithCounts)).catch(() => {});
      await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(membersMap)).catch(() => {});
    } catch (e) {
      console.log('loadFromSupabase: top-level error:', e);
    }
  }, [session]);

  const loadFromLocal = useCallback(async () => {
    try {
      const [predData, leagueData, memberData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.predictions),
        AsyncStorage.getItem(STORAGE_KEYS.leagues),
        AsyncStorage.getItem(STORAGE_KEYS.leagueMembers),
      ]);

      if (predData) {
        const parsed: Prediction[] = JSON.parse(predData);
        const normalized = parsed.map(normalizePrediction);

        // Backfill missing usernames and display names from the local profile so predictions
        // never display "Your Prediction" when a real username is available.
        const myUsername = localProfileRef.current.username;
        const myDisplayName = localProfileRef.current.displayName;
        if (myUsername && myUsername !== 'guest') {
          for (const p of normalized) {
            if (!p.username) p.username = myUsername;
            if (!p.displayName) p.displayName = myDisplayName;
          }
        }

        setPredictions(normalized);
        predictionsRef.current = normalized;
      }

      // Load edit counts from AsyncStorage
      try {
        const rawEdits = await AsyncStorage.getItem(STORAGE_KEYS.editCounts);
        if (rawEdits) {
          const parsedEdits = JSON.parse(rawEdits) as Record<string, { count: number; lastEditAt: string }>;
          setEditCounts(parsedEdits);
          editCountsRef.current = parsedEdits;
        }
      } catch {
        // Ignore corrupt edit count data
      }

      if (leagueData) {
        setLeagues(JSON.parse(leagueData));
      }

      if (memberData) {
        setLeagueMembers(JSON.parse(memberData));
      }
    } catch (e) {
      console.log('Error loading local game data:', e);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      await loadFromLocal();

      if (session?.user) {
        await withTimeout(loadFromSupabase(), 30000, undefined);
      }

      setIsLoading(false);
    };

    void load();
  }, [session, loadFromLocal, loadFromSupabase]);

  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) return;

    const isSeed = SEED_USER_IDS.has(normId(userId));

    setLeagueMembers((prev) => {
      let changed = false;
      const next: Record<string, LeagueMember[]> = {};

      for (const [leagueId, members] of Object.entries(prev)) {
        const updatedMembers = members.map((m) => {
          if (m.userId !== userId) return m;

          const nextPoints = isSeed ? m.points : localProfile.totalPoints;

          if (
            m.displayName === localProfile.displayName &&
            m.username === localProfile.username &&
            m.points === nextPoints
          ) {
            return m;
          }

          changed = true;

          return {
            ...m,
            displayName: localProfile.displayName,
            username: localProfile.username,
            points: nextPoints,
          };
        });

        next[leagueId] = updatedMembers;
      }

      return changed ? next : prev;
    });
  }, [
    session,
    localProfile.displayName,
    localProfile.username,
    localProfile.totalPoints,
  ]);

  const savePrediction = useCallback(
    async (prediction: Omit<Prediction, 'id' | 'updatedAt'>): Promise<{ synced: boolean }> => {
      // NOTE: Lock enforcement is handled by the UI (CountdownTimer + save button
      // visibility). We deliberately do NOT check isLocked here so that the local
      // save always succeeds and the user gets clear feedback. The UI will still
      // hide the save button when the race is locked.

      const now = new Date().toISOString();
      const existingPrediction = predictionsRef.current.find(
        (p) => p.raceId === prediction.raceId
      );

      // Track edit counts for achievements (Ferrari Strategy Dept., Box Box Box, etc.)
      const isEdit = !!existingPrediction;
      const prevMeta = editCountsRef.current[prediction.raceId];
      const newCount = isEdit ? (prevMeta?.count ?? 1) + 1 : (prevMeta?.count ?? 1);
      const newEditMeta = { count: newCount, lastEditAt: now };

      const nextEditCounts = { ...editCountsRef.current, [prediction.raceId]: newEditMeta };
      setEditCounts(nextEditCounts);
      editCountsRef.current = nextEditCounts;

      // Persist edit counts to AsyncStorage
      AsyncStorage.setItem(STORAGE_KEYS.editCounts, JSON.stringify(nextEditCounts)).catch(() => {});

      const savedPrediction: Prediction = normalizePrediction({
        id: existingPrediction?.id || generateId(),
        raceId: prediction.raceId,
        top10: prediction.top10 ?? [],
        fastestLap: prediction.fastestLap ?? null,
        dnf: prediction.dnf ?? null,
        pointsEarned: existingPrediction?.pointsEarned ?? prediction.pointsEarned ?? 0,
        sprintTop8: prediction.sprintTop8 ?? [],
        sprintPointsEarned:
          existingPrediction?.sprintPointsEarned ?? prediction.sprintPointsEarned ?? 0,
        updatedAt: now,
        username: existingPrediction?.username ?? localProfileRef.current.username ?? null,
        displayName: existingPrediction?.displayName ?? localProfileRef.current.displayName ?? null,
      });

      const nextPredictions = [
        ...predictionsRef.current.filter((p) => p.raceId !== prediction.raceId),
        savedPrediction,
      ];

      setPredictions(nextPredictions);
      predictionsRef.current = nextPredictions;

      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.predictions,
          JSON.stringify(nextPredictions)
        );
      } catch (e) {
        console.log('[savePrediction] Local AsyncStorage save failed:', e);
      }

      // Always try Supabase — use the session userId if available, otherwise
      // fall back to reading it from the supabase auth directly.
      const resolveUserId = async (): Promise<string | null> => {
        if (session?.user?.id) return session.user.id;

        // Session may not be in React state yet — ask Supabase directly.
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.log('[savePrediction] getSession error:', error.message);
          }
          if (data.session?.user?.id) {
            console.log('[savePrediction] Resolved userId from direct getSession:', data.session.user.id);
          }
          return data.session?.user?.id ?? null;
        } catch (e: any) {
          console.log('[savePrediction] getSession threw:', e?.message || e);
          return null;
        }
      };

      const userId = await resolveUserId();

      console.log('[savePrediction] Resolved userId:', userId, 'isSupabaseConfigured:', isSupabaseConfigured, 'sessionInState:', !!session?.user?.id);

      if (!userId || !isSupabaseConfigured) {
        console.log('[savePrediction] Saved locally only:', savedPrediction.raceId, !userId ? '(no user session)' : '(Supabase not configured)');
        return { synced: false };
      }

      console.log('[savePrediction] Attempting Supabase upsert — userId:', userId, 'raceId:', savedPrediction.raceId, 'username:', localProfileRef.current.username, 'top10:', savedPrediction.top10.slice(0, 3));

      // Retry upsert up to 3 attempts with exponential back-off.
      const doUpsert = async (attempt: number): Promise<boolean> => {
        try {
          const payload = {
            user_id: userId,
            race_id: savedPrediction.raceId,
            predicted_top10: savedPrediction.top10,
            predicted_fastest_lap: savedPrediction.fastestLap,
            predicted_dnf: savedPrediction.dnf,
            predicted_sprint_top8: savedPrediction.sprintTop8,
            points_earned: savedPrediction.pointsEarned,
            sprint_points_earned: savedPrediction.sprintPointsEarned,
            username: localProfileRef.current.username,
            display_name: localProfileRef.current.displayName,
            updated_at: savedPrediction.updatedAt,
          };
          console.log('[savePrediction] Upsert payload:', JSON.stringify(payload, null, 2));

          const { error } = await supabase
            .from('user_predictions')
            .upsert(payload, { onConflict: 'user_id,race_id' });

          if (error) {
            // 42P01 = relation does not exist — table missing, not recoverable.
            if (error.code === '42P01') {
              console.log('[savePrediction] Table does not exist — run supabase-fix-predictions.sql in the Supabase SQL Editor');
              return false;
            }

            // Schema mismatch — column missing (PGRST204) or wrong column type
            // (22P02, e.g. uuid race_id vs text 'r08'). Not recoverable without
            // running supabase-fix-predictions.sql against the database.
            if (error.code === 'PGRST204' || error.code === '22P02') {
              console.log(
                '[savePrediction] Database schema is out of date — run supabase-fix-predictions.sql in the Supabase SQL Editor. Details:',
                error.code,
                error.message
              );
              return false;
            }

            // 42501 = permission denied (RLS) — not recoverable.
            if (error.code === '42501') {
              console.log('[savePrediction] RLS policy rejected the upsert for', savedPrediction.raceId, ':', error.message);
              return false;
            }

            // Auth errors (JWT expired, invalid token, 401) — not recoverable.
            // The Supabase client returns PGRST301 for expired JWTs.
            if (
              error.code === 'PGRST301' ||
              error.message?.includes('JWT') ||
              error.message?.includes('expired') ||
              error.message?.includes('token') ||
              error.message?.includes('401') ||
              error.message?.includes('Unauthorized')
            ) {
              console.log('[savePrediction] Auth error — session may be expired. Please sign out and back in.');
              return false;
            }

            // 23503 = foreign key violation — not recoverable.
            if (error.code === '23503') {
              console.log('[savePrediction] Foreign key violation for', savedPrediction.raceId, ':', error.message);
              return false;
            }

            // Network / timeout — retry with back-off.
            const isNetworkError =
              error.message?.includes('fetch') ||
              error.message?.includes('network') ||
              error.message?.includes('timeout') ||
              error.message?.includes('abort');

            if (isNetworkError && attempt < 3) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
              console.log('[savePrediction] Network error on attempt', attempt, '— retrying in', delay, 'ms...');
              await new Promise((r) => setTimeout(r, delay));
              return doUpsert(attempt + 1);
            }

            console.log(
              '[savePrediction] Supabase upsert failed:',
              error.code,
              error.message,
              error.details ?? '',
              error.hint ?? ''
            );
            return false;
          }

          console.log('[savePrediction] Synced to Supabase:', savedPrediction.raceId);
          return true;
        } catch (e: any) {
          if (attempt < 3) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
            console.log('[savePrediction] Exception on attempt', attempt, '— retrying in', delay, 'ms...');
            await new Promise((r) => setTimeout(r, delay));
            return doUpsert(attempt + 1);
          }
          console.log('[savePrediction] Supabase save exception after retries:', e?.message || e);
          return false;
        }
      };

      const synced = await doUpsert(1);
      if (!synced) {
        console.log('[savePrediction] Could not sync to Supabase after retries — data saved locally:', savedPrediction.raceId);
      }

      // Record save time so loadFromSupabase skips immediate reloads
      // that could overwrite fresh local data with stale remote data.
      lastSaveTimeRef.current = Date.now();
      return { synced };
    },
    [session, getRaceById]
  );

  const getPrediction = useCallback(
    (raceId: string): Prediction | undefined => {
      return predictions.find((p) => p.raceId === raceId);
    },
    [predictions]
  );

  const createLeague = useCallback(
    async (
      name: string,
      description: string,
      visibility: 'public' | 'private',
      ownerId: string,
      ownerName: string,
      ownerDisplayName: string
    ): Promise<League> => {
      if (session?.user && isSupabaseConfigured) {
        const joinCode = generateJoinCode();
        const leagueId = generateUuid();

        const { data: insertedLeague, error: insertError } = await supabase
          .from('leagues')
          .insert({
            id: leagueId,
            owner_id: session.user.id,
            name,
            description,
            visibility,
            join_code: joinCode,
          })
          .select()
          .single();

        if (insertError) {
          console.log('League insert error:', insertError.message);
          throw new Error(insertError.message || 'Failed to create league');
        }

        await supabase
          .from('league_members')
          .insert({
            league_id: leagueId,
            user_id: session.user.id,
            role: 'owner',
          })
          .then(({ error }) => {
            if (error) console.log('League member insert error:', error.message);
          });

        const league: League = {
          id: leagueId,
          name,
          description,
          visibility,
          joinCode,
          ownerId: session.user.id,
          memberCount: 1,
          createdAt: insertedLeague?.created_at || new Date().toISOString(),
        };

        const ownerMember: LeagueMember = {
          userId: session.user.id,
          username: ownerName,
          displayName: ownerDisplayName,
          role: 'owner',
          points: localProfileRef.current.totalPoints,
          joinedAt: new Date().toISOString(),
        };

        setLeagues((prev) => {
          const updated = [...prev, league];
          AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updated)).catch(() => {});
          return updated;
        });

        setLeagueMembers((prev) => {
          const updated = {
            ...prev,
            [league.id]: [ownerMember],
          };
          AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updated)).catch(() => {});
          return updated;
        });

        return league;
      }

      const league: League = {
        id: generateId(),
        name,
        description,
        visibility,
        joinCode: generateJoinCode(),
        ownerId,
        memberCount: 1,
        createdAt: new Date().toISOString(),
      };

      const ownerMember: LeagueMember = {
        userId: ownerId,
        username: ownerName,
        displayName: ownerDisplayName,
        role: 'owner',
        points: localProfileRef.current.totalPoints,
        joinedAt: new Date().toISOString(),
      };

      const updatedLeagues = [...leagues, league];
      const updatedMembers = { ...leagueMembers, [league.id]: [ownerMember] };

      setLeagues(updatedLeagues);
      setLeagueMembers(updatedMembers);

      await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updatedLeagues));
      await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));

      return league;
    },
    [session, leagues, leagueMembers]
  );

  const joinLeague = useCallback(
    async (
      leagueId: string,
      userId: string,
      username: string,
      displayName: string
    ): Promise<boolean> => {
      if (session?.user && isSupabaseConfigured) {
        const { error: joinError } = await supabase
          .from('league_members')
          .insert({
            league_id: leagueId,
            user_id: session.user.id,
            role: 'member',
          });

        if (joinError) {
          console.log('Join league error:', joinError.message);

          if (
            joinError.message.includes('duplicate') ||
            joinError.message.includes('unique') ||
            joinError.message.includes('already exists')
          ) {
            return false;
          }

          throw new Error(joinError.message);
        }

        const leagueResult = await withTimeout(
          supabase.from('leagues').select('*').eq('id', leagueId).single(),
          8000,
          { data: null, error: { message: 'timeout' } } as any
        );

        const memberRows = await fetchLeagueMembersJoined(leagueId);
        const fetchedMembers: LeagueMember[] =
          memberRows.length > 0 ? mapMemberRows(memberRows, session.user.id, localProfile) : [];

        const memberCount = fetchedMembers.length || 1;

        if (leagueResult.data) {
          const mappedLeague: League = {
            id: leagueResult.data.id,
            name: leagueResult.data.name,
            description: leagueResult.data.description || '',
            visibility: leagueResult.data.visibility,
            joinCode: leagueResult.data.join_code,
            ownerId: leagueResult.data.owner_id,
            memberCount,
            createdAt: leagueResult.data.created_at,
          };

          setLeagues((prev) => {
            const filtered = prev.filter((l) => l.id !== leagueId);
            const updated = [...filtered, mappedLeague];
            AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }

        setLeagueMembers((prev) => {
          const updated = {
            ...prev,
            [leagueId]: fetchedMembers,
          };
          AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updated)).catch(() => {});
          return updated;
        });

        return true;
      }

      const league = leagues.find((l) => l.id === leagueId);

      if (!league) return false;

      const members = leagueMembers[leagueId] || [];

      if (members.some((m) => m.userId === userId)) return false;

      const newMember: LeagueMember = {
        userId,
        username,
        displayName,
        role: 'member',
        points: localProfileRef.current.totalPoints,
        joinedAt: new Date().toISOString(),
      };

      setLeagueMembers((prev) => {
        const updated = {
          ...prev,
          [leagueId]: [...(prev[leagueId] || []), newMember],
        };

        void AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updated));

        return updated;
      });

      setLeagues((prev) => {
        const updated = prev.map((l) =>
          l.id === leagueId ? { ...l, memberCount: l.memberCount + 1 } : l
        );

        void AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updated));

        return updated;
      });

      return true;
    },
    [session, localProfile, leagues, leagueMembers]
  );

  const findLeagueByCode = useCallback(
    async (code: string): Promise<League | undefined> => {
      if (session?.user && isSupabaseConfigured) {
        const result = await withTimeout(
          supabase.from('leagues').select('*').eq('join_code', code.toUpperCase()).single(),
          8000,
          { data: null, error: { message: 'timeout' } } as any
        );

        if (result.error || !result.data) {
          console.log('League not found:', result.error?.message);
          return undefined;
        }

        const countResult = await withTimeout(
          supabase
            .from('league_members')
            .select('*', { count: 'exact', head: true })
            .eq('league_id', result.data.id),
          5000,
          { count: null } as any
        );

        const foundLeague: League = {
          id: result.data.id,
          name: result.data.name,
          description: result.data.description || '',
          visibility: result.data.visibility,
          joinCode: result.data.join_code,
          ownerId: result.data.owner_id,
          memberCount: countResult.count ?? result.data.member_count ?? 1,
          createdAt: result.data.created_at,
        };

        setLeagues((prev) => {
          if (prev.some((l) => l.id === foundLeague.id)) return prev;
          const updated = [...prev, foundLeague];
          AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updated)).catch(() => {});
          return updated;
        });

        return foundLeague;
      }

      return leagues.find((l) => l.joinCode === code.toUpperCase());
    },
    [session, leagues]
  );

  const getLeagueMembers = useCallback(
    (leagueId: string): LeagueMember[] => {
      return leagueMembers[leagueId] || [];
    },
    [leagueMembers]
  );

  const fetchLeagueMembers = useCallback(
    async (leagueId: string): Promise<LeagueMember[]> => {
      if (!session?.user || !isSupabaseConfigured) {
        return leagueMembersRef.current[leagueId] || [];
      }

      const userId = session.user.id;

      try {
        const memberRows = await fetchLeagueMembersJoined(leagueId);

        if (memberRows.length === 0) {
          const league = leagues.find((l) => l.id === leagueId);

          const fallback: LeagueMember[] = [
            {
              userId: league?.ownerId || userId,
              username:
                league?.ownerId === userId ? localProfileRef.current.username : 'player',
              displayName:
                league?.ownerId === userId
                  ? localProfileRef.current.displayName
                  : 'League Owner',
              role: 'owner',
              points:
                league?.ownerId === userId ? localProfileRef.current.totalPoints : 0,
              joinedAt: league?.createdAt || new Date().toISOString(),
            },
          ];

          setLeagueMembers((prev) => {
            const updated = { ...prev, [leagueId]: fallback };
            AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updated)).catch(() => {});
            return updated;
          });

          return fallback;
        }

        const predictorTotal = predictionsRef.current.reduce(
          (s, p) => s + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
          0
        );

        const resolved = mapMemberRows(
          memberRows,
          userId,
          localProfileRef.current,
          predictorTotal
        );

        const hasCurrentUser = resolved.some((m: LeagueMember) => m.userId === userId);

        if (!hasCurrentUser) {
          resolved.push({
            userId,
            username: localProfileRef.current.username,
            displayName: localProfileRef.current.displayName,
            role: 'member',
            points: localProfileRef.current.totalPoints,
            joinedAt: new Date().toISOString(),
          });
        }

        setLeagueMembers((prev) => {
          const updated = {
            ...prev,
            [leagueId]: resolved,
          };
          AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updated)).catch(() => {});
          return updated;
        });

        return resolved;
      } catch (e) {
        console.log('fetchLeagueMembers: error', e);
        return leagueMembersRef.current[leagueId] || [];
      }
    },
    [session, leagues]
  );

  const deleteLeague = useCallback(
    async (leagueId: string) => {
      if (session?.user && isSupabaseConfigured) {
        const { error } = await supabase
          .from('leagues')
          .delete()
          .eq('id', leagueId)
          .eq('owner_id', session.user.id);

        if (error) {
          console.log('Delete league error:', error.message);
          return;
        }
      }

      setLeagues((prev) => {
        const updated = prev.filter((l) => l.id !== leagueId);
        AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      setLeagueMembers((prev) => {
        const updated = { ...prev };
        delete updated[leagueId];
        AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    },
    [session]
  );

  const refreshLeagues = useCallback(async () => {
    if (session?.user) {
      await withTimeout(loadFromSupabase(), 20000, undefined);
    }
  }, [session, loadFromSupabase]);

  const fetchPublicLeagues = useCallback(async (): Promise<League[]> => {
    if (!session?.user || !isSupabaseConfigured) return [];

    const result = await withTimeout(
      supabase
        .from('leagues')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false }),
      10000,
      { data: null, error: { message: 'timeout' } } as any
    );

    if (result.error) {
      console.log('Public leagues fetch error:', result.error.message);
      return [];
    }

    return (result.data || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description || '',
      visibility: l.visibility as 'public' | 'private',
      joinCode: l.join_code,
      ownerId: l.owner_id,
      memberCount: l.member_count || 1,
      createdAt: l.created_at,
    }));
  }, [session]);

  const fetchGlobalLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    const userId = session?.user?.id;
    const localDisplayName = localProfileRef.current.displayName;
    const localUsername = localProfileRef.current.username;

    // Locally-computed totalPoints — always authoritative for the current user.
    const localTotal = predictionsRef.current.reduce(
      (sum, p) => sum + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
      0
    );

    const mockEntries: LeaderboardEntry[] = MOCK_LEAGUE_MEMBERS.map((mock) => {
      const member = scoreMockMember(mock, MOCK_RACE_RESULTS);

      return {
        rank: 0,
        userId: member.userId,
        username: member.username,
        displayName: member.displayName,
        totalPoints: member.points,
        previousRank: undefined,
      };
    });

    if (!isSupabaseConfigured) {
      const entries = [...mockEntries];

      // Inject the current user when not already present.
      if (userId && !SEED_USER_IDS.has(normId(userId))) {
        const alreadyPresent = entries.some((e) => normId(e.userId) === normId(userId));

        if (!alreadyPresent) {
          entries.push({
            rank: 0,
            userId,
            username: localUsername,
            displayName: localDisplayName,
            totalPoints: localTotal,
            previousRank: undefined,
          });
        } else {
          // Override the existing entry with local points.
          entries.forEach((e) => {
            if (normId(e.userId) === normId(userId)) {
              e.totalPoints = localTotal;
              e.displayName = localDisplayName;
              e.username = localUsername;
            }
          });
        }
      }

      return entries
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    }

    const profiles = await fetchAllProfilesSorted();

    const supabaseEntries: LeaderboardEntry[] = profiles.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      totalPoints: p.totalPoints,
      previousRank: undefined,
    }));

    const existingIds = new Set(supabaseEntries.map((e) => normId(e.userId)));

    const merged = [
      ...supabaseEntries.map((e) => {
        if (SEED_USER_IDS.has(normId(e.userId))) {
          const canonicalPoints = scoreSeededPredictions(normId(e.userId), MOCK_RACE_RESULTS);

          return { ...e, totalPoints: canonicalPoints };
        }

        // Use locally-computed points for the current user — this is always
        // more up-to-date than Supabase after scoring.
        if (userId && normId(e.userId) === normId(userId)) {
          return {
            ...e,
            totalPoints: localTotal,
            displayName: localDisplayName,
            username: localUsername,
          };
        }

        return e;
      }),
      ...mockEntries.filter((m) => !existingIds.has(normId(m.userId))),
    ];

    // If the current user is logged in but not in Supabase profiles yet,
    // add them from local state so they can see their own rank.
    if (userId && !SEED_USER_IDS.has(normId(userId))) {
      const alreadyPresent = merged.some((e) => normId(e.userId) === normId(userId));

      if (!alreadyPresent) {
        merged.push({
          rank: 0,
          userId,
          username: localUsername,
          displayName: localDisplayName,
          totalPoints: localTotal,
          previousRank: undefined,
        });
      }
    }

    return merged
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [session]);

  const scorePredictions = useCallback(
    async (_raceResults: RaceResult[]) => {
      const currentPreds = predictionsRef.current;

      let hasUpdates = false;

      const updatedPreds = currentPreds.map((pred) => {
        if (pred.top10.length === 0) return pred;

        const result = _raceResults.find((r) => r.raceId === pred.raceId);

        if (!result || result.classification.length === 0) return pred;

        const breakdown = calculatePoints(pred, result);

        const sprintBreakdown =
          pred.sprintTop8.length > 0 &&
          result.sprintClassification &&
          result.sprintClassification.length > 0
            ? calculateSprintPoints(pred.sprintTop8, result.sprintClassification)
            : null;

        const newGpPoints = breakdown.totalPoints;
        const newSprintPoints = sprintBreakdown?.totalPoints ?? 0;

        if (
          newGpPoints === (pred.pointsEarned ?? 0) &&
          newSprintPoints === (pred.sprintPointsEarned ?? 0)
        ) {
          return pred;
        }

        hasUpdates = true;

        return {
          ...pred,
          pointsEarned: newGpPoints,
          sprintPointsEarned: newSprintPoints,
        };
      });

      if (!hasUpdates) {
        return;
      }

      const newTotal = updatedPreds.reduce(
        (sum, p) => sum + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
        0
      );

      setPredictions(updatedPreds);
      predictionsRef.current = updatedPreds;

      await AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(updatedPreds)).catch(() => {});

      // Let all consumers know scoring just ran — screens can react to this
      // timestamp to refresh their data (leaderboard, league members, etc.).
      setLastScoredAt(new Date().toISOString());

      setLeagueMembers((prev) => {
        const userId = session?.user?.id;

        if (!userId) return prev;

        let changed = false;
        const next: Record<string, LeagueMember[]> = {};

        for (const [leagueId, members] of Object.entries(prev)) {
          const updatedMembers = members.map((m) => {
            if (m.userId !== userId) return m;

            if (m.points === newTotal) return m;

            changed = true;

            return {
              ...m,
              points: newTotal,
            };
          });

          next[leagueId] = updatedMembers;
        }

        // Always persist league members to AsyncStorage when scoring updates
        // points, so the data survives app restarts.
        AsyncStorage.setItem(
          STORAGE_KEYS.leagueMembers,
          JSON.stringify(changed ? next : prev)
        ).catch(() => {});

        return changed ? next : prev;
      });

      if (session?.user && isSupabaseConfigured) {
        for (const pred of updatedPreds) {
          if (pred.top10.length === 0) continue;

          await supabase
            .from('user_predictions')
            .update({
              points_earned: pred.pointsEarned ?? 0,
              sprint_points_earned: pred.sprintPointsEarned ?? 0,
            })
            .eq('user_id', session.user.id)
            .eq('race_id', pred.raceId)
            .then(({ error }) => {
              if (error) {
                console.log('[Scoring] Supabase prediction update error:', error.message);
              }
            });
        }

        await updateProfileRef.current({ totalPoints: newTotal }).catch((error) => {
          console.log('[Scoring] updateProfile error:', error?.message || error);
        });

        await supabase
          .from('profiles')
          .update({ total_points: newTotal })
          .eq('id', session.user.id)
          .then(({ error }) => {
            if (error) {
              console.log('[Scoring] Profile points update error:', error.message);
            }
          });
      }
    },
    [session]
  );

  const totalPoints = useMemo(() => {
    const userId = session?.user?.id;

    if (userId && SEED_USER_IDS.has(normId(userId))) {
      return scoreSeededPredictions(normId(userId), MOCK_RACE_RESULTS);
    }

    return predictions.reduce(
      (sum, p) => sum + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
      0
    );
  }, [predictions, session]);

  /** Lock time for each race = raceDate + raceTime minus LOCK_MINUTES (5 min before race start). */
  const lockTimes = useMemo(() => {
    const times: Record<string, string> = {};
    for (const race of RACES) {
      try {
        const start = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
        const lockTime = new Date(start.getTime() - 5 * 60 * 1000);
        times[race.id] = lockTime.toISOString();
      } catch {
        // Skip races with invalid dates
      }
    }
    return times;
  }, []);

  return useMemo(
    () => ({
      predictions,
      leagues,
      isLoading,
      totalPoints,
      editCounts,
      lockTimes,
      lastScoredAt,
      scorePredictions,
      savePrediction,
      getPrediction,
      createLeague,
      joinLeague,
      findLeagueByCode,
      getLeagueMembers,
      fetchLeagueMembers,
      deleteLeague,
      refreshLeagues,
      fetchPublicLeagues,
      fetchGlobalLeaderboard,
    }),
    [
      predictions,
      leagues,
      isLoading,
      totalPoints,
      editCounts,
      lockTimes,
      lastScoredAt,
      scorePredictions,
      savePrediction,
      getPrediction,
      createLeague,
      joinLeague,
      findLeagueByCode,
      getLeagueMembers,
      fetchLeagueMembers,
      deleteLeague,
      refreshLeagues,
      fetchPublicLeagues,
      fetchGlobalLeaderboard,
    ]
  );
});