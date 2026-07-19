import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Prediction, League, LeagueMember, LeaderboardEntry } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useUser } from '@/providers/UserProvider';
import { useSeries } from '@/providers/SeriesProvider';
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
  series_id?: string | null;
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
    seriesId: row.series_id ?? 'f1',
  });
}

function predictionKey(prediction: Prediction): string {
  return `${prediction.seriesId ?? 'f1'}:${prediction.raceId}`;
}

// ── League helpers ───────────────────────────────────────────────────────

type LeagueRow = {
  id: string;
  name: string;
  description: string | null;
  visibility: string | null;
  join_code: string | null;
  owner_id: string | null;
  created_at: string | null;
  series_id: string | null;
};

function mapLeagueRow(row: LeagueRow, memberCount = 0): League {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    visibility: row.visibility === 'private' ? 'private' : 'public',
    joinCode: row.join_code ?? '',
    ownerId: row.owner_id ?? '',
    memberCount,
    createdAt: row.created_at ?? new Date().toISOString(),
    seriesId: row.series_id ?? 'f1',
  };
}

/** Compute per-user series-specific points from server-scored user_predictions. */
async function fetchSeriesPointsForUsers(
  userIds: string[],
  seriesId: string,
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('user_predictions')
    .select('user_id, points_earned, sprint_points_earned')
    .in('user_id', userIds)
    .eq('series_id', seriesId);
  if (error) {
    console.log('[fetchSeriesPointsForUsers] error:', error.message);
    return new Map();
  }
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const current = map.get(row.user_id) ?? 0;
    map.set(row.user_id, current + (row.points_earned ?? 0) + (row.sprint_points_earned ?? 0));
  }
  return map;
}

