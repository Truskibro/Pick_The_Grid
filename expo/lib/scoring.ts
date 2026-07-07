import {
  Prediction,
  RaceResult,
  ClassificationEntry,
  F1_POINTS,
  SPRINT_POINTS,
  FASTEST_LAP_BONUS,
  DNF_BONUS,
  MOTOGP_RACE_POINTS,
  MOTOGP_SPRINT_POINTS,
  MOTOGP_FASTEST_LAP_BONUS,
  MOTOGP_DNF_BONUS,
} from '@/types';
import { SeriesId, getSeriesConfig } from '@/constants/series';

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

function isDnsStatus(status: string): boolean {
  return (
    status === 'dns' ||
    status === 'did not start' ||
    status === 'did_not_start'
  );
}

function isTrueDnfStatus(status: string): boolean {
  return (
    status === 'dnf' ||
    status === 'retired' ||
    status === 'ret' ||
    status === 'did not finish' ||
    status === 'did_not_finish'
  );
}

/**
 * DNS = Did Not Start.
 * DNS is separate from DNF and should never award DNF prediction points.
 */
function getDnsDriverIds(result: RaceResult): Set<string> {
  const dnsIds = new Set<string>();

  if (Array.isArray(result.dnsDriverIds)) {
    for (const driverId of result.dnsDriverIds) {
      const normalizedDriverId = normalizeDriverId(driverId);

      if (normalizedDriverId) {
        dnsIds.add(normalizedDriverId);
      }
    }
  }

  if (Array.isArray(result.classification)) {
    for (const entry of result.classification) {
      const normalizedDriverId = normalizeDriverId(entry.driverId);
      const status = normalizeStatus(entry.status);

      if (!normalizedDriverId) continue;

      if (isDnsStatus(status)) {
        dnsIds.add(normalizedDriverId);
      }
    }
  }

  return dnsIds;
}

/**
 * Returns only true DNF/retired drivers.
 *
 * Important:
 * - DNF / retired = eligible for DNF bonus.
 * - DNS = did not start, NOT eligible for DNF bonus.
 */
