/**
 * Multi-series configuration.
 *
 * Each racing series (F1, MotoGP, …) has its own:
 *   - labels (Driver vs Rider, Grand Prix, etc.)
 *   - color palette
 *   - scoring points arrays
 *   - pick limits (top N for race & sprint)
 *   - bonus pick labels (DNF vs Crash/DNF)
 *
 * Existing F1 constants in `@/types` (F1_POINTS, SPRINT_POINTS, etc.) remain
 * unchanged — this file re-exports them for the F1 series so all lookups go
 * through a single `getSeriesConfig(seriesId)` helper.
 */

export type SeriesId = 'f1' | 'motogp';

export interface SeriesScoringConfig {
  /** Sunday race points for positions 1..N (N = racePoints.length) */
  racePoints: readonly number[];
  /** Sprint points for positions 1..M (M = sprintPoints.length) */
  sprintPoints: readonly number[];
  /** Bonus for correctly predicting fastest lap */
  fastestLapBonus: number;
  /** Bonus for correctly predicting DNF / Crash-DNF */
  dnfBonus: number;
}

export interface SeriesPickLimits {
  /** Number of race positions the user predicts (e.g. F1 = 10, MotoGP = 15) */
  raceTopN: number;
  /** Number of sprint positions the user predicts (e.g. F1 = 8, MotoGP = 9) */
  sprintTopN: number;
}

export interface SeriesLabels {
  /** Singular noun for a competitor: "Driver" or "Rider" */
  competitor: string;
  /** Plural: "Drivers" or "Riders" */
  competitors: string;
  /** Competitor lowercase: "driver" or "rider" */
  competitorLower: string;
  /** Plural lowercase */
  competitorsLower: string;
  /** Team / Manufacturer label */
  team: string;
  /** Plural team label */
  teams: string;
  /** DNF label shown in UI */
  dnfLabel: string;
  /** "Grand Prix" — used for both F1 and MotoGP */
  eventLabel: string;
  /** Tab label for the prediction screen */
  pickTabLabel: string;
  /** Hero title on the home screen */
  heroTitle: string;
  /** Hero subtitle on the home screen */
  heroSubtitle: string;
  /** Watch-live URL */
  watchUrl: string;
}

export interface SeriesColors {
  /** Primary accent color */
  primary: string;
  /** Lighter accent */
  primaryLight: string;
  /** Darker accent */
  primaryDark: string;
  /** Background base */
  background: string;
  /** Surface card color */
  surface: string;
  /** Elevated surface */
  surfaceElevated: string;
  /** Surface highlight */
  surfaceHighlight: string;
  /** Border color */
  border: string;
  /** Border-light color */
  borderLight: string;
  /** Tab bar background */
  tabBarBackground: string;
  /** Glow rgba */
  accentGlow: string;
  /** Hero gradient stops */
  heroGradient: readonly [string, string, string];
  /** Asphalt texture color (for MotoGP vibe) */
  asphalt?: string;
}

export interface SeriesConfig {
  id: SeriesId;
  /** Display name: "Formula 1" or "MotoGP" */
  name: string;
  /** Short name for pills/badges */
  shortName: string;
  /** Subtitle on the series-selection landing page */
  tagline: string;
  scoring: SeriesScoringConfig;
  pickLimits: SeriesPickLimits;
  labels: SeriesLabels;
  colors: SeriesColors;
}

// ── F1 ──────────────────────────────────────────────────────────────────────

const F1_COLORS: SeriesColors = {
  primary: '#E10600',
  primaryLight: '#FF2D2D',
  primaryDark: '#B30500',
  background: '#0B0E11',
  surface: '#141820',
  surfaceElevated: '#1A1F2A',
  surfaceHighlight: '#232A36',
  border: '#1E2530',
  borderLight: '#2A3340',
  tabBarBackground: '#0B0E11',
  accentGlow: 'rgba(225, 6, 0, 0.15)',
  heroGradient: ['#1A0204', '#10060C', '#0B0E11'] as const,
};

