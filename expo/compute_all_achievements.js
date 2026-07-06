/**
 * Recompute achievements for ALL users and write them to Supabase.
 *
 * Uses the Supabase REST API with the service role key (bypasses RLS).
 * Replicates the engine logic from expo/lib/achievement-engine.ts so we
 * don't need a TS build step — plain Node.js.
 *
 * Run: node compute_all_achievements.js
 */

const https = require('https');

// ── Supabase config ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

// ── HTTP helper ──────────────────────────────────────────────────────────
function fetchTable(table, select = '*') {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    const req = https.get(
      url,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Profile': 'public',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`GET ${table} failed ${res.statusCode}: ${data.slice(0, 300)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`GET ${table} JSON parse: ${e.message}`));
          }
        });
      },
    );
    req.on('error', reject);
  });
}

function upsertRows(table, rows, onConflict) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rows);
    const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Profile': 'public',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`UPSERT ${table} failed ${res.statusCode}: ${data.slice(0, 400)}`));
            return;
          }
          resolve();
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Achievement definitions (mirrors expo/constants/achievements.ts) ─────
const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

const ACHIEVEMENTS = [
  // race-day-haul: max race points in one GP (no sprint). value: points
  { id: 'race-day-haul', seasonBased: false, key: 'race_day_points', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 40 }, { tier: 'silver', value: 60 }, { tier: 'gold', value: 80 }, { tier: 'platinum', value: 105 }] },
  // season-campaign: total season points. value: points
  { id: 'season-campaign', seasonBased: true, key: 'season_total_points', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 650 }, { tier: 'silver', value: 900 }, { tier: 'gold', value: 1150 }, { tier: 'platinum', value: 1500 }] },
  // podium-prophet: level 1-4
  { id: 'podium-prophet', seasonBased: false, key: 'podium_accuracy', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 1 }, { tier: 'silver', value: 2 }, { tier: 'gold', value: 3 }, { tier: 'platinum', value: 4 }] },
  // race-winner: correct winners in season. value: count
  { id: 'race-winner', seasonBased: true, key: 'correct_winners_count', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 3 }, { tier: 'silver', value: 7 }, { tier: 'gold', value: 11 }, { tier: 'platinum', value: 20 }] },
  // grid-master: exact positions in one race
  { id: 'grid-master', seasonBased: false, key: 'exact_positions_single_race', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 4 }, { tier: 'silver', value: 5 }, { tier: 'gold', value: 6 }, { tier: 'platinum', value: 9 }] },
  // weekend-warrior: race + sprint points in one weekend
  { id: 'weekend-warrior', seasonBased: false, key: 'weekend_total_points', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 65 }, { tier: 'silver', value: 80 }, { tier: 'gold', value: 105 }, { tier: 'platinum', value: 145 }] },
  // chaos-caller: bonus picks in season (fastest lap + DNF, DNS doesn't count)
  { id: 'chaos-caller', seasonBased: true, key: 'season_bonus_picks', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 3 }, { tier: 'silver', value: 6 }, { tier: 'gold', value: 10 }, { tier: 'platinum', value: 25 }] },
  // perfect-weekend: level 1-4 (sprint weekend required)
  { id: 'perfect-weekend', seasonBased: false, key: 'perfect_weekend', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 1 }, { tier: 'silver', value: 2 }, { tier: 'gold', value: 3 }, { tier: 'platinum', value: 4 }] },
  // comeback-drive: league positions gained from bottom 50%
  { id: 'comeback-drive', seasonBased: false, key: 'comeback_gain', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 2 }, { tier: 'silver', value: 4 }, { tier: 'gold', value: 6 }, { tier: 'platinum', value: 8 }] },
  // season-champion: global percentile (higher = better). value: percentile floor
  { id: 'season-champion', seasonBased: true, key: 'season_global_percentile', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 75 }, { tier: 'silver', value: 90 }, { tier: 'gold', value: 95 }, { tier: 'platinum', value: 99 }] },
  // saturday-specialist: max sprint points in one sprint
  { id: 'saturday-specialist', seasonBased: false, key: 'sprint_points_single', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 12 }, { tier: 'silver', value: 18 }, { tier: 'gold', value: 24 }, { tier: 'platinum', value: 34 }] },
  // sprint-surgeon: exact sprint positions in one sprint
  { id: 'sprint-surgeon', seasonBased: false, key: 'sprint_exact_positions', lowerIsBetter: false,
    tiers: [{ tier: 'bronze', value: 2 }, { tier: 'silver', value: 3 }, { tier: 'gold', value: 4 }, { tier: 'platinum', value: 7 }] },
  // global-podium: global rank (lower = better)
  { id: 'global-podium', seasonBased: true, key: 'season_global_rank', lowerIsBetter: true,
    tiers: [{ tier: 'bronze', value: 100 }, { tier: 'silver', value: 25 }, { tier: 'gold', value: 10 }, { tier: 'platinum', value: 3 }] },
  // best-in-the-world: special, binary
  { id: 'best-in-the-world', seasonBased: true, key: 'season_global_number_one', lowerIsBetter: false,
    tiers: null },
  // Hidden achievements (binary)
  { id: 'box-box-box', seasonBased: false, key: 'last_minute_edit', tiers: null },
  { id: 'no-take-backs', seasonBased: false, key: 'no_edits_full_grid', tiers: null },
  { id: 'golden-goose-egg', seasonBased: false, key: 'full_grid_zero_points', tiers: null },
  { id: 'hero-to-zero', seasonBased: false, key: 'predicted_winner_dnf', tiers: null },
  { id: 'almost-had-it', seasonBased: false, key: 'correct_podium_wrong_order', tiers: null },
  { id: 'ferrari-strategy-dept', seasonBased: false, key: 'many_edits', tiers: null },
  { id: 'chaos-merchant', seasonBased: false, key: 'chaos_merchant', tiers: null },
];

