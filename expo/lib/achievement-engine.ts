/**
 * Achievement evaluation engine.
 *
 * Evaluates all achievement definitions against the current user state
 * and returns newly unlocked tiers.  Scoring data is currently mockable;
 * TODO comments mark where real Supabase / GameProvider data should be wired.
 */

import {
  AchievementDefinition,
  AchievementProgress,
  AchievementTier,
  TIER_ORDER,
  ALL_ACHIEVEMENTS,
  createEmptyProgress,
  type AchievementState,
} from '@/constants/achievements';
import type { Prediction, RaceResult, LeagueMember } from '@/types';

/* ------------------------------------------------------------------ */
/*  Input shape — the data the engine needs to evaluate achievements   */
/* ------------------------------------------------------------------ */

export interface AchievementInput {
  /** All predictions the user has made (current + previous races). */
  predictions: Prediction[];
  /** Race results keyed by raceId. */
  raceResults: Record<string, RaceResult>;
  /** The user's current total points. */
  totalPoints: number;
  /** The user's league memberships (for league-rank achievements). */
  leagueMemberships: { leagueId: string; rank: number; seasonRank?: number }[];
  /** Per-race edit counts (for Ferrari Strategy Dept., Box Box Box). */
  editCounts: Record<string, { count: number; lastEditAt: string }>;
  /** Per-race lock times (ISO strings) for Box Box Box. */
  lockTimes: Record<string, string>;
  /** Per-race league placements (leagueId:raceId -> rank). Lower = better. */
  raceWeekRanks?: Record<string, number>;
  /** Whether the season has concluded (gates season-end achievements). */
  isSeasonComplete?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Evaluation helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Evaluate a single achievement against current state.
 * Returns the highest tier index (0-3) unlocked and the current numeric value.
 * For hidden achievements, returns { tier: 0|1, value }.
 */
export function evaluateAchievement(
  def: AchievementDefinition,
  input: AchievementInput,
  existing: AchievementProgress | undefined,
): { unlockedTiers: AchievementTier[]; currentValue: number } {
  const progress = existing ?? createEmptyProgress(def.id);
  const currentValue = computeValue(def, input);
  const unlockedTiers = computeUnlockedTiers(def, currentValue, progress.unlockedTiers);

  return { unlockedTiers, currentValue };
}

function computeValue(def: AchievementDefinition, input: AchievementInput): number {
  switch (def.unlockConditionKey) {
    /* --- Race-based --- */
    case 'single_race_points':
      return maxRacePoints(input.predictions);

    case 'podium_accuracy':
      return maxPodiumAccuracy(input.predictions, input.raceResults);

    case 'exact_positions_single_race':
      return maxExactPositions(input.predictions, input.raceResults);

    case 'weekend_total_points':
      return maxWeekendPoints(input.predictions);

    case 'chaos_events':
      return maxChaosLevel(input.predictions, input.raceResults);

    case 'perfect_weekend':
      return maxPerfectWeekendLevel(input.predictions, input.raceResults);

    case 'comeback_improvement':
      // Cap at the highest non-platinum threshold. The platinum tier in the
      // definition (100) requires a 100+ point race-over-race improvement,
      // which is achievable but should never be triggered by a 0 → 100 first
      // race (no previous race to compare against).
      return Math.min(maxComebackImprovement(input.predictions), 100);

    /* --- Season-based --- */
    case 'season_total_points':
      return input.totalPoints;

    case 'correct_winners_count':
      return countCorrectWinners(input.predictions, input.raceResults);

    /* --- League-based --- */
    case 'league_race_week_rank':
      return bestRaceWeekRank(input.raceWeekRanks, input.leagueMemberships);

    case 'league_season_rank':
      // Season-rank achievements only evaluate once the season is officially over.
      // Without this guard, mid-season standings would prematurely unlock tiers.
      if (!input.isSeasonComplete) return 999;
      return bestLeagueSeasonRank(input.leagueMemberships);

    /* --- Hidden --- */
    case 'last_minute_edit':
      return hasLastMinuteEdit(input.editCounts, input.lockTimes) ? 1 : 0;

    case 'no_edits_full_grid':
      return hasNoEditsFullGrid(input.predictions, input.editCounts) ? 1 : 0;

    case 'full_grid_zero_points':
      return hasFullGridZeroPoints(input.predictions, input.raceResults) ? 1 : 0;

    case 'predicted_winner_dnf':
      return hasPredictedWinnerDNF(input.predictions, input.raceResults) ? 1 : 0;

    case 'correct_podium_wrong_order':
      return hasCorrectPodiumWrongOrder(input.predictions, input.raceResults) ? 1 : 0;

    case 'many_edits':
      return hasManyEdits(input.editCounts) ? 1 : 0;

    case 'chaos_merchant':
      return hasChaosMerchant(input.predictions, input.raceResults) ? 1 : 0;

    default:
      return 0;
  }
}

function computeUnlockedTiers(
  def: AchievementDefinition,
  currentValue: number,
  alreadyUnlocked: AchievementTier[],
): AchievementTier[] {
  if (!def.tiers) {
    // Hidden achievement — binary unlock
    return currentValue >= 1 ? ['bronze' as AchievementTier] : [];
  }

  const unlocked = new Set(alreadyUnlocked);
  for (const tierDef of def.tiers) {
    if (currentValue >= tierDef.value) {
      unlocked.add(tierDef.tier);
    }
  }
  return TIER_ORDER.filter((t) => unlocked.has(t));
}

/* ------------------------------------------------------------------ */
/*  Specific value computers                                           */
/* ------------------------------------------------------------------ */

function maxRacePoints(predictions: Prediction[]): number {
  return predictions.reduce((max, p) => {
    const pts = (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0);
    return pts > max ? pts : max;
  }, 0);
}

function maxPodiumAccuracy(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): number {
  let best = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;

    const resultPodium = result.classification
      .filter((c) => c.position <= 3)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.driverId);

