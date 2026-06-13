/**
 * SEEDED 2026 MOCK PREDICTION DATA — sourced from the Pick The Grid spreadsheet.
 *
 * These are pre-submitted picks for four users across all completed races
 * before Monaco, excluding cancelled Bahrain and Saudi Arabia.
 *
 * The app already knows the race results. This file only seeds user picks.
 * The scoring engine calculates points from these picks against the app's known results.
 */

import { Prediction, RaceResult } from '@/types';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';

// ---------------------------------------------------------------------------
// Driver mapping: spreadsheet short name → app driver ID from f1-data.ts
// ---------------------------------------------------------------------------

const D: Record<string, string> = {
  'M. Verstappen': 'VER',
  'G. Russell': 'RUS',
  'K. Antonelli': 'ANT',
  'O. Piastri': 'PIA',
  'O. PIastri': 'PIA',
  'C. Leclerc': 'LEC',
  'L. Norris': 'NOR',
  'L. Hamilton': 'HAM',
  'L. Hamillton': 'HAM',
  'I. Hadjar': 'HAD',
  'I. Hdjar': 'HAD',
  'L. Lawson': 'LAW',
  'C. Sainz': 'SAI',
  'N. Hulkenberg': 'HUL',
  'Nico': 'HUL',
  'A. Lindblad': 'LIN',
  'A. Lindbald': 'LIN',
  'A. Linblad': 'LIN',
  'P. Gasly': 'GAS',
  'O. Bearman': 'BEA',
  'F. Colapinto': 'COL',
  'A. Albon': 'ALB',
  'F. Alonso': 'ALO',
  Alonso: 'ALO',
  'L. Stroll': 'STR',
  Stroll: 'STR',
  'V. Bottas': 'BOT',
  Bottas: 'BOT',
  'S. Perez': 'PER',
  'G. Bortoleto': 'BOR',
  'G. Bartoleto': 'BOR',
  'E. Ocon': 'OCO',
};

function map(names: string[]): string[] {
  return names.map((name) => D[name] ?? name);
}

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
// Completed race IDs
// ---------------------------------------------------------------------------

export const COMPLETED_RACE_IDS = ['r01', 'r02', 'r03', 'r06', 'r07', 'r08'] as const;

// ---------------------------------------------------------------------------
// Raw prediction type
// ---------------------------------------------------------------------------

export type RawPrediction = Omit<Prediction, 'id' | 'updatedAt' | 'username' | 'displayName'> & { username?: string | null };

// ---------------------------------------------------------------------------
// Seeded predictions by user and race
// ---------------------------------------------------------------------------