const ACH_BY_KEY = {};
for (const a of ACHIEVEMENTS) ACH_BY_KEY[a.key] = a;

// ── Value computers (mirror expo/lib/achievement-engine.ts) ──────────────

function maxRaceDayPoints(preds) {
  return preds.reduce((m, p) => Math.max(m, p.points_earned ?? 0), 0);
}

function maxPodiumAccuracy(preds, results) {
  let best = 0;
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    const resultPodium = result.classification
      .filter((c) => c.position <= 3)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.driverId);
    const predPodium = (pred.predicted_top10 || []).slice(0, 3);
    if (predPodium.length < 3) continue;
    const exactMatch = predPodium[0] === resultPodium[0] && predPodium[1] === resultPodium[1] && predPodium[2] === resultPodium[2];
    let correctPositions = 0;
    for (let i = 0; i < 3; i++) if (predPodium[i] === resultPodium[i]) correctPositions++;
    const driversCorrectAnyOrder = predPodium.filter((d) => resultPodium.includes(d)).length;
    let level = 0;
    if (driversCorrectAnyOrder >= 2) level = Math.max(level, 1);
    if (correctPositions >= 2) level = Math.max(level, 2);
    if (exactMatch) level = Math.max(level, 3);
    if (exactMatch) {
      const flCorrect = !!pred.predicted_fastest_lap && pred.predicted_fastest_lap === result.fastest_lap_driver_id;
      const dnfCorrect = !!pred.predicted_dnf && (result.dnf_driver_ids || []).includes(pred.predicted_dnf);
      if (flCorrect && dnfCorrect) level = Math.max(level, 4);
    }
    if (level > best) best = level;
  }
  return best;
}

function maxExactPositions(preds, results) {
  let best = 0;
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    const resultTop10 = result.classification.filter((c) => c.position <= 10).sort((a, b) => a.position - b.position).map((c) => c.driverId);
    const predTop10 = pred.predicted_top10 || [];
    let exact = 0;
    for (let i = 0; i < Math.min(predTop10.length, resultTop10.length); i++) {
      if (predTop10[i] === resultTop10[i]) exact++;
    }
    if (exact > best) best = exact;
  }
  return best;
}

