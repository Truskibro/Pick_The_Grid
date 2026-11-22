import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import * as Notifications from 'expo-notifications';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ensureAndroidChannel } from '@/lib/notifications';
import { useSeries } from '@/providers/SeriesProvider';
import { useUser } from '@/providers/UserProvider';
import { useGame } from '@/providers/GameProvider';

export interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  league_id: string;
  series_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
  league?: { name: string } | null;
  challenger?: { display_name: string; username: string } | null;
  challenged?: { display_name: string; username: string } | null;
}

export type SendChallengeResult = {
  ok: boolean;
  reason: 'sent' | 'pending' | 'accepted' | 'no-league' | 'guest' | 'error';
};

const CHALLENGE_SELECT = `
  id, challenger_id, challenged_id, league_id, series_id, status, created_at, responded_at,
  league:leagues(name),
  challenger:profiles!challenges_challenger_id_fkey(display_name, username),
  challenged:profiles!challenges_challenged_id_fkey(display_name, username)
`;

// PostgREST embeds can arrive as an object or a one-element array depending on
// cardinality inference — flatten them to the shape the UI expects.
type RawEmbed = { display_name?: string; username?: string; name?: string };

function firstEmbed(value: RawEmbed | RawEmbed[] | null | undefined): RawEmbed | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function fresh(challenges: Challenge[], seen: Set<string>): Challenge[] {
  return challenges.filter((c) => !seen.has(c.id));
}

function normalizeChallenge(raw: {
  id: string;
  challenger_id: string;
  challenged_id: string;
  league_id: string;
  series_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  league: RawEmbed[] | null;
  challenger: RawEmbed[] | null;
  challenged: RawEmbed[] | null;
}): Challenge {
  const league = firstEmbed(raw.league);
  const challenger = firstEmbed(raw.challenger);
  const challenged = firstEmbed(raw.challenged);
  return {
    id: raw.id,
    challenger_id: raw.challenger_id,
    challenged_id: raw.challenged_id,
    league_id: raw.league_id,
    series_id: raw.series_id,
    status: raw.status as Challenge['status'],
    created_at: raw.created_at,
    responded_at: raw.responded_at,
    league: league ? { name: String(league.name ?? '') } : null,
    challenger: challenger
      ? { display_name: String(challenger.display_name ?? ''), username: String(challenger.username ?? '') }
      : null,
    challenged: challenged
      ? { display_name: String(challenged.display_name ?? ''), username: String(challenged.username ?? '') }
      : null,
  };
}

