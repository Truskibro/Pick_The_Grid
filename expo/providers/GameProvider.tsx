import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Prediction, League, LeagueMember, LeaderboardEntry, RaceResult } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useUser } from '@/providers/UserProvider';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';
import { Session } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  predictions: 'apex_draft_predictions',
  editCounts: 'apex_draft_edit_counts',
  leagues: 'apex_draft_leagues',
  leagueMembers: 'apex_draft_league_members',
  lastSaveTime: 'apex_draft_last_save_time',
} as const;

type PredictionInput = Omit<Prediction, 'id' | 'updatedAt' | 'username' | 'displayName'> &
  Partial<Pick<Prediction, 'username' | 'displayName'>>;

type EditCounts = Record<string, { count: number; lastEditAt: string }>;

type PredictionRow = {
  id: string;
  user_id: string;
  race_id: string;
  predicted_top10: string[] | null;
  predicted_fastest_lap: string | null;
  predicted_dnf: string | null;
  points_earned: number | null;
  predicted_sprint_top8: string[] | null;
  sprint_points_earned: number | null;
  username: string | null;
  display_name: string | null;
  updated_at: string | null;
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

  for (const prediction of localPredictions) {
    byRaceId.set(prediction.raceId, normalizePrediction(prediction));
  }

  for (const prediction of cloudPredictions) {
    byRaceId.set(prediction.raceId, normalizePrediction(prediction));
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

  useEffect(() => {
    if (!isSupabaseConfigured || !activeUserId) {
      cloudLoadedForUserRef.current = null;
      return;
    }

    if (cloudLoadedForUserRef.current === activeUserId) return;
    cloudLoadedForUserRef.current = activeUserId;

    let cancelled = false;

    const loadCloudPredictions = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('user_predictions')
          .select('*')
          .eq('user_id', activeUserId)
          .order('updated_at', { ascending: false });

        if (error) {
          console.log('[GameProvider] Cloud prediction load failed:', error.message);
          return;
        }

        if (cancelled || !data) return;

        const cloudPredictions = (data as PredictionRow[]).map(mapPredictionRow);
        const merged = mergePredictions(predictionsRef.current, cloudPredictions);

        setPredictions(merged);
        predictionsRef.current = merged;
        await persistPredictions(merged);
      } catch (e: any) {
        console.log('[GameProvider] Cloud prediction load threw:', e?.message || e);
      }
    };

    void loadCloudPredictions();

    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  const updateLocalProfile = useCallback(async (): Promise<void> => {
    await AsyncStorage.setItem('apex_draft_profile', JSON.stringify(profile));
  }, [profile]);

  const savePrediction = useCallback(
    async (prediction: PredictionInput): Promise<{ synced: boolean }> => {
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

      const payload = buildPredictionPayload(savedPrediction, userId, currentUsername, currentDisplayName);

      const { data, error } = await supabase
        .from('user_predictions')
        .upsert(payload, { onConflict: 'user_id,race_id' })
        .select('*')
        .single();

      if (error) {
        console.log('[savePrediction] Supabase upsert failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return { synced: false };
      }

      if (data) {
        const confirmedPrediction = mapPredictionRow(data as PredictionRow);
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

      return { synced: true };
    },
    [profile, resolveUserId],
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

  const fetchGlobalLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    if (!isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('user_predictions')
        .select('user_id, username, display_name, points_earned, sprint_points_earned, updated_at');

      if (error || !data) {
        if (error) console.log('[GameProvider] Leaderboard load failed:', error.message);
        return [];
      }

      const userMap = new Map<string, {
        username: string;
        displayName: string;
        totalPoints: number;
        latestUpdatedAt: string;
      }>();

      for (const row of data as Array<{
        user_id: string;
        username: string | null;
        display_name: string | null;
        points_earned: number | null;
        sprint_points_earned: number | null;
        updated_at: string | null;
      }>) {
        const existing = userMap.get(row.user_id);
        const points = (row.points_earned ?? 0) + (row.sprint_points_earned ?? 0);
        const latestUpdatedAt = row.updated_at ?? '';
        const shouldUseRowName = !existing || latestUpdatedAt >= existing.latestUpdatedAt;

        userMap.set(row.user_id, {
          username: shouldUseRowName
            ? cleanText(row.username) ?? existing?.username ?? 'Unknown'
            : existing.username,
          displayName: shouldUseRowName
            ? cleanText(row.display_name) ?? existing?.displayName ?? cleanText(row.username) ?? 'Unknown'
            : existing.displayName,
          totalPoints: (existing?.totalPoints ?? 0) + points,
          latestUpdatedAt: shouldUseRowName ? latestUpdatedAt : existing?.latestUpdatedAt ?? '',
        });
      }

      const entries: LeaderboardEntry[] = Array.from(userMap.entries()).map(([userId, info]) => ({
        rank: 0,
        userId,
        username: info.username,
        displayName: info.displayName,
        totalPoints: info.totalPoints,
      }));

      entries.sort((a, b) => b.totalPoints - a.totalPoints);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
    } catch (e: any) {
      console.log('[GameProvider] Leaderboard load threw:', e?.message || e);
      return [];
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
      if (!result || result.classification.length === 0 || prediction.top10.length === 0) {
        return prediction;
      }

      const mainBreakdown = calculatePoints(prediction, result);
      const sprintBreakdown = result.sprintClassification && prediction.sprintTop8.length > 0
        ? calculateSprintPoints(prediction.sprintTop8, result.sprintClassification)
        : null;

      const nextPrediction = normalizePrediction({
        ...prediction,
        pointsEarned: mainBreakdown.totalPoints,
        sprintPointsEarned: sprintBreakdown?.totalPoints ?? 0,
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
      const payload = buildPredictionPayload(prediction, userId, names.username ?? prediction.username, names.displayName ?? prediction.displayName);
      const { error } = await supabase
        .from('user_predictions')
        .upsert(payload, { onConflict: 'user_id,race_id' });

      if (error) {
        console.log('[GameProvider] Scored prediction sync failed:', error.message);
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

      const members: LeagueMember[] = (data as any[]).map((row) => {
        const profileData = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          userId: row.user_id,
          username: profileData?.username || 'Unknown',
          displayName: profileData?.display_name || profileData?.username || 'Unknown',
          role: row.role || 'member',
          points: profileData?.total_points || 0,
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
    lockTimes,
    fetchLeagueMembers,
  };
});