function maxWeekendPoints(preds) {
  return preds.reduce((m, p) => Math.max(m, (p.points_earned ?? 0) + (p.sprint_points_earned ?? 0)), 0);
}

function exactRaceTop10(pred, result) {
  const resultTop10 = result.classification.filter((c) => c.position <= 10).sort((a, b) => a.position - b.position).map((c) => c.driverId);
  const predTop10 = pred.predicted_top10 || [];
  if (predTop10.length < 10 || resultTop10.length < 10) return false;
  for (let i = 0; i < 10; i++) if (predTop10[i] !== resultTop10[i]) return false;
  return true;
}

function exactSprintTop8(pred, result) {
  if (!result.sprint_classification || result.sprint_classification.length === 0) return false;
  const resultTop8 = result.sprint_classification.filter((c) => c.position <= 8).sort((a, b) => a.position - b.position).map((c) => c.driverId);
  const predTop8 = pred.predicted_sprint_top8 || [];
  if (predTop8.length < 8 || resultTop8.length < 8) return false;
  for (let i = 0; i < 8; i++) if (predTop8[i] !== resultTop8[i]) return false;
  return true;
}

function maxPerfectWeekendLevel(preds, results, racesById) {
  let best = 0;
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    const race = racesById[pred.race_id];
    if (!race || !race.has_sprint) continue;
    const winnerCorrect = (pred.predicted_top10 || []).length > 0 &&
      result.classification.some((c) => c.position === 1 && c.driverId === pred.predicted_top10[0]);
    const sprintPts = pred.sprint_points_earned ?? 0;
    const resultPodium = result.classification.filter((c) => c.position <= 3).sort((a, b) => a.position - b.position).map((c) => c.driverId);
    const predPodium = (pred.predicted_top10 || []).slice(0, 3);
    const exactPodium = predPodium.length >= 3 &&
      predPodium[0] === resultPodium[0] && predPodium[1] === resultPodium[1] && predPodium[2] === resultPodium[2];
    const flCorrect = !!pred.predicted_fastest_lap && pred.predicted_fastest_lap === result.fastest_lap_driver_id;
    const dnfCorrect = !!pred.predicted_dnf && (result.dnf_driver_ids || []).includes(pred.predicted_dnf);
    if (winnerCorrect && sprintPts >= 12) best = Math.max(best, 1);
    if (exactPodium && sprintPts >= 18) best = Math.max(best, 2);
    if (exactPodium && flCorrect && sprintPts >= 24) best = Math.max(best, 3);
    if (exactRaceTop10(pred, result) && flCorrect && dnfCorrect && exactSprintTop8(pred, result)) best = Math.max(best, 4);
  }
  return best;
}

function maxSprintPoints(preds) {
  return preds.reduce((m, p) => Math.max(m, p.sprint_points_earned ?? 0), 0);
}

function maxSprintExactPositions(preds, results) {
  let best = 0;
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.sprint_classification || result.sprint_classification.length === 0) continue;
    const resultTop8 = result.sprint_classification.filter((c) => c.position <= 8).sort((a, b) => a.position - b.position).map((c) => c.driverId);
    const predTop8 = pred.predicted_sprint_top8 || [];
    let exact = 0;
    for (let i = 0; i < Math.min(predTop8.length, resultTop8.length); i++) {
      if (predTop8[i] === resultTop8[i]) exact++;
    }
    if (exact > best) best = exact;
  }
  return best;
}

function raceInSeason(race, season) {
  if (!race || !race.race_date) return false;
  return race.race_date.slice(0, 4) === season;
}