export function getTrueDnfDriverIds(result: RaceResult): Set<string> {
  const trueDnfIds = new Set<string>();
  const dnsIds = getDnsDriverIds(result);

  if (Array.isArray(result.classification)) {
    for (const entry of result.classification) {
      const normalizedDriverId = normalizeDriverId(entry.driverId);
      const status = normalizeStatus(entry.status);

      if (!normalizedDriverId) continue;
      if (dnsIds.has(normalizedDriverId)) continue;

      if (isTrueDnfStatus(status)) {
        trueDnfIds.add(normalizedDriverId);
      }
    }
  }

  /**
   * Backward compatibility:
   * If a race result still has dnfDriverIds, use it, but never count a driver
   * as DNF if the driver is also marked as DNS.
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

/**
 * Calculate points for a race prediction using the scoring rules of the
 * given series. Defaults to F1 if no seriesId is provided (backward compat).
 */
export function calculatePoints(
  prediction: Prediction,
  result: RaceResult,
  seriesId: SeriesId = 'f1',
): ScoringBreakdown {
  const config = getSeriesConfig(seriesId).scoring;
  const racePoints = config.racePoints;
  const flBonus = config.fastestLapBonus;
  const dnfBonus = config.dnfBonus;
  const raceTopN = getSeriesConfig(seriesId).pickLimits.raceTopN;

  let positionPoints = 0;
  const correctPositions: number[] = [];
  const alreadyScoredDrivers = new Set<string>();

  const resultTopN = result.classification
    .filter((entry) => entry.position <= raceTopN)
    .sort((a, b) => a.position - b.position)
    .map((entry) => normalizeDriverId(entry.driverId));

  for (let i = 0; i < prediction.top10.length && i < raceTopN; i++) {
    const predictedDriverId = normalizeDriverId(prediction.top10[i]);
    const actualDriverId = resultTopN[i];

    if (!predictedDriverId) continue;

    if (alreadyScoredDrivers.has(predictedDriverId)) {
      console.log(
        `[Scoring] Duplicate pick ignored at P${i + 1}: ${predictedDriverId}`
      );
      continue;
    }

    alreadyScoredDrivers.add(predictedDriverId);

    if (predictedDriverId === actualDriverId) {
      positionPoints += racePoints[i] ?? 0;
      correctPositions.push(i);

      console.log(
        `[Scoring] Exact match at P${i + 1}: ${predictedDriverId} = +${racePoints[i] ?? 0}`
      );
    }
  }

  let fastestLapPoints = 0;
  const predictedFastestLap = normalizeDriverId(prediction.fastestLap);
  const actualFastestLap = normalizeDriverId(result.fastestLapDriverId);

  if (predictedFastestLap && predictedFastestLap === actualFastestLap) {
    fastestLapPoints = flBonus;

    console.log(
      `[Scoring] Fastest lap correct: ${predictedFastestLap} = +${flBonus}`
    );
  }

  let dnfPoints = 0;
  const predictedDnf = normalizeDriverId(prediction.dnf);
  const actualDnsDriverIds = getDnsDriverIds(result);
  const actualDnfDriverIds = getTrueDnfDriverIds(result);

  if (!predictedDnf && actualDnfDriverIds.size === 0) {
    dnfPoints = dnfBonus;

    console.log(
      `[Scoring] DNF correct: no DNF predicted and none retired = +${dnfBonus}`
    );
  } else if (predictedDnf && actualDnsDriverIds.has(predictedDnf)) {
    console.log(
      `[Scoring] DNF pick was DNS, no DNF points awarded: ${predictedDnf}`
    );
  } else if (predictedDnf && actualDnfDriverIds.has(predictedDnf)) {
    dnfPoints = dnfBonus;

    console.log(`[Scoring] DNF correct: ${predictedDnf} = +${dnfBonus}`);
  } else if (predictedDnf) {
    console.log(
      `[Scoring] DNF incorrect: predicted ${predictedDnf}, true DNFs: ${
        Array.from(actualDnfDriverIds).join(', ') || 'none'
      }, DNS: ${Array.from(actualDnsDriverIds).join(', ') || 'none'}`
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

/**
 * Calculate sprint points using the scoring rules of the given series.
 * Defaults to F1 if no seriesId is provided (backward compat).
 */
export function calculateSprintPoints(
  sprintTop8: string[],
  sprintResult: ClassificationEntry[],
  seriesId: SeriesId = 'f1',
): SprintScoringBreakdown {
  const config = getSeriesConfig(seriesId).scoring;
  const sprintPoints = config.sprintPoints;
  const sprintTopN = getSeriesConfig(seriesId).pickLimits.sprintTopN;

  let positionPoints = 0;
  const correctPositions: number[] = [];
  const alreadyScoredDrivers = new Set<string>();

  const resultTopN = sprintResult
    .filter((entry) => entry.position <= sprintTopN)
    .sort((a, b) => a.position - b.position)
    .map((entry) => normalizeDriverId(entry.driverId));

  for (let i = 0; i < sprintTop8.length && i < sprintTopN; i++) {
    const predictedDriverId = normalizeDriverId(sprintTop8[i]);
    const actualDriverId = resultTopN[i];

    if (!predictedDriverId) continue;

    if (alreadyScoredDrivers.has(predictedDriverId)) {
      console.log(
        `[Sprint Scoring] Duplicate pick ignored at P${i + 1}: ${predictedDriverId}`
      );
      continue;
    }

    alreadyScoredDrivers.add(predictedDriverId);

    if (predictedDriverId === actualDriverId) {
      positionPoints += sprintPoints[i] ?? 0;
      correctPositions.push(i);

      console.log(
        `[Sprint Scoring] Exact match at P${i + 1}: ${predictedDriverId} = +${sprintPoints[i] ?? 0}`
      );
    }
  }

  return {
    positionPoints,
    totalPoints: positionPoints,
    correctPositions,
  };
}