    const predPodium = pred.top10.slice(0, 3);
    if (predPodium.length < 3) continue;

    // Check exact match (platinum level)
    const exactMatch =
      predPodium[0] === resultPodium[0] &&
      predPodium[1] === resultPodium[1] &&
      predPodium[2] === resultPodium[2];

    // Check all 3 in any order (gold level)
    const allThreeAnyOrder =
      predPodium.every((d) => resultPodium.includes(d)) &&
      resultPodium.every((d) => predPodium.includes(d));

    // Count correct position matches
    let correctPositions = 0;
    for (let i = 0; i < 3; i++) {
      if (predPodium[i] === resultPodium[i]) correctPositions++;
    }

    const level = exactMatch ? 4 : allThreeAnyOrder ? 3 : correctPositions;
    if (level > best) best = level;
  }
  return best;
}

function maxExactPositions(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): number {
  let best = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;

    const resultTop10 = result.classification
      .filter((c) => c.position <= 10)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.driverId);

    let exact = 0;
    for (let i = 0; i < Math.min(pred.top10.length, resultTop10.length); i++) {
      if (pred.top10[i] === resultTop10[i]) exact++;
    }
    if (exact > best) best = exact;
  }
  return best;
}

function maxWeekendPoints(predictions: Prediction[]): number {
  // TODO: Group predictions by weekend (raceId prefix) when real weekend data exists.
  // For now, each race is treated as its own weekend.
  return maxRacePoints(predictions);
}

function maxChaosLevel(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): number {
  let bestLevel = 0;

  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;

    const flCorrect = !!pred.fastestLap && pred.fastestLap === result.fastestLapDriverId;
    const dnfCorrect = !!pred.dnf && result.dnfDriverIds.includes(pred.dnf);
    const winnerCorrect =
      pred.top10.length > 0 &&
      result.classification.some(
        (c) => c.position === 1 && c.driverId === pred.top10[0],
      );

    // Level tracking across races
    const hasEverFL = predictions.some((p) => {
      const r = raceResults[p.raceId];
      return r && !!p.fastestLap && p.fastestLap === r.fastestLapDriverId;
    });
    const hasEverDNF = predictions.some((p) => {
      const r = raceResults[p.raceId];
      return r && !!p.dnf && r.dnfDriverIds.includes(p.dnf);
    });

    if (flCorrect || dnfCorrect) bestLevel = Math.max(bestLevel, 1); // Bronze
    if (hasEverFL && hasEverDNF) bestLevel = Math.max(bestLevel, 2); // Silver
    if (flCorrect && dnfCorrect) bestLevel = Math.max(bestLevel, 3); // Gold
    if (winnerCorrect && flCorrect && dnfCorrect) bestLevel = Math.max(bestLevel, 4); // Platinum
  }

  return bestLevel;
}

