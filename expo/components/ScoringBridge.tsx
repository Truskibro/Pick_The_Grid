import { useEffect, useRef, useCallback } from 'react';
import { useF1Data } from '@/providers/F1DataProvider';
import { useSeries } from '@/providers/SeriesProvider';
import { useGame } from '@/providers/GameProvider';
import { SEED_USERS, scoreSeededPredictions, getCompletedRaceIds } from '@/constants/seed-predictions';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RaceResult } from '@/types';

/**
 * Auto-scoring bridge that fires whenever race results become available
 * for completed races. Handles:
 *
 *  1. Current user's predictions — scored via GameProvider.scorePredictions
 *  2. Seed users' points — computed fresh and persisted to Supabase profiles
 *  3. Achievement evaluation — triggered by the reactively-updated state
 *
 * Detection strategy:
 *  - A race is "scorable" when it has classification data AND its date has passed
 *  - We don't rely on the race.status field (which may lag behind actual results)
 *  - Uses a stable scoring-id ref to avoid redundant re-scoring
 */
export default function ScoringBridge() {
  const { currentSeries } = useSeries();
  const { raceResults, races } = useF1Data();
  const { scorePredictions, predictions, refreshPredictions } = useGame();

  // Stable identity of what we've already scored — avoids infinite loops.
  const lastScoringId = useRef<string>('');

  /**
   * Persist seed-user total points to Supabase profiles.
   * Uses the admin RPC if available; falls back to a best-effort direct update.
   */
  const persistSeedScores = useCallback(
    async (seedScores: Map<string, number>) => {
      if (!isSupabaseConfigured) return;

      for (const [userId, totalPoints] of seedScores) {
        try {
          // Try the admin RPC first (security definer, bypasses RLS).
          const { error } = await supabase.rpc('admin_set_profile_points', {
            p_user_id: userId,
            p_total_points: totalPoints,
          });

          if (error) {
            // RPC might not exist yet — fall back to direct profile upsert
            // (only works if the caller is the profile owner; graceful no-op otherwise).
            console.log(
              '[ScoringBridge] admin_set_profile_points RPC unavailable, trying direct update:',
              error.message
            );
            const seedUser = SEED_USERS.find((u) => u.userId === userId);
            await supabase.from('profiles').upsert(
              {
                id: userId,
                username: seedUser?.username ?? `user_${userId.substring(0, 8)}`,
                display_name: seedUser?.displayName ?? 'Seed Player',
                total_points: totalPoints,
              },
              { onConflict: 'id' }
            );
          }
        } catch (e: any) {
          console.log('[ScoringBridge] Failed to persist seed score for', userId, ':', e?.message || e);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!raceResults || raceResults.length === 0) return;

    // Determine which races have scorable results (classification data present).
    const resultsWithData = raceResults.filter(
      (r) => r.classification && r.classification.length > 0
    );
    if (resultsWithData.length === 0) return;

    // Find races that are in the past (or marked completed) and have results.
    const today = new Date().toISOString().split('T')[0];
    const scorableRaceIds = new Set(
      races
        .filter((race) => {
          if (race.status === 'completed') return true;
          if (race.status === 'cancelled') return false;
          return race.raceDate <= today;
        })
        .filter((race) => resultsWithData.some((r) => r.raceId === race.id))
        .map((race) => race.id)
    );

    if (scorableRaceIds.size === 0) return;

    // Build a stable scoring identity: sorted race IDs + result count.
    const sortedIds = [...scorableRaceIds].sort().join(',');
    const scoringId = `${resultsWithData.length}:${sortedIds}`;

    if (scoringId === lastScoringId.current) {
      // Already scored this exact result set.
      return;
    }

    lastScoringId.current = scoringId;

    console.log(
      '[ScoringBridge] Race results detected for:',
      sortedIds,
      '— triggering scoring pipeline'
    );

    // ── 1. Score the current user's predictions ──────────────────────────
    //    This MUST complete before any refresh, otherwise refreshPredictions
    //    pulls stale (points_earned=0) rows from Supabase and overwrites the
    //    just-computed scores via mergePredictions.
    let didScoreCurrentUser = false;
    if (predictions.length > 0) {
      const hasUnscoredPredictions = predictions.some((p) => {
        if (p.top10.length === 0) return false;
        if (!scorableRaceIds.has(p.raceId)) return false;
        return true;
      });

      if (hasUnscoredPredictions) {
        console.log('[ScoringBridge] Scoring current user predictions');
        // Use an async IIFE so we can await scoring before deciding to refresh.
        void (async () => {
          await scorePredictions(raceResults);

          // ── 2. Score seed users and persist to Supabase ──────────────────
          const seedScores = new Map<string, number>();
          for (const seedUser of SEED_USERS) {
            const points = scoreSeededPredictions(seedUser.userId, raceResults);
            seedScores.set(seedUser.userId, points);
            console.log(`[ScoringBridge] Seed user ${seedUser.displayName}: ${points} pts`);
          }
          void persistSeedScores(seedScores);

          // ── 3. Do NOT refresh from Supabase here ─────────────────────────
          //    scorePredictions already synced the updated points to Supabase.
          //    Refreshing would risk pulling stale rows that haven't propagated
          //    yet and overwriting the correct local scores via mergePredictions.
        })();
        didScoreCurrentUser = true;
      }
    }

    if (!didScoreCurrentUser) {
      // ── 2. Score seed users and persist to Supabase ──────────────────────
      const seedScores = new Map<string, number>();
      for (const seedUser of SEED_USERS) {
        const points = scoreSeededPredictions(seedUser.userId, raceResults);
        seedScores.set(seedUser.userId, points);
        console.log(`[ScoringBridge] Seed user ${seedUser.displayName}: ${points} pts`);
      }
      void persistSeedScores(seedScores);

      // ── 3. Refresh predictions from Supabase ──────────────────────────────
      //    Safe to refresh here because we didn't score anything locally.
      if (isSupabaseConfigured) {
        void refreshPredictions();
      }
    }
  }, [
    raceResults,
    races,
    predictions.length,
    scorePredictions,
    refreshPredictions,
    persistSeedScores,
    currentSeries,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  return null;
}
