/**
 * SEEDED MOCK PREDICTION DATA — sourced from the Pick The Grid spreadsheet.
 *
 * These are pre-submitted picks for four users across all completed races.
 * The picks are verified against the 2026 spreadsheet (2026-06-16).
 *
 * The scoring engine calculates points from these picks against the app's known results.
 *
 * IMPORTANT: Keep this file in sync with the spreadsheet after any data import.
 * The leaderboard falls back to this data when Supabase is unreachable.
 */

import { Prediction, RaceResult } from '@/types';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';

// ---------------------------------------------------------------------------
// User profiles
// ---------------------------------------------------------------------------

export interface SeedUser {
  userId: string;
  username: string;
  displayName: string;
}

export const SEED_USERS: SeedUser[] = [
  {
    userId: 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4',
    username: 'skyeleach',
    displayName: 'Skye Leach',
  },
  {
    userId: '652154af-dc27-47b5-aa79-25903b9c4a1b',
    username: 'whitney',
    displayName: 'Whitney Trujillo',
  },
  {
    userId: 'f35417e9-4f0d-4def-9c2f-c81276863fc0',
    username: 'bryanleach',
    displayName: 'Bryan Leach',
  },
  {
    userId: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b',
    username: 'sainz4ever55',
    displayName: 'Carlos Trujillo',
  },
];

// ---------------------------------------------------------------------------
// Completed race IDs — races R01–R06 of the 2026 season are complete.
// R07 (Barcelona/Spanish GP) has no predictions in the spreadsheet yet.
// ---------------------------------------------------------------------------

export const COMPLETED_RACE_IDS = [
  'r01','r02','r03','r04','r05','r06',
] as const;

// ---------------------------------------------------------------------------
// Raw prediction type
// ---------------------------------------------------------------------------

export type RawPrediction = Omit<Prediction, 'id' | 'updatedAt' | 'username' | 'displayName'> & { username?: string | null; displayName?: string | null };

// ---------------------------------------------------------------------------
// Seeded predictions by user and race
// Verified against the 2026 Pick The Grid spreadsheet.
//
// Points are computed by the scoring engine from the app's known race results.
// The spreadsheet uses its own formulas; minor point differences may exist.
// ---------------------------------------------------------------------------