function maxPerfectWeekendLevel(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): number {
  let best = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;

    const winnerCorrect =
      pred.top10.length > 0 &&
      result.classification.some(
        (c) => c.position === 1 && c.driverId === pred.top10[0],
      );
    const racePts = (pred.pointsEarned ?? 0) + (pred.sprintPointsEarned ?? 0);

    const resultPodium = result.classification
      .filter((c) => c.position <= 3)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.driverId);
    const predPodium = pred.top10.slice(0, 3);
    const allThreeAnyOrder =
      predPodium.length >= 3 &&
      predPodium.every((d) => resultPodium.includes(d)) &&
      resultPodium.every((d) => predPodium.includes(d));
    const exactPodium =
      allThreeAnyOrder &&
      predPodium[0] === resultPodium[0] &&
      predPodium[1] === resultPodium[1] &&
      predPodium[2] === resultPodium[2];
    const flOrDnf =
      (!!pred.fastestLap && pred.fastestLap === result.fastestLapDriverId) ||
      (!!pred.dnf && result.dnfDriverIds.includes(pred.dnf));

    if (winnerCorrect && exactPodium && flOrDnf) best = Math.max(best, 4);
    else if (winnerCorrect && exactPodium) best = Math.max(best, 3);
    else if (winnerCorrect && allThreeAnyOrder) best = Math.max(best, 2);
    else if (winnerCorrect && racePts >= 50) best = Math.max(best, 1);
  }
  return best;
}

function maxComebackImprovement(predictions: Prediction[]): number {
  // Only consider races that actually have a result — without a result,
  // pointsEarned is 0 by default and would fabricate a 0 → big swing.
  const scored = predictions.filter(
    (p) => (p.pointsEarned ?? 0) > 0 || (p.sprintPointsEarned ?? 0) > 0,
  );
  // Sort by updatedAt to establish chronological order of race weekends.
  const sorted = [...scored].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
  );
  let best = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevPts =
      (sorted[i - 1].pointsEarned ?? 0) + (sorted[i - 1].sprintPointsEarned ?? 0);
    const currPts =
      (sorted[i].pointsEarned ?? 0) + (sorted[i].sprintPointsEarned ?? 0);
    const improvement = currPts - prevPts;
    if (improvement > best) best = improvement;
  }
  return best;
}

function countCorrectWinners(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): number {
  let count = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;
    if (
      pred.top10.length > 0 &&
      result.classification.some(
        (c) => c.position === 1 && c.driverId === pred.top10[0],
      )
    ) {
      count++;
    }
  }
  return count;
}

function bestRaceWeekRank(
  raceWeekRanks: Record<string, number> | undefined,
  memberships: AchievementInput['leagueMemberships'],
): number {
  // Prefer real per-race league placements when provided.
  if (raceWeekRanks && Object.keys(raceWeekRanks).length > 0) {
    const ranks = Object.values(raceWeekRanks).filter((r) => typeof r === 'number' && r > 0);
    if (ranks.length > 0) return Math.min(...ranks);
  }
  // Without per-race data we cannot legitimately claim a "race week" placement.
  // Fall back to a sentinel that satisfies no tier (lowest tier requires top 5).
  if (memberships.length === 0) return 999;
  // Note: overall league rank is NOT a valid proxy for a single race week,
  // so we deliberately do NOT use it here.
  return 999;
}

function bestLeagueSeasonRank(
  memberships: AchievementInput['leagueMemberships'],
): number {
  if (memberships.length === 0) return 999;
  const seasonRanks = memberships
    .map((m) => m.seasonRank)
    .filter((r): r is number => r != null);
  if (seasonRanks.length === 0) return 999;
  return Math.min(...seasonRanks);
}

/* --- Hidden achievements --- */

function hasLastMinuteEdit(
  editCounts: Record<string, { count: number; lastEditAt: string }>,
  lockTimes: Record<string, string>,
): boolean {
  for (const [raceId, meta] of Object.entries(editCounts)) {
    const lockTime = lockTimes[raceId];
    if (!lockTime) continue;
    const lastEdit = new Date(meta.lastEditAt).getTime();
    const lock = new Date(lockTime).getTime();
    const diffSec = (lock - lastEdit) / 1000;
    if (diffSec <= 60 && diffSec >= 0) return true;
  }
  return false;
}

