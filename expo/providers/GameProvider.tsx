import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useUser } from '@/providers/UserProvider';
import { Prediction, League, LeagueMember, RaceResult, LeaderboardEntry } from '@/types';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';
import {
  SEED_PREDICTIONS,
  COMPLETED_RACE_IDS,
  SEED_USERS,
} from '@/constants/seed-predictions';
import {
  MOCK_LEAGUE_MEMBERS,
  scoreMockMember,
} from '@/constants/mock-members';
import { MOCK_RACE_RESULTS } from '@/constants/f1-data';

const STORAGE_KEYS = {
  predictions: 'apex_draft_predictions',
  leagues: 'apex_draft_leagues',
  leagueMembers: 'apex_draft_league_members',
  pointsResetV1: 'apex_draft_points_reset_v1',
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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function withTimeout<T>(promiseOrThenable: Promise<T> | PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  const promise = Promise.resolve(promiseOrThenable);
  return Promise.race([
    promise.catch((err: any) => {
      console.log('withTimeout: promise rejected:', err?.message || err);
      return fallback;
    }),
    new Promise<T>((resolve) => setTimeout(() => {
      console.log('withTimeout: timed out after', ms, 'ms');
      resolve(fallback);
    }, ms)),
  ]);
}

/**
 * Map league_members rows (with embedded `profiles`) to LeagueMember[].
 * The current user's row is overridden with live local profile data so
 * username/display-name changes show instantly without re-fetching.
 */
function mapMemberRows(
  rows: any[],
  currentUserId: string,
  localProfile: { username: string; displayName: string; totalPoints: number }
): LeagueMember[] {
  return rows.map((m: any) => {
    const isCurrentUser = m.user_id === currentUserId;
    // profiles can come back as object or array depending on PostgREST join shape
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;

    const username = isCurrentUser
      ? localProfile.username
      : (profile?.username?.trim() || 'player');
    const displayName = isCurrentUser
      ? localProfile.displayName
      : (profile?.display_name?.trim() || profile?.username?.trim() || 'Player');
    // Points reset — leaderboard starts from scratch for everyone.
    const points = isCurrentUser ? localProfile.totalPoints : 0;

    return {
      userId: m.user_id,
      username,
      displayName,
      role: m.role || 'member',
      points,
      joinedAt: m.joined_at || new Date().toISOString(),
    };
  });
}

/** Fetch league members joined with their profile in a single round-trip. */
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

async function fetchAllProfilesSorted(): Promise<{ userId: string; username: string; displayName: string; totalPoints: number }[]> {
  try {
    const { data, error } = await withTimeout(
      supabase.from('profiles').select('id, username, display_name, total_points').order('total_points', { ascending: false }).limit(100),
      15000,
      { data: null, error: { message: 'timeout' } } as any
    );
    if (error || !data) {
      console.log('fetchAllProfilesSorted: error', error?.message || 'no data');
      return [];
    }
    console.log('fetchAllProfilesSorted: loaded', data.length, 'profiles for leaderboard');
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
  const { session, profile: localProfile } = useUser();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<Record<string, LeagueMember[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Keep a ref to localProfile so loadFromSupabase always sees the latest
  // profile without needing to re-create itself (which would trigger unwanted
  // reloads every time the display name changes).
  const localProfileRef = useRef(localProfile);
  localProfileRef.current = localProfile;

  const loadFromSupabase = useCallback(async () => {
    if (!session?.user) return;
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, skipping remote load');
      return;
    }
    const userId = session.user.id;
    console.log('loadFromSupabase: starting for user:', userId);

    try {
      const predResult = await withTimeout(
        supabase
          .from('user_predictions')
          .select('*')
          .eq('user_id', userId),
        10000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (predResult.error) {
        console.log('Predictions load error:', predResult.error.message);
      }

      let preds: Prediction[] = [];

      if (predResult.data && predResult.data.length > 0) {
        preds = predResult.data.map((p: any) => ({
          id: p.id,
          raceId: p.race_id,
          top10: p.predicted_top10 || [],
          fastestLap: p.predicted_fastest_lap || null,
          dnf: p.predicted_dnf || null,
          pointsEarned: p.points_earned || 0,
          sprintTop8: p.predicted_sprint_top8 || [],
          sprintPointsEarned: p.sprint_points_earned || 0,
          updatedAt: p.updated_at,
        }));
        console.log('Loaded', preds.length, 'predictions from Supabase');
      }

      // ── Seed predictions for the four spreadsheet users ──
      // If the signed-in user is one of the seed users and has missing
      // predictions for any completed race, inject the seed picks and
      // upsert them to Supabase so the scoring engine can award points.
      const seedForUser = SEED_PREDICTIONS[userId];
      if (seedForUser) {
        const seedUser = SEED_USERS.find(u => u.userId === userId);
        const existingRaceIds = new Set(preds.map(p => p.raceId));
        let seeded = false;

        for (const raceId of COMPLETED_RACE_IDS) {
          if (existingRaceIds.has(raceId)) continue;
          const rawPred = seedForUser[raceId];
          if (!rawPred) continue;

          const fullPred: Prediction = {
            id: generateUuid(),
            raceId: rawPred.raceId,
            top10: rawPred.top10,
            fastestLap: rawPred.fastestLap,
            dnf: rawPred.dnf,
            pointsEarned: 0,
            sprintTop8: rawPred.sprintTop8,
            sprintPointsEarned: 0,
            updatedAt: '2026-01-01T00:00:00Z',
          };

          preds.push(fullPred);
          seeded = true;

          // Write to Supabase so the seed picks persist
          supabase
            .from('user_predictions')
            .upsert({
              user_id: userId,
              race_id: fullPred.raceId,
              predicted_top10: fullPred.top10,
              predicted_fastest_lap: fullPred.fastestLap,
              predicted_dnf: fullPred.dnf,
              predicted_sprint_top8: fullPred.sprintTop8,
              points_earned: 0,
              sprint_points_earned: 0,
              updated_at: fullPred.updatedAt,
            }, { onConflict: 'user_id,race_id' })
            .then(({ error }) => {
              if (error) console.log('[Seed] Upsert error for', raceId, ':', error.message);
              else console.log('[Seed] Wrote prediction for', seedUser?.displayName, raceId);
            })
            .catch(() => {});
        }

        if (seeded) {
          console.log('[Seed] Injected seed predictions for user:', seedUser?.displayName);
        }
      }

      if (preds.length > 0) {
        setPredictions(preds);
        await AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(preds)).catch(() => {});
      }

      const membershipResult = await withTimeout(
        supabase
          .from('league_members')
          .select('league_id')
          .eq('user_id', userId),
        10000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (membershipResult.error) {
        console.log('Membership query error:', membershipResult.error.message);
      }

      const myLeagueIds: string[] = (membershipResult.data || []).map((m: any) => m.league_id);
      console.log('User is member of', myLeagueIds.length, 'leagues');

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

      // If membership query returned nothing (can happen on web due to auth
      // timing/RLS), do a second-pass lookup so joined leagues still show up.
      if (myLeagueIds.length === 0) {
        const fallbackMembership = await withTimeout(
          supabase.from('league_members').select('league_id').eq('user_id', userId),
          8000,
          { data: null, error: { message: 'timeout' } } as any
        );
        const fallbackIds: string[] = (fallbackMembership.data || []).map((m: any) => m.league_id);
        if (fallbackIds.length > 0) {
          const fallbackLeagues = await withTimeout(
            supabase.from('leagues').select('*').in('id', fallbackIds),
            8000,
            { data: null, error: { message: 'timeout' } } as any
          );
          if (!fallbackLeagues.error && fallbackLeagues.data) {
            for (const fl of fallbackLeagues.data) {
              if (!allLeagueData.some((l: any) => l.id === fl.id)) {
                allLeagueData.push(fl);
              }
            }
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
        (l, i, arr) => arr.findIndex(x => x.id === l.id) === i
      );

      const membersMap: Record<string, LeagueMember[]> = {};

      const memberPromises = uniqueLeagues.map(async (league) => {
        try {
          const rows = await fetchLeagueMembersJoined(league.id);
          if (rows.length === 0) {
            membersMap[league.id] = [{
              userId: league.ownerId,
              username: (league.ownerId === userId) ? localProfileRef.current.username : 'player',
              displayName: (league.ownerId === userId) ? localProfileRef.current.displayName : 'League Owner',
              role: 'owner',
              points: 0,
              joinedAt: league.createdAt,
            }];
            return;
          }
          membersMap[league.id] = mapMemberRows(rows, userId, localProfileRef.current);
        } catch (e) {
          console.log('Error loading members for league', league.id, e);
          membersMap[league.id] = [];
        }
      });

      await withTimeout(Promise.all(memberPromises), 20000, []);

      const leaguesWithCounts = uniqueLeagues.map(l => ({
        ...l,
        memberCount: membersMap[l.id]?.length ?? 1,
      }));
      setLeagues(leaguesWithCounts);
      setLeagueMembers(membersMap);
      console.log('loadFromSupabase: done, loaded', leaguesWithCounts.length, 'leagues');
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
        const normalized = parsed.map(p => ({
          ...p,
          sprintTop8: p.sprintTop8 ?? [],
          sprintPointsEarned: p.sprintPointsEarned ?? 0,
          pointsEarned: p.pointsEarned ?? 0,
        }));
        setPredictions(normalized);
      }
      if (leagueData) setLeagues(JSON.parse(leagueData));
      if (memberData) setLeagueMembers(JSON.parse(memberData));
      console.log('Loaded game data from local storage');
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
  }, [session, loadFromSupabase, loadFromLocal]);

  // Keep the current user's profile data in league members in sync.
  // Without this, changing the display name in Settings doesn't update the
  // already-loaded league member rows (which captured the old data at fetch time).
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    setLeagueMembers(prev => {
      let changed = false;
      const next: Record<string, LeagueMember[]> = {};
      for (const [leagueId, members] of Object.entries(prev)) {
        const updatedMembers = members.map(m => {
          if (m.userId !== userId) return m;
          if (
            m.displayName === localProfile.displayName &&
            m.username === localProfile.username &&
            m.points === localProfile.totalPoints
          ) return m;
          changed = true;
          return {
            ...m,
            displayName: localProfile.displayName,
            username: localProfile.username,
            points: localProfile.totalPoints,
          };
        });
        next[leagueId] = updatedMembers;
      }
      return changed ? next : prev;
    });
  }, [session, localProfile.displayName, localProfile.username, localProfile.totalPoints]);

  const savePrediction = useCallback(async (prediction: Omit<Prediction, 'id' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const localPred: Prediction = {
      id: generateId(),
      ...prediction,
      updatedAt: now,
    };

    setPredictions(prev => {
      const filtered = prev.filter(p => p.raceId !== prediction.raceId);
      const existing = prev.find(p => p.raceId === prediction.raceId);
      const merged: Prediction = existing
        ? { ...existing, ...prediction, updatedAt: now }
        : localPred;
      const updated = [...filtered, merged];
      AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(updated)).catch(() => {});
      return updated;
    });

    if (session?.user && isSupabaseConfigured) {
      try {
        const { error: upsertError } = await supabase
          .from('user_predictions')
          .upsert({
            user_id: session.user.id,
            race_id: prediction.raceId,
            predicted_top10: prediction.top10,
            predicted_fastest_lap: prediction.fastestLap,
            predicted_dnf: prediction.dnf,
            predicted_sprint_top8: prediction.sprintTop8,
            points_earned: prediction.pointsEarned,
            sprint_points_earned: prediction.sprintPointsEarned,
            updated_at: now,
          }, { onConflict: 'user_id,race_id' });

        if (upsertError) {
          console.log('Prediction upsert error:', upsertError.message);
          return;
        }

        const { data: verifyData, error: verifyError } = await supabase
          .from('user_predictions')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('race_id', prediction.raceId)
          .single();

        if (!verifyError && verifyData) {
          const saved: Prediction = {
            id: verifyData.id,
            raceId: verifyData.race_id,
            top10: verifyData.predicted_top10 || [],
            fastestLap: verifyData.predicted_fastest_lap || null,
            dnf: verifyData.predicted_dnf || null,
            pointsEarned: verifyData.points_earned || 0,
            sprintTop8: verifyData.predicted_sprint_top8 || [],
            sprintPointsEarned: verifyData.sprint_points_earned || 0,
            updatedAt: verifyData.updated_at,
          };

          setPredictions(prev => {
            const filtered = prev.filter(p => p.raceId !== prediction.raceId);
            const updated = [...filtered, saved];
            AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }
      } catch (e) {
        console.log('Prediction save to Supabase failed:', e);
      }
    }
  }, [session]);

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

      const createdAt = insertedLeague?.created_at || new Date().toISOString();

      const league: League = {
        id: leagueId,
        name,
        description,
        visibility,
        joinCode,
        ownerId: session.user.id,
        memberCount: 1,
        createdAt,
      };

      setLeagues(prev => [...prev, league]);
      setLeagueMembers(prev => ({
        ...prev,
        [league.id]: [{
          userId: session.user.id,
          username: ownerName,
          displayName: ownerDisplayName,
          role: 'owner',
          points: 0,
          joinedAt: new Date().toISOString(),
        }],
      }));

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
  }, [session, leagues, leagueMembers]);

  const joinLeague = useCallback(async (
    leagueId: string,
    userId: string,
    username: string,
    displayName: string,
  ): Promise<boolean> => {
    if (session?.user && isSupabaseConfigured) {
      console.log('joinLeague: joining league', leagueId);

      const { error: joinError } = await supabase
        .from('league_members')
        .insert({
          league_id: leagueId,
          user_id: session.user.id,
          role: 'member',
        });

      if (joinError) {
        console.log('Join league error:', joinError.message);
        if (joinError.message.includes('duplicate') || joinError.message.includes('unique') || joinError.message.includes('already exists')) {
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
      const fetchedMembers: LeagueMember[] = memberRows.length > 0
        ? mapMemberRows(memberRows, session.user.id, localProfile)
        : [];

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
        setLeagues(prev => {
          const filtered = prev.filter(l => l.id !== leagueId);
          return [...filtered, mappedLeague];
        });
      } else {
        setLeagues(prev =>
          prev.map(l => l.id === leagueId ? { ...l, memberCount } : l)
        );
      }

      setLeagueMembers(prev => ({
        ...prev,
        [leagueId]: fetchedMembers,
      }));

      console.log('Joined league, loaded', fetchedMembers.length, 'members');
      return true;
    }

    let leagueExists = false;
    let alreadyMember = false;

    setLeagues(prev => {
      const league = prev.find(l => l.id === leagueId);
      if (!league) {
        leagueExists = false;
        return prev;
      }
      leagueExists = true;
      return prev;
    });

    if (!leagueExists) return false;

    setLeagueMembers(prev => {
      const members = prev[leagueId] || [];
      if (members.some(m => m.userId === userId)) {
        alreadyMember = true;
        return prev;
      }
      return prev;
    });

    if (alreadyMember) return false;

    const newMember: LeagueMember = {
      userId,
      username,
      displayName,
      role: 'member',
      points: 0,
      joinedAt: new Date().toISOString(),
    };

    setLeagueMembers(prev => {
      const updated = { ...prev, [leagueId]: [...(prev[leagueId] || []), newMember] };
      void AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(updated));
      return updated;
    });
    setLeagues(prev => {
      const updated = prev.map(l =>
        l.id === leagueId ? { ...l, memberCount: l.memberCount + 1 } : l
      );
      void AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(updated));
      return updated;
    });

    return true;
  }, [session, localProfile]);

  const findLeagueByCode = useCallback(async (code: string): Promise<League | undefined> => {
    if (session?.user && isSupabaseConfigured) {
      console.log('Finding league by code:', code);
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
        supabase.from('league_members').select('*', { count: 'exact', head: true }).eq('league_id', result.data.id),
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

      setLeagues(prev => {
        if (prev.some(l => l.id === foundLeague.id)) return prev;
        return [...prev, foundLeague];
      });

      return foundLeague;
    }

    let found: League | undefined;
    setLeagues(prev => {
      found = prev.find(l => l.joinCode === code.toUpperCase());
      return prev;
    });
    return found;
  }, [session]);

  const getLeagueMembers = useCallback((leagueId: string): LeagueMember[] => {
    return leagueMembers[leagueId] || [];
  }, [leagueMembers]);

  const leagueMembersRef = useRef(leagueMembers);
  leagueMembersRef.current = leagueMembers;

  // Keep a ref to predictions so scorePredictions can read the latest values
  // after setPredictions settles, without depending on the predictions state
  // (which would cause the callback to be recreated too often).
  const predictionsRef = useRef(predictions);
  predictionsRef.current = predictions;

  const fetchLeagueMembers = useCallback(async (leagueId: string): Promise<LeagueMember[]> => {
    if (!session?.user || !isSupabaseConfigured) {
      console.log('fetchLeagueMembers: no session or supabase not configured');
      return leagueMembersRef.current[leagueId] || [];
    }

    const userId = session.user.id;
    console.log('fetchLeagueMembers: fetching for league', leagueId, 'current displayName:', localProfileRef.current.displayName);

    try {
      const memberRows = await fetchLeagueMembersJoined(leagueId);

      if (memberRows.length === 0) {
        console.log('fetchLeagueMembers: no member rows found, creating owner fallback');
        const league = leagues.find(l => l.id === leagueId);
        const fallback: LeagueMember[] = [{
          userId: league?.ownerId || userId,
          username: (league?.ownerId === userId) ? localProfileRef.current.username : 'player',
          displayName: (league?.ownerId === userId) ? localProfileRef.current.displayName : 'League Owner',
          role: 'owner',
          points: localProfileRef.current.totalPoints,
          joinedAt: league?.createdAt || new Date().toISOString(),
        }];
        setLeagueMembers(prev => ({ ...prev, [leagueId]: fallback }));
        return fallback;
      }

      const resolved = mapMemberRows(memberRows, userId, localProfileRef.current);

      // Ensure current user is always present with live profile data
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

      console.log('fetchLeagueMembers:', resolved.length, 'members ->', resolved.map((m: LeagueMember) => `${m.displayName} (@${m.username})`).join(', '));

      setLeagueMembers(prev => ({
        ...prev,
        [leagueId]: resolved,
      }));

      return resolved;
    } catch (e) {
      console.log('fetchLeagueMembers: error', e);
      return leagueMembersRef.current[leagueId] || [];
    }
  }, [session]);

  const deleteLeague = useCallback(async (leagueId: string) => {
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

    setLeagues(prev => prev.filter(l => l.id !== leagueId));
    setLeagueMembers(prev => {
      const updated = { ...prev };
      delete updated[leagueId];
      return updated;
    });

    if (!session?.user) {
      setLeagues(prev => {
        void AsyncStorage.setItem(STORAGE_KEYS.leagues, JSON.stringify(prev));
        return prev;
      });
      setLeagueMembers(prev => {
        void AsyncStorage.setItem(STORAGE_KEYS.leagueMembers, JSON.stringify(prev));
        return prev;
      });
    }
  }, [session]);

  const refreshLeagues = useCallback(async () => {
    if (session?.user) {
      console.log('Refreshing leagues...');
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
    // Score mock members against fallback race results so seed users
    // (Skye, Whitney, Bryan, Carlos) always appear with points on the
    // global leaderboard even if they don't have Supabase profiles.
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
      console.log('fetchGlobalLeaderboard: Supabase not configured, returning mock members only');
      return mockEntries
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

    // Merge mock members into Supabase results — dedupe by userId so real
    // Supabase profiles take priority, but seed users still appear if missing.
    const existingIds = new Set(supabaseEntries.map(e => e.userId));
    const merged = [
      ...supabaseEntries,
      ...mockEntries.filter(m => !existingIds.has(m.userId)),
    ];

    return merged
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, []);

  const scorePredictions = useCallback(async (_raceResults: RaceResult[]) => {
    let hasUpdates = false;

    setPredictions(prev => {
      const updatedPreds = prev.map(pred => {
        if (pred.top10.length === 0) return pred;

        const result = _raceResults.find(r => r.raceId === pred.raceId);
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

        console.log(
          '[Scoring] Race', pred.raceId,
          'GP:', newGpPoints, '(was', pred.pointsEarned, ')',
          'Sprint:', newSprintPoints, '(was', pred.sprintPointsEarned, ')'
        );
        hasUpdates = true;
        return {
          ...pred,
          pointsEarned: newGpPoints,
          sprintPointsEarned: newSprintPoints,
        };
      });

      return hasUpdates ? updatedPreds : prev;
    });

    if (!hasUpdates) {
      console.log('[Scoring] No new points to award');
      return;
    }

    // After state settles, persist to AsyncStorage and Supabase.
    const currentPreds = predictionsRef.current;
    await AsyncStorage.setItem(STORAGE_KEYS.predictions, JSON.stringify(currentPreds)).catch(() => {});

    const newTotal = currentPreds.reduce(
      (sum, p) => sum + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
      0
    );
    console.log('[Scoring] New total points:', newTotal);

    if (session?.user && isSupabaseConfigured) {
      for (const pred of currentPreds) {
        if (pred.top10.length === 0) continue;
        console.log(
          '[Scoring] Updating points in Supabase for race:', pred.raceId,
          'GP:', pred.pointsEarned, 'Sprint:', pred.sprintPointsEarned
        );
        await supabase
          .from('user_predictions')
          .update({
            points_earned: pred.pointsEarned ?? 0,
            sprint_points_earned: pred.sprintPointsEarned ?? 0,
          })
          .eq('user_id', session.user.id)
          .eq('race_id', pred.raceId)
          .then(({ error }) => {
            if (error) console.log('[Scoring] Supabase update error:', error.message);
          });
      }

      await supabase
        .from('profiles')
        .update({ total_points: newTotal })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.log('[Scoring] Profile points update error:', error.message);
          else console.log('[Scoring] Profile total_points updated to', newTotal);
        });
    }
  }, [session]);

  // Total points derived from all scored predictions (GP + sprint).
  const totalPoints = useMemo(
    () =>
      predictions.reduce(
        (sum, p) => sum + (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0),
        0
      ),
    [predictions]
  );

  return useMemo(() => ({
    predictions,
    leagues,
    isLoading,
    totalPoints,
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
  }), [predictions, leagues, isLoading, totalPoints, scorePredictions, savePrediction, getPrediction, createLeague, joinLeague, findLeagueByCode, getLeagueMembers, fetchLeagueMembers, deleteLeague, refreshLeagues, fetchPublicLeagues, fetchGlobalLeaderboard]);
});