const F1_CONFIG: SeriesConfig = {
  id: 'f1',
  name: 'Formula 1',
  shortName: 'F1',
  tagline: 'Predict the grid, sprints, fastest lap, DNFs, and climb the leaderboard.',
  scoring: {
    racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const,
    sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1] as const,
    fastestLapBonus: 1,
    dnfBonus: 10,
  },
  pickLimits: {
    raceTopN: 10,
    sprintTopN: 8,
  },
  labels: {
    competitor: 'Driver',
    competitors: 'Drivers',
    competitorLower: 'driver',
    competitorsLower: 'drivers',
    team: 'Team',
    teams: 'Teams',
    dnfLabel: 'DNF',
    eventLabel: 'Grand Prix',
    pickTabLabel: 'Pick',
    heroTitle: 'Pick The Grid',
    heroSubtitle: 'Predict the top 10. Score big. Own the paddock.',
    watchUrl: 'https://f1tv.formula1.com/',
  },
  colors: F1_COLORS,
};

// ── MotoGP ──────────────────────────────────────────────────────────────────

const MOTOGP_COLORS: SeriesColors = {
  // MotoGP 2025 rebrand inspired: dark carbon slate + electric cyan + hot yellow.
  // Neutral, flexible masterbrand with high-contrast accents that feels nothing like F1 red.
  primary: '#00E5FF',
  primaryLight: '#4DEEFF',
  primaryDark: '#00A8CC',
  background: '#0A0C0E',
  surface: '#121418',
  surfaceElevated: '#1A1E24',
  surfaceHighlight: '#22282F',
  border: '#1C2228',
  borderLight: '#2A3138',
  tabBarBackground: '#0A0C0E',
  accentGlow: 'rgba(0, 229, 255, 0.15)',
  heroGradient: ['#0A1E26', '#0E141A', '#0A0C0E'] as const,
};

const MOTOGP_CONFIG: SeriesConfig = {
  id: 'motogp',
  name: 'MotoGP',
  shortName: 'MotoGP',
  tagline: 'Predict riders, sprints, race results, crashes, and fight for the championship.',
  scoring: {
    // MotoGP Sunday race points: 1st–15th
    racePoints: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const,
    // MotoGP sprint points: 1st–9th
    sprintPoints: [12, 9, 7, 6, 5, 4, 3, 2, 1] as const,
    fastestLapBonus: 1,
    dnfBonus: 10,
  },
  pickLimits: {
    raceTopN: 15,
    sprintTopN: 9,
  },
  labels: {
    competitor: 'Rider',
    competitors: 'Riders',
    competitorLower: 'rider',
    competitorsLower: 'riders',
    team: 'Manufacturer',
    teams: 'Manufacturers',
    dnfLabel: 'Crash/DNF',
    eventLabel: 'Grand Prix',
    pickTabLabel: 'Pick',
    heroTitle: 'Pick Your Race',
    heroSubtitle: 'Predict the top 15. Score big. Own the circuit.',
    watchUrl: 'https://www.motogp.com/video',
  },
  colors: MOTOGP_COLORS,
};

// ── Registry ────────────────────────────────────────────────────────────────

const SERIES_REGISTRY: Record<SeriesId, SeriesConfig> = {
  f1: F1_CONFIG,
  motogp: MOTOGP_CONFIG,
};

export const ALL_SERIES: SeriesConfig[] = [F1_CONFIG, MOTOGP_CONFIG];

export function getSeriesConfig(seriesId: SeriesId): SeriesConfig {
  return SERIES_REGISTRY[seriesId] ?? F1_CONFIG;
}

export function isValidSeriesId(id: string | null | undefined): id is SeriesId {
  return id === 'f1' || id === 'motogp';
}

/**
 * Returns the race-points array for a given position (1-indexed).
 * Returns 0 for positions beyond the points distribution.
 */
export function racePointsForPosition(seriesId: SeriesId, position: number): number {
  const { racePoints } = getSeriesConfig(seriesId).scoring;
  const idx = position - 1;
  if (idx < 0 || idx >= racePoints.length) return 0;
  return racePoints[idx];
}

/**
 * Returns the sprint-points array for a given position (1-indexed).
 * Returns 0 for positions beyond the points distribution.
 */
export function sprintPointsForPosition(seriesId: SeriesId, position: number): number {
  const { sprintPoints } = getSeriesConfig(seriesId).scoring;
  const idx = position - 1;
  if (idx < 0 || idx >= sprintPoints.length) return 0;
  return sprintPoints[idx];
}
