/**
 * SEEDED 2026 MOCK PREDICTION DATA — sourced from the Pick The Grid spreadsheet.
 *
 * These are pre-submitted picks for four users across all completed races
 * before Monaco (r01–r07, excluding cancelled Bahrain r04 and Saudi r05).
 * The existing scoring engine calculates points from the app's known results.
 *
 * Race IDs (from f1-data.ts):
 *   r01 = Australian Grand Prix 2026 (GP only)
 *   r02 = Chinese Grand Prix 2026 (Sprint + GP)
 *   r03 = Japanese Grand Prix 2026 (GP only)
 *   r06 = Miami Grand Prix 2026 (Sprint + GP)
 *   r07 = Canadian Grand Prix 2026 (Sprint + GP)
 *
 * Cancelled: r04 (Bahrain), r05 (Saudi Arabia) — no picks seeded.
 * Upcoming: r08+ (Monaco onward) — not touched.
 */

import { Prediction, RaceResult } from '@/types';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';

// ---------------------------------------------------------------------------
// Driver mapping: spreadsheet short name → app driver ID (f1-data.ts)
// ---------------------------------------------------------------------------
const D: Record<string, string> = {
  'M. Verstappen':   'VER',
  'G. Russell':       'RUS',
  'K. Antonelli':     'ANT',
  'O. Piastri':       'PIA',
  'C. Leclerc':       'LEC',
  'L. Norris':        'NOR',
  'L. Hamilton':      'HAM',
  'I. Hadjar':        'HAD',
  'L. Lawson':        'LAW',
  'C. Sainz':         'SAI',
  'N. Hulkenberg':    'HUL',
  'A. Lindblad':      'LIN',
  'P. Gasly':         'GAS',
  'O. Bearman':       'BEA',
  'F. Colapinto':     'COL',
};

/** Map an array of spreadsheet short names to app driver IDs. */
function map(names: string[]): string[] {
  return names.map(n => D[n] ?? n);
}

/** Map a single spreadsheet short name or null → driver ID or null. */
function mapOne(name: string | null): string | null {
  if (!name) return null;
  return D[name] ?? name;
}

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
// Race event IDs
// ---------------------------------------------------------------------------
export const COMPLETED_RACE_IDS = ['r01', 'r02', 'r03', 'r06', 'r07'] as const;

// ---------------------------------------------------------------------------
// Raw prediction type (without id / updatedAt — filled in at usage site)
// ---------------------------------------------------------------------------
export type RawPrediction = Omit<Prediction, 'id' | 'updatedAt'>;

