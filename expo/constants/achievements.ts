/**
 * Achievement / Grid Badge system for Apex Draft F1.
 *
 * All achievement definitions live here — visible tiered families, a special
 * non-tiered badge (Best in the World), plus hidden single-unlock badges.
 * The evaluation engine in @/lib/achievement-engine consumes these
 * definitions to compute progress.
 *
 * IMPORTANT DISPLAY RULES
 * -----------------------
 * Platinum tiers are completely hidden until unlocked. Before unlock, the UI
 * must not render a Platinum tier row, locked placeholder, progress toward
 * Platinum, or any indication that Platinum exists. Once unlocked, Platinum is
 * revealed as a completed tier with its actual requirement text.
 *
 * SEASON-BASED REPEATABLE ACHIEVEMENTS
 * ------------------------------------
 * Achievements flagged `isSeasonBased` repeat every season. Earned instances
 * are recorded per-season in `AchievementProgress.seasonInstances` and
 * displayed as "Achievement Name — 2026", "Achievement Name — 2027", etc.
 * Earning a new season never overwrites a previous season's instance.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type AchievementCategory = 'race' | 'season' | 'league';

export interface AchievementTierDefinition {
  tier: AchievementTier;
  label: string;
  requirement: string;
  /** Numeric threshold the engine compares against. */
  value: number;
}

/**
 * A per-season earned instance for season-based repeatable achievements.
 * The season label (e.g. "2026") is stored on the instance, not on the
 * base achievement definition, so the definition ID stays stable.
 */
export interface SeasonInstance {
  /** Season label, e.g. "2026". */
  season: string;
  unlockedTiers: AchievementTier[];
  currentValue: number;
  unlockedAt: Partial<Record<AchievementTier, string>>;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  isHidden: boolean;
  /**
   * Special non-tiered, non-hidden achievement (e.g. Best in the World).
   * Structurally like a hidden achievement (tiers: null, binary unlock) but
   * publicly listed and revealed.
   */
  isSpecial?: boolean;
  /**
   * Season-based repeatable achievements earn a fresh instance each season.
   * The season label is recorded on the earned instance, not the definition.
   */
  isSeasonBased?: boolean;
  /** Lucide icon name (kebab-case). */
  icon: string;
  /** Tiered achievements have 4 tiers; hidden/special achievements use `null`. */
  tiers: AchievementTierDefinition[] | null;
  /** Machine key consumed by the evaluation engine. */
  unlockConditionKey: string;
  /** Shown as the requirement text on locked hidden badges. */
  unlockHint?: string;
  /**
   * Rank-style achievements are lower-is-better (rank 1 = best).
   * The engine compares currentValue <= tier.value instead of >=.
   * Defaults to false (higher-is-better, e.g. points).
   */
  lowerIsBetter?: boolean;
}

/** Per-player progress snapshot persisted to AsyncStorage + Supabase. */
export interface AchievementProgress {
  achievementId: string;
  unlockedTiers: AchievementTier[];
  currentValue: number;
  unlockedAt: Partial<Record<AchievementTier, string>>;
  /**
   * For season-based achievements: one entry per season that has progress.
   * The current season's instance is always present and mirrors the flat
   * fields. Previous seasons are frozen and never overwritten.
   */
  seasonInstances?: SeasonInstance[];
}

export type AchievementState = Record<string, AchievementProgress>;

/* ------------------------------------------------------------------ */
/*  Tier colour palette                                                */
/* ------------------------------------------------------------------ */

export const TIER_COLORS: Record<
  AchievementTier,
  { primary: string; secondary: string; glow: string }
> = {
  bronze: {
    primary: '#CD7F32',
    secondary: '#8B5A2B',
    glow: 'rgba(205, 127, 50, 0.30)',
  },
  silver: {
    primary: '#C0C0C0',
    secondary: '#808080',
    glow: 'rgba(192, 192, 192, 0.30)',
  },
  gold: {
    primary: '#FFD700',
    secondary: '#B8860B',
    glow: 'rgba(255, 215, 0, 0.30)',
  },
  platinum: {
    primary: '#76E4FF',
    secondary: '#4A9FB5',
    glow: 'rgba(118, 228, 255, 0.30)',
  },
};

export const TIER_ORDER: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