function countCorrectWinnersForSeason(preds, results, racesById, season) {
  let count = 0;
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    if (season && !raceInSeason(racesById[pred.race_id], season)) continue;
    if ((pred.predicted_top10 || []).length > 0 &&
      result.classification.some((c) => c.position === 1 && c.driverId === pred.predicted_top10[0])) {
      count++;
    }
  }
  return count;
}

function countSeasonBonusPicks(preds, results, racesById, season) {
  let count = 0;
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    if (season && !raceInSeason(racesById[pred.race_id], season)) continue;
    if (!!pred.predicted_fastest_lap && pred.predicted_fastest_lap === result.fastest_lap_driver_id) count++;
    if (!!pred.predicted_dnf && (result.dnf_driver_ids || []).includes(pred.predicted_dnf)) count++;
  }
  return count;
}

function maxComebackGain(raceWeekRanks) {
  if (!raceWeekRanks || raceWeekRanks.length === 0) return 0;
  let best = 0;
  for (const entry of raceWeekRanks) {
    const memberCount = entry.memberCount ?? 0;
    if (memberCount < 6) continue;
    if (entry.preWeekendRank == null) continue;
    const bottomHalfThreshold = Math.ceil(memberCount / 2);
    if (entry.preWeekendRank > bottomHalfThreshold) {
      const gain = entry.preWeekendRank - entry.rank;
      if (gain > best) best = gain;
    }
  }
  return best;
}