// ---------------------------------------------------------------------------
// Per-user, per-race predictions keyed by userId then raceId
// ---------------------------------------------------------------------------
export const SEED_PREDICTIONS: Record<string, Record<string, RawPrediction>> = {
  // =========================================================================
  // Skye Leach — cb7536a7-ad8b-44d4-981b-4b24c19abcc4
  // =========================================================================
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': {

    // Australian Grand Prix 2026 (r01) — GP
    r01: {
      raceId: 'r01',
      top10: map([
        'M. Verstappen', 'G. Russell', 'K. Antonelli', 'O. Piastri',
        'C. Leclerc', 'L. Norris', 'L. Hamilton', 'I. Hadjar',
        'L. Lawson', 'C. Sainz',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // China 2026 Sprint (r02) — Sprint
    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell', 'K. Antonelli', 'C. Leclerc', 'L. Hamilton',
        'M. Verstappen', 'O. Piastri', 'L. Norris', 'I. Hadjar',
        'O. Bearman', 'P. Gasly',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'G. Russell', 'K. Antonelli', 'L. Hamilton', 'L. Norris',
        'C. Leclerc', 'O. Piastri', 'M. Verstappen', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    // Japanese Grand Prix 2026 (r03) — GP
    r03: {
      raceId: 'r03',
      top10: map([
        'K. Antonelli', 'G. Russell', 'C. Leclerc', 'O. Piastri',
        'L. Hamilton', 'L. Norris', 'M. Verstappen', 'I. Hadjar',
        'P. Gasly', 'A. Lindblad',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // Miami 2026 Sprint (r06) — Sprint
    r06: {
      raceId: 'r06',
      top10: map([
        'M. Verstappen', 'K. Antonelli', 'L. Norris', 'C. Leclerc',
        'G. Russell', 'L. Hamilton', 'O. Piastri', 'I. Hadjar',
        'P. Gasly', 'O. Bearman',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli', 'L. Norris', 'O. Piastri', 'G. Russell',
        'C. Leclerc', 'M. Verstappen', 'L. Hamilton', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    // Canadian GP 2026 Sprint (r07) — Sprint
    r07: {
      raceId: 'r07',
      top10: map([
        'G. Russell', 'K. Antonelli', 'O. Piastri', 'L. Norris',
        'L. Hamilton', 'C. Leclerc', 'M. Verstappen', 'I. Hadjar',
        'A. Lindblad', 'L. Lawson',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli', 'G. Russell', 'L. Norris', 'O. Piastri',
        'C. Leclerc', 'M. Verstappen', 'L. Hamilton', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },
  },

  // =========================================================================
  // Whitney Trujillo — 652154af-dc27-47b5-aa79-25903b9c4a1b
  // =========================================================================
  '652154af-dc27-47b5-aa79-25903b9c4a1b': {

    // Australian Grand Prix 2026 (r01) — GP
    r01: {
      raceId: 'r01',
      top10: map([
        'K. Antonelli', 'G. Russell', 'C. Leclerc', 'O. Piastri',
        'I. Hadjar', 'M. Verstappen', 'L. Norris', 'L. Hamilton',
        'L. Lawson', 'N. Hulkenberg',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // China 2026 (r02) — Sprint + GP
    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell', 'K. Antonelli', 'C. Leclerc', 'L. Hamilton',
        'O. Piastri', 'M. Verstappen', 'L. Norris', 'I. Hadjar',
        'N. Hulkenberg', 'O. Bearman',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli', 'G. Russell', 'L. Norris', 'L. Hamilton',
        'M. Verstappen', 'O. Piastri', 'C. Leclerc', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    // Japanese Grand Prix 2026 (r03) — GP
    r03: {
      raceId: 'r03',
      top10: map([
        'K. Antonelli', 'G. Russell', 'C. Leclerc', 'O. Piastri',
        'L. Norris', 'M. Verstappen', 'L. Hamilton', 'P. Gasly',
        'I. Hadjar', 'N. Hulkenberg',
      ]),
      fastestLap: mapOne('O. Piastri'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // Miami 2026 (r06) — Sprint + GP
    r06: {
      raceId: 'r06',
      top10: map([
        'O. Piastri', 'M. Verstappen', 'L. Norris', 'K. Antonelli',
        'C. Leclerc', 'G. Russell', 'L. Hamilton', 'F. Colapinto',
        'C. Sainz', 'P. Gasly',
      ]),
      fastestLap: null,
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'L. Norris', 'C. Leclerc', 'K. Antonelli', 'O. Piastri',
        'M. Verstappen', 'G. Russell', 'L. Hamilton', 'F. Colapinto',
      ]),
      sprintPointsEarned: 0,
    },

    // Canadian GP 2026 (r07) — Sprint + GP
    r07: {
      raceId: 'r07',
      top10: map([
        'G. Russell', 'K. Antonelli', 'L. Norris', 'O. Piastri',
        'M. Verstappen', 'C. Leclerc', 'L. Hamilton', 'I. Hadjar',
        'A. Lindblad', 'F. Colapinto',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli', 'G. Russell', 'O. Piastri', 'L. Norris',
        'M. Verstappen', 'C. Leclerc', 'L. Hamilton', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },
  },

  // =========================================================================
  // Bryan Leach — f35417e9-4f0d-4def-9c2f-c81276863fc0
  // =========================================================================
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': {

    // Australian Grand Prix 2026 (r01) — GP
    r01: {
      raceId: 'r01',
      top10: map([
        'G. Russell', 'K. Antonelli', 'O. Piastri', 'C. Leclerc',
        'L. Norris', 'L. Hamilton', 'I. Hadjar', 'M. Verstappen',
        'L. Lawson', 'A. Lindblad',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // China 2026 (r02) — Sprint + GP
    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell', 'K. Antonelli', 'C. Leclerc', 'L. Hamilton',
        'O. Piastri', 'L. Norris', 'M. Verstappen', 'I. Hadjar',
        'O. Bearman', 'P. Gasly',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      // NOTE: Spreadsheet lists C. Leclerc twice (positions 4 and 5).
      // Mapped as-is — the scoring engine won't double-credit.
      sprintTop8: map([
        'G. Russell', 'K. Antonelli', 'L. Hamilton', 'C. Leclerc',
        'C. Leclerc', 'M. Verstappen', 'L. Norris', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    // Japanese Grand Prix 2026 (r03) — GP
    r03: {
      raceId: 'r03',
      top10: map([
        'G. Russell', 'K. Antonelli', 'C. Leclerc', 'L. Hamilton',
        'M. Verstappen', 'O. Piastri', 'L. Norris', 'I. Hadjar',
        'P. Gasly', 'A. Lindblad',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // Miami 2026 (r06) — Sprint + GP
    r06: {
      raceId: 'r06',
      top10: map([
        'M. Verstappen', 'K. Antonelli', 'L. Norris', 'C. Leclerc',
        'G. Russell', 'O. Piastri', 'L. Hamilton', 'P. Gasly',
        'I. Hadjar', 'F. Colapinto',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli', 'L. Norris', 'O. Piastri', 'C. Leclerc',
        'G. Russell', 'M. Verstappen', 'L. Hamilton', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    // Canadian GP 2026 (r07) — Sprint + GP
    r07: {
      raceId: 'r07',
      top10: map([
        'G. Russell', 'K. Antonelli', 'L. Norris', 'O. Piastri',
        'L. Hamilton', 'C. Leclerc', 'M. Verstappen', 'I. Hadjar',
        'A. Lindblad', 'L. Lawson',
      ]),
      fastestLap: mapOne('L. Norris'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'G. Russell', 'K. Antonelli', 'L. Norris', 'O. Piastri',
        'L. Hamilton', 'C. Leclerc', 'M. Verstappen', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },
  },

  // =========================================================================
  // Carlos Trujillo — e11ea4f5-2ba4-4241-9791-b4b6a560534b
  // =========================================================================
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': {

    // Australian Grand Prix 2026 (r01) — GP
    r01: {
      raceId: 'r01',
      top10: map([
        'G. Russell', 'K. Antonelli', 'C. Leclerc', 'O. Piastri',
        'I. Hadjar', 'L. Hamilton', 'L. Norris', 'M. Verstappen',
        'L. Lawson', 'N. Hulkenberg',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // China 2026 (r02) — Sprint + GP
    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell', 'K. Antonelli', 'L. Hamilton', 'C. Leclerc',
        'L. Norris', 'O. Piastri', 'M. Verstappen', 'I. Hadjar',
        'P. Gasly', 'N. Hulkenberg',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'G. Russell', 'K. Antonelli', 'L. Hamilton', 'L. Norris',
        'C. Leclerc', 'M. Verstappen', 'O. Piastri', 'P. Gasly',
      ]),
      sprintPointsEarned: 0,
    },

    // Japanese Grand Prix 2026 (r03) — GP
    r03: {
      raceId: 'r03',
      top10: map([
        'K. Antonelli', 'G. Russell', 'C. Leclerc', 'L. Hamilton',
        'O. Piastri', 'L. Norris', 'I. Hadjar', 'M. Verstappen',
        'P. Gasly', 'A. Lindblad',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    // Miami 2026 (r06) — Sprint + GP
    r06: {
      raceId: 'r06',
      // NOTE: Spreadsheet lists C. Leclerc twice (P4 and P6). Mapped as-is.
      top10: map([
        'M. Verstappen', 'K. Antonelli', 'L. Norris', 'C. Leclerc',
        'G. Russell', 'C. Leclerc', 'O. Piastri', 'L. Hamilton',
        'P. Gasly', 'N. Hulkenberg',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'L. Norris', 'K. Antonelli', 'O. Piastri', 'C. Leclerc',
        'G. Russell', 'M. Verstappen', 'L. Hamilton', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    // Canadian GP 2026 (r07) — Sprint + GP
    r07: {
      raceId: 'r07',
      top10: map([
        'K. Antonelli', 'G. Russell', 'L. Norris', 'O. Piastri',
        'M. Verstappen', 'C. Leclerc', 'L. Hamilton', 'I. Hadjar',
        'A. Lindblad', 'F. Colapinto',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli', 'G. Russell', 'O. Piastri', 'L. Norris',
        'M. Verstappen', 'C. Leclerc', 'L. Hamilton', 'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },
  },
};

// ---------------------------------------------------------------------------
// Scoring helper — score one user's full set of predictions against all
// available race results.  Returns the summed total points.
// ---------------------------------------------------------------------------

/**
 * Score a user's seeded predictions against the provided race results.
 * Returns total points summed across all completed races (GP + sprint).
 */
export function scoreSeededPredictions(
  userId: string,
  raceResults: RaceResult[],
): number {
  const userPreds = SEED_PREDICTIONS[userId];
  if (!userPreds) return 0;

  let total = 0;

  for (const raceId of COMPLETED_RACE_IDS) {
    const pred = userPreds[raceId];
    if (!pred) continue;

    const result = raceResults.find(r => r.raceId === raceId);
    if (!result) continue;

    // Build a full Prediction (with placeholder id/updatedAt) for the scorer
    const fullPred: Prediction = {
      id: `seed-${userId}-${raceId}`,
      ...pred,
      updatedAt: '2026-01-01T00:00:00Z',
    };

    // GP scoring
    if (pred.top10.length > 0 && result.classification.length > 0) {
      const breakdown = calculatePoints(fullPred, result);
      total += breakdown.totalPoints;
    }

    // Sprint scoring (if the race had a sprint and a prediction exists)
    if (
      pred.sprintTop8.length > 0 &&
      result.sprintClassification &&
      result.sprintClassification.length > 0
    ) {
      const sprintBreakdown = calculateSprintPoints(
        pred.sprintTop8,
        result.sprintClassification,
      );
      total += sprintBreakdown.totalPoints;
    }
  }

  return total;
}