export const [ChallengeProvider, useChallenges] = createContextHook(() => {
  const { currentSeries } = useSeries();
  const { profile, isGuest, notifications } = useUser();
  const { leagues } = useGame();

  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || isGuest || !profile?.id) {
      setAllChallenges([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select(CHALLENGE_SELECT)
        .or(`challenger_id.eq.${profile.id},challenged_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });
      if (!error) setAllChallenges((data ?? []).map(normalizeChallenge));
    } catch (e) {
      console.log('[challenges] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [isGuest, profile?.id]);

  useEffect(() => {
    void refresh();
    // Keep the badge count reasonably fresh without push.
    const interval = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Challenges for the active series only.
  const challenges = useMemo(
    () => allChallenges.filter((c) => (c.series_id ?? 'f1') === currentSeries),
    [allChallenges, currentSeries],
  );

  const pendingIncoming = useMemo(
    () => challenges.filter((c) => c.status === 'pending' && c.challenged_id === profile?.id),
    [challenges, profile?.id],
  );

  // Local notifications for NEW incoming invites. The first load only primes
  // the seen-set (no spam for the existing backlog); after that, any pending
  // invite the poll hasn't seen before fires one notification — unless the
  // user turned Challenge Invites off in Settings.
  const seenPendingIdsRef = useRef<Set<string> | null>(null);
  const challengeInvitesEnabled = notifications?.challengeInvites !== false;
  useEffect(() => {
    const currentIds = new Set(pendingIncoming.map((c) => c.id));
    const seen = seenPendingIdsRef.current;
    seenPendingIdsRef.current = currentIds;

    if (seen === null || fresh(pendingIncoming, seen).length === 0) return;
    if (!challengeInvitesEnabled) return;

    const freshChallenges = fresh(pendingIncoming, seen);
    void (async () => {
      try {
        await ensureAndroidChannel();
        for (const c of freshChallenges) {
          const challengerName =
            c.challenger?.display_name?.trim() ||
            c.challenger?.username?.trim() ||
            'A rival';
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '\u2694\uFE0F New Challenge',
              body: `${challengerName} challenged you to a head-to-head. Accept or decline it in your Challenges tab.`,
            },
            trigger: null,
          });
        }
      } catch (e) {
        console.log('[challenges] invite notification failed:', e);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIncoming, challengeInvitesEnabled]);

  /**
   * Send a head-to-head invite to a player you share a league with.
   * League-only: a shared league in the current series is required, and an
   * already-pending or already-accepted challenge is not duplicated.
   */
  const sendChallenge = useCallback(
    async (rivalId: string): Promise<SendChallengeResult> => {
      if (!isSupabaseConfigured || isGuest || !profile?.id) return { ok: false, reason: 'guest' };
      if (rivalId === profile.id) return { ok: false, reason: 'error' };

      try {
        // Shared leagues with the rival, scoped to the current series.
        const [mineRes, theirsRes] = await Promise.all([
          supabase.from('league_members').select('league_id').eq('user_id', profile.id),
          supabase.from('league_members').select('league_id').eq('user_id', rivalId),
        ]);
        if (mineRes.error || theirsRes.error) return { ok: false, reason: 'error' };

        const seriesLeagueIds = new Set(
          leagues.filter((l) => (l.seriesId ?? 'f1') === currentSeries).map((l) => l.id),
        );
        const myLeagueIds = new Set((mineRes.data ?? []).map((m) => m.league_id as string));
        const sharedLeague = (theirsRes.data ?? [])
          .map((m) => m.league_id as string)
          .find((id) => myLeagueIds.has(id) && seriesLeagueIds.has(id));
        if (!sharedLeague) return { ok: false, reason: 'no-league' };

        // Don't duplicate an open or live challenge in this series.
        const { data: existing, error: existingError } = await supabase
          .from('challenges')
          .select('id, status')
          .eq('series_id', currentSeries)
          .in('status', ['pending', 'accepted'])
          .or(
            `and(challenger_id.eq.${profile.id},challenged_id.eq.${rivalId}),` +
              `and(challenger_id.eq.${rivalId},challenged_id.eq.${profile.id})`,
          );
        if (!existingError && (existing ?? []).length > 0) {
          const statuses = new Set((existing ?? []).map((c) => c.status));
          return {
            ok: false,
            reason: statuses.has('accepted') ? 'accepted' : 'pending',
          };
        }

        const { error: insertError } = await supabase.from('challenges').insert({
          challenger_id: profile.id,
          challenged_id: rivalId,
          league_id: sharedLeague,
          series_id: currentSeries,
        });
        if (insertError) {
          console.log('[challenges] insert error:', insertError.message);
          return { ok: false, reason: 'error' };
        }

        void refresh();
        return { ok: true, reason: 'sent' };
      } catch (e) {
        console.log('[challenges] send error:', e);
        return { ok: false, reason: 'error' };
      }
    },
    [currentSeries, isGuest, leagues, profile?.id, refresh],
  );

  /** Accept or decline an incoming invite. */
  const respondToChallenge = useCallback(
    async (challengeId: string, accept: boolean): Promise<boolean> => {
      if (!isSupabaseConfigured || isGuest) return false;
      const { error } = await supabase
        .from('challenges')
        .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
        .eq('id', challengeId);
      if (error) {
        console.log('[challenges] respond error:', error.message);
        return false;
      }
      void refresh();
      return true;
    },
    [isGuest, refresh],
  );

  /** Withdraw a pending invite you sent. */
  const cancelChallenge = useCallback(
    async (challengeId: string): Promise<boolean> => {
      if (!isSupabaseConfigured || isGuest) return false;
      const { error } = await supabase.from('challenges').delete().eq('id', challengeId);
      if (error) {
        console.log('[challenges] cancel error:', error.message);
        return false;
      }
      void refresh();
      return true;
    },
    [isGuest, refresh],
  );

  return {
    challenges,
    pendingIncoming,
    loading,
    refresh,
    sendChallenge,
    respondToChallenge,
    cancelChallenge,
  };
});
