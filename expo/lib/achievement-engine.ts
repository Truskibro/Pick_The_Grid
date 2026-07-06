/**
 * Achievement evaluation engine.
 *
 * Evaluates all achievement definitions against the current user state and
 * returns newly unlocked tiers (and, for season-based achievements, newly
 * earned per-season instances). Platinum tiers are evaluated internally but
 * the display layer is responsible for hiding them until unlocked.
 *
 * Season-based repeatable achievements keep a per-season instance. Earning a
 * new season never overwrites a previous season's instance — previous seasons
 * are frozen in `seasonInstances` and only the current season's flat fields
 * are mutated.
 */

import {
  AchievementDefinition,
  AchievementProgress,
  AchievementTier,
  TIER_ORDER,
  ALL_ACHIEVEMENTS,
  createEmptyProgress,
  type AchievementState,
  type SeasonInstance,
} from '@/constants/achievements';
import type { Prediction, RaceResult, Race } from '@/types';

/* ------------------------------------------------------------------ */
/*  Input shape — the data the engine needs to evaluate achievements   */
/* ------------------------------------------------------------------ */

export interface LeagueMembership {
  leagueId: string;
  rank: number;
  seasonRank?: number;
  /** Total active members in the league (for comeback-drive eligibility). */
  memberCount?: number;
}

export interface RaceWeekRankEntry {
  leagueId: string;
  raceId: string;
  rank: number;
  /** The user's league rank immediately before this race weekend (lower = better). */
  preWeekendRank?: number;
  /** Total active members in the league (for comeback eligibility). */
  memberCount?: number;
}

export interface AchievementInput {
  /** All predictions the user has made (current + previous races). */
  predictions: Prediction[];
  /** Race results keyed by raceId. */
  raceResults: Record<string, RaceResult>;
  /** Races keyed by raceId (used to detect sprint weekends & season). */
  racesById: Record<string, Race>;
  /** The user's current total points (race + sprint, all-time). */
  totalPoints: number;
  /** The user's league memberships. */
  leagueMemberships: LeagueMembership[];
  /** Per-race edit counts (for Ferrari Strategy Dept., Box Box Box). */
  editCounts: Record<string, { count: number; lastEditAt: string }>;
  /** Per-race lock times (ISO strings) for Box Box Box. */
  lockTimes: Record<string, string>;
  /** Per-race league placements + pre-weekend rank for comeback tracking. */
  raceWeekRanks?: RaceWeekRankEntry[];
  /** Global leaderboard entries for season-end achievements. */
  globalLeaderboard?: { userId: string; totalPoints: number }[];
  /** Current season label, e.g. "2026". Derived from race dates when available. */
  currentSeason?: string;
  /** Whether the season has concluded (gates season-end achievements). */
  isSeasonComplete?: boolean;
  /** The user's id (for leaderboard lookups). */
  userId?: string;
}

