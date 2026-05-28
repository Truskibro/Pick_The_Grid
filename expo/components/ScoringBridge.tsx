import { useEffect, useRef } from 'react';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';

export default function ScoringBridge() {
  const { raceResults } = useF1Data();
  const { scorePredictions, predictions } = useGame();
  const lastScoredRef = useRef<string>('');

  useEffect(() => {
    if (!raceResults || raceResults.length === 0) return;
    if (predictions.length === 0) return;

    const unscoredPreds = predictions.filter(
      p => p.pointsEarned === 0 && p.top10.length > 0
    );
    if (unscoredPreds.length === 0) return;

    const key = unscoredPreds.map(p => p.raceId).sort().join(',') + '_' + raceResults.length;
    if (key === lastScoredRef.current) return;
    lastScoredRef.current = key;

    console.log('[ScoringBridge] Found', unscoredPreds.length, 'unscored predictions and', raceResults.length, 'race results, triggering scoring...');
    void scorePredictions(raceResults);
  }, [raceResults, predictions, scorePredictions]);

  return null;
}