function hasNoEditsFullGrid(
  predictions: Prediction[],
  editCounts: Record<string, { count: number; lastEditAt: string }>,
): boolean {
  for (const pred of predictions) {
    if (pred.top10.length < 10) continue;
    const meta = editCounts[pred.raceId];
    // If no edits recorded at all OR count is 1 (initial submit only)
    if (!meta || meta.count <= 1) return true;
  }
  return false;
}

function hasFullGridZeroPoints(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): boolean {
  for (const pred of predictions) {
    if (pred.top10.length < 10) continue;
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;
    const totalPts = (pred.pointsEarned ?? 0) + (pred.sprintPointsEarned ?? 0);
    if (totalPts === 0) return true;
  }
  return false;
}

function hasPredictedWinnerDNF(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): boolean {
  for (const pred of predictions) {
    if (pred.top10.length === 0) continue;
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;
    const predictedWinner = pred.top10[0];
    // Check if predicted winner is in DNF list
    if (result.dnfDriverIds.includes(predictedWinner)) return true;
    // Also check classification for 'retired' or 'dnf' status
    const entry = result.classification.find((c) => c.driverId === predictedWinner);
    if (entry && (entry.status === 'retired' || entry.status === 'dnf')) return true;
  }
  return false;
}

function hasCorrectPodiumWrongOrder(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): boolean {
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;

    const resultPodium = result.classification
      .filter((c) => c.position <= 3)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.driverId);

    const predPodium = pred.top10.slice(0, 3);
    if (predPodium.length < 3) continue;

    const allThreeAnyOrder =
      predPodium.every((d) => resultPodium.includes(d)) &&
      resultPodium.every((d) => predPodium.includes(d));

    const exactMatch =
      predPodium[0] === resultPodium[0] &&
      predPodium[1] === resultPodium[1] &&
      predPodium[2] === resultPodium[2];

    // All correct drivers but wrong order
    if (allThreeAnyOrder && !exactMatch) return true;
  }
  return false;
}

function hasManyEdits(
  editCounts: Record<string, { count: number; lastEditAt: string }>,
): boolean {
  return Object.values(editCounts).some((m) => m.count >= 5);
}

function hasChaosMerchant(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): boolean {
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;
    const flCorrect = !!pred.fastestLap && pred.fastestLap === result.fastestLapDriverId;
    const dnfCorrect = !!pred.dnf && result.dnfDriverIds.includes(pred.dnf);
    if (flCorrect && dnfCorrect) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Batch evaluation — run all achievements and return newly unlocked  */
/* ------------------------------------------------------------------ */

export interface EvaluationResult {
  state: AchievementState;
  newlyUnlocked: { achievementId: string; tier: AchievementTier; def: AchievementDefinition }[];
}

export function evaluateAll(
  input: AchievementInput,
  existingState: AchievementState,
): EvaluationResult {
  const state: AchievementState = { ...existingState };
  const newlyUnlocked: EvaluationResult['newlyUnlocked'] = [];

  for (const def of ALL_ACHIEVEMENTS) {
    const existing = existingState[def.id];
    const { unlockedTiers, currentValue } = evaluateAchievement(def, input, existing);

    // Determine newly unlocked tiers
    const prevUnlocked = new Set(existing?.unlockedTiers ?? []);
    for (const tier of unlockedTiers) {
      if (!prevUnlocked.has(tier)) {
        newlyUnlocked.push({ achievementId: def.id, tier, def });
      }
    }

    state[def.id] = {
      achievementId: def.id,
      unlockedTiers,
      currentValue,
      unlockedAt: {
        ...(existing?.unlockedAt ?? {}),
        ...Object.fromEntries(
          unlockedTiers
            .filter((t) => !prevUnlocked.has(t))
            .map((t) => [t, new Date().toISOString()]),
        ),
      },
    };
  }

  return { state, newlyUnlocked };
}

/**
 * Build a minimal mock input for testing / guest mode.
 * TODO: Replace with real data from GameProvider + F1DataProvider.
 */
export function buildMockInput(overrides: Partial<AchievementInput> = {}): AchievementInput {
  return {
    predictions: [],
    raceResults: {},
    totalPoints: 0,
    leagueMemberships: [],
    editCounts: {},
    lockTimes: {},
    raceWeekRanks: {},
    isSeasonComplete: false,
    ...overrides,
  };
}
