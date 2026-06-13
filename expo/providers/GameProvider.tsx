import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Prediction, League, LeagueMember, LeaderboardEntry, RaceResult } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  predictions: 'apex_draft_predictions',
  editCounts: 'apex_draft_edit_counts',
  leagues: 'apex_draft_leagues',
  leagueMembers: 'apex_draft_league_members',
  lastSaveTime: 'apex_draft_last_save_time',
} as const;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

let lastSaveTimeGlobal: number = 0;

export const [GameProvider, useGame] = createContextHook(() => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<Record<string, LeagueMember[]>>({});
  const [editCounts, setEditCounts] = useState<Record<string, { count: number; lastEditAt: string }>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [session, setSession] = useState<Session | null>(null);

  const predictionsRef = useRef<Prediction[]>([]);
  const editCountsRef = useRef<Record<string, { count: number; lastEditAt: string }>>({});
  const localProfileRef = useRef<{ username: string | null; displayName: string | null }>({
    username: null,
    displayName: null,
  });
  const lastSaveTimeRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => {
    predictionsRef.current = predictions;
  }, [predictions]);

  useEffect(() => {
    editCountsRef.current = editCounts;
  }, [editCounts]);

  // Listen for auth session changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load persisted data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [predData, editData, leagueData, memberData, lastSaveData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.predictions),
          AsyncStorage.getItem(STORAGE_KEYS.editCounts),
          AsyncStorage.getItem(STORAGE_KEYS.leagues),
          AsyncStorage.getItem(STORAGE_KEYS.leagueMembers),
          AsyncStorage.getItem(STORAGE_KEYS.lastSaveTime),
        ]);

        if (predData) {
          const parsed: Prediction[] = JSON.parse(predData);
          setPredictions(parsed);
          predictionsRef.current = parsed;
        }
        if (editData) {
          const parsed = JSON.parse(editData);
          setEditCounts(parsed);
          editCountsRef.current = parsed;
        }
        if (leagueData) setLeagues(JSON.parse(leagueData));
        if (memberData) setLeagueMembers(JSON.parse(memberData));
        if (lastSaveData) {
          const ts = parseInt(lastSaveData, 10);
          lastSaveTimeRef.current = ts;
          lastSaveTimeGlobal = ts;
        }
      } catch (e) {
        console.log('Error loading game data:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Update local profile ref from AsyncStorage
  const updateLocalProfile = useCallback(async () => {
    try {
      const profileData = await AsyncStorage.getItem('apex_draft_profile');
      if (profileData) {
        const profile = JSON.parse(profileData);
        localProfileRef.current = {
          username: profile.username || null,
          displayName: profile.displayName || null,
        };
      }
    } catch {}
  }, []);

  useEffect(() => {
    updateLocalProfile();
  }, [updateLocalProfile]);

  const savePrediction = useCallback(
    async (
      prediction: Omit<Prediction, 'id' | 'updatedAt'>
    ): Promise<{ synced: boolean }> => {
      const now = new Date().toISOString();

      const existingPrediction = predictionsRef.current.find(
        (p) => p.raceId === prediction.raceId
      );

      const isEdit = !!existingPrediction;
      const prevMeta = editCountsRef.current[prediction.raceId];
      const newCount = isEdit ? (prevMeta?.count ?? 1) + 1 : 1;
      const newEditMeta = { count: newCount, lastEditAt: now };
      const nextEditCounts = { ...editCountsRef.current, [prediction.raceId]: newEditMeta };

      setEditCounts(nextEditCounts);
      editCountsRef.current = nextEditCounts;
      AsyncStorage.setItem(STORAGE_KEYS.editCounts, JSON.stringify(nextEditCounts)).catch(() => {});

      const currentUsername =
        localProfileRef.current.username &&
        localProfileRef.current.username.trim() !== ''
          ? localProfileRef.current.username.trim()
          : null;

      const currentDisplayName =
        localProfileRef.current.displayName &&
        localProfileRef.current.displayName.trim() !== ''
          ? localProfileRef.current.displayName.trim()
          : currentUsername;

      const savedPrediction: Prediction = normalizePrediction({
        id: existingPrediction?.id || generateId(),
        raceId: prediction.raceId,
        top10: prediction.top10 ?? [],
        fastestLap: prediction.fastestLap ?? null,
        dnf: prediction.dnf ?? null,
        pointsEarned: prediction.pointsEarned ?? existingPrediction?.pointsEarned ?? 0,
        sprintTop8: prediction.sprintTop8 ?? [],
        sprintPointsEarned:
          prediction.sprintPointsEarned ??
          existingPrediction?.sprintPointsEarned ??
          0,
        updatedAt: now,
        username: currentUsername,
        displayName: currentDisplayName,
      });

      const nextPredictions = [
        ...predictionsRef.current.filter((p) => p.raceId !== prediction.raceId),
        savedPrediction,
      ];

      setPredictions(nextPredictions);
      predictionsRef.current = nextPredictions;

      try {
        await AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(nextPredictions));
      } catch (e) {
        console.log('[savePrediction] Local AsyncStorage save failed:', e);
      }

      const resolveUserId = async (): Promise<string | null> => {
        if (session?.user?.id) return session.user.id;
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.log('[savePrediction] getSession error:', error.message);
          }
          return data.session?.user?.id ?? null;
        } catch (e: any) {
          console.log('[savePrediction] getSession threw:', e?.message || e);
          return null;
        }
      };

      const userId = await resolveUserId();

      if (!userId) {
        console.log('[savePrediction] Supabase not updated: no logged-in user.');
        return { synced: false };
      }

      if (!isSupabaseConfigured) {
        console.log('[savePrediction] Supabase not updated: not configured.');
        return { synced: false };
      }

      const payload = {
        user_id: userId,
        race_id: savedPrediction.raceId,
        username: currentUsername,
        display_name: currentDisplayName,
        predicted_top10: savedPrediction.top10,
        predicted_fastest_lap: savedPrediction.fastestLap,
        predicted_dnf: savedPrediction.dnf,
        points_earned: savedPrediction.pointsEarned ?? 0,
        predicted_sprint_top8: savedPrediction.sprintTop8 ?? [],
        sprint_points_earned: savedPrediction.sprintPointsEarned ?? 0,
        updated_at: savedPrediction.updatedAt,
      };

      const { error } = await supabase
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

      lastSaveTimeRef.current = Date.now();
      lastSaveTimeGlobal = Date.now();
      AsyncStorage.setItem(STORAGE_KEYS.lastSaveTime, String(lastSaveTimeRef.current)).catch(() => {});

      return { synced: true };
    },
    [session]
  );

  const getPrediction = useCallback((raceId: string): Prediction | undefined => {
    return predictions.find(p => p.raceId === raceId);
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
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return false;

    const members = leagueMembers[leagueId] || [];
    if (members.some(m => m.userId === userId)) return false;

    const newMember: LeagueMember = {
      userId,
      username,
      displayName,
      role: 'member',
      points: 0,
      joinedAt: new Date().toISOString(),
    };

    const updatedMembers = { ...leagueMembers, [leagueId]: [...members, newMember] };
    const updatedLeagues = leagues.map(l =>
      l.id === leagueId ? { ...l, memberCount: l.memberCount + 1 } : l
    );

    setLeagueMembers(updatedMembers);
    setLeagues(updatedLeagues);
    await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));
    await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updatedLeagues));

    return true;
  }, [leagues, leagueMembers]);

  const findLeagueByCode = useCallback((code: string): League | undefined => {
    return leagues.find(l => l.joinCode === code.toUpperCase());
  }, [leagues]);

  const getLeagueMembers = useCallback((leagueId: string): LeagueMember[] => {
    return leagueMembers[leagueId] || [];
  }, [leagueMembers]);

  const deleteLeague = useCallback(async (leagueId: string) => {
    const updatedLeagues = leagues.filter(l => l.id !== leagueId);
    const updatedMembers = { ...leagueMembers };
    delete updatedMembers[leagueId];

    setLeagues(updatedLeagues);
    setLeagueMembers(updatedMembers);
    await AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updatedLeagues));
    await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));
  }, [leagues, leagueMembers]);

  const refreshLeagues = useCallback(async () => {
    try {
      const leagueData = await AsyncStorage.getItem(STORAGE_KEYS.leagues);
      const memberData = await AsyncStorage.getItem(STORAGE_KEYS.leagueMembers);
      if (leagueData) setLeagues(JSON.parse(leagueData));
      if (memberData) setLeagueMembers(JSON.parse(memberData));
    } catch {}
  }, []);

  const fetchPublicLeagues = useCallback(async (): Promise<League[]> => {
    return leagues.filter(l => l.visibility === 'public');
  }, [leagues]);

  const fetchGlobalLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('user_predictions')
        .select('user_id, username, display_name, points_earned');
      if (error || !data) return [];

      const userMap = new Map<string, { username: string; displayName: string; totalPoints: number }>();
      for (const row of data) {
        const uid = row.user_id;
        const existing = userMap.get(uid);
        const pts = (row.points_earned || 0) + (existing?.totalPoints || 0);
        userMap.set(uid, {
          username: row.username || existing?.username || 'Unknown',
          displayName: row.display_name || existing?.displayName || 'Unknown',
          totalPoints: pts,
        });
      }

      const entries: LeaderboardEntry[] = [];
      for (const [userId, info] of userMap) {
        entries.push({
          rank: 0,
          userId,
          username: info.username,
          displayName: info.displayName,
          totalPoints: info.totalPoints,
        });
      }
      entries.sort((a, b) => b.totalPoints - a.totalPoints);
      entries.forEach((e, i) => (e.rank = i + 1));
      return entries;
    } catch {
      return [];
    }
  }, []);

  const scorePredictions = useCallback(async (raceResults: RaceResult[]): Promise<void> => {
    // Scoring is handled by the scoring engine; this is a placeholder for triggering rescore
    console.log('[GameProvider] scorePredictions called for', raceResults.length, 'races');
  }, []);

  // Update local profile ref periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateLocalProfile();
    }, 5000);
    return () => clearInterval(interval);
  }, [updateLocalProfile]);

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
        .select('*')
        .eq('league_id', leagueId);
      if (error || !data) return [];

      const members: LeagueMember[] = data.map((row: any) => ({
        userId: row.user_id,
        username: row.username || 'Unknown',
        displayName: row.display_name || 'Unknown',
        role: row.role || 'member',
        points: row.points || 0,
        joinedAt: row.joined_at || new Date().toISOString(),
      }));

      const updatedMembers = { ...leagueMembers, [leagueId]: members };
      setLeagueMembers(updatedMembers);
      await AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updatedMembers));
      return members;
    } catch {
      return [];
    }
  }, [leagueMembers]);

  const totalPoints = useMemo(() => {
    return predictions.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);
  }, [predictions]);

  return {
    predictions,
    leagues,
    leagueMembers,
    editCounts,
    isLoading,
    totalPoints,
    session,
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
