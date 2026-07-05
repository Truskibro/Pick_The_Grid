import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Prediction, League, LeagueMember, LeaderboardEntry, RaceResult } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useUser } from '@/providers/UserProvider';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';
import { Session } from '@supabase/supabase-js';
import { SEED_USERS, scoreSeededPredictions, getCompletedRaceIds } from '@/constants/seed-predictions';
import { MOCK_RACE_RESULTS } from '@/constants/f1-data';

const STORAGE_KEYS = {
  predictions: 'apex_draft_predictions_rebuilt_v2',
  editCounts: 'apex_draft_edit_counts',
  leagues: 'apex_draft_leagues',
  leagueMembers: 'apex_draft_league_members',
  lastSaveTime: 'apex_draft_last_save_time',
} as const;

const LEGACY_PREDICTION_STORAGE_KEYS = [
  'apex_draft_predictions',
  'apex_draft_predictions_rebuilt_v1',
] as const;

type PredictionInput = Omit<Prediction, 'id' | 'updatedAt' | 'username' | 'displayName'> &
  Partial<Pick<Prediction, 'username' | 'displayName'>>;

type EditCounts = Record<string, { count: number; lastEditAt: string }>;

type PredictionRow = {
  id: string;
  user_id: string;
  race_id: string;
  username: string;
  display_name: string;
  predicted_top10: string[];
  predicted_fastest_lap: string | null;
  predicted_dnf: string | null;
  points_earned: number;
  predicted_sprint_top8: string[];
  sprint_points_earned: number;
  created_at: string;
  updated_at: string;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePrediction(prediction: Prediction): Prediction {
  return {
    ...prediction,
    top10: Array.isArray(prediction.top10) ? prediction.top10 : [],
    fastestLap: prediction.fastestLap ?? null,
    dnf: prediction.dnf ?? null,
    pointsEarned: prediction.pointsEarned ?? 0,
    sprintTop8: Array.isArray(prediction.sprintTop8) ? prediction.sprintTop8 : [],
    sprintPointsEarned: prediction.sprintPointsEarned ?? 0,
    updatedAt: prediction.updatedAt ?? new Date().toISOString(),
    username: cleanText(prediction.username),
    displayName: cleanText(prediction.displayName),
  };
}

function mapPredictionRow(row: PredictionRow): Prediction {
  return normalizePrediction({
    id: row.id,
    raceId: row.race_id,
    top10: row.predicted_top10 ?? [],
    fastestLap: row.predicted_fastest_lap ?? null,
    dnf: row.predicted_dnf ?? null,
    pointsEarned: row.points_earned ?? 0,
    sprintTop8: row.predicted_sprint_top8 ?? [],
    sprintPointsEarned: row.sprint_points_earned ?? 0,
    updatedAt: row.updated_at ?? new Date().toISOString(),
    username: row.username ?? null,
    displayName: row.display_name ?? null,
  });
}

function mergePredictions(localPredictions: Prediction[], cloudPredictions: Prediction[]): Prediction[] {
  const byRaceId = new Map<string, Prediction>();

  // Seed with local predictions first (fallback only).
  for (const prediction of localPredictions) {
    const normalized = normalizePrediction(prediction);
    byRaceId.set(normalized.raceId, normalized);
  }

  // Cloud (Supabase) is the authoritative source of truth for logged-in users.
  // When a cloud prediction has actual picks, it ALWAYS wins over local —
  // regardless of timestamp. This prevents stale local AsyncStorage data from
  // shadowing the correct picks that were saved to Supabase.
  // Local is only kept when the cloud row has no picks (safety net).
  for (const prediction of cloudPredictions) {
    const normalized = normalizePrediction(prediction);
    const existing = byRaceId.get(normalized.raceId);

    const cloudHasPicks =
      normalized.top10.length > 0 ||
      normalized.sprintTop8.length > 0 ||
      normalized.fastestLap != null ||
      normalized.dnf != null;

    if (!existing || cloudHasPicks) {
      byRaceId.set(normalized.raceId, normalized);
    }
  }

  return Array.from(byRaceId.values()).sort((a, b) => a.raceId.localeCompare(b.raceId));
}

async function persistPredictions(predictions: Prediction[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(predictions));
}

function profileNames(profile: { username: string; displayName: string }): {
  username: string | null;
  displayName: string | null;
} {
  const username = cleanText(profile.username);
  const displayName = cleanText(profile.displayName);
  const normalizedUsername = username && username !== 'guest' ? username : null;
  const normalizedDisplayName = displayName && displayName !== 'Guest Player' ? displayName : null;

  return {
    username: normalizedUsername,
    displayName: normalizedDisplayName ?? normalizedUsername,
  };
}

function buildPredictionPayload(
  prediction: Prediction,
  userId: string,
  username: string | null,
  displayName: string | null,
) {
  return {
    user_id: userId,
    race_id: prediction.raceId,
    username,
    display_name: displayName,
    predicted_top10: prediction.top10,
    predicted_fastest_lap: prediction.fastestLap,
    predicted_dnf: prediction.dnf,
    points_earned: prediction.pointsEarned ?? 0,
    predicted_sprint_top8: prediction.sprintTop8 ?? [],
    sprint_points_earned: prediction.sprintPointsEarned ?? 0,
    updated_at: prediction.updatedAt,
  };
}

type PredictionPayload = ReturnType<typeof buildPredictionPayload>;

type PredictionWriteResult = {
  synced: boolean;
  row: PredictionRow | null;
  errorMessage?: string;
};

async function fetchSupabaseProfileNames(userId: string): Promise<{
  username: string | null;
  displayName: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.log('[savePrediction] Could not read profile names:', error.message);
    return { username: null, displayName: null };
  }

  const profileRow = data as { username?: string | null; display_name?: string | null } | null;
  const username = cleanText(profileRow?.username);
  const displayName = cleanText(profileRow?.display_name) ?? username;

  return { username, displayName };
}