/* ------------------------------------------------------------------ */
/*  Evaluation helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Evaluate a single achievement against current state.
 * Returns the highest tier set unlocked and the current numeric value.
 * For hidden/special achievements, returns a binary unlock via bronze tier.
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
    case 'race_day_points':
      return maxRaceDayPoints(input.predictions);

    case 'podium_accuracy':
      return maxPodiumAccuracy(input.predictions, input.raceResults);

    case 'exact_positions_single_race':
      return maxExactPositions(input.predictions, input.raceResults);

    case 'weekend_total_points':
      return maxWeekendPoints(input.predictions);

    case 'perfect_weekend':
      return maxPerfectWeekendLevel(input.predictions, input.raceResults, input.racesById);

    case 'sprint_points_single':
      return maxSprintPoints(input.predictions);

    case 'sprint_exact_positions':
      return maxSprintExactPositions(input.predictions, input.raceResults);

    /* --- Season-based --- */
    case 'season_total_points':
      return input.totalPoints;

    case 'correct_winners_count':
      return countCorrectWinnersForSeason(input.predictions, input.raceResults, input.racesById, input.currentSeason);

    case 'season_bonus_picks':
      return countSeasonBonusPicks(input.predictions, input.raceResults, input.racesById, input.currentSeason);

    /* --- League-based --- */
    case 'comeback_gain':
      return maxComebackGain(input.raceWeekRanks);

    /* --- Season global (percentile / rank / #1) --- */
    case 'season_global_percentile':
      if (!input.isSeasonComplete) return 0;
      return seasonGlobalPercentile(input.globalLeaderboard, input.userId);

    case 'season_global_rank':
      if (!input.isSeasonComplete) return 9999;
      return seasonGlobalRank(input.globalLeaderboard, input.userId);

    case 'season_global_number_one':
      if (!input.isSeasonComplete) return 0;
      return isSeasonGlobalNumberOne(input.globalLeaderboard, input.userId) ? 1 : 0;

    /* --- Hidden (unchanged) --- */
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
    // Hidden / special achievement — binary unlock via bronze tier.
    return currentValue >= 1 ? ['bronze' as AchievementTier] : [];
  }

  const unlocked = new Set(alreadyUnlocked);
  const lowerIsBetter = def.lowerIsBetter ?? false;
  for (const tierDef of def.tiers) {
    const met = lowerIsBetter
      ? currentValue <= tierDef.value && currentValue > 0
      : currentValue >= tierDef.value;
    if (met) {
      unlocked.add(tierDef.tier);
    }
  }
  return TIER_ORDER.filter((t) => unlocked.has(t));
}

/* ------------------------------------------------------------------ */
/*  Specific value computers                                           */
/* ------------------------------------------------------------------ */

/**
 * Race Day Haul — only Grand Prix race points. Excludes sprint points.
 * Counts race top-10 points, fastest lap points, and DNF points only.
 * `pointsEarned` already encapsulates top-10 + fastest lap + DNF scoring
 * (see scoring lib), so we use it directly and ignore sprint points.
 */