/**
 * Tiers shown while Platinum is still locked. Platinum is revealed only once
 * unlocked, so locked UI renders only these three tiers.
 */
export const VISIBLE_TIERS_WHEN_LOCKED: AchievementTier[] = ['bronze', 'silver', 'gold'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** True when a Platinum tier has been unlocked for this achievement. */
export function isPlatinumUnlocked(progress?: AchievementProgress): boolean {
  return !!progress?.unlockedTiers?.includes('platinum');
}

/**
 * Returns the tiers that should be displayed for a tiered achievement:
 * Bronze/Silver/Gold always, Platinum only once unlocked.
 */
export function getDisplayTiers(
  def: AchievementDefinition,
  progress?: AchievementProgress,
): AchievementTierDefinition[] {
  if (!def.tiers) return [];
  if (isPlatinumUnlocked(progress)) return def.tiers;
  return def.tiers.filter((t) => t.tier !== 'platinum');
}

/**
 * The highest threshold the progress bar should measure against. While
 * Platinum is hidden, the bar is capped at Gold so it never implies a hidden
 * fourth tier. Once Platinum is unlocked, the bar measures against Platinum.
 */
export function getProgressDenominator(
  def: AchievementDefinition,
  progress?: AchievementProgress,
): number {
  if (!def.tiers || def.tiers.length === 0) return 0;
  if (isPlatinumUnlocked(progress)) {
    return def.tiers[def.tiers.length - 1].value;
  }
  const gold = def.tiers.find((t) => t.tier === 'gold');
  return gold ? gold.value : def.tiers[def.tiers.length - 1].value;
}

/* ------------------------------------------------------------------ */
/*  Visible tiered achievements                                        */
/* ------------------------------------------------------------------ */

const RACE_DAY_HAUL: AchievementDefinition = {
  id: 'race-day-haul',
  name: 'Race Day Haul',
  description:
    'Score a strong amount of Grand Prix race points in a single race. Only Grand Prix race points count — sprint points are excluded.',
  category: 'race',
  isHidden: false,
  icon: 'star',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Score 40 race points in one Grand Prix', value: 40 },
    { tier: 'silver', label: 'Silver', requirement: 'Score 60 race points in one Grand Prix', value: 60 },
    { tier: 'gold', label: 'Gold', requirement: 'Score 80 race points in one Grand Prix', value: 80 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Score 105+ race points in one Grand Prix', value: 105 },
  ],
  unlockConditionKey: 'race_day_points',
};

const SEASON_CAMPAIGN: AchievementDefinition = {
  id: 'season-campaign',
  name: 'Season Campaign',
  description: 'Earn total season points across a full season.',
  category: 'season',
  isHidden: false,
  isSeasonBased: true,
  icon: 'calendar',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Score 650 season points', value: 650 },
    { tier: 'silver', label: 'Silver', requirement: 'Score 900 season points', value: 900 },
    { tier: 'gold', label: 'Gold', requirement: 'Score 1,150 season points', value: 1150 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Score 1,500 season points', value: 1500 },
  ],
  unlockConditionKey: 'season_total_points',
};

const PODIUM_PROPHET: AchievementDefinition = {
  id: 'podium-prophet',
  name: 'Podium Prophet',
  description: 'Correctly predict the race podium.',
  category: 'race',
  isHidden: false,
  icon: 'trophy',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Predict 2 of the 3 podium drivers in one race', value: 1 },
    { tier: 'silver', label: 'Silver', requirement: 'Predict 2 podium drivers in their exact positions', value: 2 },
    { tier: 'gold', label: 'Gold', requirement: 'Predict all 3 podium drivers in their exact positions', value: 3 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Predict the exact podium order, fastest lap, and DNF in the same race', value: 4 },
  ],
  unlockConditionKey: 'podium_accuracy',
};

const RACE_WINNER: AchievementDefinition = {
  id: 'race-winner',
  name: 'Race Winner',
  description: 'Correctly predict race winners across a single season.',
  category: 'season',
  isHidden: false,
  isSeasonBased: true,
  icon: 'flag',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Correctly predict 3 race winners in one season', value: 3 },
    { tier: 'silver', label: 'Silver', requirement: 'Correctly predict 7 race winners in one season', value: 7 },
    { tier: 'gold', label: 'Gold', requirement: 'Correctly predict 11 race winners in one season', value: 11 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Correctly predict 20 race winners in one season', value: 20 },
  ],
  unlockConditionKey: 'correct_winners_count',
};

const GRID_MASTER: AchievementDefinition = {
  id: 'grid-master',
  name: 'Grid Master',
  description: 'Correctly predict exact finishing positions in a single race.',
  category: 'race',
  isHidden: false,
  icon: 'grid-3x3',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Get 4 exact finishing positions in one race', value: 4 },
    { tier: 'silver', label: 'Silver', requirement: 'Get 5 exact finishing positions in one race', value: 5 },
    { tier: 'gold', label: 'Gold', requirement: 'Get 6 exact finishing positions in one race', value: 6 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Get 9 exact finishing positions in one race', value: 9 },
  ],
  unlockConditionKey: 'exact_positions_single_race',
};

const WEEKEND_WARRIOR: AchievementDefinition = {
  id: 'weekend-warrior',
  name: 'Weekend Warrior',
  description:
    'Score strong total points across a full race weekend. Both race and sprint points count.',
  category: 'race',
  isHidden: false,
  icon: 'zap',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Score 65 points in one race weekend', value: 65 },
    { tier: 'silver', label: 'Silver', requirement: 'Score 80 points in one race weekend', value: 80 },
    { tier: 'gold', label: 'Gold', requirement: 'Score 105 points in one race weekend', value: 105 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Score 145+ points in one race weekend', value: 145 },
  ],
  unlockConditionKey: 'weekend_total_points',
};

const CHAOS_CALLER: AchievementDefinition = {
  id: 'chaos-caller',
  name: 'Chaos Caller',
  description:
    'Correctly predict volatile race events across a season. Bonus picks are fastest lap and DNF. DNS does not count as a correct DNF.',
  category: 'season',
  isHidden: false,
  isSeasonBased: true,
  icon: 'shuffle',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Correctly predict 3 total bonus picks in one season', value: 3 },
    { tier: 'silver', label: 'Silver', requirement: 'Correctly predict 6 total bonus picks in one season', value: 6 },
    { tier: 'gold', label: 'Gold', requirement: 'Correctly predict 10 total bonus picks in one season', value: 10 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Correctly predict 25 total bonus picks in one season', value: 25 },
  ],
  unlockConditionKey: 'season_bonus_picks',
};

const PERFECT_WEEKEND: AchievementDefinition = {
  id: 'perfect-weekend',
  name: 'Perfect Weekend',
  description:
    'Deliver an elite prediction on a sprint weekend. All tiers require a sprint weekend.',
  category: 'race',
  isHidden: false,
  icon: 'crown',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'On a sprint weekend, correctly predict the race winner and score 12+ sprint points', value: 1 },
    { tier: 'silver', label: 'Silver', requirement: 'On a sprint weekend, correctly predict the exact race podium and score 18+ sprint points', value: 2 },
    { tier: 'gold', label: 'Gold', requirement: 'On a sprint weekend, correctly predict the exact race podium, fastest lap, and score 24+ sprint points', value: 3 },
    { tier: 'platinum', label: 'Platinum', requirement: 'On a sprint weekend, perfectly predict every available category: exact race top 10, fastest lap, DNF, and exact sprint top 8', value: 4 },
  ],
  unlockConditionKey: 'perfect_weekend',
};