export const SEED_PREDICTIONS: Record<string, Record<string, RawPrediction>> = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': {
    r01: {
      raceId: 'r01',
      top10: map([
        'M. Verstappen',
        'G. Russell',
        'K. Antonelli',
        'O. Piastri',
        'C. Leclerc',
        'L. Norris',
        'L. Hamilton',
        'I. Hadjar',
        'L. Lawson',
        'C. Sainz',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: mapOne('Stroll'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'C. Leclerc',
        'L. Hamilton',
        'M. Verstappen',
        'O. Piastri',
        'L. Norris',
        'I. Hadjar',
        'O. Bearman',
        'P. Gasly',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('F. Alonso'),
      pointsEarned: 0,
      sprintTop8: map([
        'G. Russell',
        'K. Antonelli',
        'L. Hamilton',
        'L. Norris',
        'C. Leclerc',
        'O. Piastri',
        'M. Verstappen',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r03: {
      raceId: 'r03',
      top10: map([
        'K. Antonelli',
        'G. Russell',
        'C. Leclerc',
        'O. Piastri',
        'L. Hamilton',
        'L. Norris',
        'M. Verstappen',
        'I. Hadjar',
        'P. Gasly',
        'A. Lindblad',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: mapOne('V. Bottas'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r06: {
      raceId: 'r06',
      top10: map([
        'M. Verstappen',
        'K. Antonelli',
        'L. Norris',
        'C. Leclerc',
        'G. Russell',
        'L. Hamilton',
        'O. Piastri',
        'I. Hadjar',
        'P. Gasly',
        'O. Bearman',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: mapOne('F. Colapinto'),
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli',
        'L. Norris',
        'O. Piastri',
        'G. Russell',
        'C. Leclerc',
        'M. Verstappen',
        'L. Hamilton',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r07: {
      raceId: 'r07',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'O. Piastri',
        'L. Norris',
        'L. Hamilton',
        'C. Leclerc',
        'M. Verstappen',
        'I. Hadjar',
        'A. Lindblad',
        'L. Lawson',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: mapOne('F. Colapinto'),
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli',
        'G. Russell',
        'L. Norris',
        'O. Piastri',
        'C. Leclerc',
        'M. Verstappen',
        'L. Hamilton',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r08: {
      raceId: 'r08',
      top10: map([
        'K. Antonelli',
        'L. Hamilton',
        'O. Piastri',
        'I. Hadjar',
        'L. Lawson',
        'A. Lindblad',
        'C. Leclerc',
        'P. Gasly',
        'A. Albon',
        'E. Ocon',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: mapOne('L. Stroll'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },

  '652154af-dc27-47b5-aa79-25903b9c4a1b': {
    r01: {
      raceId: 'r01',
      top10: map([
        'K. Antonelli',
        'G. Russell',
        'C. Leclerc',
        'O. Piastri',
        'I. Hadjar',
        'M. Verstappen',
        'L. Norris',
        'L. Hamilton',
        'L. Lawson',
        'N. Hulkenberg',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: mapOne('Stroll'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'C. Leclerc',
        'L. Hamilton',
        'O. Piastri',
        'M. Verstappen',
        'L. Norris',
        'I. Hadjar',
        'N. Hulkenberg',
        'O. Bearman',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('L. Stroll'),
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli',
        'G. Russell',
        'L. Norris',
        'L. Hamilton',
        'M. Verstappen',
        'O. Piastri',
        'C. Leclerc',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r03: {
      raceId: 'r03',
      top10: map([
        'K. Antonelli',
        'G. Russell',
        'C. Leclerc',
        'O. Piastri',
        'L. Norris',
        'M. Verstappen',
        'L. Hamilton',
        'P. Gasly',
        'I. Hadjar',
        'N. Hulkenberg',
      ]),
      fastestLap: mapOne('O. Piastri'),
      dnf: mapOne('S. Perez'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r06: {
      raceId: 'r06',
      top10: map([
        'O. Piastri',
        'M. Verstappen',
        'L. Norris',
        'K. Antonelli',
        'C. Leclerc',
        'G. Russell',
        'L. Hamilton',
        'F. Colapinto',
        'C. Sainz',
        'P. Gasly',
      ]),
      fastestLap: null,
      dnf: mapOne('L. Stroll'),
      pointsEarned: 0,
      sprintTop8: map([
        'L. Norris',
        'C. Leclerc',
        'K. Antonelli',
        'O. Piastri',
        'M. Verstappen',
        'G. Russell',
        'L. Hamilton',
        'F. Colapinto',
      ]),
      sprintPointsEarned: 0,
    },

    r07: {
      raceId: 'r07',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'L. Norris',
        'O. Piastri',
        'M. Verstappen',
        'C. Leclerc',
        'L. Hamilton',
        'I. Hadjar',
        'A. Lindblad',
        'F. Colapinto',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: mapOne('L. Stroll'),
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli',
        'G. Russell',
        'O. Piastri',
        'L. Norris',
        'M. Verstappen',
        'C. Leclerc',
        'L. Hamilton',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r08: {
      raceId: 'r08',
      top10: map([
        'K. Antonelli',
        'L. Hamilton',
        'I. Hadjar',
        'O. Piastri',
        'C. Leclerc',
        'A. Lindblad',
        'L. Lawson',
        'P. Gasly',
        'A. Albon',
        'S. Perez',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: mapOne('M. Verstappen'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },

  'f35417e9-4f0d-4def-9c2f-c81276863fc0': {
    r01: {
      raceId: 'r01',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'O. Piastri',
        'C. Leclerc',
        'L. Norris',
        'L. Hamilton',
        'I. Hadjar',
        'M. Verstappen',
        'L. Lawson',
        'A. Lindblad',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('Alonso'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'C. Leclerc',
        'L. Hamilton',
        'O. Piastri',
        'L. Norris',
        'M. Verstappen',
        'I. Hadjar',
        'O. Bearman',
        'P. Gasly',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('S. Perez'),
      pointsEarned: 0,
      sprintTop8: map([
        'G. Russell',
        'K. Antonelli',
        'L. Hamilton',
        'C. Leclerc',
        'C. Leclerc',
        'M. Verstappen',
        'L. Norris',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r03: {
      raceId: 'r03',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'C. Leclerc',
        'L. Hamilton',
        'M. Verstappen',
        'O. Piastri',
        'L. Norris',
        'I. Hadjar',
        'P. Gasly',
        'A. Lindblad',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('L. Stroll'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r06: {
      raceId: 'r06',
      top10: map([
        'M. Verstappen',
        'K. Antonelli',
        'L. Norris',
        'C. Leclerc',
        'G. Russell',
        'O. Piastri',
        'L. Hamilton',
        'P. Gasly',
        'I. Hadjar',
        'F. Colapinto',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: mapOne('F. Alonso'),
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli',
        'L. Norris',
        'O. Piastri',
        'C. Leclerc',
        'G. Russell',
        'M. Verstappen',
        'L. Hamilton',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r07: {
      raceId: 'r07',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'L. Norris',
        'O. Piastri',
        'L. Hamilton',
        'C. Leclerc',
        'M. Verstappen',
        'I. Hadjar',
        'A. Lindblad',
        'L. Lawson',
      ]),
      fastestLap: mapOne('L. Norris'),
      dnf: mapOne('V. Bottas'),
      pointsEarned: 0,
      sprintTop8: map([
        'G. Russell',
        'K. Antonelli',
        'L. Norris',
        'O. Piastri',
        'L. Hamilton',
        'C. Leclerc',
        'M. Verstappen',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r08: {
      raceId: 'r08',
      top10: map([
        'K. Antonelli',
        'L. Hamilton',
        'O. Piastri',
        'I. Hadjar',
        'L. Lawson',
        'A. Lindblad',
        'P. Gasly',
        'A. Albon',
        'E. Ocon',
        'S. Perez',
      ]),
      fastestLap: mapOne('L. Hamilton'),
      dnf: mapOne('L. Norris'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },

  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': {
    r01: {
      raceId: 'r01',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'C. Leclerc',
        'O. Piastri',
        'I. Hadjar',
        'L. Hamilton',
        'L. Norris',
        'M. Verstappen',
        'L. Lawson',
        'N. Hulkenberg',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('Alonso'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r02: {
      raceId: 'r02',
      top10: map([
        'G. Russell',
        'K. Antonelli',
        'L. Hamilton',
        'C. Leclerc',
        'L. Norris',
        'O. Piastri',
        'M. Verstappen',
        'I. Hadjar',
        'P. Gasly',
        'N. Hulkenberg',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('A. Albon'),
      pointsEarned: 0,
      sprintTop8: map([
        'G. Russell',
        'K. Antonelli',
        'L. Hamilton',
        'L. Norris',
        'C. Leclerc',
        'M. Verstappen',
        'O. Piastri',
        'P. Gasly',
      ]),
      sprintPointsEarned: 0,
    },

    r03: {
      raceId: 'r03',
      top10: map([
        'K. Antonelli',
        'G. Russell',
        'C. Leclerc',
        'L. Hamilton',
        'O. Piastri',
        'L. Norris',
        'I. Hadjar',
        'M. Verstappen',
        'P. Gasly',
        'A. Lindblad',
      ]),
      fastestLap: mapOne('G. Russell'),
      dnf: mapOne('L. Stroll'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },

    r06: {
      raceId: 'r06',
      top10: map([
        'M. Verstappen',
        'K. Antonelli',
        'L. Norris',
        'C. Leclerc',
        'G. Russell',
        'C. Leclerc',
        'O. Piastri',
        'L. Hamilton',
        'P. Gasly',
        'N. Hulkenberg',
      ]),
      fastestLap: mapOne('M. Verstappen'),
      dnf: null,
      pointsEarned: 0,
      sprintTop8: map([
        'L. Norris',
        'K. Antonelli',
        'O. Piastri',
        'C. Leclerc',
        'G. Russell',
        'M. Verstappen',
        'L. Hamilton',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r07: {
      raceId: 'r07',
      top10: map([
        'K. Antonelli',
        'G. Russell',
        'L. Norris',
        'O. Piastri',
        'M. Verstappen',
        'C. Leclerc',
        'L. Hamilton',
        'I. Hadjar',
        'A. Lindblad',
        'F. Colapinto',
      ]),
      fastestLap: mapOne('K. Antonelli'),
      dnf: mapOne('F. Alonso'),
      pointsEarned: 0,
      sprintTop8: map([
        'K. Antonelli',
        'G. Russell',
        'O. Piastri',
        'L. Norris',
        'M. Verstappen',
        'C. Leclerc',
        'L. Hamilton',
        'I. Hadjar',
      ]),
      sprintPointsEarned: 0,
    },

    r08: {
      raceId: 'r08',
      top10: map([
        'C. Leclerc',
        'K. Antonelli',
        'O. Piastri',
        'L. Hamilton',
        'L. Norris',
        'I. Hadjar',
        'L. Lawson',
        'A. Lindblad',
        'P. Gasly',
        'A. Albon',
      ]),
      fastestLap: mapOne('C. Leclerc'),
      dnf: mapOne('C. Sainz'),
      pointsEarned: 0,
      sprintTop8: [],
      sprintPointsEarned: 0,
    },
  },
};

// ---------------------------------------------------------------------------
// Scoring helper
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
      displayName: null,
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