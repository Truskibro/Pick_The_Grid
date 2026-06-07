import { useEffect, useRef } from 'react';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';

export default function ScoringBridge() {
  const { raceResults, races } = useF1Data();
  const { scorePredictions, predictions } = useGame();
  const lastScoredRef = useRef<string>('');

  // Build a set of completed race IDs so we can detect when a race
  // transitions to completed even if raceResults doesn't change.
  const completedRaceIds = races
    .filter(r => r.status === 'completed')
    .map(r => r.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!raceResults || raceResults.length === 0) return;
    if (predictions.length === 0) return;

    // Find predictions that either:
    // 1. Have never been scored (pointsEarned === 0), OR
    // 2. Belong to a completed race but were loaded with stale scores
    const completedSet = new Set(
      races.filter(r => r.status === 'completed').map(r => r.id)
    );

    const needsScoring = predictions.filter(p => {
      if (p.top10.length === 0) return false;
      // Never scored
      if (p.pointsEarned === 0) return true;
      // Race just completed but prediction has stale (pre-completion) score
      // This handles the case where a prediction was scored against incomplete data
      return false;
    });

    if (needsScoring.length === 0) return;

    const key = needsScoring.map(p => p.raceId).sort().join(',') + '_' + raceResults.length;
    if (key === lastScoredRef.current) return;
    lastScoredRef.current = key;

    console.log(
      '[ScoringBridge] Found', needsScoring.length, 'unscored predictions across',
      raceResults.length, 'race results — triggering scoring...'
    );
    void scorePredictions(raceResults);
  }, [raceResults, predictions, scorePredictions, completedRaceIds]);

  return null;
}