function maxRaceDayPoints(predictions: Prediction[]): number {
  return predictions.reduce((max, p) => {
    const pts = p.pointsEarned ?? 0;
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

    const exactMatch =
      predPodium[0] === resultPodium[0] &&
      predPodium[1] === resultPodium[1] &&
      predPodium[2] === resultPodium[2];

    const allThreeAnyOrder =
      predPodium.every((d) => resultPodium.includes(d)) &&
      resultPodium.every((d) => predPodium.includes(d));

    let correctPositions = 0;
    for (let i = 0; i < 3; i++) {
      if (predPodium[i] === resultPodium[i]) correctPositions++;
    }

    // Bronze: 2 of 3 podium drivers (any order) — value 1
    // Silver: 2 in exact positions — value 2
    // Gold: all 3 in exact positions — value 3
    // Platinum: exact podium + fastest lap + DNF — value 4
    let level = 0;
    const driversCorrectAnyOrder = predPodium.filter((d) => resultPodium.includes(d)).length;
    if (driversCorrectAnyOrder >= 2) level = Math.max(level, 1); // Bronze
    if (correctPositions >= 2) level = Math.max(level, 2); // Silver
    if (exactMatch) level = Math.max(level, 3); // Gold

    if (exactMatch) {
      const flCorrect = !!pred.fastestLap && pred.fastestLap === result.fastestLapDriverId;
      const dnfCorrect = !!pred.dnf && result.dnfDriverIds.includes(pred.dnf);
      if (flCorrect && dnfCorrect) level = Math.max(level, 4); // Platinum
    }

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

/**
 * Weekend Warrior — race + sprint points combined for a single weekend.
 * Each race is treated as its own weekend (race + sprint share the raceId).
 */
function maxWeekendPoints(predictions: Prediction[]): number {
  return predictions.reduce((max, p) => {
    const pts = (p.pointsEarned ?? 0) + (p.sprintPointsEarned ?? 0);
    return pts > max ? pts : max;
  }, 0);
}

/**
 * Perfect Weekend — requires a sprint weekend.
 * Levels map to the tier values 1–4.
 */
function maxPerfectWeekendLevel(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
  racesById: Record<string, Race>,
): number {
  let best = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;
    const race = racesById[pred.raceId];
    if (!race?.hasSprint) continue; // must be a sprint weekend

    const winnerCorrect =
      pred.top10.length > 0 &&
      result.classification.some((c) => c.position === 1 && c.driverId === pred.top10[0]);

    const sprintPts = pred.sprintPointsEarned ?? 0;

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
    const flCorrect = !!pred.fastestLap && pred.fastestLap === result.fastestLapDriverId;
    const dnfCorrect = !!pred.dnf && result.dnfDriverIds.includes(pred.dnf);

    // Bronze: winner + 12+ sprint pts
    if (winnerCorrect && sprintPts >= 12) best = Math.max(best, 1);
    // Silver: exact race podium + 18+ sprint pts
    if (exactPodium && sprintPts >= 18) best = Math.max(best, 2);
    // Gold: exact race podium + fastest lap + 24+ sprint pts
    if (exactPodium && flCorrect && sprintPts >= 24) best = Math.max(best, 3);
    // Platinum: exact race top 10 + fastest lap + DNF + exact sprint top 8
    if (exactRaceTop10(pred, result) && flCorrect && dnfCorrect && exactSprintTop8(pred, result)) {
      best = Math.max(best, 4);
    }
  }
  return best;
}

function exactRaceTop10(pred: Prediction, result: RaceResult): boolean {
  const resultTop10 = result.classification
    .filter((c) => c.position <= 10)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.driverId);
  if (pred.top10.length < 10 || resultTop10.length < 10) return false;
  for (let i = 0; i < 10; i++) {
    if (pred.top10[i] !== resultTop10[i]) return false;
  }
  return true;
}

function exactSprintTop8(pred: Prediction, result: RaceResult): boolean {
  if (!result.sprintClassification || result.sprintClassification.length === 0) return false;
  const resultTop8 = result.sprintClassification
    .filter((c) => c.position <= 8)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.driverId);
  if (pred.sprintTop8.length < 8 || resultTop8.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (pred.sprintTop8[i] !== resultTop8[i]) return false;
  }
  return true;
}

/** Saturday Specialist — max sprint points in a single sprint. */
function maxSprintPoints(predictions: Prediction[]): number {
  return predictions.reduce((max, p) => {
    const pts = p.sprintPointsEarned ?? 0;
    return pts > max ? pts : max;
  }, 0);
}

/** Sprint Surgeon — max exact sprint positions in a single sprint. */
function maxSprintExactPositions(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
): number {
  let best = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result?.sprintClassification || result.sprintClassification.length === 0) continue;

    const resultTop8 = result.sprintClassification
      .filter((c) => c.position <= 8)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.driverId);

    let exact = 0;
    for (let i = 0; i < Math.min(pred.sprintTop8.length, resultTop8.length); i++) {
      if (pred.sprintTop8[i] === resultTop8[i]) exact++;
    }
    if (exact > best) best = exact;
  }
  return best;
}