const COMEBACK_DRIVE: AchievementDefinition = {
  id: 'comeback-drive',
  name: 'Comeback Drive',
  description:
    'Climb the standings from the bottom of a league. Only leagues with at least 6 active members count, and you must be ranked in the bottom 50% before the weekend starts.',
  category: 'league',
  isHidden: false,
  icon: 'trending-up',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'While ranked in the bottom 50% of a league, gain 2+ league positions in one race weekend', value: 2 },
    { tier: 'silver', label: 'Silver', requirement: 'While ranked in the bottom 50% of a league, gain 4+ league positions in one race weekend', value: 4 },
    { tier: 'gold', label: 'Gold', requirement: 'While ranked in the bottom 50% of a league, gain 6+ league positions in one race weekend', value: 6 },
    { tier: 'platinum', label: 'Platinum', requirement: 'While ranked in the bottom 50% of a league, gain 8+ league positions in one race weekend', value: 8 },
  ],
  unlockConditionKey: 'comeback_gain',
};

const SEASON_CHAMPION: AchievementDefinition = {
  id: 'season-champion',
  name: 'Season Champion',
  description:
    'Finish the season near the top of the global leaderboard. Based on the global leaderboard, not leagues.',
  category: 'season',
  isHidden: false,
  isSeasonBased: true,
  icon: 'award',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Finish the season in the top 25% of the global leaderboard', value: 75 },
    { tier: 'silver', label: 'Silver', requirement: 'Finish the season in the top 10% of the global leaderboard', value: 90 },
    { tier: 'gold', label: 'Gold', requirement: 'Finish the season in the top 5% of the global leaderboard', value: 95 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Finish the season in the top 1% of the global leaderboard', value: 99 },
  ],
  unlockConditionKey: 'season_global_percentile',
};

