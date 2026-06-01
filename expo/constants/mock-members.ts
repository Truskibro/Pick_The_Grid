import { LeagueMember } from '@/types';
import { RaceResult } from '@/types';
import {
  SEED_USERS,
  scoreSeededPredictions,
  COMPLETED_RACE_IDS,
} from '@/constants/seed-predictions';

/**
 * Mock league member — a seed user whose predictions (from the spreadsheet)
 * are scored against whatever race results the F1DataProvider has loaded.
 *
 * Points are computed live from `scoreSeededPredictions` which sums GP +
 * sprint points across all completed races (r01, r02, r03, r06, r07).
 * Cancelled races (Bahrain r04, Saudi r05) and upcoming races (Monaco r08+)
 * are excluded.
 */
export interface MockMember {
  userId: string;
  username: string;
  displayName: string;
  joinedAt: string;
}

/**
 * All four seed users from the 2026 Pick The Grid spreadsheet.
 * Their predictions live in `constants/seed-predictions.ts`.
 */
export const MOCK_LEAGUE_MEMBERS: MockMember[] = SEED_USERS.map((u) => ({
  userId: u.userId,
  username: u.username,
  displayName: u.displayName,
  joinedAt: '2026-03-01T00:00:00Z',
}));

/**
 * Score a mock member's seeded predictions against all loaded race results.
 * Returns a fully-formed LeagueMember with live points summed across
 * every completed race before Monaco.
 */
export function scoreMockMember(
  mock: MockMember,
  raceResults: RaceResult[],
): LeagueMember {
  const points = scoreSeededPredictions(mock.userId, raceResults);

  return {
    userId: mock.userId,
    username: mock.username,
    displayName: mock.displayName,
    role: 'member' as const,
    points,
    joinedAt: mock.joinedAt,
  };
}

// Re-export for callers that need the race IDs
export { COMPLETED_RACE_IDS };