async function ensureSupabaseProfileForPrediction(
  userId: string,
  username: string,
  displayName: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      username,
      display_name: displayName,
    }, { onConflict: 'id' });

  if (error) {
    console.log('[savePrediction] Profile upsert before prediction failed:', error.message);
  }
}

async function writePredictionRow(payload: PredictionPayload): Promise<PredictionWriteResult> {
  const { data, error } = await supabase.rpc('save_user_prediction', {
    p_race_id: payload.race_id,
    p_predicted_top10: payload.predicted_top10,
    p_predicted_fastest_lap: payload.predicted_fastest_lap,
    p_predicted_dnf: payload.predicted_dnf,
    p_points_earned: payload.points_earned,
    p_predicted_sprint_top8: payload.predicted_sprint_top8,
    p_sprint_points_earned: payload.sprint_points_earned,
    p_username: payload.username,
    p_display_name: payload.display_name,
  });

  if (error) {
    console.log('[savePrediction] Supabase RPC save failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { synced: false, row: null, errorMessage: error.message };
  }

  return { synced: true, row: data as PredictionRow };
}

let lastSaveTimeGlobal: number = 0;

export const [GameProvider, useGame] = createContextHook(() => {
  const { profile, session: userSession } = useUser();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<Record<string, LeagueMember[]>>({});
  const [editCounts, setEditCounts] = useState<EditCounts>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const predictionsRef = useRef<Prediction[]>([]);
  const editCountsRef = useRef<EditCounts>({});
  const lastSaveTimeRef = useRef<number>(0);
  const cloudLoadedForUserRef = useRef<string | null>(null);

  const activeUserId = userSession?.user?.id ?? null;

  useEffect(() => {
    predictionsRef.current = predictions;
  }, [predictions]);

  useEffect(() => {
    editCountsRef.current = editCounts;
  }, [editCounts]);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        const [predData, editData, leagueData, memberData, lastSaveData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.predictions),
          AsyncStorage.getItem(STORAGE_KEYS.editCounts),
          AsyncStorage.getItem(STORAGE_KEYS.leagues),
          AsyncStorage.getItem(STORAGE_KEYS.leagueMembers),
          AsyncStorage.getItem(STORAGE_KEYS.lastSaveTime),
        ]);

        await Promise.all(
          LEGACY_PREDICTION_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key)),
        );

        if (predData) {
          const parsed = JSON.parse(predData) as Prediction[];
          const normalized = parsed.map(normalizePrediction);
          setPredictions(normalized);
          predictionsRef.current = normalized;
        }
        if (editData) {
          const parsed = JSON.parse(editData) as EditCounts;
          setEditCounts(parsed);
          editCountsRef.current = parsed;
        }
        if (leagueData) setLeagues(JSON.parse(leagueData) as League[]);
        if (memberData) setLeagueMembers(JSON.parse(memberData) as Record<string, LeagueMember[]>);
        if (lastSaveData) {
          const ts = parseInt(lastSaveData, 10);
          lastSaveTimeRef.current = ts;
          lastSaveTimeGlobal = ts;
        }
      } catch (e) {
        console.log('[GameProvider] Error loading local game data:', e);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (activeUserId) return activeUserId;

    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.log('[GameProvider] getSession error:', error.message);
      }
      return data.session?.user?.id ?? null;
    } catch (e: any) {
      console.log('[GameProvider] getSession threw:', e?.message || e);
      return null;
    }
  }, [activeUserId]);

  const loadCloudPredictionsForUser = useCallback(async (userId: string): Promise<Prediction[]> => {
    try {
      const { data, error } = await supabase
        .from('user_predictions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.log('[GameProvider] Cloud prediction load failed:', error.message);
        return predictionsRef.current;
      }

      const cloudRows = (data ?? []) as PredictionRow[];
      const cloudPredictions = cloudRows.map(mapPredictionRow);
      const localPredictions = predictionsRef.current;

      // If Supabase is empty but we have local predictions, keep the locals.
      // This prevents wiping a user's picks when the Supabase table exists but
      // has no rows (e.g. after a fresh migration or wrong-project issue).
      if (cloudPredictions.length === 0 && localPredictions.length > 0) {
        console.log('[GameProvider] Supabase returned empty — keeping local predictions:', {
          localCount: localPredictions.length,
        });
        // Still persist locals so they survive app restarts.
        await persistPredictions(localPredictions);
        return localPredictions;
      }

      // Merge local + cloud — local picks that were never synced to Supabase
      // are preserved, and cloud picks that are newer win on conflict.
      let mergedPredictions = mergePredictions(localPredictions, cloudPredictions);

      // Safety net: never let an empty cloud prediction overwrite a local
      // prediction that has actual picks. This guards against stale/partial
      // Supabase rows from failed syncs or trigger-induced timestamp mismatches.
      const localByRace = new Map(localPredictions.map((p) => [p.raceId, p]));
      mergedPredictions = mergedPredictions.map((mp) => {
        const local = localByRace.get(mp.raceId);
        if (!local) return mp;
        const localHasPicks = local.top10.length > 0 || local.sprintTop8.length > 0 || local.fastestLap || local.dnf;
        const mergedHasPicks = mp.top10.length > 0 || mp.sprintTop8.length > 0 || mp.fastestLap || mp.dnf;
        if (localHasPicks && !mergedHasPicks) {
          console.log('[GameProvider] Keeping local picks for', mp.raceId, '(cloud had empty picks)');
          return local;
        }
        return mp;
      });

      // Identify local-only predictions (never synced) and upload them now.
      const cloudRaceIds = new Set(cloudPredictions.map((p) => p.raceId));
      const unsyncedPredictions = localPredictions.filter(
        (p) => !cloudRaceIds.has(p.raceId) && p.top10.length > 0
      );

      if (unsyncedPredictions.length > 0) {
        console.log('[GameProvider] Syncing', unsyncedPredictions.length, 'local-only predictions to Supabase');
        const names = profileNames(profile);
        const syncUsername = names.username ?? `user_${userId.substring(0, 8)}`;
        const syncDisplayName = names.displayName ?? syncUsername;

        await Promise.all(unsyncedPredictions.map(async (prediction) => {
          const payload = buildPredictionPayload(prediction, userId, syncUsername, syncDisplayName);
          const result = await writePredictionRow(payload);
          if (!result.synced) {
            console.log('[GameProvider] Failed to sync local prediction for', prediction.raceId, ':', result.errorMessage);
          }
        }));

        // Reload from Supabase after uploading to get the confirmed rows back.
        const { data: reloadData } = await supabase
          .from('user_predictions')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        const reloadedRows = (reloadData ?? []) as PredictionRow[];
        const reloadedCloud = reloadedRows.map(mapPredictionRow);
        let finalMerged = mergePredictions(localPredictions, reloadedCloud);

        // Same safety net: never let empty cloud data overwrite local picks.
        const finalLocalByRace = new Map(localPredictions.map((p) => [p.raceId, p]));
        finalMerged = finalMerged.map((mp) => {
          const local = finalLocalByRace.get(mp.raceId);
          if (!local) return mp;
          const localHasPicks = local.top10.length > 0 || local.sprintTop8.length > 0 || local.fastestLap || local.dnf;
          const mergedHasPicks = mp.top10.length > 0 || mp.sprintTop8.length > 0 || mp.fastestLap || mp.dnf;
          if (localHasPicks && !mergedHasPicks) {
            console.log('[GameProvider] Keeping local picks for', mp.raceId, '(post-sync cloud had empty picks)');
            return local;
          }
          return mp;
        });

        setPredictions(finalMerged);
        predictionsRef.current = finalMerged;
        await persistPredictions(finalMerged);

        console.log('[GameProvider] Loaded cloud predictions + synced locals:', {
          cloudRows: reloadedRows.length,
          races: finalMerged.length,
          synced: unsyncedPredictions.length,
        });
        return finalMerged;
      }

      setPredictions(mergedPredictions);
      predictionsRef.current = mergedPredictions;
      await persistPredictions(mergedPredictions);

      console.log('[GameProvider] Loaded cloud predictions:', {
        rows: cloudRows.length,
        races: mergedPredictions.length,
      });
      return mergedPredictions;
    } catch (e: any) {
      console.log('[GameProvider] Cloud prediction load threw:', e?.message || e);
      return predictionsRef.current;
    }
  }, []);

  const refreshPredictions = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) return;

    const userId = await resolveUserId();
    if (!userId) {
      console.log('[GameProvider] Prediction refresh skipped: no logged-in user.');
      return;
    }

    cloudLoadedForUserRef.current = userId;
    await loadCloudPredictionsForUser(userId);
  }, [loadCloudPredictionsForUser, resolveUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !activeUserId) {
      cloudLoadedForUserRef.current = null;
      return;
    }

    // Wait until local AsyncStorage has loaded first. Otherwise a slower local
    // read can overwrite freshly fetched Supabase predictions during startup.
    if (isLoading) return;

    if (cloudLoadedForUserRef.current === activeUserId) return;
    cloudLoadedForUserRef.current = activeUserId;

    void loadCloudPredictionsForUser(activeUserId);
  }, [activeUserId, isLoading, loadCloudPredictionsForUser]);

  const updateLocalProfile = useCallback(async (): Promise<void> => {
    await AsyncStorage.setItem('apex_draft_profile', JSON.stringify(profile));
  }, [profile]);

  const savePrediction = useCallback(
    async (prediction: PredictionInput): Promise<{ synced: boolean; errorMessage?: string }> => {
      const now = new Date().toISOString();
      const existingPrediction = predictionsRef.current.find((p) => p.raceId === prediction.raceId);
      const isEdit = !!existingPrediction;
      const prevMeta = editCountsRef.current[prediction.raceId];
      const newCount = isEdit ? (prevMeta?.count ?? 1) + 1 : 1;
      const newEditMeta = { count: newCount, lastEditAt: now };
      const nextEditCounts = { ...editCountsRef.current, [prediction.raceId]: newEditMeta };
      const names = profileNames(profile);
      const fallbackUsername = cleanText(prediction.username) ?? existingPrediction?.username ?? null;
      const fallbackDisplayName = cleanText(prediction.displayName) ?? existingPrediction?.displayName ?? fallbackUsername;
      const currentUsername = names.username ?? fallbackUsername;
      const currentDisplayName = names.displayName ?? fallbackDisplayName;

      setEditCounts(nextEditCounts);
      editCountsRef.current = nextEditCounts;
      AsyncStorage.setItem(STORAGE_KEYS.editCounts, JSON.stringify(nextEditCounts)).catch(() => {});

      const savedPrediction: Prediction = normalizePrediction({
        id: existingPrediction?.id || generateId(),
        raceId: prediction.raceId,
        top10: prediction.top10 ?? [],
        fastestLap: prediction.fastestLap ?? null,
        dnf: prediction.dnf ?? null,
        pointsEarned: prediction.pointsEarned ?? existingPrediction?.pointsEarned ?? 0,
        sprintTop8: prediction.sprintTop8 ?? [],
        sprintPointsEarned: prediction.sprintPointsEarned ?? existingPrediction?.sprintPointsEarned ?? 0,
        updatedAt: now,
        username: currentUsername,
        displayName: currentDisplayName,
      });

      const optimisticPredictions = [
        ...predictionsRef.current.filter((p) => p.raceId !== prediction.raceId),
        savedPrediction,
      ].sort((a, b) => a.raceId.localeCompare(b.raceId));

      setPredictions(optimisticPredictions);
      predictionsRef.current = optimisticPredictions;

      try {
        await persistPredictions(optimisticPredictions);
      } catch (e) {
        console.log('[savePrediction] Local AsyncStorage save failed:', e);
      }

      if (!isSupabaseConfigured) {
        console.log('[savePrediction] Supabase not updated: not configured.');
        return { synced: false };
      }

      const userId = await resolveUserId();
      if (!userId) {
        console.log('[savePrediction] Supabase not updated: no logged-in user.');
        return { synced: false };
      }

      const cloudNames = await fetchSupabaseProfileNames(userId);
      const syncUsername = cloudNames.username ?? currentUsername ?? `user_${userId.substring(0, 8)}`;
      const syncDisplayName = cloudNames.displayName ?? currentDisplayName ?? syncUsername;
      await ensureSupabaseProfileForPrediction(userId, syncUsername, syncDisplayName);

      const predictionForSync = normalizePrediction({
        ...savedPrediction,
        username: syncUsername,
        displayName: syncDisplayName,
      });
      const payload = buildPredictionPayload(predictionForSync, userId, syncUsername, syncDisplayName);
      const writeResult = await writePredictionRow(payload);

      if (!writeResult.synced) {
        return { synced: false, errorMessage: writeResult.errorMessage };
      }

      console.log('[savePrediction] Supabase synced prediction:', {
        raceId: predictionForSync.raceId,
        picks: predictionForSync.top10.slice(0, 3),
      });

      cloudLoadedForUserRef.current = userId;

      if (writeResult.row) {
        const confirmedPrediction = mapPredictionRow(writeResult.row);
        const confirmedPredictions = [
          ...predictionsRef.current.filter((p) => p.raceId !== confirmedPrediction.raceId),
          confirmedPrediction,
        ].sort((a, b) => a.raceId.localeCompare(b.raceId));

        setPredictions(confirmedPredictions);
        predictionsRef.current = confirmedPredictions;
        await persistPredictions(confirmedPredictions);
      }

      lastSaveTimeRef.current = Date.now();
      lastSaveTimeGlobal = Date.now();
      AsyncStorage.setItem(STORAGE_KEYS.lastSaveTime, String(lastSaveTimeRef.current)).catch(() => {});

      // Do NOT reload from Supabase here. The confirmed row from the RPC is the
      // source of truth, and reloading can introduce a race where a stale cloud
      // row (with a server-set updated_at that differs from the RPC response)
      // overwrites the just-saved picks during merge.

      return { synced: true };
    },
    [profile, resolveUserId, loadCloudPredictionsForUser],
  );

  const getPrediction = useCallback((raceId: string): Prediction | undefined => {
    return predictions.find((p) => p.raceId === raceId);
  }, [predictions]);

  const createLeague = useCallback(async (
    name: string,
    description: string,
    visibility: 'public' | 'private',
    ownerId: string,
    ownerName: string,
    ownerDisplayName: string,
  ): Promise<League> => {
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
      points: 0,
      joinedAt: new Date().toISOString(),
    };

    const updatedLeagues = [...leagues, league];
    const updatedMembers = { ...leagueMembers, [league.id]: [ownerMember] };

    setLeagues(updatedLeagues);
    setLeagueMembers(updatedMembers);
    await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updatedLeagues));
    await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));

    return league;
  }, [leagues, leagueMembers]);

  const joinLeague = useCallback(async (
    leagueId: string,
    userId: string,
    username: string,
    displayName: string,
  ): Promise<boolean> => {
    const league = leagues.find((l) => l.id === leagueId);
    if (!league) return false;

    const members = leagueMembers[leagueId] || [];
    if (members.some((m) => m.userId === userId)) return false;

    const newMember: LeagueMember = {
      userId,
      username,
      displayName,
      role: 'member',
      points: 0,
      joinedAt: new Date().toISOString(),
    };

    const updatedMembers = { ...leagueMembers, [leagueId]: [...members, newMember] };
    const updatedLeagues = leagues.map((l) =>
      l.id === leagueId ? { ...l, memberCount: l.memberCount + 1 } : l,
    );

    setLeagueMembers(updatedMembers);
    setLeagues(updatedLeagues);
    await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));
    await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updatedLeagues));

    return true;
  }, [leagues, leagueMembers]);

  const findLeagueByCode = useCallback((code: string): League | undefined => {
    return leagues.find((l) => l.joinCode === code.toUpperCase());
  }, [leagues]);

  const getLeagueMembers = useCallback((leagueId: string): LeagueMember[] => {
    return leagueMembers[leagueId] || [];
  }, [leagueMembers]);

  const deleteLeague = useCallback(async (leagueId: string): Promise<void> => {
    const updatedLeagues = leagues.filter((l) => l.id !== leagueId);
    const updatedMembers = { ...leagueMembers };
    delete updatedMembers[leagueId];

    setLeagues(updatedLeagues);
    setLeagueMembers(updatedMembers);
    await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updatedLeagues));
    await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));
  }, [leagues, leagueMembers]);

  const refreshLeagues = useCallback(async (): Promise<void> => {
    try {
      const leagueData = await AsyncStorage.getItem(STORAGE_KEYS.leagues);
      const memberData = await AsyncStorage.getItem(STORAGE_KEYS.leagueMembers);
      if (leagueData) setLeagues(JSON.parse(leagueData) as League[]);
      if (memberData) setLeagueMembers(JSON.parse(memberData) as Record<string, LeagueMember[]>);
    } catch {}
  }, []);

  const fetchPublicLeagues = useCallback(async (): Promise<League[]> => {
    return leagues.filter((l) => l.visibility === 'public');
  }, [leagues]);

  function buildSeedLeaderboard(): LeaderboardEntry[] {
    // Use the dynamic getCompletedRaceIds so newly-completed races are
    // automatically included in seed-user scoring.
    const seedResults = MOCK_RACE_RESULTS;
    const entries: LeaderboardEntry[] = SEED_USERS.map((user) => ({
      rank: 0,
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      totalPoints: scoreSeededPredictions(user.userId, seedResults),
    }));

    console.log(
      '[GameProvider] Seed leaderboard computed using',
      getCompletedRaceIds(seedResults).length,
      'completed races:',
      getCompletedRaceIds(seedResults).join(', ')
    );

    entries.sort((a, b) => b.totalPoints - a.totalPoints);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  const fetchGlobalLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    // Always compute seed-user points from the verified spreadsheet predictions.
    // These are the authoritative scores, immune to stale Supabase cached values.
    const seedUserIdSet = new Set(SEED_USERS.map((u) => u.userId));
    const seedLeaderboard = buildSeedLeaderboard();
    const seedScoreMap = new Map<string, number>();
    const seedNameMap = new Map<string, { username: string; displayName: string }>();

    for (const entry of seedLeaderboard) {
      seedScoreMap.set(entry.userId, entry.totalPoints);
      seedNameMap.set(entry.userId, { username: entry.username, displayName: entry.displayName });
    }

    if (!isSupabaseConfigured) {
      return seedLeaderboard;
    }

    try {
      // Query BOTH profiles and user_predictions so we include every registered
      // user — not just the ones who happen to have prediction rows.
      const [profilesRes, predictionsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, total_points'),
        supabase.from('user_predictions').select('user_id, username, display_name, points_earned, sprint_points_earned, updated_at'),
      ]);

      const allProfiles = (profilesRes.data ?? []) as Array<{
        id: string;
        username: string | null;
        display_name: string | null;
        total_points: number | null;
      }>;

      const allPredictions = (predictionsRes.data ?? []) as Array<{
        user_id: string;
        username: string | null;
        display_name: string | null;
        points_earned: number | null;
        sprint_points_earned: number | null;
        updated_at: string | null;
      }>;

      if (predictionsRes.error) {
        console.log('[GameProvider] Predictions query error:', predictionsRes.error.message);
      }
      if (profilesRes.error) {
        console.log('[GameProvider] Profiles query error:', profilesRes.error.message);
      }

      // Build a map of every user from profiles.
      const userMap = new Map<string, {
        username: string;
        displayName: string;
        totalPoints: number;
        isSeedUser: boolean;
      }>();

      for (const profile of allProfiles) {
        const isSeed = seedUserIdSet.has(profile.id);
        userMap.set(profile.id, {
          username: cleanText(profile.username) ?? 'Unknown',
          displayName: cleanText(profile.display_name) ?? cleanText(profile.username) ?? 'Unknown',
          totalPoints: isSeed ? (seedScoreMap.get(profile.id) ?? 0) : (profile.total_points ?? 0),
          isSeedUser: isSeed,
        });
      }

      // For non-seed users, compute points from their prediction rows (more
      // accurate than profiles.total_points, which may be stale).
      const nonSeedPoints = new Map<string, number>();
      for (const row of allPredictions) {
        if (seedUserIdSet.has(row.user_id)) continue;
        const current = nonSeedPoints.get(row.user_id) ?? 0;
        nonSeedPoints.set(
          row.user_id,
          current + (row.points_earned ?? 0) + (row.sprint_points_earned ?? 0),
        );
      }

      // Override non-seed user points with the sum from predictions.
      for (const [userId, points] of nonSeedPoints) {
        const existing = userMap.get(userId);
        if (existing && !existing.isSeedUser) {
          existing.totalPoints = points;
        }
      }

      // Build the entries, excluding only truly bogus placeholder accounts.
      // We no longer exclude by user ID — real users with low points should
      // still appear. Only filter out entries that have no meaningful name.
      const entries: LeaderboardEntry[] = Array.from(userMap.entries())
        .filter(([_userId, info]) => {
          const name = info.displayName || info.username || '';
          // Keep any entry that looks like a real person.
          return name.length > 0 && name !== 'Unknown';
        })
        .map(([userId, info]) => ({
          rank: 0,
          userId,
          username: info.isSeedUser ? (seedNameMap.get(userId)?.username ?? info.username) : info.username,
          displayName: info.isSeedUser ? (seedNameMap.get(userId)?.displayName ?? info.displayName) : info.displayName,
          totalPoints: info.isSeedUser ? (seedScoreMap.get(userId) ?? info.totalPoints) : info.totalPoints,
        }));

      // Ensure seed users always appear, even if their profile is missing.
      const existingUserIds = new Set(entries.map((e) => e.userId));
      for (const seedEntry of seedLeaderboard) {
        if (!existingUserIds.has(seedEntry.userId)) {
          entries.push(seedEntry);
        }
      }

      entries.sort((a, b) => b.totalPoints - a.totalPoints);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
    } catch (e: any) {
      console.log('[GameProvider] Leaderboard load threw:', e?.message || e);
      return seedLeaderboard;
    }
  }, []);

  const scorePredictions = useCallback(async (raceResults: RaceResult[]): Promise<void> => {
    if (!raceResults || raceResults.length === 0) return;

    const resultByRaceId = new Map<string, RaceResult>();
    for (const result of raceResults) {
      resultByRaceId.set(result.raceId, result);
    }

    const names = profileNames(profile);
    let hasChanges = false;
    const changedPredictions: Prediction[] = [];

    const scoredPredictions = predictionsRef.current.map((prediction) => {
      const result = resultByRaceId.get(prediction.raceId);
      if (!result) return prediction;

      const hasRaceResults = result.classification && result.classification.length > 0;
      const hasSprintResults =
        !!result.sprintClassification && result.sprintClassification.length > 0;

      // No results at all yet — keep the prediction as-is.
      if (!hasRaceResults && !hasSprintResults) return prediction;

      // Race points only update when we actually have race results.
      // Sprint points update independently as soon as sprint results land.
      const mainBreakdown =
        hasRaceResults && prediction.top10.length > 0
          ? calculatePoints(prediction, result)
          : null;

      const sprintBreakdown =
        hasSprintResults && prediction.sprintTop8.length > 0
          ? calculateSprintPoints(prediction.sprintTop8, result.sprintClassification!)
          : null;

      const nextPrediction = normalizePrediction({
        ...prediction,
        pointsEarned: mainBreakdown?.totalPoints ?? prediction.pointsEarned ?? 0,
        sprintPointsEarned: sprintBreakdown?.totalPoints ?? prediction.sprintPointsEarned ?? 0,
        username: names.username ?? prediction.username,
        displayName: names.displayName ?? prediction.displayName,
        updatedAt: prediction.updatedAt,
      });

      if (
        nextPrediction.pointsEarned !== prediction.pointsEarned ||
        nextPrediction.sprintPointsEarned !== prediction.sprintPointsEarned ||
        nextPrediction.username !== prediction.username ||
        nextPrediction.displayName !== prediction.displayName
      ) {
        hasChanges = true;
        changedPredictions.push(nextPrediction);
      }

      return nextPrediction;
    });

    if (!hasChanges) return;

    setPredictions(scoredPredictions);
    predictionsRef.current = scoredPredictions;
    await persistPredictions(scoredPredictions);

    if (!isSupabaseConfigured) return;

    const userId = await resolveUserId();
    if (!userId) return;

    await Promise.all(changedPredictions.map(async (prediction) => {
      const syncUsername = names.username ?? prediction.username ?? `user_${userId.substring(0, 8)}`;
      const syncDisplayName = names.displayName ?? prediction.displayName ?? syncUsername;
      await ensureSupabaseProfileForPrediction(userId, syncUsername, syncDisplayName);
      const payload = buildPredictionPayload(prediction, userId, syncUsername, syncDisplayName);
      const writeResult = await writePredictionRow(payload);

      if (!writeResult.synced) {
        console.log('[GameProvider] Scored prediction sync failed:', writeResult.errorMessage ?? 'Unknown error');
      }
    }));

    const total = scoredPredictions.reduce(
      (sum, prediction) => sum + (prediction.pointsEarned ?? 0) + (prediction.sprintPointsEarned ?? 0),
      0,
    );

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ total_points: total })
      .eq('id', userId);

    if (profileError) {
      console.log('[GameProvider] Profile total points update failed:', profileError.message);
    }
  }, [profile, resolveUserId]);

  const lockTimes = useMemo<Record<string, string>>(() => {
    return {};
  }, []);

  const fetchLeagueMembers = useCallback(async (leagueId: string): Promise<LeagueMember[]> => {
    const cached = leagueMembers[leagueId];
    if (cached && cached.length > 0) return cached;

    if (!isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('league_members')
        .select('user_id, role, joined_at, profiles(username, display_name, total_points)')
        .eq('league_id', leagueId);

      if (error || !data) {
        if (error) console.log('[GameProvider] League members load failed:', error.message);
        return [];
      }

      // Compute member points from verified seed scores where available,
      // falling back to profiles.total_points for non-seed users.
      const seedScoreMap = new Map<string, number>();
      for (const entry of buildSeedLeaderboard()) {
        seedScoreMap.set(entry.userId, entry.totalPoints);
      }

      const members: LeagueMember[] = (data as any[]).map((row) => {
        const profileData = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const computedPoints = seedScoreMap.get(row.user_id) ?? (profileData?.total_points || 0);
        return {
          userId: row.user_id,
          username: profileData?.username || 'Unknown',
          displayName: profileData?.display_name || profileData?.username || 'Unknown',
          role: row.role || 'member',
          points: computedPoints,
          joinedAt: row.joined_at || new Date().toISOString(),
        };
      });

      const updatedMembers = { ...leagueMembers, [leagueId]: members };
      setLeagueMembers(updatedMembers);
      await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));
      return members;
    } catch (e: any) {
      console.log('[GameProvider] League members load threw:', e?.message || e);
      return [];
    }
  }, [leagueMembers]);

  const totalPoints = useMemo(() => {
    return predictions.reduce(
      (sum, prediction) => sum + (prediction.pointsEarned || 0) + (prediction.sprintPointsEarned || 0),
      0,
    );
  }, [predictions]);

  return {
    predictions,
    leagues,
    leagueMembers,
    editCounts,
    isLoading,
    totalPoints,
    session: userSession as Session | null,
    savePrediction,
    getPrediction,
    createLeague,
    joinLeague,
    findLeagueByCode,
    getLeagueMembers,
    deleteLeague,
    refreshLeagues,
    fetchPublicLeagues,
    fetchGlobalLeaderboard,
    scorePredictions,
    updateLocalProfile,
    refreshPredictions,
    lockTimes,
    fetchLeagueMembers,
  };
});