const SATURDAY_SPECIALIST: AchievementDefinition = {
  id: 'saturday-specialist',
  name: 'Saturday Specialist',
  description: 'Score strong points in a single sprint race.',
  category: 'race',
  isHidden: false,
  icon: 'rocket',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Score 12 sprint points in one sprint', value: 12 },
    { tier: 'silver', label: 'Silver', requirement: 'Score 18 sprint points in one sprint', value: 18 },
    { tier: 'gold', label: 'Gold', requirement: 'Score 24 sprint points in one sprint', value: 24 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Score 34+ sprint points in one sprint', value: 34 },
  ],
  unlockConditionKey: 'sprint_points_single',
};

const SPRINT_SURGEON: AchievementDefinition = {
  id: 'sprint-surgeon',
  name: 'Sprint Surgeon',
  description: 'Correctly predict exact sprint finishing positions in a single sprint.',
  category: 'race',
  isHidden: false,
  icon: 'activity',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Get 2 exact sprint positions in one sprint', value: 2 },
    { tier: 'silver', label: 'Silver', requirement: 'Get 3 exact sprint positions in one sprint', value: 3 },
    { tier: 'gold', label: 'Gold', requirement: 'Get 4 exact sprint positions in one sprint', value: 4 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Get 7 exact sprint positions in one sprint', value: 7 },
  ],
  unlockConditionKey: 'sprint_exact_positions',
};

const GLOBAL_PODIUM: AchievementDefinition = {
  id: 'global-podium',
  name: 'Global Podium',
  description: 'Finish the season among the best players worldwide.',
  category: 'season',
  isHidden: false,
  isSeasonBased: true,
  icon: 'globe',
  lowerIsBetter: true,
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Finish the season in the top 100 users worldwide', value: 100 },
    { tier: 'silver', label: 'Silver', requirement: 'Finish the season in the top 25 users worldwide', value: 25 },
    { tier: 'gold', label: 'Gold', requirement: 'Finish the season in the top 10 users worldwide', value: 10 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Finish the season on the global podium: top 3 worldwide', value: 3 },
  ],
  unlockConditionKey: 'season_global_rank',
};

/* ------------------------------------------------------------------ */
/*  Special non-tiered achievement                                     */
/* ------------------------------------------------------------------ */

const BEST_IN_THE_WORLD: AchievementDefinition = {
  id: 'best-in-the-world',
  name: 'Best in the World',
  description: 'Finish a season ranked #1 on the global leaderboard.',
  category: 'season',
  isHidden: false,
  isSpecial: true,
  isSeasonBased: true,
  icon: 'crown',
  tiers: null,
  unlockConditionKey: 'season_global_number_one',
};

/* ------------------------------------------------------------------ */
/*  Hidden achievements (unchanged)                                    */
/* ------------------------------------------------------------------ */

const BOX_BOX_BOX: AchievementDefinition = {
  id: 'box-box-box',
  name: 'Box Box Box',
  description: 'Edit prediction within a minute of lock.',
  category: 'race',
  isHidden: true,
  icon: 'timer',
  tiers: null,
  unlockConditionKey: 'last_minute_edit',
  unlockHint: 'Edit your prediction within 60 seconds of the lock deadline',
};