function seasonGlobalPercentile(leaderboard, userId) {
  if (!leaderboard || leaderboard.length === 0 || !userId) return 0;
  const sorted = [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  const idx = sorted.findIndex((e) => e.userId === userId);
  if (idx === -1) return 0;
  const rank = idx + 1;
  const total = sorted.length;
  return Math.round(100 - ((rank - 1) / total) * 100);
}

function seasonGlobalRank(leaderboard, userId) {
  if (!leaderboard || leaderboard.length === 0 || !userId) return 9999;
  const sorted = [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  const idx = sorted.findIndex((e) => e.userId === userId);
  if (idx === -1) return 9999;
  return idx + 1;
}

function isSeasonGlobalNumberOne(leaderboard, userId) {
  if (!leaderboard || leaderboard.length === 0 || !userId) return false;
  const sorted = [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  return sorted[0] && sorted[0].userId === userId;
}

// ── Hidden achievement helpers ───────────────────────────────────────────
function hasLastMinuteEdit(editCounts, lockTimes) {
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

function hasNoEditsFullGrid(preds, editCounts) {
  for (const pred of preds) {
    if ((pred.predicted_top10 || []).length < 10) continue;
    const meta = editCounts[pred.race_id];
    if (!meta || meta.count <= 1) return true;
  }
  return false;
}

function hasFullGridZeroPoints(preds, results) {
  for (const pred of preds) {
    if ((pred.predicted_top10 || []).length < 10) continue;
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    const totalPts = (pred.points_earned ?? 0) + (pred.sprint_points_earned ?? 0);
    if (totalPts === 0) return true;
  }
  return false;
}

function hasPredictedWinnerDNF(preds, results) {
  for (const pred of preds) {
    if ((pred.predicted_top10 || []).length === 0) continue;
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    const predictedWinner = pred.predicted_top10[0];
    if ((result.dnf_driver_ids || []).includes(predictedWinner)) return true;
    const entry = result.classification.find((c) => c.driverId === predictedWinner);
    if (entry && (entry.status === 'retired' || entry.status === 'dnf')) return true;
  }
  return false;
}

function hasCorrectPodiumWrongOrder(preds, results) {
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    const resultPodium = result.classification.filter((c) => c.position <= 3).sort((a, b) => a.position - b.position).map((c) => c.driverId);
    const predPodium = (pred.predicted_top10 || []).slice(0, 3);
    if (predPodium.length < 3) continue;
    const allThreeAnyOrder = predPodium.every((d) => resultPodium.includes(d)) && resultPodium.every((d) => predPodium.includes(d));
    const exactMatch = predPodium[0] === resultPodium[0] && predPodium[1] === resultPodium[1] && predPodium[2] === resultPodium[2];
    if (allThreeAnyOrder && !exactMatch) return true;
  }
  return false;
}

function hasManyEdits(editCounts) {
  return Object.values(editCounts).some((m) => m.count >= 5);
}

function hasChaosMerchant(preds, results) {
  for (const pred of preds) {
    const result = results[pred.race_id];
    if (!result || !result.classification || result.classification.length === 0) continue;
    const flCorrect = !!pred.predicted_fastest_lap && pred.predicted_fastest_lap === result.fastest_lap_driver_id;
    const dnfCorrect = !!pred.predicted_dnf && (result.dnf_driver_ids || []).includes(pred.predicted_dnf);
    if (flCorrect && dnfCorrect) return true;
  }
  return false;
}

// ── Compute value for one achievement ────────────────────────────────────
function computeValue(def, input) {
  switch (def.key) {
    case 'race_day_points': return maxRaceDayPoints(input.predictions);
    case 'podium_accuracy': return maxPodiumAccuracy(input.predictions, input.raceResults);
    case 'exact_positions_single_race': return maxExactPositions(input.predictions, input.raceResults);
    case 'weekend_total_points': return maxWeekendPoints(input.predictions);
    case 'perfect_weekend': return maxPerfectWeekendLevel(input.predictions, input.raceResults, input.racesById);
    case 'sprint_points_single': return maxSprintPoints(input.predictions);
    case 'sprint_exact_positions': return maxSprintExactPositions(input.predictions, input.raceResults);
    case 'season_total_points': return input.totalPoints;
    case 'correct_winners_count': return countCorrectWinnersForSeason(input.predictions, input.raceResults, input.racesById, input.currentSeason);
    case 'season_bonus_picks': return countSeasonBonusPicks(input.predictions, input.raceResults, input.racesById, input.currentSeason);
    case 'comeback_gain': return maxComebackGain(input.raceWeekRanks);
    case 'season_global_percentile': return input.isSeasonComplete ? seasonGlobalPercentile(input.globalLeaderboard, input.userId) : 0;
    case 'season_global_rank': return input.isSeasonComplete ? seasonGlobalRank(input.globalLeaderboard, input.userId) : 9999;
    case 'season_global_number_one': return input.isSeasonComplete ? (isSeasonGlobalNumberOne(input.globalLeaderboard, input.userId) ? 1 : 0) : 0;
    case 'last_minute_edit': return hasLastMinuteEdit(input.editCounts, input.lockTimes) ? 1 : 0;
    case 'no_edits_full_grid': return hasNoEditsFullGrid(input.predictions, input.editCounts) ? 1 : 0;
    case 'full_grid_zero_points': return hasFullGridZeroPoints(input.predictions, input.raceResults) ? 1 : 0;
    case 'predicted_winner_dnf': return hasPredictedWinnerDNF(input.predictions, input.raceResults) ? 1 : 0;
    case 'correct_podium_wrong_order': return hasCorrectPodiumWrongOrder(input.predictions, input.raceResults) ? 1 : 0;
    case 'many_edits': return hasManyEdits(input.editCounts) ? 1 : 0;
    case 'chaos_merchant': return hasChaosMerchant(input.predictions, input.raceResults) ? 1 : 0;
    default: return 0;
  }
}

function computeUnlockedTiers(def, currentValue) {
  if (!def.tiers) {
    return currentValue >= 1 ? ['bronze'] : [];
  }
  const unlocked = new Set();
  for (const tierDef of def.tiers) {
    const met = def.lowerIsBetter
      ? currentValue <= tierDef.value && currentValue > 0
      : currentValue >= tierDef.value;
    if (met) unlocked.add(tierDef.tier);
  }
  return TIER_ORDER.filter((t) => unlocked.has(t));
}

// ── Compute raceWeekRanks for a user (mirror provider logic) ─────────────
function computeRaceWeekRanks(userId, allMembersByLeague, allPreds, racesById, resultsById, completedRaceIds) {
  const entries = [];
  for (const [leagueId, userIds] of allMembersByLeague) {
    if (!userIds.has(userId)) continue;
    const cumulativePoints = new Map();
    for (const uid of userIds) cumulativePoints.set(uid, 0);
    const sortedRaces = Object.values(racesById)
      .filter((r) => completedRaceIds.has(r.id))
      .sort((a, b) => (a.race_date || '').localeCompare(b.race_date || ''));
    for (const race of sortedRaces) {
      const userMap = new Map();
      for (const p of allPreds) {
        if (p.race_id !== race.id) continue;
        if (!userIds.has(p.user_id)) continue;
        const pts = (p.points_earned ?? 0) + (p.sprint_points_earned ?? 0);
        const prev = userMap.get(p.user_id) ?? -1;
        if (pts > prev) userMap.set(p.user_id, pts);
      }
      if (userMap.size === 0) continue;
      // Pre-weekend rank
      const preScored = [];
      for (const uid of userIds) preScored.push({ userId: uid, pts: cumulativePoints.get(uid) ?? 0 });
      preScored.sort((a, b) => b.pts - a.pts);
      const preIdx = preScored.findIndex((s) => s.userId === userId);
      const preWeekendRank = preIdx >= 0 ? preIdx + 1 : undefined;
      // Post-race rank
      const scored = [];
      for (const [uid, pts] of userMap) scored.push({ userId: uid, pts });
      scored.sort((a, b) => b.pts - a.pts);
      const idx = scored.findIndex((s) => s.userId === userId);
      if (idx === -1) continue;
      entries.push({ leagueId, raceId: race.id, rank: idx + 1, preWeekendRank, memberCount: userIds.size });
      // Update cumulative
      for (const s of scored) cumulativePoints.set(s.userId, (cumulativePoints.get(s.userId) ?? 0) + s.pts);
    }
  }
  return entries;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching all data from Supabase...');
  const [profiles, predictions, raceResults, races, leagueMembers, existingAch] = await Promise.all([
    fetchTable('profiles', 'id,username,display_name,total_points'),
    fetchTable('user_predictions', 'user_id,race_id,predicted_top10,predicted_fastest_lap,predicted_dnf,predicted_sprint_top8,points_earned,sprint_points_earned,updated_at,created_at'),
    fetchTable('race_results', 'race_id,classification,fastest_lap_driver_id,dnf_driver_ids,dns_driver_ids,sprint_classification'),
    fetchTable('races', 'id,round,name,location,country,race_date,race_time,status,has_sprint,winner'),
    fetchTable('league_members', 'league_id,user_id,role,joined_at'),
    fetchTable('user_achievements', 'user_id,achievement_id,unlocked_tiers,current_value,unlocked_at'),
  ]);

  console.log(`  profiles: ${profiles.length}`);
  console.log(`  predictions: ${predictions.length}`);
  console.log(`  race_results: ${raceResults.length}`);
  console.log(`  races: ${races.length}`);
  console.log(`  league_members: ${leagueMembers.length}`);
  console.log(`  existing user_achievements: ${existingAch.length}`);

  // Build lookup maps
  const resultsById = {};
  for (const r of raceResults) {
    if (!r.race_id) continue;
    resultsById[r.race_id] = {
      raceId: r.race_id,
      classification: Array.isArray(r.classification) ? r.classification : [],
      fastestLapDriverId: r.fastest_lap_driver_id ?? null,
      dnfDriverIds: Array.isArray(r.dnf_driver_ids) ? r.dnf_driver_ids : [],
      dnsDriverIds: Array.isArray(r.dns_driver_ids) ? r.dns_driver_ids : [],
      sprintClassification: Array.isArray(r.sprint_classification) ? r.sprint_classification : undefined,
    };
  }

  const racesById = {};
  for (const r of races) {
    if (!r.id) continue;
    racesById[r.id] = {
      id: r.id,
      round: r.round,
      name: r.name,
      raceDate: r.race_date,
      status: r.status,
      hasSprint: !!r.has_sprint,
    };
  }

  const completedRaceIds = new Set(
    Object.values(racesById).filter((r) => r.status === 'completed').map((r) => r.id),
  );

  // Group league members by league
  const allMembersByLeague = new Map();
  for (const m of leagueMembers) {
    if (!m.league_id || !m.user_id) continue;
    let set = allMembersByLeague.get(m.league_id);
    if (!set) { set = new Set(); allMembersByLeague.set(m.league_id, set); }
    set.add(m.user_id);
  }

  // Group predictions by user
  const predsByUser = new Map();
  for (const p of predictions) {
    if (!p.user_id) continue;
    let arr = predsByUser.get(p.user_id);
    if (!arr) { arr = []; predsByUser.set(p.user_id, arr); }
    arr.push(p);
  }

  // All predictions (for raceWeekRanks computation across all users in a league)
  const allPreds = predictions;

  // Season info
  const allRacesArr = Object.values(racesById);
  const isSeasonComplete = allRacesArr.length > 0 && allRacesArr.every((r) => r.status === 'completed' || r.status === 'cancelled');
  const sortedRaces = [...allRacesArr].sort((a, b) => (a.raceDate || '').localeCompare(b.raceDate || ''));
  const completedRaces = sortedRaces.filter((r) => r.status === 'completed');
  const refRace = completedRaces.length > 0 ? completedRaces[completedRaces.length - 1] : sortedRaces[sortedRaces.length - 1];
  const currentSeason = refRace?.raceDate?.slice(0, 4) ?? '';

  console.log(`  currentSeason: ${currentSeason}`);
  console.log(`  isSeasonComplete: ${isSeasonComplete}`);

  // Global leaderboard (from profiles total_points)
  const globalLeaderboard = profiles
    .map((p) => ({ userId: p.id, totalPoints: p.total_points ?? 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Existing achievements map: userId -> achievementId -> row
  const existingByUser = new Map();
  for (const r of existingAch) {
    if (!r.user_id) continue;
    let m = existingByUser.get(r.user_id);
    if (!m) { m = new Map(); existingByUser.set(r.user_id, m); }
    m.set(r.achievement_id, r);
  }

  // Compute achievements for each user
  const allRows = [];
  let totalUnlocked = 0;

  for (const profile of profiles) {
    const userId = profile.id;
    const userPreds = predsByUser.get(userId) || [];
    const totalPoints = profile.total_points ?? 0;

    // Compute raceWeekRanks for this user
    const raceWeekRanks = computeRaceWeekRanks(userId, allMembersByLeague, allPreds, racesById, resultsById, completedRaceIds);

    // Build edit counts (count updated_at changes — we approximate: each prediction's
    // updated_at != created_at => 1 edit; otherwise 0 edits. We don't have full edit
    // history in Supabase, so we use a best-effort heuristic.)
    const editCounts = {};
    const lockTimes = {};
    for (const pred of userPreds) {
      const created = pred.created_at ? new Date(pred.created_at).getTime() : 0;
      const updated = pred.updated_at ? new Date(pred.updated_at).getTime() : 0;
      const count = (created > 0 && updated > 0 && Math.abs(updated - created) > 1000) ? 2 : 1;
      editCounts[pred.race_id] = { count, lastEditAt: pred.updated_at || pred.created_at };
      // Lock time: race_date + race_time; approximate as race_date 00:00 if no time
      const race = racesById[pred.race_id];
      if (race?.raceDate) {
        lockTimes[pred.race_id] = race.raceDate + 'T' + (race.raceTime || '00:00') + ':00';
      }
    }

    const input = {
      predictions: userPreds,
      raceResults: resultsById,
      racesById,
      totalPoints,
      leagueMemberships: [],
      editCounts,
      lockTimes,
      raceWeekRanks,
      globalLeaderboard,
      currentSeason,
      isSeasonComplete,
      userId,
    };

    const userRows = [];
    for (const def of ACHIEVEMENTS) {
      const currentValue = computeValue(def, input);
      const unlockedTiers = computeUnlockedTiers(def, currentValue);

      // Preserve existing unlockedAt timestamps for tiers already unlocked
      const existing = existingByUser.get(userId)?.get(def.id);
      const existingUnlockedAt = (existing && typeof existing.unlocked_at === 'object' && existing.unlocked_at) ? existing.unlocked_at : {};
      const existingTiers = (existing && Array.isArray(existing.unlocked_tiers)) ? existing.unlocked_tiers : [];
      const existingSet = new Set(existingTiers);

      const unlockedAt = { ...existingUnlockedAt };
      for (const t of unlockedTiers) {
        if (!unlockedAt[t]) unlockedAt[t] = new Date().toISOString();
      }

      // Season instances for season-based achievements
      let seasonInstances = undefined;
      if (def.seasonBased && currentSeason) {
        const existingInst = (existing && Array.isArray(existing.season_instances)) ? existing.season_instances : [];
        const prevCurrent = existingInst.find((i) => i.season === currentSeason);
        const prevCurrentTiers = new Set(prevCurrent?.unlockedTiers || []);
        const mergedTiers = [...new Set([...(prevCurrent?.unlockedTiers || []), ...unlockedTiers])];
        const mergedValue = Math.max(prevCurrent?.currentValue ?? 0, currentValue);
        const mergedUnlockedAt = { ...(prevCurrent?.unlockedAt || {}) };
        for (const t of unlockedTiers) {
          if (!prevCurrentTiers.has(t) && !mergedUnlockedAt[t]) mergedUnlockedAt[t] = new Date().toISOString();
        }
        const currentInstance = { season: currentSeason, unlockedTiers: mergedTiers, currentValue: mergedValue, unlockedAt: mergedUnlockedAt };
        const otherInstances = existingInst.filter((i) => i.season !== currentSeason);
        seasonInstances = [...otherInstances, currentInstance].sort((a, b) => a.season.localeCompare(b.season));
      }

      // Every row must have identical keys for PostgREST bulk upsert.
      const row = {
        user_id: userId,
        achievement_id: def.id,
        unlocked_tiers: unlockedTiers,
        current_value: currentValue,
        unlocked_at: unlockedAt,
        updated_at: new Date().toISOString(),
        season_instances: seasonInstances ?? null,
      };

      userRows.push(row);
      if (unlockedTiers.length > 0) totalUnlocked++;
    }

    allRows.push(...userRows);
    const userUnlocked = userRows.filter((r) => r.unlocked_tiers.length > 0).length;
    console.log(`  ${profile.display_name || profile.username || userId.slice(0, 8)}: ${userUnlocked}/${ACHIEVEMENTS.length} achievements unlocked`);
  }

  console.log(`\nTotal achievement rows to upsert: ${allRows.length}`);
  console.log(`Total unlocked tiers across all users: ${totalUnlocked}`);

  // Upsert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    try {
      await upsertRows('user_achievements', batch, 'user_id,achievement_id');
      console.log(`  upserted batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(allRows.length / BATCH)}`);
    } catch (e) {
      // Retry without season_instances if the column doesn't exist
      if (e.message.includes('season_instances') || e.message.includes('42703') || e.message.includes('column')) {
        console.log('  season_instances column missing — retrying batch without it...');
        const stripped = batch.map((r) => {
          const { season_instances, ...rest } = r;
          return rest;
        });
        await upsertRows('user_achievements', stripped, 'user_id,achievement_id');
        console.log(`  upserted batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(allRows.length / BATCH)} (no season_instances)`);
      } else {
        throw e;
      }
    }
  }

  console.log('\n✅ All achievements recomputed and written to Supabase.');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