/** Count members per league from league_members table. */
async function fetchMemberCounts(leagueIds: string[]): Promise<Map<string, number>> {
  if (leagueIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('league_members')
    .select('league_id')
    .in('league_id', leagueIds);
  if (error) {
    console.log('[fetchMemberCounts] error:', error.message);
    return new Map();
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.league_id) {
      counts.set(row.league_id, (counts.get(row.league_id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Fetch members for a batch of leagues in one round-trip, computing each
 * member's points from server-scored user_predictions filtered by the
 * league's series. Returns a map keyed by league_id.
 */
async function fetchLeagueMembersBatch(
  leagueIds: string[],
): Promise<Record<string, LeagueMember[]> | null> {
  if (leagueIds.length === 0) return null;
  const { data: memberRows, error } = await supabase
    .from('league_members')
    .select('league_id, user_id, role, joined_at, profiles!league_members_user_id_fkey(username, display_name)')
    .in('league_id', leagueIds);
  if (error) {
    console.log('[fetchLeagueMembersBatch] error:', error.message);
    return null;
  }

  // Group raw member rows by league.
  const grouped = new Map<string, Array<{ row: any }>>();
  const allUserIds = new Set<string>();
  for (const row of memberRows ?? []) {
    if (!row.league_id || !row.user_id) continue;
    const arr = grouped.get(row.league_id) ?? [];
    arr.push({ row });
    grouped.set(row.league_id, arr);
    allUserIds.add(row.user_id);
  }

  // Look up the series for each league so we filter points correctly.
  const { data: leagueRows } = await supabase
    .from('leagues')
    .select('id, series_id')
    .in('id', leagueIds);
  const leagueSeries = new Map<string, string>();
  for (const lr of leagueRows ?? []) {
    leagueSeries.set(lr.id, lr.series_id ?? 'f1');
  }

  // Compute per-user points for each series present.
  const seriesToUsers = new Map<string, Set<string>>();
  for (const [lid, members] of grouped) {
    const sid = leagueSeries.get(lid) ?? 'f1';
    const set = seriesToUsers.get(sid) ?? new Set<string>();
    for (const m of members) allUserIds.has(m.row.user_id) && set.add(m.row.user_id);
    seriesToUsers.set(sid, set);
  }
  const seriesPoints = new Map<string, Map<string, number>>();
  for (const [sid, users] of seriesToUsers) {
    seriesPoints.set(sid, await fetchSeriesPointsForUsers(Array.from(users), sid));
  }

  const result: Record<string, LeagueMember[]> = {};
  for (const [lid, members] of grouped) {
    const sid = leagueSeries.get(lid) ?? 'f1';
    const ptsMap = seriesPoints.get(sid) ?? new Map<string, number>();
    result[lid] = members.map(({ row }) => {
      const profileData = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        userId: row.user_id,
        username: profileData?.username ?? 'Unknown',
        displayName: profileData?.display_name ?? profileData?.username ?? 'Unknown',
        role: row.role === 'owner' ? 'owner' : 'member',
        points: ptsMap.get(row.user_id) ?? 0,
        joinedAt: row.joined_at ?? new Date().toISOString(),
      } as LeagueMember;
    });
  }
  return result;
}

function mergePredictions(localPredictions: Prediction[], cloudPredictions: Prediction[]): Prediction[] {
  const byKey = new Map<string, Prediction>();

  // Seed with local predictions first (fallback only).
  // Keyed by seriesId + raceId so F1 and MotoGP predictions never collide.
  for (const prediction of localPredictions) {
    const normalized = normalizePrediction(prediction);
    byKey.set(predictionKey(normalized), normalized);
  }

  // Cloud (Supabase) is the authoritative source of truth for logged-in users.
  // When a cloud prediction has actual picks, it ALWAYS wins over local —
  // regardless of timestamp. This prevents stale local AsyncStorage data from
  // shadowing the correct picks that were saved to Supabase.
  // Local is only kept when the cloud row has no picks (safety net).
  //
  // Points are now authored by the server (score_predictions_for_race).
  // The cloud row's pointsEarned/sprintPointsEarned is authoritative when
  // the server-scoring migration has been applied and the race has results.
  // We still preserve the higher of (local, cloud) points as a transitional
  // safety net so a freshly-deployed migration with unscored historical rows
  // doesn't zero out points that were correct under the old client-side flow.
  //
  // Keying by seriesId + raceId ensures F1 and MotoGP predictions never
  // overwrite each other.
  for (const prediction of cloudPredictions) {
    const normalized = normalizePrediction(prediction);
    const key = predictionKey(normalized);
    const existing = byKey.get(key);

    const cloudHasPicks =
      normalized.top10.length > 0 ||
      normalized.sprintTop8.length > 0 ||
      normalized.fastestLap != null ||
      normalized.dnf != null;

    if (!existing || cloudHasPicks) {
      // Preserve the higher points from local if cloud has a stale zero
      // (e.g. results not yet inserted, or migration not yet applied).
      if (existing) {
        normalized.pointsEarned = Math.max(
          normalized.pointsEarned ?? 0,
          existing.pointsEarned ?? 0,
        );
        normalized.sprintPointsEarned = Math.max(
          normalized.sprintPointsEarned ?? 0,
          existing.sprintPointsEarned ?? 0,
        );
      }
      byKey.set(key, normalized);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.raceId.localeCompare(b.raceId));
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
    series_id: prediction.seriesId ?? 'f1',
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
  // Try the multiseries-aware RPC (accepts p_series_id) first.
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
    p_series_id: payload.series_id,
  });

  if (error) {
    // If the multiseries migration hasn't been applied yet, the RPC
    // won't accept p_series_id. Postgres throws 42883 (function signature
    // mismatch) or PostgREST returns PGRST202 (schema cache miss).
    // Retry without the series_id parameter so saves still work.
    const isMissingParam =
      error.message?.includes('p_series_id') ||
      error.code === '42703' || // undefined_column
      error.code === '42883' || // undefined_function (signature mismatch)
      error.code === 'PGRST202'; // schema cache miss

    if (isMissingParam) {
      console.log('[savePrediction] p_series_id not supported, retrying without it');
      const { data: fallbackData, error: fallbackError } = await supabase.rpc(
        'save_user_prediction',
        {
          p_race_id: payload.race_id,
          p_predicted_top10: payload.predicted_top10,
          p_predicted_fastest_lap: payload.predicted_fastest_lap,
          p_predicted_dnf: payload.predicted_dnf,
          p_points_earned: payload.points_earned,
          p_predicted_sprint_top8: payload.predicted_sprint_top8,
          p_sprint_points_earned: payload.sprint_points_earned,
          p_username: payload.username,
          p_display_name: payload.display_name,
        },
      );

      if (fallbackError) {
        console.log('[savePrediction] Fallback RPC save also failed:', {
          code: fallbackError.code,
          message: fallbackError.message,
        });
        return { synced: false, row: null, errorMessage: fallbackError.message };
      }

      return { synced: true, row: fallbackData as PredictionRow };
    }

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
  const { currentSeries } = useSeries();
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

      // Merge local + cloud, keyed by seriesId + raceId so F1 and MotoGP
      // predictions never overwrite each other.
      let mergedPredictions = mergePredictions(localPredictions, cloudPredictions);

      // Safety net: never let an empty cloud prediction overwrite a local
      // prediction that has actual picks. Keyed by seriesId + raceId.
      const localByRace = new Map(localPredictions.map((p) => [predictionKey(p), p]));
      mergedPredictions = mergedPredictions.map((mp) => {
        const local = localByRace.get(predictionKey(mp));
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
      const cloudKeys = new Set(cloudPredictions.map((p) => predictionKey(p)));
      const unsyncedPredictions = localPredictions.filter(
        (p) => !cloudKeys.has(predictionKey(p)) && p.top10.length > 0
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
        const finalLocalByRace = new Map(localPredictions.map((p) => [predictionKey(p), p]));
        finalMerged = finalMerged.map((mp) => {
          const local = finalLocalByRace.get(predictionKey(mp));
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
      const predictionSeriesId = prediction.seriesId ?? currentSeries;
      const existingPrediction = predictionsRef.current.find(
        (p) => p.raceId === prediction.raceId && (p.seriesId ?? 'f1') === predictionSeriesId,
      );
      const isEdit = !!existingPrediction;
      const editCountKey = `${predictionSeriesId}:${prediction.raceId}`;
      const prevMeta = editCountsRef.current[editCountKey];
      const newCount = isEdit ? (prevMeta?.count ?? 1) + 1 : 1;
      const newEditMeta = { count: newCount, lastEditAt: now };
      const nextEditCounts = { ...editCountsRef.current, [editCountKey]: newEditMeta };
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
        seriesId: predictionSeriesId,
      });

      const optimisticPredictions = [
        ...predictionsRef.current.filter(
          (p) => !(p.raceId === prediction.raceId && (p.seriesId ?? 'f1') === predictionSeriesId),
        ),
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
        seriesId: predictionSeriesId,
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
        const confirmedSeriesId = confirmedPrediction.seriesId ?? predictionSeriesId;
        const confirmedPredictions = [
          ...predictionsRef.current.filter(
            (p) => !(p.raceId === confirmedPrediction.raceId && (p.seriesId ?? 'f1') === confirmedSeriesId),
          ),
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

  const getPrediction = useCallback((raceId: string, seriesId?: string): Prediction | undefined => {
    const targetSeries = seriesId ?? currentSeries;
    return predictions.find(
      (p) => p.raceId === raceId && (p.seriesId ?? 'f1') === targetSeries,
    );
  }, [predictions, currentSeries]);

  // ── Leagues: Supabase-backed ──────────────────────────────────────────
  //
  // Leagues and league_members live in Supabase. AsyncStorage is used only as
  // a read-through cache so the UI can render immediately on focus; every
  // mutation writes to Supabase first, then refreshes from Supabase so all
  // users see the same data.

  const persistLeaguesLocal = useCallback(async (
    nextLeagues: League[],
    nextMembers: Record<string, LeagueMember[]>,
  ) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(nextLeagues));
      await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(nextMembers));
    } catch (e) {
      console.log('[persistLeaguesLocal] error:', e);
    }
  }, []);

  const createLeague = useCallback(async (
    name: string,
    description: string,
    visibility: 'public' | 'private',
    ownerId: string,
    ownerName: string,
    ownerDisplayName: string,
    seriesId?: string,
  ): Promise<League> => {
    const finalSeriesId = seriesId ?? 'f1';

    // Local-only fast path (guest / Supabase not configured).
    if (!isSupabaseConfigured || !ownerId || ownerId === 'guest') {
      const localLeague: League = {
        id: generateId(),
        name,
        description,
        visibility,
        joinCode: generateJoinCode(),
        ownerId,
        memberCount: 1,
        createdAt: new Date().toISOString(),
        seriesId: finalSeriesId,
      };
      const ownerMember: LeagueMember = {
        userId: ownerId,
        username: ownerName,
        displayName: ownerDisplayName,
        role: 'owner',
        points: 0,
        joinedAt: new Date().toISOString(),
      };
      const nextLeagues = [...leagues, localLeague];
      const nextMembers = { ...leagueMembers, [localLeague.id]: [ownerMember] };
      setLeagues(nextLeagues);
      setLeagueMembers(nextMembers);
      await persistLeaguesLocal(nextLeagues, nextMembers);
      return localLeague;
    }

    // Generate a unique join code (retry on rare collision).
    let joinCode = generateJoinCode();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: existing } = await supabase
        .from('leagues')
        .select('id')
        .eq('join_code', joinCode)
        .maybeSingle();
      if (!existing) break;
      joinCode = generateJoinCode();
    }

    const { data: leagueRow, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name,
        description,
        visibility,
        join_code: joinCode,
        owner_id: ownerId,
        series_id: finalSeriesId,
      })
      .select('*')
      .single();

    if (leagueError || !leagueRow) {
      console.log('[createLeague] insert failed:', leagueError?.message);
      throw new Error(leagueError?.message ?? 'Failed to create league');
    }

    const newLeague = mapLeagueRow(leagueRow as LeagueRow, 1);

    const { error: memberError } = await supabase
      .from('league_members')
      .insert({
        league_id: newLeague.id,
        user_id: ownerId,
        role: 'owner',
      });

    if (memberError) {
      console.log('[createLeague] owner member insert failed:', memberError.message);
    }

    const ownerMember: LeagueMember = {
      userId: ownerId,
      username: ownerName,
      displayName: ownerDisplayName,
      role: 'owner',
      points: 0,
      joinedAt: new Date().toISOString(),
    };

    const nextLeagues = [...leagues, newLeague];
    const nextMembers = { ...leagueMembers, [newLeague.id]: [ownerMember] };
    setLeagues(nextLeagues);
    setLeagueMembers(nextMembers);
    await persistLeaguesLocal(nextLeagues, nextMembers);

    return newLeague;
  }, [leagues, leagueMembers, persistLeaguesLocal]);

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

    // Local-only fast path.
    if (!isSupabaseConfigured || !userId || userId === 'guest') {
      const newMember: LeagueMember = {
        userId,
        username,
        displayName,
        role: 'member',
        points: 0,
        joinedAt: new Date().toISOString(),
      };
      const nextMembers = { ...leagueMembers, [leagueId]: [...members, newMember] };
      const nextLeagues = leagues.map((l) =>
        l.id === leagueId ? { ...l, memberCount: l.memberCount + 1 } : l,
      );
      setLeagueMembers(nextMembers);
      setLeagues(nextLeagues);
      await persistLeaguesLocal(nextLeagues, nextMembers);
      return true;
    }

    const { error } = await supabase
      .from('league_members')
      .insert({
        league_id: leagueId,
        user_id: userId,
        role: 'member',
      });

    if (error) {
      // 23505 = unique_violation — already a member.
      if (error.code === '23505') return false;
      console.log('[joinLeague] insert failed:', error.message);
      return false;
    }

    // Optimistically add locally; refresh will reconcile counts.
    const newMember: LeagueMember = {
      userId,
      username,
      displayName,
      role: 'member',
      points: 0,
      joinedAt: new Date().toISOString(),
    };
    const nextMembers = { ...leagueMembers, [leagueId]: [...members, newMember] };
    const nextLeagues = leagues.map((l) =>
      l.id === leagueId ? { ...l, memberCount: l.memberCount + 1 } : l,
    );
    setLeagueMembers(nextMembers);
    setLeagues(nextLeagues);
    await persistLeaguesLocal(nextLeagues, nextMembers);

    return true;
  }, [leagues, leagueMembers, persistLeaguesLocal]);

  const findLeagueByCode = useCallback(async (code: string): Promise<League | undefined> => {
    const upper = code.toUpperCase();
    // Check local cache first (covers the local-only fast path).
    const local = leagues.find((l) => l.joinCode === upper);
    if (local) return local;

    if (!isSupabaseConfigured) return undefined;

    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('join_code', upper)
      .maybeSingle();

    if (error || !data) return undefined;
    const counts = await fetchMemberCounts([data.id]);
    return mapLeagueRow(data as LeagueRow, counts.get(data.id) ?? 0);
  }, [leagues]);

  const getLeagueMembers = useCallback((leagueId: string): LeagueMember[] => {
    return leagueMembers[leagueId] || [];
  }, [leagueMembers]);

  const deleteLeague = useCallback(async (leagueId: string): Promise<void> => {
    // Local-only fast path.
    if (!isSupabaseConfigured) {
      const nextLeagues = leagues.filter((l) => l.id !== leagueId);
      const nextMembers = { ...leagueMembers };
      delete nextMembers[leagueId];
      setLeagues(nextLeagues);
      setLeagueMembers(nextMembers);
      await persistLeaguesLocal(nextLeagues, nextMembers);
      return;
    }

    const { error } = await supabase.from('leagues').delete().eq('id', leagueId);
    if (error) {
      console.log('[deleteLeague] failed:', error.message);
      // Still update local state so the UI reflects intent.
    }

    const nextLeagues = leagues.filter((l) => l.id !== leagueId);
    const nextMembers = { ...leagueMembers };
    delete nextMembers[leagueId];
    setLeagues(nextLeagues);
    setLeagueMembers(nextMembers);
    await persistLeaguesLocal(nextLeagues, nextMembers);
  }, [leagues, leagueMembers, persistLeaguesLocal]);

  const refreshLeagues = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured || !activeUserId) {
      // Keep whatever's in AsyncStorage (local-only leagues).
      try {
        const leagueData = await AsyncStorage.getItem(STORAGE_KEYS.leagues);
        const memberData = await AsyncStorage.getItem(STORAGE_KEYS.leagueMembers);
        if (leagueData) setLeagues(JSON.parse(leagueData) as League[]);
        if (memberData) setLeagueMembers(JSON.parse(memberData) as Record<string, LeagueMember[]>);
      } catch {}
      return;
    }

    try {
      // Fetch every league the current user is a member of, plus public
      // leagues so Browse still works. This is the authoritative view.
      const { data: memberRows, error: memberError } = await supabase
        .from('league_members')
        .select('league_id')
        .eq('user_id', activeUserId);

      if (memberError) {
        console.log('[refreshLeagues] member lookup failed:', memberError.message);
        return;
      }

      const memberLeagueIds = (memberRows ?? []).map((r) => r.league_id).filter(Boolean) as string[];

      let leaguesQuery = supabase.from('leagues').select('*');
      if (memberLeagueIds.length > 0) {
        // Leagues the user belongs to OR any public league.
        leaguesQuery = leaguesQuery.or(`id.in.(${memberLeagueIds.join(',')}),visibility.eq.public`);
      } else {
        leaguesQuery = leaguesQuery.eq('visibility', 'public');
      }

      const { data: leagueRows, error: leagueError } = await leaguesQuery;
      if (leagueError || !leagueRows) {
        console.log('[refreshLeagues] league fetch failed:', leagueError?.message);
        return;
      }

      const allIds = leagueRows.map((r) => r.id);
      const counts = await fetchMemberCounts(allIds);

      const nextLeagues: League[] = leagueRows.map((row) =>
        mapLeagueRow(row as LeagueRow, counts.get(row.id) ?? 0),
      );

      setLeagues(nextLeagues);
      await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(nextLeagues));

      // Warm member caches for the user's own leagues so the leagues list +
      // detail render without a flash. Member points are computed from
      // server-scored user_predictions (series-filtered per league).
      if (memberLeagueIds.length > 0) {
        const warmed = await fetchLeagueMembersBatch(memberLeagueIds);
        if (warmed) {
          await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(warmed));
        }
      }
    } catch (e: any) {
      console.log('[refreshLeagues] threw:', e?.message || e);
    }
  }, [activeUserId]);

  const fetchPublicLeagues = useCallback(async (): Promise<League[]> => {
    if (!isSupabaseConfigured) {
      return leagues.filter((l) => l.visibility === 'public');
    }
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('visibility', 'public');
    if (error || !data) {
      console.log('[fetchPublicLeagues] failed:', error?.message);
      return leagues.filter((l) => l.visibility === 'public');
    }
    const ids = data.map((r) => r.id);
    const counts = await fetchMemberCounts(ids);
    return data.map((row) => mapLeagueRow(row as LeagueRow, counts.get(row.id) ?? 0));
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

  const fetchGlobalLeaderboard = useCallback(async (seriesId?: string): Promise<LeaderboardEntry[]> => {
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
      // F1 seed users only appear on the F1 leaderboard.
      if (seriesId && seriesId !== 'f1') return [];
      return seedLeaderboard;
    }

    try {
      // Query BOTH profiles and user_predictions so we include every registered
      // user — not just the ones who happen to have prediction rows.
      //
      // We try the series_id-filtered query first. If the series_id column
      // doesn't exist yet (migration not run) or the query fails, we fall back
      // to the original query without the series filter so points still show.
      const profilesPromise = supabase
        .from('profiles')
        .select('id, username, display_name, total_points');

      // Try the series_id-filtered query first. If the series_id column
      // doesn't exist yet (migration not run) or the query fails, fall back
      // to the unfiltered query so points still show.
      let predictionsRes;
      let usingSeriesFilter = false;

      if (seriesId) {
        predictionsRes = await supabase
          .from('user_predictions')
          .select('user_id, username, display_name, points_earned, sprint_points_earned, updated_at, series_id')
          .eq('series_id', seriesId);
        usingSeriesFilter = true;

        if (predictionsRes.error) {
          // The series_id column or migration has not been applied yet.
          // DO NOT fall back to an unfiltered query — that would leak
          // F1 points into the MotoGP leaderboard (and vice versa).
          // Return a safe, series-appropriate leaderboard instead.
          console.warn(
            `[GameProvider] series_id query failed for "${seriesId}". ` +
            `Migration not applied? Returning safe leaderboard to prevent cross-series point leakage. ` +
            `Error: ${predictionsRes.error.message}`
          );

          // Seed users only appear on the F1 leaderboard.
          if (seriesId === 'f1') {
            return seedLeaderboard;
          }
          return [];
        }
      } else {
        predictionsRes = await supabase
          .from('user_predictions')
          .select('user_id, username, display_name, points_earned, sprint_points_earned, updated_at');
      }

      const profilesRes = await profilesPromise;

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
        series_id?: string | null;
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
      // When a series filter is active, only predictions for that series
      // are counted, so the leaderboard is series-specific.
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
      // When filtering by series, users with no predictions in that series
      // keep a 0 score (set via the map default below).
      for (const [userId, points] of nonSeedPoints) {
        const existing = userMap.get(userId);
        if (existing && !existing.isSeedUser) {
          existing.totalPoints = points;
        }
      }

      // When filtering by series, exclude non-seed users who have no
      // predictions in that series (they should not appear with 0 or leaked
      // points from another series).
      if (seriesId) {
        for (const [userId, info] of userMap) {
          if (!info.isSeedUser && !nonSeedPoints.has(userId)) {
            userMap.delete(userId);
          }
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
          seriesId: seriesId ?? undefined,
        }));

      // Ensure seed users always appear, even if their profile is missing.
      // But only include seed users on the F1 leaderboard (they have F1 data only).
      if (!seriesId || seriesId === 'f1') {
        const existingUserIds = new Set(entries.map((e) => e.userId));
        for (const seedEntry of seedLeaderboard) {
          if (!existingUserIds.has(seedEntry.userId)) {
            entries.push(seedEntry);
          }
        }
      }

      // Points are now authored by Supabase (score_predictions_for_race).
      // No local-score override — the server's points_earned values are
      // authoritative and read straight from user_predictions.
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

  const lockTimes = useMemo<Record<string, string>>(() => {
    return {};
  }, []);

  const fetchLeagueMembers = useCallback(async (leagueId: string): Promise<LeagueMember[]> => {
    // Always re-fetch from Supabase when configured so every user sees the
    // same real membership (no per-device divergence). Cache only as a
    // read-through fallback for offline / guest use.
    if (!isSupabaseConfigured) {
      return leagueMembers[leagueId] ?? [];
    }

    try {
      // Look up the league's series so we filter points correctly.
      const { data: leagueRow } = await supabase
        .from('leagues')
        .select('series_id')
        .eq('id', leagueId)
        .maybeSingle();
      const seriesId = (leagueRow as any)?.series_id ?? 'f1';

      const { data, error } = await supabase
        .from('league_members')
        .select('user_id, role, joined_at, profiles!league_members_user_id_fkey(username, display_name)')
        .eq('league_id', leagueId);

      if (error || !data) {
        if (error) console.log('[GameProvider] League members load failed:', error.message);
        return leagueMembers[leagueId] ?? [];
      }

      const userIds = (data as any[]).map((r) => r.user_id).filter(Boolean) as string[];
      const pointsMap = await fetchSeriesPointsForUsers(userIds, seriesId);

      const members: LeagueMember[] = (data as any[]).map((row) => {
        const profileData = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          userId: row.user_id,
          username: profileData?.username ?? 'Unknown',
          displayName: profileData?.display_name ?? profileData?.username ?? 'Unknown',
          role: row.role === 'owner' ? 'owner' : 'member',
          points: pointsMap.get(row.user_id) ?? 0,
          joinedAt: row.joined_at ?? new Date().toISOString(),
        } as LeagueMember;
      });

      const updatedMembers = { ...leagueMembers, [leagueId]: members };
      setLeagueMembers(updatedMembers);
      await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));
      return members;
    } catch (e: any) {
      console.log('[GameProvider] League members load threw:', e?.message || e);
      return leagueMembers[leagueId] ?? [];
    }
  }, [leagueMembers]);

  const totalPoints = useMemo(() => {
    // Only sum predictions for the currently-selected series.
    return predictions
      .filter((p) => (p.seriesId ?? 'f1') === currentSeries)
      .reduce(
        (sum, prediction) => sum + (prediction.pointsEarned || 0) + (prediction.sprintPointsEarned || 0),
        0,
      );
  }, [predictions, currentSeries]);

  /** Series-specific total points (sums only predictions matching seriesId). */
  const getSeriesTotalPoints = useCallback((seriesId: string): number => {
    return predictions
      .filter((p) => (p.seriesId ?? 'f1') === seriesId)
      .reduce(
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
    getSeriesTotalPoints,
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
    updateLocalProfile,
    refreshPredictions,
    lockTimes,
    fetchLeagueMembers,
  };
});