/** Race Winner — correct race winners in the current season. */
function countCorrectWinnersForSeason(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
  racesById: Record<string, Race>,
  currentSeason?: string,
): number {
  let count = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;
    if (currentSeason && !raceInSeason(racesById[pred.raceId], currentSeason)) continue;
    if (
      pred.top10.length > 0 &&
      result.classification.some((c) => c.position === 1 && c.driverId === pred.top10[0])
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Chaos Caller — total correct bonus picks (fastest lap + DNF) in the season.
 * DNS does not count as a correct DNF.
 */
function countSeasonBonusPicks(
  predictions: Prediction[],
  raceResults: Record<string, RaceResult>,
  racesById: Record<string, Race>,
  currentSeason?: string,
): number {
  let count = 0;
  for (const pred of predictions) {
    const result = raceResults[pred.raceId];
    if (!result || result.classification.length === 0) continue;
    if (currentSeason && !raceInSeason(racesById[pred.raceId], currentSeason)) continue;

    if (!!pred.fastestLap && pred.fastestLap === result.fastestLapDriverId) {
      count++;
    }
    // DNF correct only if the predicted driver is in dnfDriverIds (not dnsDriverIds).
    if (!!pred.dnf && result.dnfDriverIds.includes(pred.dnf)) {
      count++;
    }
  }
  return count;
}

/**
 * Comeback Drive — max league positions gained in a single race weekend
 * while ranked in the bottom 50% of a league (≥6 members) before the weekend.
 */
function maxComebackGain(raceWeekRanks?: RaceWeekRankEntry[]): number {
  if (!raceWeekRanks || raceWeekRanks.length === 0) return 0;
  let best = 0;
  for (const entry of raceWeekRanks) {
    const memberCount = entry.memberCount ?? 0;
    if (memberCount < 6) continue;
    if (entry.preWeekendRank == null) continue;
    const bottomHalfThreshold = Math.ceil(memberCount / 2);
    if (entry.preWeekendRank > bottomHalfThreshold) {
      // User was in the bottom 50% before the weekend.
      const gain = entry.preWeekendRank - entry.rank;
      if (gain > best) best = gain;
    }
  }
  return best;
}

/* --- Season global helpers --- */

/** Season Champion — returns the percentile floor (e.g. 95 = top 5%). 0 = no data. */
function seasonGlobalPercentile(
  leaderboard: { userId: string; totalPoints: number }[] | undefined,
  userId?: string,
): number {
  if (!leaderboard || leaderboard.length === 0 || !userId) return 0;
  const sorted = [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  const idx = sorted.findIndex((e) => e.userId === userId);
  if (idx === -1) return 0;
  const rank = idx + 1;
  const total = sorted.length;
  if (total === 0) return 0;
  // percentile floor = 100 - (rank-1)/total*100. Higher = better (top 1% = 99).
  return Math.round(100 - ((rank - 1) / total) * 100);
}

/** Global Podium — returns the user's global rank. Lower = better. 9999 = no data. */
function seasonGlobalRank(
  leaderboard: { userId: string; totalPoints: number }[] | undefined,
  userId?: string,
): number {
  if (!leaderboard || leaderboard.length === 0 || !userId) return 9999;
  const sorted = [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  const idx = sorted.findIndex((e) => e.userId === userId);
  if (idx === -1) return 9999;
  return idx + 1;
}

function isSeasonGlobalNumberOne(
  leaderboard: { userId: string; totalPoints: number }[] | undefined,
  userId?: string,
): boolean {
  if (!leaderboard || leaderboard.length === 0 || !userId) return false;
  const sorted = [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  return sorted[0]?.userId === userId;
}

/* --- Hidden achievements (unchanged) --- */

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
    if (result.dnfDriverIds.includes(predictedWinner)) return true;
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

/* --- Season helpers --- */

/** True when the race belongs to the given season label (by race year). */
function raceInSeason(race: Race | undefined, season: string): boolean {
  if (!race) return false;
  const year = race.raceDate?.slice(0, 4);
  return year === season;
}

/* ------------------------------------------------------------------ */
/*  Batch evaluation — run all achievements and return newly unlocked  */
/* ------------------------------------------------------------------ */

export interface NewlyUnlockedEntry {
  achievementId: string;
  tier: AchievementTier;
  def: AchievementDefinition;
  /** For season-based achievements, the season label of the instance. */
  season?: string;
}

export interface EvaluationResult {
  state: AchievementState;
  newlyUnlocked: NewlyUnlockedEntry[];
}

export function evaluateAll(
  input: AchievementInput,
  existingState: AchievementState,
): EvaluationResult {
  const state: AchievementState = { ...existingState };
  const newlyUnlocked: NewlyUnlockedEntry[] = [];
  const currentSeason = input.currentSeason ?? '';

  for (const def of ALL_ACHIEVEMENTS) {
    const existing = existingState[def.id];
    const { unlockedTiers, currentValue } = evaluateAchievement(def, input, existing);

    const prevUnlocked = new Set(existing?.unlockedTiers ?? []);

    if (def.isSeasonBased && currentSeason) {
      // --- Season-based: store per-season instance, freeze previous seasons ---
      const prevInstances: SeasonInstance[] = Array.isArray(existing?.seasonInstances)
        ? existing!.seasonInstances!
        : [];
      const prevCurrent = prevInstances.find((i) => i.season === currentSeason);
      const prevCurrentTiers = new Set(prevCurrent?.unlockedTiers ?? []);

      // Merge current-season instance.
      const mergedTiers = [...new Set([...(prevCurrent?.unlockedTiers ?? []), ...unlockedTiers])];
      const mergedValue = Math.max(prevCurrent?.currentValue ?? 0, currentValue);
      const mergedUnlockedAt: Partial<Record<AchievementTier, string>> = {
        ...(prevCurrent?.unlockedAt ?? {}),
        ...Object.fromEntries(
          unlockedTiers
            .filter((t) => !prevCurrentTiers.has(t))
            .map((t) => [t, new Date().toISOString()]),
        ),
      };

      const currentInstance: SeasonInstance = {
        season: currentSeason,
        unlockedTiers: mergedTiers,
        currentValue: mergedValue,
        unlockedAt: mergedUnlockedAt,
      };

      // Freeze previous seasons — keep them unchanged.
      const otherInstances = prevInstances.filter((i) => i.season !== currentSeason);
      const seasonInstances = [...otherInstances, currentInstance].sort((a, b) =>
        a.season.localeCompare(b.season),
      );

      // Flat fields mirror the current-season instance for backward compat.
      state[def.id] = {
        achievementId: def.id,
        unlockedTiers: mergedTiers,
        currentValue: mergedValue,
        unlockedAt: mergedUnlockedAt,
        seasonInstances,
      };

      // Newly unlocked this evaluation (current season only).
      for (const tier of unlockedTiers) {
        if (!prevCurrentTiers.has(tier)) {
          newlyUnlocked.push({ achievementId: def.id, tier, def, season: currentSeason });
        }
      }
    } else {
      // --- Non-season achievement: standard union merge ---
      const mergedTiers = [...new Set([...(existing?.unlockedTiers ?? []), ...unlockedTiers])];
      const mergedValue = Math.max(existing?.currentValue ?? 0, currentValue);
      const mergedUnlockedAt: Partial<Record<AchievementTier, string>> = {
        ...(existing?.unlockedAt ?? {}),
        ...Object.fromEntries(
          unlockedTiers
            .filter((t) => !prevUnlocked.has(t))
            .map((t) => [t, new Date().toISOString()]),
        ),
      };

      state[def.id] = {
        achievementId: def.id,
        unlockedTiers: mergedTiers,
        currentValue: mergedValue,
        unlockedAt: mergedUnlockedAt,
      };

      for (const tier of unlockedTiers) {
        if (!prevUnlocked.has(tier)) {
          newlyUnlocked.push({ achievementId: def.id, tier, def });
        }
      }
    }
  }

  return { state, newlyUnlocked };
}

/**
 * Build a minimal mock input for testing / guest mode.
 */
export function buildMockInput(overrides: Partial<AchievementInput> = {}): AchievementInput {
  return {
    predictions: [],
    raceResults: {},
    racesById: {},
    totalPoints: 0,
    leagueMemberships: [],
    editCounts: {},
    lockTimes: {},
    raceWeekRanks: [],
    globalLeaderboard: [],
    currentSeason: '',
    isSeasonComplete: false,
    ...overrides,
  };
}
