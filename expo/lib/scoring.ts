import {
  Prediction,
  RaceResult,
  ClassificationEntry,
  F1_POINTS,
  SPRINT_POINTS,
  FASTEST_LAP_BONUS,
  DNF_BONUS,
} from '@/types';

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

function normalizeDriverId(driverId: string | null | undefined): string | null {
  if (!driverId) return null;
  return String(driverId).trim().toUpperCase();
}

function normalizeStatus(status: string | null | undefined): string {
  return String(status || '').trim().toLowerCase();
}

/**
 * Returns only true DNF/retired drivers.
 *
 * Important:
 * - DNF / retired = eligible for DNF bonus.
 * - DNS = did not start, NOT eligible for DNF bonus.
 *
 * This also protects against result data where dnfDriverIds accidentally includes
 * all non-classified drivers, including DNS drivers.
 */
function getTrueDnfDriverIds(result: RaceResult): Set<string> {
  const trueDnfIds = new Set<string>();
  const dnsIds = new Set<string>();

  if (Array.isArray(result.classification)) {
    for (const entry of result.classification) {
      const normalizedDriverId = normalizeDriverId(entry.driverId);
      const status = normalizeStatus(entry.status);

      if (!normalizedDriverId) continue;

      if (status === 'dns' || status === 'did not start') {
        dnsIds.add(normalizedDriverId);
        continue;
      }

      if (
        status === 'dnf' ||
        status === 'retired' ||
        status === 'ret' ||
        status === 'did not finish'
      ) {
        trueDnfIds.add(normalizedDriverId);
      }
    }
  }

  /**
   * Backward compatibility:
   * If the app has a dnfDriverIds array, use it too, but do NOT include any
   * driver that the classification marks as DNS.
   */
  if (Array.isArray(result.dnfDriverIds)) {
    for (const driverId of result.dnfDriverIds) {
      const normalizedDriverId = normalizeDriverId(driverId);

      if (!normalizedDriverId) continue;
      if (dnsIds.has(normalizedDriverId)) continue;

      trueDnfIds.add(normalizedDriverId);
    }
  }

  return trueDnfIds;
}

export function calculatePoints(
  prediction: Prediction,
  result: RaceResult
): ScoringBreakdown {
  let positionPoints = 0;
  const correctPositions: number[] = [];
  const alreadyScoredDrivers = new Set<string>();

  const resultTop10 = result.classification
    .filter((c) => c.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map((c) => normalizeDriverId(c.driverId));

  for (let i = 0; i < prediction.top10.length && i < 10; i++) {
    const predictedDriverId = normalizeDriverId(prediction.top10[i]);
    const actualDriverId = resultTop10[i];

    if (!predictedDriverId) continue;

    if (alreadyScoredDrivers.has(predictedDriverId)) {
      console.log(
        `[Scoring] Duplicate pick ignored at P${i + 1}: ${predictedDriverId}`
      );
      continue;
    }

    alreadyScoredDrivers.add(predictedDriverId);

    if (predictedDriverId === actualDriverId) {
      positionPoints += F1_POINTS[i];
      correctPositions.push(i);

      console.log(
        `[Scoring] Exact match at P${i + 1}: ${predictedDriverId} = +${F1_POINTS[i]}`
      );
    }
  }

  let fastestLapPoints = 0;
  const predictedFastestLap = normalizeDriverId(prediction.fastestLap);
  const actualFastestLap = normalizeDriverId(result.fastestLapDriverId);

  if (predictedFastestLap && predictedFastestLap === actualFastestLap) {
    fastestLapPoints = FASTEST_LAP_BONUS;

    console.log(
      `[Scoring] Fastest lap correct: ${predictedFastestLap} = +${FASTEST_LAP_BONUS}`
    );
  }

  let dnfPoints = 0;
  const predictedDnf = normalizeDriverId(prediction.dnf);
  const actualDnfDriverIds = getTrueDnfDriverIds(result);

  if (predictedDnf && actualDnfDriverIds.has(predictedDnf)) {
    dnfPoints = DNF_BONUS;

    console.log(`[Scoring] DNF correct: ${predictedDnf} = +${DNF_BONUS}`);
  } else if (predictedDnf) {
    console.log(
      `[Scoring] DNF incorrect: predicted ${predictedDnf}, true DNFs: ${
        Array.from(actualDnfDriverIds).join(', ') || 'none'
      }`
    );
  }

  const totalPoints = positionPoints + fastestLapPoints + dnfPoints;

  console.log(
    `[Scoring] Total: ${totalPoints} (pos: ${positionPoints}, fl: ${fastestLapPoints}, dnf: ${dnfPoints})`
  );

  return {
    positionPoints,
    fastestLapPoints,
    dnfPoints,
    totalPoints,
    correctPositions,
  };
}

export function calculateSprintPoints(
  sprintTop8: string[],
  sprintResult: ClassificationEntry[]
): SprintScoringBreakdown {
  let positionPoints = 0;
  const correctPositions: number[] = [];
  const alreadyScoredDrivers = new Set<string>();

  const resultTop8 = sprintResult
    .filter((c) => c.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map((c) => normalizeDriverId(c.driverId));

  for (let i = 0; i < sprintTop8.length && i < 8; i++) {
    const predictedDriverId = normalizeDriverId(sprintTop8[i]);
    const actualDriverId = resultTop8[i];

    if (!predictedDriverId) continue;

    if (alreadyScoredDrivers.has(predictedDriverId)) {
      console.log(
        `[Sprint Scoring] Duplicate pick ignored at P${i + 1}: ${predictedDriverId}`
      );
      continue;
    }

    alreadyScoredDrivers.add(predictedDriverId);

    if (predictedDriverId === actualDriverId) {
      positionPoints += SPRINT_POINTS[i];
      correctPositions.push(i);

      console.log(
        `[Sprint Scoring] Exact match at P${i + 1}: ${predictedDriverId} = +${SPRINT_POINTS[i]}`
      );
    }
  }

  return {
    positionPoints,
    totalPoints: positionPoints,
    correctPositions,
  };
}