const NO_TAKE_BACKS: AchievementDefinition = {
  id: 'no-take-backs',
  name: 'No Take Backs',
  description: 'Submit a full grid and never edit it before lock.',
  category: 'race',
  isHidden: true,
  icon: 'lock',
  tiers: null,
  unlockConditionKey: 'no_edits_full_grid',
  unlockHint: 'Submit a complete prediction and never change it before the deadline',
};

const GOLDEN_GOOSE_EGG: AchievementDefinition = {
  id: 'golden-goose-egg',
  name: 'Golden Goose Egg',
  description: 'Submit full grid and score 0.',
  category: 'race',
  isHidden: true,
  icon: 'alert-triangle',
  tiers: null,
  unlockConditionKey: 'full_grid_zero_points',
  unlockHint: 'Submit predictions for all 10 positions and score exactly 0 points',
};

const HERO_TO_ZERO: AchievementDefinition = {
  id: 'hero-to-zero',
  name: 'Hero to Zero',
  description: 'Predicted winner DNFs.',
  category: 'race',
  isHidden: true,
  icon: 'frown',
  tiers: null,
  unlockConditionKey: 'predicted_winner_dnf',
  unlockHint: 'Your predicted race winner fails to finish the race',
};

const ALMOST_HAD_IT: AchievementDefinition = {
  id: 'almost-had-it',
  name: 'Almost Had It',
  description: 'Correct podium drivers but wrong order.',
  category: 'race',
  isHidden: true,
  icon: 'refresh-cw',
  tiers: null,
  unlockConditionKey: 'correct_podium_wrong_order',
  unlockHint: 'Get all 3 podium drivers right but in the wrong positions',
};

const FERRARI_STRATEGY: AchievementDefinition = {
  id: 'ferrari-strategy-dept',
  name: 'Ferrari Strategy Dept.',
  description: 'Change prediction 5+ times before lock.',
  category: 'race',
  isHidden: true,
  icon: 'edit-3',
  tiers: null,
  unlockConditionKey: 'many_edits',
  unlockHint: 'Edit your prediction 5 or more times for a single race before the lock deadline',
};

const CHAOS_MERCHANT: AchievementDefinition = {
  id: 'chaos-merchant',
  name: 'Chaos Merchant',
  description: 'Correctly predict fastest lap and DNF in the same race.',
  category: 'race',
  isHidden: true,
  icon: 'flame',
  tiers: null,
  unlockConditionKey: 'chaos_merchant',
  unlockHint: 'Correctly predict both the fastest lap driver and a DNF in the same race',
};

/* ------------------------------------------------------------------ */
/*  Master registry                                                    */
/* ------------------------------------------------------------------ */

export const VISIBLE_ACHIEVEMENTS: AchievementDefinition[] = [
  RACE_DAY_HAUL,
  SEASON_CAMPAIGN,
  PODIUM_PROPHET,
  RACE_WINNER,
  GRID_MASTER,
  WEEKEND_WARRIOR,
  CHAOS_CALLER,
  PERFECT_WEEKEND,
  COMEBACK_DRIVE,
  SEASON_CHAMPION,
  SATURDAY_SPECIALIST,
  SPRINT_SURGEON,
  GLOBAL_PODIUM,
  BEST_IN_THE_WORLD,
];

export const HIDDEN_ACHIEVEMENTS: AchievementDefinition[] = [
  BOX_BOX_BOX,
  NO_TAKE_BACKS,
  GOLDEN_GOOSE_EGG,
  HERO_TO_ZERO,
  ALMOST_HAD_IT,
  FERRARI_STRATEGY,
  CHAOS_MERCHANT,
];

export const ALL_ACHIEVEMENTS: AchievementDefinition[] = [
  ...VISIBLE_ACHIEVEMENTS,
  ...HIDDEN_ACHIEVEMENTS,
];

/** Lookup map keyed by achievement id. */
export const ACHIEVEMENT_MAP: Record<string, AchievementDefinition> = Object.fromEntries(
  ALL_ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** IDs of season-based repeatable achievements. */
export const SEASON_BASED_IDS: ReadonlySet<string> = new Set(
  ALL_ACHIEVEMENTS.filter((a) => a.isSeasonBased).map((a) => a.id),
);

/** Factory for an empty progress snapshot. */
export function createEmptyProgress(achievementId: string): AchievementProgress {
  return {
    achievementId,
    unlockedTiers: [],
    currentValue: 0,
    unlockedAt: {},
  };
}
