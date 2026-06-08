import { useEffect, useRef } from 'react';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';
import { isLocked } from '@/components/CountdownTimer';

export default function ScoringBridge() {
  const { raceResults, races } = useF1Data();
  const { scorePredictions, predictions } = useGame();

  // Track the last-scored predictions length so we re-score whenever
  // predictions change (e.g. after a Supabase load overwrites local data).
  const lastScoredLen = useRef<number>(0);

  // Build sets for quick lookup.
  const completedRaceIds = new Set(
    races.filter((r) => r.status === 'completed').map((r) => r.id)
  );

  const resultRaceIds = new Set(raceResults.map((r) => r.raceId));

  useEffect(() => {
    if (!raceResults || raceResults.length === 0) return;
    if (predictions.length === 0) return;

    // Find predictions for completed races that have results.
    // Always re-score — never trust stored pointsEarned from Supabase.
    // The scorePredictions function itself skips predictions whose points
    // haven't changed, so this is cheap when nothing has changed.
    const candidates = predictions.filter((p) => {
      if (p.top10.length === 0) return false;
      if (!completedRaceIds.has(p.raceId)) return false;
      if (!resultRaceIds.has(p.raceId)) return false;
      return true;
    });

    if (candidates.length === 0) return;

    // Only run scoring when the prediction list actually changed
    // (new predictions loaded, stored pointsEarned overwritten, etc.)
    if (predictions.length === lastScoredLen.current) {
      // Same length — check if any prediction's pointsEarned differs from
      // what we'd compute. But rather than duplicating scoring logic here,
      // only skip if no prediction has zero points (all already scored).
      const allAlreadyScored = predictions
        .filter((p) => completedRaceIds.has(p.raceId) && p.top10.length > 0)
        .every((p) => p.pointsEarned !== 0 || p.sprintPointsEarned !== 0);

      if (allAlreadyScored) return;
    }

    lastScoredLen.current = predictions.length;

    console.log(
      '[ScoringBridge] Scoring',
      candidates.length,
      'completed-race predictions:',
      candidates.map((p) => p.raceId).join(', '),
    );

    void scorePredictions(raceResults);
  }, [raceResults, predictions, scorePredictions, completedRaceIds.size, resultRaceIds.size]);

  return null;
}
