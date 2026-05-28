import { LeagueMember, Prediction } from '@/types';
import { RaceResult } from '@/types';

/**
 * Mock league members with hard-coded predictions for the Miami GP (r06).
 * Their displayed points are computed live against whatever race result the
 * F1DataProvider has loaded, so they stay accurate as data arrives.
 */
export interface MockMember {
  userId: string;
  username: string;
  displayName: string;
  raceId: string;
  prediction: Omit<Prediction, 'id' | 'updatedAt'>;
  joinedAt: string;
}

export const MIAMI_RACE_ID = 'r06';


export const MOCK_LEAGUE_MEMBERS: MockMember[] = [
  {
    userId: 'e11ea4f5-2ba4-4241-9791-b4b6a560534b',
    username: 'sainz4ever55',
    displayName: 'Sainz4Ever55',
    raceId: MIAMI_RACE_ID,
    joinedAt: '2026-03-01T00:00:00Z',
    prediction: {
      raceId: MIAMI_RACE_ID,
      top10: ['ANT', 'RUS', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
  },
  {
    userId: '652154af-dc27-47b5-aa79-25903b9c4a1b',
    username: 'whitney',
    displayName: 'Whitney',
    raceId: MIAMI_RACE_ID,
    joinedAt: '2026-03-01T00:00:00Z',
    prediction: {
      raceId: MIAMI_RACE_ID,
      top10: ['RUS', 'ANT', 'NOR', 'PIA', 'VER', 'LEC', 'HAM', 'HAD', 'LIN', 'COL'],
      fastestLap: 'ANT',
      dnf: 'STR',
      pointsEarned: 0,
      sprintTop8: ['ANT', 'RUS', 'PIA', 'NOR', 'VER', 'LEC', 'HAM', 'HAD'],
      sprintPointsEarned: 0,
    },
  },
];

/**
 * Score a mock member's picks against the loaded Miami race result and the
 * hard-coded sprint result. Returns a fully-formed LeagueMember.
 */
export function scoreMockMember(
  mock: MockMember,
  _raceResult: RaceResult | undefined,
): LeagueMember {
  // Points reset to zero — leaderboard starts from scratch.
  // Predictions stay attached for reference but award no points.
  return {
    userId: mock.userId,
    username: mock.username,
    displayName: mock.displayName,
    role: 'member',
    points: 0,
    joinedAt: mock.joinedAt,
  };
}
