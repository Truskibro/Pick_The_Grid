export interface Team {
  id: string;
  name: string;
  color: string;
  shortName: string;
}

export interface Driver {
  id: string;
  name: string;
  shortName: string;
  number: number;
  teamId: string;
  championshipPoints: number;
}

export interface Race {
  id: string;
  round: number;
  name: string;
  location: string;
  country: string;
  countryFlag: string;
  raceDate: string;
  raceTime: string;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  hasSprint: boolean;
  /** Sprint race date (Saturday) for sprint weekends, independent of the main race. */
  sprintDate?: string;
  /** Sprint race local time (HH:MM, 24h, UTC). */
  sprintTime?: string;
  winner?: string;
  currentLap?: number;
  totalLaps?: number;
  /** Which racing series this race belongs to ('f1' | 'motogp'). Defaults to 'f1'. */
  seriesId?: string;
}

export type ClassificationStatus =
  | 'finished'
  | 'retired'
  | 'dnf'
  | 'dns';

export interface RaceResult {
  raceId: string;
  classification: ClassificationEntry[];
  fastestLapDriverId: string | null;
  dnfDriverIds: string[];

  /**
   * DNS = Did Not Start.
   * DNS is separate from DNF and should never award DNF prediction points.
   */
  dnsDriverIds?: string[];

  /**
   * Sprint classification when the weekend included a sprint race.
   */
  sprintClassification?: ClassificationEntry[];
}

export interface ClassificationEntry {
  position: number;
  driverId: string;
  time: string;
  gap: string;
  points: number;
  status: ClassificationStatus;
}

export interface Prediction {
  id: string;
  raceId: string;
  top10: string[];
  fastestLap: string | null;
  dnf: string | null;
  pointsEarned: number;
  sprintTop8: string[];
  sprintPointsEarned: number;
  updatedAt: string;
  username: string | null;
  displayName: string | null;
  /** Which racing series this prediction belongs to ('f1' | 'motogp'). Defaults to 'f1'. */
  seriesId?: string;
}

export interface League {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  joinCode: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  /** Which racing series this league belongs to ('f1' | 'motogp'). Defaults to 'f1'. */
  seriesId?: string;
}

export interface LeagueMember {
  userId: string;
  username: string;
  displayName: string;
  role: 'owner' | 'member';
  points: number;
  joinedAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  country: string;
  totalPoints: number;
  rank: number;
  leaguesJoined: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  totalPoints: number;
  previousRank?: number;
  /** Which series these points belong to ('f1' | 'motogp'). */
  seriesId?: string;
}

export interface NotificationSettings {
  lockReminder: boolean;
  raceStartReminder: boolean;
  resultsPosted: boolean;
  /** Notify when a sprint race is about to start (sprint weekends only). */
  sprintStartReminder: boolean;
  /** Notify when a sprint race ends and predictions are being scored. */
  sprintEndReminder: boolean;
  /** Notify when the main race ends and final results are being scored. */
  raceEndReminder: boolean;
}

export const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
export const FASTEST_LAP_BONUS = 1;
export const DNF_BONUS = 10;

// ── MotoGP scoring ─────────────────────────────────────────────────────────
/** MotoGP Sunday race points: 1st–15th */
export const MOTOGP_RACE_POINTS = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
/** MotoGP sprint points: 1st–9th */
export const MOTOGP_SPRINT_POINTS = [12, 9, 7, 6, 5, 4, 3, 2, 1] as const;
export const MOTOGP_FASTEST_LAP_BONUS = 1;
export const MOTOGP_DNF_BONUS = 10;