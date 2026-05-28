import { Prediction, RaceResult, ClassificationEntry, F1_POINTS, SPRINT_POINTS, FASTEST_LAP_BONUS, DNF_BONUS } from '@/types';

export interface ScoringBreakdown {
  positionPoints: number;
  fastestLapPoints: number;
  dnfPoints: number;
  totalPoints: number;
  correctPositions: number[];
}

export interface SprintScoringBreakdown {
  positionPoints: number;
  totalPoints: number;
  correctPositions: number[];
}

export function calculatePoints(
  prediction: Prediction,
  result: RaceResult
): ScoringBreakdown {
  let positionPoints = 0;
  const correctPositions: number[] = [];

  const resultTop10 = result.classification
    .filter(c => c.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map(c => c.driverId);

  for (let i = 0; i < prediction.top10.length && i < 10; i++) {
    const predictedDriverId = prediction.top10[i];
    const actualIndex = resultTop10.indexOf(predictedDriverId);

    if (actualIndex === i) {
      positionPoints += F1_POINTS[i];
      correctPositions.push(i);
      console.log(`[Scoring] Exact match at P${i + 1}: ${predictedDriverId} = +${F1_POINTS[i]}`);
    } else if (actualIndex !== -1 && Math.abs(actualIndex - i) === 1) {
      const partialPoints = Math.floor(F1_POINTS[i] * 0.5);
      positionPoints += partialPoints;
      console.log(`[Scoring] Off-by-one at P${i + 1}: predicted ${predictedDriverId}, actual P${actualIndex + 1} = +${partialPoints}`);
    } else if (actualIndex !== -1) {
      const partialPoints = Math.floor(F1_POINTS[i] * 0.25);
      positionPoints += partialPoints;
      console.log(`[Scoring] In top 10 at P${i + 1}: predicted ${predictedDriverId}, actual P${actualIndex + 1} = +${partialPoints}`);
    }
  }

  let fastestLapPoints = 0;
  if (prediction.fastestLap && prediction.fastestLap === result.fastestLapDriverId) {
    fastestLapPoints = FASTEST_LAP_BONUS;
    console.log(`[Scoring] Fastest lap correct: ${prediction.fastestLap} = +${FASTEST_LAP_BONUS}`);
  }

  let dnfPoints = 0;
  if (prediction.dnf && result.dnfDriverIds.includes(prediction.dnf)) {
    dnfPoints = DNF_BONUS;
    console.log(`[Scoring] DNF correct: ${prediction.dnf} = +${DNF_BONUS}`);
  }

  const totalPoints = positionPoints + fastestLapPoints + dnfPoints;
  console.log(`[Scoring] Total: ${totalPoints} (pos: ${positionPoints}, fl: ${fastestLapPoints}, dnf: ${dnfPoints})`);

  return {
    positionPoints,
    fastestLapPoints,
    dnfPoints,
    totalPoints,
    correctPositions,
  };
}

/**
 * Score a sprint race prediction against actual results.
 * Sprint grid is top 8 only; scoring is exact-position only.
 */
export function calculateSprintPoints(
  sprintTop8: string[],
  sprintResult: ClassificationEntry[]
): SprintScoringBreakdown {
  let positionPoints = 0;
  const correctPositions: number[] = [];

  const resultTop8 = sprintResult
    .filter(c => c.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map(c => c.driverId);

  for (let i = 0; i < sprintTop8.length && i < 8; i++) {
    const predictedDriverId = sprintTop8[i];
    const actualIndex = resultTop8.indexOf(predictedDriverId);

    if (actualIndex === i) {
      positionPoints += SPRINT_POINTS[i];
      correctPositions.push(i);
    } else if (actualIndex !== -1 && Math.abs(actualIndex - i) === 1) {
      positionPoints += Math.floor(SPRINT_POINTS[i] * 0.5);
    } else if (actualIndex !== -1) {
      positionPoints += Math.floor(SPRINT_POINTS[i] * 0.25);
    }
  }

  return {
    positionPoints,
    totalPoints: positionPoints,
    correctPositions,
  };
}
