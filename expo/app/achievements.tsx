import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as icons from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import {
  ALL_ACHIEVEMENTS,
  VISIBLE_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  TIER_ORDER,
  TIER_COLORS,
  TIER_LABELS,
  ACHIEVEMENT_MAP,
  type AchievementDefinition,
  type AchievementProgress,
  type AchievementTier,
  type AchievementCategory,
} from '@/constants/achievements';
import { useAchievements } from '@/providers/AchievementProvider';
import { useGame } from '@/providers/GameProvider';
import AchievementUnlockToast from '@/components/AchievementUnlockToast';

type FilterTab = 'all' | 'race' | 'season' | 'league' | 'hidden' | 'unlocked';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'race', label: 'Race' },
  { key: 'season', label: 'Season' },
  { key: 'league', label: 'League' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'unlocked', label: 'Unlocked' },
];

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  race: 'Race',
  season: 'Season',
  league: 'League',
};

const TIER_ICONS: Record<AchievementTier, string> = {
  bronze: 'Medal',
  silver: 'Medal',
  gold: 'Medal',
  platinum: 'Diamond',
};

function resolveIcon(iconName: string): React.ComponentType<any> {
  const pascal = iconName
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return (icons as any)[pascal] || (icons as any)['Trophy'];
}

export default function AchievementsScreen() {
  const {
    state,
    isLoaded,
    unlockQueue,
    unlockedCount,
    totalTiersCount,
    unlockedTiersCount,
    dismissUnlock,
  } = useAchievements();
  const { totalPoints } = useGame();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [selectedDef, setSelectedDef] = useState<AchievementDefinition | null>(null);

  const filteredAchievements = useMemo(() => {
    let list: AchievementDefinition[];
    switch (activeFilter) {
      case 'race':
        list = ALL_ACHIEVEMENTS.filter((a) => a.category === 'race');
        break;
      case 'season':
        list = ALL_ACHIEVEMENTS.filter((a) => a.category === 'season');
        break;
      case 'league':
        list = ALL_ACHIEVEMENTS.filter((a) => a.category === 'league');
        break;
      case 'hidden':
        list = HIDDEN_ACHIEVEMENTS;
        break;
      case 'unlocked':
        list = ALL_ACHIEVEMENTS.filter((a) => {
          const prog = state[a.id];
          return prog && prog.unlockedTiers.length > 0;
        });
        break;
      default:
        list = [...ALL_ACHIEVEMENTS];
    }
    return list.sort((a, b) => {
      const aUnlocked = (state[a.id]?.unlockedTiers.length ?? 0) > 0 ? 0 : 1;
      const bUnlocked = (state[b.id]?.unlockedTiers.length ?? 0) > 0 ? 0 : 1;
      return aUnlocked - bUnlocked;
    });
  }, [activeFilter, state]);

  const selectedProgress = selectedDef ? state[selectedDef.id] : undefined;
  const currentToast = unlockQueue.length > 0 && !unlockQueue[0].dismissed ? unlockQueue[0] : null;

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Grid Badges' }} />
        <Text style={styles.loadingText}>Loading badges...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Grid Badges',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
        }}
      />

      {/* Progress header */}
      <View style={styles.progressHeader}>
        <LinearGradient
          colors={['rgba(225,6,0,0.08)', 'rgba(225,6,0,0.02)']}
          style={styles.progressInner}
        >
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>{unlockedCount}</Text>
              <Text style={styles.progressStatLabel}>Badges</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>
                {unlockedTiersCount}/{totalTiersCount}
              </Text>
              <Text style={styles.progressStatLabel}>Tiers</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>{totalPoints}</Text>
              <Text style={styles.progressStatLabel}>Points</Text>
            </View>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: totalTiersCount > 0
                    ? `${Math.round((unlockedTiersCount / totalTiersCount) * 100)}%`
                    : '0%',
                },
              ]}
            />
          </View>
        </LinearGradient>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.7}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setActiveFilter(tab.key);
                }}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
              >
                {isActive && (
                  <LinearGradient
                    colors={['#E10600', '#B30500']}
                    style={StyleSheet.absoluteFill as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <Text
                  style={[styles.filterTabText, isActive && styles.filterTabTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Badge grid */}
      <ScrollView
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredAchievements.length === 0 ? (
          <View style={styles.emptyState}>
            <icons.Search size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No badges found for this filter.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredAchievements.map((def) => (
              <AchievementCard
                key={def.id}
                def={def}
                progress={state[def.id]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDef(def);
                }}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail modal */}
      <AchievementDetailModal
        def={selectedDef}
        progress={selectedProgress}
        visible={!!selectedDef}
        onClose={() => setSelectedDef(null)}
      />

      {/* Unlock toast overlay */}
      <AchievementUnlockToast
        def={currentToast?.def ?? { id: '', name: '', description: '', category: 'race', isHidden: false, icon: 'trophy', tiers: null, unlockConditionKey: '' }}
        tier={currentToast?.tier ?? 'bronze'}
        visible={!!currentToast}
        onDismiss={dismissUnlock}
      />
    </View>
  );
}

/* ────────────────────────────────────────────── */
/*  Achievement Card                               */
/* ────────────────────────────────────────────── */

function AchievementCard({
  def,
  progress,
  onPress,
}: {
  def: AchievementDefinition;
  progress: AchievementProgress | undefined;
  onPress: () => void;
}) {
  const Icon = resolveIcon(def.icon);
  const isUnlocked = (progress?.unlockedTiers.length ?? 0) > 0;
  const isHidden = def.isHidden && !isUnlocked;

  const highestTier: AchievementTier | null =
    progress?.unlockedTiers.length
      ? progress.unlockedTiers[progress.unlockedTiers.length - 1]
      : null;
  const accentColor = highestTier ? TIER_COLORS[highestTier].primary : Colors.textMuted;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, isUnlocked && { borderColor: accentColor + '30' }]}
    >
      {isUnlocked && highestTier && (
        <LinearGradient
          colors={[TIER_COLORS[highestTier].glow, 'transparent']}
          style={styles.cardGlow}
          pointerEvents="none"
        />
      )}

      {/* Card header */}
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIconShell,
            isHidden
              ? { backgroundColor: 'rgba(255,255,255,0.04)' }
              : isUnlocked && highestTier
              ? { backgroundColor: TIER_COLORS[highestTier].glow }
              : { backgroundColor: 'rgba(255,255,255,0.05)' },
          ]}
        >
          {isHidden ? (
            <icons.EyeOff size={20} color={Colors.textMuted} />
          ) : (
            <Icon size={20} color={isUnlocked && highestTier ? TIER_COLORS[highestTier].primary : Colors.textMuted} />
          )}
        </View>

        <View style={styles.cardTitleBlock}>
          <Text style={[styles.cardName, isHidden && styles.cardNameHidden]} numberOfLines={1}>
            {isHidden ? 'Hidden Badge' : def.name}
          </Text>
          <Text style={styles.cardCategory}>{CATEGORY_LABELS[def.category]}</Text>
        </View>

        {isUnlocked && highestTier && (
          <View style={[styles.unlockedBadge, { backgroundColor: TIER_COLORS[highestTier].glow, borderColor: TIER_COLORS[highestTier].primary }]}>
            <icons.CheckCircle size={12} color={TIER_COLORS[highestTier].primary} />
            <Text style={[styles.unlockedBadgeText, { color: TIER_COLORS[highestTier].primary }]}>
              {TIER_LABELS[highestTier]}
            </Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={styles.cardDesc} numberOfLines={2}>
        {isHidden ? 'Complete a secret objective to reveal this badge.' : def.description}
      </Text>

      {/* Hidden unlock hint */}
      {isHidden && !isUnlocked && def.unlockHint && (
        <View style={styles.hiddenHint}>
          <icons.HelpCircle size={12} color={Colors.textMuted} />
          <Text style={styles.hiddenHintText} numberOfLines={2}>
            {def.unlockHint}
          </Text>
        </View>
      )}

      {/* Tier progress for visible achievements */}
      {!def.isHidden && def.tiers && (
        <View style={styles.tierRow}>
          {def.tiers.map((tierDef, idx) => {
            const isTierUnlocked = progress?.unlockedTiers.includes(tierDef.tier) ?? false;
            const tierColors = TIER_COLORS[tierDef.tier];
            const isNextTier =
              !isTierUnlocked &&
              (idx === 0 || progress?.unlockedTiers.includes(def.tiers![idx - 1].tier));

            return (
              <View
                key={tierDef.tier}
                style={[
                  styles.tierDot,
                  isTierUnlocked
                    ? { backgroundColor: tierColors.primary, borderColor: tierColors.secondary }
                    : isNextTier
                    ? { borderColor: tierColors.primary, borderWidth: 2 }
                    : { borderColor: Colors.border },
                ]}
              >
                {isTierUnlocked && (
                  <icons.Check size={8} color="#FFF" strokeWidth={3} />
                )}
              </View>
            );
          })}

          <Text style={styles.tierProgressText}>
            {progress?.currentValue ?? 0}
            {def.tiers && def.tiers.length > 0 && progress && (
              <> / {def.tiers[def.tiers.length - 1].value}</>
            )}
          </Text>
        </View>
      )}

      {/* Hidden unlocked show real info */}
      {def.isHidden && isUnlocked && (
        <View style={styles.revealedInfo}>
          <Text style={styles.revealedName}>{def.name}</Text>
          <Text style={styles.revealedDesc}>{def.description}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────── */
/*  Achievement Detail Modal                       */
/* ────────────────────────────────────────────── */

function AchievementDetailModal({
  def,
  progress,
  visible,
  onClose,
}: {
  def: AchievementDefinition | null;
  progress: AchievementProgress | undefined;
  visible: boolean;
  onClose: () => void;
}) {
  if (!def) return null;

  const Icon = resolveIcon(def.icon);
  const isHidden = def.isHidden;
  const isHiddenUnlocked = isHidden && (progress?.unlockedTiers.length ?? 0) > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          {/* Drag indicator */}
          <View style={styles.modalHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconShell,
                  (isHidden && !isHiddenUnlocked)
                    ? { backgroundColor: 'rgba(255,255,255,0.04)' }
                    : { backgroundColor: 'rgba(225,6,0,0.08)' },
                ]}
              >
                {isHidden && !isHiddenUnlocked ? (
                  <icons.EyeOff size={28} color={Colors.textMuted} />
                ) : (
                  <Icon size={28} color={isHiddenUnlocked ? Colors.warning : Colors.f1Red} />
                )}
              </View>

              <Text style={styles.modalName}>
                {isHidden && !isHiddenUnlocked ? 'Hidden Badge' : def.name}
              </Text>
              <Text style={styles.modalCategoryBadge}>
                {CATEGORY_LABELS[def.category]}
              </Text>
              <Text style={styles.modalDesc}>
                {isHidden && !isHiddenUnlocked
                  ? 'Complete a secret objective to reveal this badge.'
                  : def.description}
              </Text>

              {/* Progress bar for tiered achievements */}
              {!isHidden && def.tiers && progress && (
                <View style={styles.modalProgressTrack}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      {
                        width: def.tiers.length > 0
                          ? `${Math.min(100, Math.round((progress.currentValue / def.tiers[def.tiers.length - 1].value) * 100))}%`
                          : '0%',
                      },
                    ]}
                  />
                </View>
              )}

              {!isHidden && def.tiers && progress && (
                <Text style={styles.modalProgressLabel}>
                  Progress: {progress.currentValue} / {def.tiers[def.tiers.length - 1].value}
                </Text>
              )}
            </View>

            {/* Tiers section */}
            {def.tiers ? (
              <View style={styles.tiersSection}>
                <Text style={styles.tiersSectionTitle}>TIER REQUIREMENTS</Text>
                {def.tiers.map((tierDef, idx) => {
                  const isUnlocked = progress?.unlockedTiers.includes(tierDef.tier) ?? false;
                  const tColors = TIER_COLORS[tierDef.tier];
                  const prevUnlocked =
                    idx === 0 || (progress?.unlockedTiers.includes(def.tiers![idx - 1].tier) ?? false);
                  const isNextTier = !isUnlocked && prevUnlocked;

                  return (
                    <View
                      key={tierDef.tier}
                      style={[
                        styles.tierCard,
                        isUnlocked && { borderColor: tColors.primary + '40', backgroundColor: tColors.glow + '15' },
                        isNextTier && { borderColor: tColors.primary + '60' },
                      ]}
                    >
                      {/* Tier header */}
                      <View style={styles.tierCardHeader}>
                        <View
                          style={[
                            styles.tierBadge,
                            isUnlocked
                              ? { backgroundColor: tColors.primary }
                              : isNextTier
                              ? { borderColor: tColors.primary, borderWidth: 2, backgroundColor: 'transparent' }
                              : { borderColor: Colors.border, borderWidth: 1.5, backgroundColor: 'transparent' },
                          ]}
                        >
                          {isUnlocked ? (
                            <icons.Check size={14} color="#000" strokeWidth={3} />
                          ) : (
                            <Text
                              style={[
                                styles.tierBadgeText,
                                isNextTier
                                  ? { color: tColors.primary }
                                  : { color: Colors.textMuted },
                              ]}
                            >
                              {idx + 1}
                            </Text>
                          )}
                        </View>

                        <View style={styles.tierCardTitleBlock}>
                          <Text
                            style={[
                              styles.tierCardLabel,
                              isUnlocked && { color: tColors.primary },
                              !isUnlocked && !isNextTier && { color: Colors.textMuted },
                            ]}
                          >
                            {TIER_LABELS[tierDef.tier]}
                          </Text>
                          <Text
                            style={[
                              styles.tierCardReq,
                              !isUnlocked && !isNextTier && { color: Colors.textMuted },
                            ]}
                          >
                            {tierDef.requirement}
                          </Text>
                        </View>

                        {isUnlocked ? (
                          <View style={[styles.tierStatusBadge, { backgroundColor: tColors.glow, borderColor: tColors.primary }]}>
                            <icons.CheckCircle size={12} color={tColors.primary} />
                            <Text style={[styles.tierStatusText, { color: tColors.primary }]}>
                              Unlocked
                            </Text>
                          </View>
                        ) : isNextTier ? (
                          <View style={[styles.tierStatusBadge, { backgroundColor: tColors.glow, borderColor: tColors.primary }]}>
                            <Text style={[styles.tierStatusText, { color: tColors.primary }]}>
                              {progress ? `${progress.currentValue}/${tierDef.value}` : `0/${tierDef.value}`}
                            </Text>
                          </View>
                        ) : (
                          <icons.Lock size={14} color={Colors.textMuted} />
                        )}
                      </View>

                      {/* Progress fill for in-progress tier */}
                      {isNextTier && progress && (
                        <View style={styles.tierProgressTrack}>
                          <View
                            style={[
                              styles.tierProgressFill,
                              {
                                width: `${Math.min(100, Math.round((progress.currentValue / tierDef.value) * 100))}%`,
                                backgroundColor: tColors.primary,
                              },
                            ]}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              /* Hidden achievement pre-unlock */
              !isHiddenUnlocked && def.unlockHint && (
                <View style={styles.tiersSection}>
                  <Text style={styles.tiersSectionTitle}>UNLOCK CONDITION</Text>
                  <View style={styles.hiddenConditionCard}>
                    <icons.HelpCircle size={18} color={Colors.warning} />
                    <Text style={styles.hiddenConditionText}>{def.unlockHint}</Text>
                  </View>
                </View>
              )
            )}

            {/* Hidden achievement post-unlock */}
            {isHiddenUnlocked && (
              <View style={styles.tiersSection}>
                <Text style={styles.tiersSectionTitle}>HOW YOU UNLOCKED IT</Text>
                <View style={styles.hiddenConditionCardUnlocked}>
                  <icons.CheckCircle size={18} color={Colors.success} />
                  <Text style={styles.hiddenConditionTextUnlocked}>
                    {def.unlockHint ?? def.description}
                  </Text>
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ────────────────────────────────────────────── */
/*  Styles                                          */
/* ────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },

  /* Progress header */
  progressHeader: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressInner: {
    padding: 18,
    gap: 14,
  },
  progressStats: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  progressStat: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  progressStatValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
  },
  progressStatLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  progressDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%' as any,
    borderRadius: 2,
    backgroundColor: Colors.f1Red,
  },

  /* Filter tabs */
  filterBar: {
    marginTop: 14,
    marginBottom: 4,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  filterTabActive: {
    borderColor: Colors.f1Red,
  },
  filterTabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    position: 'relative' as const,
    zIndex: 1,
  },
  filterTabTextActive: {
    color: '#FFF',
    fontWeight: '700' as const,
  },

  /* Grid */
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  grid: {
    gap: 10,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  /* Card */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 10,
  },
  cardIconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  cardNameHidden: {
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  cardCategory: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  unlockedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  unlockedBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  cardDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },

  /* Hidden hint */
  hiddenHint: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  hiddenHintText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },

  /* Tier dots */
  tierRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  tierDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tierProgressText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    marginLeft: 'auto' as any,
  },

  /* Revealed hidden achievement */
  revealedInfo: {
    backgroundColor: 'rgba(255,214,10,0.06)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.15)',
    marginTop: 2,
  },
  revealedName: {
    color: Colors.warning,
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  revealedDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  /* ── Modal ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%' as any,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
  },

  /* Modal header */
  modalHeader: {
    alignItems: 'center' as const,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  modalIconShell: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
    textAlign: 'center' as const,
  },
  modalCategoryBadge: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  modalDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center' as const,
    paddingHorizontal: 12,
  },
  modalProgressTrack: {
    width: '100%' as any,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden' as const,
    marginTop: 4,
  },
  modalProgressFill: {
    height: '100%' as any,
    borderRadius: 2,
    backgroundColor: Colors.f1Red,
  },
  modalProgressLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },

  /* Tiers section */
  tiersSection: {
    marginTop: 24,
    gap: 10,
  },
  tiersSectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  tierCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tierCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  tierBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  tierCardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  tierCardLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  tierCardReq: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  tierStatusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierStatusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  tierProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden' as const,
    marginTop: 10,
  },
  tierProgressFill: {
    height: '100%' as any,
    borderRadius: 2,
  },

  /* Hidden condition */
  hiddenConditionCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: 'rgba(255,214,10,0.06)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.15)',
  },
  hiddenConditionText: {
    color: Colors.warning,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
    fontWeight: '600' as const,
  },
  hiddenConditionCardUnlocked: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: 'rgba(48,209,88,0.06)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.15)',
  },
  hiddenConditionTextUnlocked: {
    color: Colors.success,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
    fontWeight: '600' as const,
  },
});
