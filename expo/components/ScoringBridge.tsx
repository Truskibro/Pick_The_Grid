import { useEffect, useRef } from 'react';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';
import { isLocked } from '@/components/CountdownTimer';

export default function ScoringBridge() {
  const { raceResults, races } = useF1Data();
  const { scorePredictions, predictions } = useGame();

  // Track which race IDs have already been scored so we don't double-score.
  const scoredRaceIds = useRef<Set<string>>(new Set());

  // Build sets for quick lookup.
  const completedRaceIds = new Set(
    races.filter((r) => r.status === 'completed').map((r) => r.id)
  );

  const resultRaceIds = new Set(raceResults.map((r) => r.raceId));

  useEffect(() => {
    if (!raceResults || raceResults.length === 0) return;
    if (predictions.length === 0) return;

    // Find predictions that need scoring:
    // 1. Race is completed
    // 2. Race has results available
    // 3. Prediction hasn't been scored yet (pointsEarned === 0)
    // 4. We haven't already scored this race+result combination
    const needsScoring = predictions.filter((p) => {
      if (p.top10.length === 0) return false;

      // Only score for races that are officially completed.
      if (!completedRaceIds.has(p.raceId)) return false;

      // Only score if results exist for this race.
      if (!resultRaceIds.has(p.raceId)) return false;

      // Skip if already scored with non-zero points.
      if (p.pointsEarned !== 0 || p.sprintPointsEarned !== 0) return false;

      // Skip if we already attempted to score this exact race+results combo.
      const scoreKey = `${p.raceId}`;
      if (scoredRaceIds.current.has(scoreKey)) return false;

      return true;
    });

    if (needsScoring.length === 0) return;

    // Mark these races as scored so we don't re-score on re-render.
    for (const p of needsScoring) {
      scoredRaceIds.current.add(p.raceId);
    }

    console.log(
      '[ScoringBridge] Found',
      needsScoring.length,
      'unscored predictions for completed races:',
      needsScoring.map((p) => p.raceId).join(', '),
      '— triggering scoring...'
    );

    void scorePredictions(raceResults);
  }, [raceResults, predictions, scorePredictions, completedRaceIds.size, resultRaceIds.size]);

  return null;
}
