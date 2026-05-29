/**
 * Achievement / Grid Badge system for Apex Draft F1.
 *
 * All achievement definitions live here — visible tiered families (A–K) plus
 * hidden single-unlock badges.  The evaluation engine in
 * @/lib/achievement-engine consumes these definitions to compute progress.
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

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  isHidden: boolean;
  /** Lucide icon name (kebab-case). */
  icon: string;
  /** Tiered achievements have 4 tiers; hidden achievements use `null`. */
  tiers: AchievementTierDefinition[] | null;
  /** Machine key consumed by the evaluation engine. */
  unlockConditionKey: string;
  /** Shown as the requirement text on locked hidden badges. */
  unlockHint?: string;
}

/** Per-player progress snapshot persisted to AsyncStorage. */
export interface AchievementProgress {
  achievementId: string;
  unlockedTiers: AchievementTier[];
  currentValue: number;
  unlockedAt: Partial<Record<AchievementTier, string>>;
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

/* ------------------------------------------------------------------ */
/*  Visible tiered achievements (A–K)                                  */
/* ------------------------------------------------------------------ */

const POINTS_FINISH: AchievementDefinition = {
  id: 'points-finish',
  name: 'Points Finish',
  description: 'Score a strong amount of points in a single race.',
  category: 'race',
  isHidden: false,
  icon: 'star',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Score 25+ points in one race', value: 25 },
    { tier: 'silver', label: 'Silver', requirement: 'Score 50+ points in one race', value: 50 },
    { tier: 'gold', label: 'Gold', requirement: 'Score 75+ points in one race', value: 75 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Score 100+ points in one race', value: 100 },
  ],
  unlockConditionKey: 'single_race_points',
};

const SEASON_CAMPAIGN: AchievementDefinition = {
  id: 'season-campaign',
  name: 'Season Campaign',
  description: 'Earn total points across the season.',
  category: 'season',
  isHidden: false,
  icon: 'calendar',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Earn 500 season points', value: 500 },
    { tier: 'silver', label: 'Silver', requirement: 'Earn 750 season points', value: 750 },
    { tier: 'gold', label: 'Gold', requirement: 'Earn 1,000 season points', value: 1000 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Earn 1,250 season points', value: 1250 },
  ],
  unlockConditionKey: 'season_total_points',
};

const PODIUM_PROPHET: AchievementDefinition = {
  id: 'podium-prophet',
  name: 'Podium Prophet',
  description: 'Correctly predict podium drivers.',
  category: 'race',
  isHidden: false,
  icon: 'trophy',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Predict 1 podium driver in the correct podium position', value: 1 },
    { tier: 'silver', label: 'Silver', requirement: 'Predict 2 podium drivers in the correct podium positions', value: 2 },
    { tier: 'gold', label: 'Gold', requirement: 'Predict all 3 podium drivers in any order', value: 3 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Predict P1, P2, and P3 exactly', value: 4 },
  ],
  unlockConditionKey: 'podium_accuracy',
};

const RACE_WINNER: AchievementDefinition = {
  id: 'race-winner',
  name: 'Race Winner',
  description: 'Correctly predict race winners across the season.',
  category: 'season',
  isHidden: false,
  icon: 'flag',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Correctly predict 1 race winner', value: 1 },
    { tier: 'silver', label: 'Silver', requirement: 'Correctly predict 3 race winners', value: 3 },
    { tier: 'gold', label: 'Gold', requirement: 'Correctly predict 5 race winners', value: 5 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Correctly predict 8 race winners', value: 8 },
  ],
  unlockConditionKey: 'correct_winners_count',
};

const GRID_MASTER: AchievementDefinition = {
  id: 'grid-master',
  name: 'Grid Master',
  description: 'Correctly predict exact finishing positions.',
  category: 'race',
  isHidden: false,
  icon: 'grid-3x3',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Correctly predict 3 exact finishing positions in one race', value: 3 },
    { tier: 'silver', label: 'Silver', requirement: 'Correctly predict 4 exact finishing positions in one race', value: 4 },
    { tier: 'gold', label: 'Gold', requirement: 'Correctly predict 5 exact finishing positions in one race', value: 5 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Correctly predict 6 exact finishing positions in one race', value: 6 },
  ],
  unlockConditionKey: 'exact_positions_single_race',
};

const WEEKEND_WARRIOR: AchievementDefinition = {
  id: 'weekend-warrior',
  name: 'Weekend Warrior',
  description: 'Score strong total points across a race weekend.',
  category: 'race',
  isHidden: false,
  icon: 'zap',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Score 50+ total points across a race weekend', value: 50 },
    { tier: 'silver', label: 'Silver', requirement: 'Score 75+ total points across a race weekend', value: 75 },
    { tier: 'gold', label: 'Gold', requirement: 'Score 100+ total points across a race weekend', value: 100 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Score 125+ total points across a race weekend', value: 125 },
  ],
  unlockConditionKey: 'weekend_total_points',
};

const CHAOS_CALLER: AchievementDefinition = {
  id: 'chaos-caller',
  name: 'Chaos Caller',
  description: 'Correctly predict volatile race events like fastest lap and DNF.',
  category: 'race',
  isHidden: false,
  icon: 'shuffle',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Correctly predict either fastest lap or DNF once', value: 1 },
    { tier: 'silver', label: 'Silver', requirement: 'Correctly predict fastest lap and DNF at least once in the same season', value: 2 },
    { tier: 'gold', label: 'Gold', requirement: 'Correctly predict fastest lap and DNF in the same race', value: 3 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Correctly predict race winner, fastest lap, and DNF in the same race', value: 4 },
  ],
  unlockConditionKey: 'chaos_events',
};

const PERFECT_WEEKEND: AchievementDefinition = {
  id: 'perfect-weekend',
  name: 'Perfect Weekend',
  description: 'Deliver a complete elite prediction weekend.',
  category: 'race',
  isHidden: false,
  icon: 'crown',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Correctly predict race winner and score 50+ points', value: 1 },
    { tier: 'silver', label: 'Silver', requirement: 'Correctly predict race winner and podium drivers in any order', value: 2 },
    { tier: 'gold', label: 'Gold', requirement: 'Correctly predict race winner and exact podium', value: 3 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Correctly predict race winner, exact podium, and either fastest lap or DNF', value: 4 },
  ],
  unlockConditionKey: 'perfect_weekend',
};

const COMEBACK_DRIVE: AchievementDefinition = {
  id: 'comeback-drive',
  name: 'Comeback Drive',
  description: 'Improve dramatically after a previous race.',
  category: 'race',
  isHidden: false,
  icon: 'trending-up',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Improve your race score by 25+ points from the previous race', value: 25 },
    { tier: 'silver', label: 'Silver', requirement: 'Improve your race score by 50+ points from the previous race', value: 50 },
    { tier: 'gold', label: 'Gold', requirement: 'Improve your race score by 75+ points from the previous race', value: 75 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Move from the bottom half of a league race week to top 3 after one race', value: 100 },
  ],
  unlockConditionKey: 'comeback_improvement',
};

const RACE_WEEK_RIVAL: AchievementDefinition = {
  id: 'race-week-rival',
  name: 'Race Week Rival',
  description: 'Perform well inside a league during a single race week.',
  category: 'league',
  isHidden: false,
  icon: 'swords',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Finish top 5 in a league race week', value: 5 },
    { tier: 'silver', label: 'Silver', requirement: 'Finish top 3 in a league race week', value: 3 },
    { tier: 'gold', label: 'Gold', requirement: 'Finish 2nd in a league race week', value: 2 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Finish 1st in a league race week', value: 1 },
  ],
  unlockConditionKey: 'league_race_week_rank',
};

const SEASON_CHAMPION: AchievementDefinition = {
  id: 'season-champion',
  name: 'Season Champion',
  description: 'Perform well inside a league across a full season.',
  category: 'league',
  isHidden: false,
  icon: 'award',
  tiers: [
    { tier: 'bronze', label: 'Bronze', requirement: 'Finish top 10 in a league season', value: 10 },
    { tier: 'silver', label: 'Silver', requirement: 'Finish top 5 in a league season', value: 5 },
    { tier: 'gold', label: 'Gold', requirement: 'Finish top 3 in a league season', value: 3 },
    { tier: 'platinum', label: 'Platinum', requirement: 'Finish 1st in a league season', value: 1 },
  ],
  unlockConditionKey: 'league_season_rank',
};

/* ------------------------------------------------------------------ */
/*  Hidden achievements                                               */
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
  POINTS_FINISH,
  SEASON_CAMPAIGN,
  PODIUM_PROPHET,
  RACE_WINNER,
  GRID_MASTER,
  WEEKEND_WARRIOR,
  CHAOS_CALLER,
  PERFECT_WEEKEND,
  COMEBACK_DRIVE,
  RACE_WEEK_RIVAL,
  SEASON_CHAMPION,
];

export const HIDDEN_ACHIEVEMENTS: AchievementDefinition[] = [
  BOX_BOX_BOX,
  NO_TAKE_BACKS,
  HERO_TO_ZERO,
  SUNDAY_RUINED,
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

/** Factory for an empty progress snapshot. */
export function createEmptyProgress(achievementId: string): AchievementProgress {
  return {
    achievementId,
    unlockedTiers: [],
    currentValue: 0,
    unlockedAt: {},
  };
}
