import { useEffect, useRef } from 'react';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';

/**
 * Monitors race statuses and race results, automatically triggering scoring
 * whenever a race completes and results are available.
 *
 * Uses a scored-race-IDs ref instead of fragile pointsEarned checks so that
 * no legitimate scoring event is ever skipped.
 */
export default function ScoringBridge() {
  const { raceResults, races } = useF1Data();
  const { scorePredictions, predictions } = useGame();

  // Track which (raceId × predictionsLength) combo we last scored.
  // The scoring identity changes when either the predictions list grows/changes
  // or when a new race's results become available.
  const lastScoringId = useRef<string>('');

  // Build lookup sets once per render.
  const completedRaceIds = new Set(
    races.filter((r) => r.status === 'completed').map((r) => r.id)
  );

  const resultRaceIds = new Set(raceResults.map((r) => r.raceId));

  useEffect(() => {
    if (!raceResults || raceResults.length === 0) return;
    if (predictions.length === 0) return;

    // Find predictions for completed races that have results available.
    const candidates = predictions.filter((p) => {
      if (p.top10.length === 0) return false;
      if (!completedRaceIds.has(p.raceId)) return false;
      if (!resultRaceIds.has(p.raceId)) return false;
      return true;
    });

    if (candidates.length === 0) return;

    // Build a stable scoring identity: concatenate sorted candidate race IDs
    // plus the predictions length. When this changes, scoring must re-run.
    const candidateRaceIds = [...new Set(candidates.map((p) => p.raceId))].sort().join(',');
    const scoringId = `${predictions.length}:${candidateRaceIds}`;

    if (scoringId === lastScoringId.current) {
      // Already scored this exact set — nothing changed.
      return;
    }

    lastScoringId.current = scoringId;

    console.log(
      '[ScoringBridge] Race(s) completed — scoring',
      candidates.length,
      'predictions for:',
      candidateRaceIds,
    );

    void scorePredictions(raceResults);
  }, [raceResults, predictions, scorePredictions, completedRaceIds.size, resultRaceIds.size]);

  return null;
}