export const SEED_PREDICTIONS: Record<string, Record<string, RawPrediction>> = {
  // ---- Skye Leach ----
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': {
    r01: {
      raceId: 'r01',
      top10: ['VER', 'RUS', 'ANT', 'PIA', 'LEC', 'NOR', 'HAM', 'HAD', 'LAW', 'SAI'],
      fastestLap: 'VER',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r02: {
      raceId: 'r02',
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'VER', 'PIA', 'NOR', 'HAD', 'BEA', 'GAS'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      pointsEarned: 0,
      sprintTop8: ['RUS', 'ANT', 'HAM', 'NOR', 'LEC', 'PIA', 'VER', 'HAD'],
      sprintPointsEarned: 0,
    },
    r03: {
      raceId: 'r03',
      top10: ['ANT', 'RUS', 'LEC', 'PIA', 'HAM', 'NOR', 'VER', 'HAD', 'GAS', 'LIN'],
      fastestLap: 'ANT',
      dnf: 'BOT',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r04: {
      raceId: 'r04',
      top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'HAM', 'PIA', 'HAD', 'GAS', 'BEA'],
      fastestLap: 'VER',
      dnf: 'COL',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'NOR', 'PIA', 'RUS', 'LEC', 'VER', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
    r05: {
      raceId: 'r05',
      top10: ['RUS', 'ANT', 'PIA', 'NOR', 'HAM', 'LEC', 'VER', 'HAD', 'LIN', 'LAW'],
      fastestLap: 'ANT',
      dnf: 'COL',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'RUS', 'NOR', 'PIA', 'LEC', 'VER', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
    r06: {
      raceId: 'r06',
      top10: ['ANT', 'VER', 'RUS', 'LEC', 'HAM', 'PIA', 'HAD', 'NOR', 'GAS', 'COL'],
      fastestLap: 'ANT',
      dnf: 'LAW',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },

  // ---- Whitney Trujillo ----
  '652154af-dc27-47b5-aa79-25903b9c4a1b': {
    r01: {
      raceId: 'r01',
      top10: ['ANT', 'RUS', 'LEC', 'PIA', 'HAD', 'VER', 'NOR', 'HAM', 'LAW', 'HUL'],
      fastestLap: 'VER',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r02: {
      raceId: 'r02',
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'PIA', 'VER', 'NOR', 'HAD', 'HUL', 'BEA'],
      fastestLap: 'RUS',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'RUS', 'NOR', 'HAM', 'VER', 'PIA', 'LEC', 'HAD'],
      sprintPointsEarned: 0,
    },
    r03: {
      raceId: 'r03',
      top10: ['ANT', 'RUS', 'LEC', 'PIA', 'NOR', 'VER', 'HAM', 'GAS', 'HAD', 'HUL'],
      fastestLap: 'PIA',
      dnf: 'PER',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r04: {
      raceId: 'r04',
      top10: ['PIA', 'VER', 'NOR', 'ANT', 'LEC', 'RUS', 'HAM', 'COL', 'SAI', 'GAS'],
      fastestLap: null,
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: ['NOR', 'LEC', 'ANT', 'PIA', 'VER', 'RUS', 'HAM', 'COL'],
      sprintPointsEarned: 0,
    },
    r05: {
      raceId: 'r05',
      top10: ['RUS', 'ANT', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'],
      fastestLap: 'ANT',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
    r06: {
      raceId: 'r06',
      top10: ['ANT', 'VER', 'HAM', 'LEC', 'HAD', 'PIA', 'RUS', 'NOR', 'GAS', 'SAI'],
      fastestLap: 'ANT',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },

  // ---- Bryan Leach ----
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': {
    r01: {
      raceId: 'r01',
      top10: ['RUS', 'ANT', 'PIA', 'LEC', 'NOR', 'HAM', 'HAD', 'VER', 'LAW', 'LIN'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r02: {
      raceId: 'r02',
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'PIA', 'NOR', 'VER', 'HAD', 'BEA', 'GAS'],
      fastestLap: 'RUS',
      dnf: 'PER',
      pointsEarned: 0,
      sprintTop8: ['RUS', 'ANT', 'HAM', 'LEC', 'LEC', 'VER', 'NOR', 'HAD'],
      sprintPointsEarned: 0,
    },
    r03: {
      raceId: 'r03',
      top10: ['RUS', 'ANT', 'LEC', 'HAM', 'VER', 'PIA', 'NOR', 'HAD', 'GAS', 'LIN'],
      fastestLap: 'RUS',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r04: {
      raceId: 'r04',
      top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'PIA', 'HAM', 'GAS', 'HAD', 'COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'NOR', 'PIA', 'LEC', 'RUS', 'VER', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
    r05: {
      raceId: 'r05',
      top10: ['RUS', 'ANT', 'NOR', 'PIA', 'HAM', 'LEC', 'VER', 'HAD', 'LIN', 'LAW'],
      fastestLap: 'NOR',
      dnf: 'BOT',
      pointsEarned: 0,
      sprintTop8: ['RUS', 'ANT', 'NOR', 'PIA', 'HAM', 'LEC', 'VER', 'HAD'],
      sprintPointsEarned: 0,
    },
    r06: {
      raceId: 'r06',
      top10: ['ANT', 'VER', 'LEC', 'HAM', 'RUS', 'PIA', 'NOR', 'GAS', 'LAW', 'ALB'],
      fastestLap: 'ANT',
      dnf: 'HAD',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },

  // ---- Carlos Trujillo (sainz4ever55) ----
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': {
    r01: {
      raceId: 'r01',
      top10: ['RUS', 'ANT', 'LEC', 'PIA', 'HAD', 'HAM', 'NOR', 'VER', 'LAW', 'HUL'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r02: {
      raceId: 'r02',
      top10: ['RUS', 'ANT', 'HAM', 'LEC', 'NOR', 'PIA', 'VER', 'HAD', 'GAS', 'HUL'],
      fastestLap: 'RUS',
      dnf: 'ALB',
      pointsEarned: 0,
      sprintTop8: ['RUS', 'ANT', 'HAM', 'NOR', 'LEC', 'VER', 'PIA', 'GAS'],
      sprintPointsEarned: 0,
    },
    r03: {
      raceId: 'r03',
      top10: ['ANT', 'RUS', 'LEC', 'HAM', 'PIA', 'NOR', 'HAD', 'VER', 'GAS', 'LIN'],
      fastestLap: 'RUS',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
    r04: {
      raceId: 'r04',
      top10: ['VER', 'ANT', 'NOR', 'LEC', 'RUS', 'LEC', 'PIA', 'HAM', 'GAS', 'HUL'],
      fastestLap: 'VER',
      dnf: null,
      pointsEarned: 0,
      sprintTop8: ['NOR', 'ANT', 'PIA', 'LEC', 'RUS', 'VER', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
    r05: {
      raceId: 'r05',
      top10: ['ANT', 'RUS', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
    r06: {
      raceId: 'r06',
      top10: ['VER', 'ANT', 'HAM', 'LEC', 'HAD', 'RUS', 'PIA', 'NOR', 'GAS', 'LAW'],
      fastestLap: 'VER',
      dnf: 'BOR',
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },
};

// ---------------------------------------------------------------------------
// Scoring helper — scores all completed races against the provided results.
// Used by the leaderboard fallback when Supabase is unreachable.
// Points are set to 0 above and computed fresh each time to stay consistent
// with the scoring engine.
// ---------------------------------------------------------------------------

export function scoreSeededPredictions(
  userId: string,
  raceResults: RaceResult[]
): number {
  const userPreds = SEED_PREDICTIONS[userId.toLowerCase()];

  if (!userPreds) return 0;

  let total = 0;

  for (const raceId of COMPLETED_RACE_IDS) {
    const pred = userPreds[raceId];

    if (!pred) continue;

    const result = raceResults.find((raceResult) => raceResult.raceId === raceId);

    if (!result) continue;

    const fullPred: Prediction = {
      id: `seed-${userId}-${raceId}`,
      ...pred,
      username: pred.username ?? null,
      displayName: pred.displayName ?? null,
      updatedAt: '2026-01-01T00:00:00Z',
    };

    if (pred.top10.length > 0 && result.classification.length > 0) {
      const breakdown = calculatePoints(fullPred, result);
      total += breakdown.totalPoints;
    }

    if (
      pred.sprintTop8.length > 0 &&
      result.sprintClassification &&
      result.sprintClassification.length > 0
    ) {
      const sprintBreakdown = calculateSprintPoints(
        pred.sprintTop8,
        result.sprintClassification
      );

      total += sprintBreakdown.totalPoints;
    }
  }

  return total;
}
