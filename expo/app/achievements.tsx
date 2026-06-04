import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as icons from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import {
  ALL_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  TIER_COLORS,
  TIER_LABELS,
  type AchievementCategory,
  type AchievementDefinition,
  type AchievementProgress,
  type AchievementTier,
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

const HIDDEN_COLORS = {
  black: '#050505',
  blackSoft: '#0A0A0A',
  blackRaised: '#111111',
  red: Colors.f1Red,
  redDark: Colors.f1RedDark,
  redSoft: 'rgba(225, 6, 0, 0.12)',
  redGlow: 'rgba(225, 6, 0, 0.22)',
  redBorder: 'rgba(225, 6, 0, 0.58)',
  redBorderStrong: 'rgba(225, 6, 0, 0.88)',
};

function resolveIcon(iconName: string): React.ComponentType<any> {
  const pascal = iconName
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  return (icons as any)[pascal] || (icons as any).Trophy;
}

function getHighestTier(progress?: AchievementProgress): AchievementTier | null {
  if (!progress?.unlockedTiers?.length) return null;
  return progress.unlockedTiers[progress.unlockedTiers.length - 1];
}

function isUnlocked(progress?: AchievementProgress): boolean {
  return (progress?.unlockedTiers?.length ?? 0) > 0;
}

function getAccentColor(def: AchievementDefinition, progress?: AchievementProgress): string {
  if (def.isHidden) return HIDDEN_COLORS.red;

  const highestTier = getHighestTier(progress);

  if (highestTier) {
    return TIER_COLORS[highestTier].primary;
  }

  return Colors.textMuted;
}

function getSoftGlow(def: AchievementDefinition, progress?: AchievementProgress): string {
  if (def.isHidden) return HIDDEN_COLORS.redGlow;

  const highestTier = getHighestTier(progress);

  if (highestTier) {
    return TIER_COLORS[highestTier].glow;
  }

  return 'transparent';
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
        list = ALL_ACHIEVEMENTS.filter((a) => isUnlocked(state[a.id]));
        break;
      default:
        list = [...ALL_ACHIEVEMENTS];
    }

    return list.sort((a, b) => {
      const aUnlocked = isUnlocked(state[a.id]) ? 0 : 1;
      const bUnlocked = isUnlocked(state[b.id]) ? 0 : 1;

      if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;

      if (a.isHidden !== b.isHidden) {
        return a.isHidden ? 1 : -1;
      }

      return a.name.localeCompare(b.name);
    });
  }, [activeFilter, state]);

  const selectedProgress = selectedDef ? state[selectedDef.id] : undefined;
  const currentToast = unlockQueue.length > 0 && !unlockQueue[0].dismissed ? unlockQueue[0] : null;

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.f1Red} />
        <Text style={styles.loadingText}>Loading badges...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Achievements' }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.progressHeader}>
          <LinearGradient
            colors={['#191014', '#0B0E11']}
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
                    width:
                      totalTiersCount > 0
                        ? `${Math.min(
                            100,
                            Math.round((unlockedTiersCount / totalTiersCount) * 100)
                          )}%`
                        : '0%',
                  },
                ]}
              />
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.key;

            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.85}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setActiveFilter(tab.key);
                }}
                style={[styles.filterTab, active && styles.filterTabActive]}
              >
                {active && (
                  <LinearGradient
                    colors={
                      tab.key === 'hidden'
                        ? [HIDDEN_COLORS.black, HIDDEN_COLORS.redDark]
                        : [Colors.f1RedDark, Colors.f1Red]
                    }
                    style={StyleSheet.absoluteFill}
                  />
                )}

                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filteredAchievements.length === 0 ? (
          <View style={styles.emptyState}>
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
      </ScrollView>

      <AchievementDetailModal
        def={selectedDef}
        progress={selectedProgress}
        visible={!!selectedDef}
        onClose={() => setSelectedDef(null)}
      />

      <AchievementUnlockToast
        def={currentToast?.def}
        tier={currentToast?.tier}
        visible={!!currentToast}
        onDismiss={dismissUnlock}
      />
    </View>
  );
}

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
  const unlocked = isUnlocked(progress);
  const hidden = def.isHidden;
  const hiddenLocked = hidden && !unlocked;
  const hiddenUnlocked = hidden && unlocked;
  const highestTier = getHighestTier(progress);
  const accentColor = getAccentColor(def, progress);
  const glowColor = getSoftGlow(def, progress);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.card,
        hidden && styles.hiddenCard,
        hiddenUnlocked && styles.hiddenUnlockedCard,
        hiddenLocked && styles.hiddenLockedCard,
        unlocked && !hidden && { borderColor: `${accentColor}70` },
      ]}
    >
      {hidden ? (
        <LinearGradient
          colors={
            hiddenUnlocked
              ? ['rgba(225,6,0,0.20)', 'rgba(5,5,5,0.98)', 'rgba(0,0,0,1)']
              : ['rgba(225,6,0,0.10)', 'rgba(5,5,5,0.98)', 'rgba(0,0,0,1)']
          }
          style={styles.cardGlow}
        />
      ) : (
        unlocked && <LinearGradient colors={[glowColor, 'transparent']} style={styles.cardGlow} />
      )}

      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIconShell,
            hidden
              ? styles.hiddenIconShell
              : {
                  backgroundColor: unlocked ? `${accentColor}22` : Colors.surfaceHighlight,
                  borderColor: unlocked ? `${accentColor}55` : Colors.border,
                },
          ]}
        >
          {hiddenLocked ? (
            <icons.Lock size={22} color={HIDDEN_COLORS.red} />
          ) : (
            <Icon size={22} color={hidden ? '#FFF' : accentColor} />
          )}
        </View>

        <View style={styles.cardTitleBlock}>
          <Text
            style={[
              styles.cardName,
              hidden && styles.hiddenCardName,
              hiddenLocked && styles.cardNameHidden,
            ]}
            numberOfLines={1}
          >
            {hiddenLocked ? 'Hidden Badge' : def.name}
          </Text>

          <Text style={[styles.cardCategory, hidden && styles.hiddenCardCategory]}>
            {hidden ? 'Secret' : CATEGORY_LABELS[def.category]}
          </Text>
        </View>

        {unlocked && (
          <View
            style={[
              styles.unlockedBadge,
              hidden
                ? styles.hiddenUnlockedPill
                : {
                    borderColor: `${accentColor}80`,
                    backgroundColor: `${accentColor}14`,
                  },
            ]}
          >
            <icons.Check size={11} color={hidden ? '#FFF' : accentColor} />
            <Text
              style={[
                styles.unlockedBadgeText,
                { color: hidden ? '#FFF' : accentColor },
              ]}
            >
              {hidden ? 'UNLOCKED' : highestTier ? TIER_LABELS[highestTier] : 'Unlocked'}
            </Text>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.cardDesc,
          hidden && styles.hiddenCardDesc,
        ]}
        numberOfLines={2}
      >
        {hiddenLocked ? 'Complete a secret objective to reveal this badge.' : def.description}
      </Text>

      {hiddenLocked && def.unlockHint && (
        <View style={styles.hiddenHint}>
          <icons.EyeOff size={13} color={HIDDEN_COLORS.red} />
          <Text style={styles.hiddenHintText}>{def.unlockHint}</Text>
        </View>
      )}

      {hiddenUnlocked && (
        <View style={styles.hiddenRevealBox}>
          <Text style={styles.hiddenRevealLabel}>SECRET BADGE REVEALED</Text>
          <Text style={styles.hiddenRevealText}>{def.unlockHint ?? def.description}</Text>
        </View>
      )}

      {!def.isHidden && def.tiers && (
        <View style={styles.tierFooter}>
          <View style={styles.tierRow}>
            {def.tiers.map((tierDef) => {
              const tierUnlocked = progress?.unlockedTiers?.includes(tierDef.tier) ?? false;
              const tierColors = TIER_COLORS[tierDef.tier];

              return (
                <View
                  key={tierDef.tier}
                  style={[
                    styles.tierDot,
                    {
                      borderColor: tierUnlocked ? tierColors.primary : Colors.borderLight,
                      backgroundColor: tierUnlocked ? `${tierColors.primary}22` : 'transparent',
                    },
                  ]}
                >
                  {tierUnlocked && <icons.Check size={11} color={tierColors.primary} />}
                </View>
              );
            })}
          </View>

          <Text style={styles.tierProgressText}>
            {progress?.currentValue ?? 0}
            {def.tiers.length > 0 ? ` / ${def.tiers[def.tiers.length - 1].value}` : ''}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

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
  const unlocked = isUnlocked(progress);
  const hidden = def.isHidden;
  const hiddenLocked = hidden && !unlocked;
  const hiddenUnlocked = hidden && unlocked;
  const accentColor = getAccentColor(def, progress);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalSheet,
            hidden && styles.hiddenModalSheet,
          ]}
          onPress={() => {}}
        >
          <View style={[styles.modalHandle, hidden && styles.hiddenModalHandle]} />

          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconShell,
                  hidden
                    ? styles.hiddenModalIcon
                    : {
                        backgroundColor: hiddenLocked ? Colors.surfaceHighlight : `${accentColor}22`,
                        borderColor: hiddenLocked ? Colors.border : `${accentColor}70`,
                      },
                ]}
              >
                {hiddenLocked ? (
                  <icons.Lock size={32} color={HIDDEN_COLORS.red} />
                ) : (
                  <Icon size={32} color={hidden ? '#FFF' : accentColor} />
                )}
              </View>

              <Text style={[styles.modalName, hidden && styles.hiddenModalName]}>
                {hiddenLocked ? 'Hidden Badge' : def.name}
              </Text>

              <Text style={[styles.modalCategoryBadge, hidden && styles.hiddenModalCategoryBadge]}>
                {hidden ? 'Secret' : CATEGORY_LABELS[def.category]}
              </Text>

              <Text style={[styles.modalDesc, hidden && styles.hiddenModalDesc]}>
                {hiddenLocked ? 'Complete a secret objective to reveal this badge.' : def.description}
              </Text>
            </View>

            {!def.isHidden && def.tiers && progress && (
              <>
                <View style={styles.modalProgressTrack}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      {
                        width:
                          def.tiers.length > 0
                            ? `${Math.min(
                                100,
                                Math.round(
                                  (progress.currentValue / def.tiers[def.tiers.length - 1].value) *
                                    100
                                )
                              )}%`
                            : '0%',
                      },
                    ]}
                  />
                </View>

                <Text style={styles.modalProgressLabel}>
                  Progress: {progress.currentValue} / {def.tiers[def.tiers.length - 1].value}
                </Text>
              </>
            )}

            {def.tiers ? (
              <View style={styles.tiersSection}>
                <Text style={styles.tiersSectionTitle}>TIER REQUIREMENTS</Text>

                {def.tiers.map((tierDef, idx) => {
                  const tierUnlocked = progress?.unlockedTiers?.includes(tierDef.tier) ?? false;
                  const tierColors = TIER_COLORS[tierDef.tier];
                  const previousUnlocked =
                    idx === 0 ||
                    (progress?.unlockedTiers?.includes(def.tiers![idx - 1].tier) ?? false);
                  const nextTier = !tierUnlocked && previousUnlocked;

                  return (
                    <View
                      key={tierDef.tier}
                      style={[
                        styles.tierCard,
                        tierUnlocked && {
                          borderColor: `${tierColors.primary}70`,
                          backgroundColor: `${tierColors.primary}10`,
                        },
                      ]}
                    >
                      <View style={styles.tierCardHeader}>
                        <View
                          style={[
                            styles.tierBadge,
                            {
                              backgroundColor: tierUnlocked
                                ? `${tierColors.primary}24`
                                : Colors.surfaceHighlight,
                              borderColor: tierUnlocked ? `${tierColors.primary}80` : Colors.border,
                            },
                          ]}
                        >
                          {tierUnlocked ? (
                            <icons.Check size={15} color={tierColors.primary} />
                          ) : (
                            <Text style={styles.tierBadgeText}>{idx + 1}</Text>
                          )}
                        </View>

                        <View style={styles.tierCardTitleBlock}>
                          <Text style={styles.tierCardLabel}>{TIER_LABELS[tierDef.tier]}</Text>
                          <Text style={styles.tierCardReq}>{tierDef.requirement}</Text>
                        </View>

                        <Text
                          style={[
                            styles.tierStatusText,
                            tierUnlocked && { color: tierColors.primary },
                          ]}
                        >
                          {tierUnlocked
                            ? 'Unlocked'
                            : nextTier && progress
                              ? `${progress.currentValue}/${tierDef.value}`
                              : 'Locked'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : hiddenUnlocked ? (
              <View style={styles.hiddenUnlockedModalBox}>
                <Text style={styles.hiddenUnlockedModalBoxLabel}>SECRET BADGE UNLOCKED</Text>
                <Text style={styles.hiddenUnlockedModalBoxText}>
                  {def.unlockHint ?? def.description}
                </Text>
              </View>
            ) : (
              def.unlockHint && (
                <View style={styles.hiddenConditionCard}>
                  <icons.Lock size={18} color={HIDDEN_COLORS.red} />
                  <Text style={styles.hiddenConditionText}>{def.unlockHint}</Text>
                </View>
              )
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
    marginTop: 10,
  },

  scrollContent: {
    paddingBottom: 40,
  },

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
  },

  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  progressStat: {
    flex: 1,
    alignItems: 'center',
  },

  progressStatValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },

  progressStatLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
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
    overflow: 'hidden',
    marginTop: 14,
  },

  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.f1Red,
  },

  filterBar: {
    marginTop: 14,
    marginBottom: 4,
  },

  filterContent: {
    paddingHorizontal: 16,
  },

  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginRight: 8,
  },

  filterTabActive: {
    borderColor: Colors.f1Red,
  },

  filterTabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    zIndex: 1,
  },

  filterTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  grid: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 10,
  },

  hiddenCard: {
    backgroundColor: HIDDEN_COLORS.black,
    borderColor: HIDDEN_COLORS.redBorder,
  },

  hiddenLockedCard: {
    opacity: 0.96,
  },

  hiddenUnlockedCard: {
    backgroundColor: HIDDEN_COLORS.black,
    borderColor: HIDDEN_COLORS.redBorderStrong,
    borderWidth: 1.5,
  },

  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  cardIconShell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
  },

  hiddenIconShell: {
    backgroundColor: HIDDEN_COLORS.blackRaised,
    borderColor: HIDDEN_COLORS.redBorder,
  },

  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },

  cardName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  hiddenCardName: {
    color: '#FFF',
  },

  cardNameHidden: {
    color: '#F2F2F2',
    fontStyle: 'italic',
  },

  cardCategory: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  hiddenCardCategory: {
    color: HIDDEN_COLORS.red,
  },

  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },

  hiddenUnlockedPill: {
    backgroundColor: HIDDEN_COLORS.redDark,
    borderColor: HIDDEN_COLORS.red,
  },

  unlockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginLeft: 4,
  },

  cardDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },

  hiddenCardDesc: {
    color: '#C8C8C8',
  },

  hiddenHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: HIDDEN_COLORS.blackSoft,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: HIDDEN_COLORS.redBorder,
  },

  hiddenHintText: {
    color: '#BDBDBD',
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
    marginLeft: 6,
  },

  hiddenRevealBox: {
    backgroundColor: HIDDEN_COLORS.blackSoft,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: HIDDEN_COLORS.redBorder,
    marginTop: 2,
  },

  hiddenRevealLabel: {
    color: HIDDEN_COLORS.red,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 5,
  },

  hiddenRevealText: {
    color: '#D8D8D8',
    fontSize: 12,
    lineHeight: 17,
  },

  tierFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tierDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  tierProgressText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 'auto',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: Colors.border,
  },

  hiddenModalSheet: {
    backgroundColor: HIDDEN_COLORS.black,
    borderColor: HIDDEN_COLORS.redBorder,
  },

  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  hiddenModalHandle: {
    backgroundColor: HIDDEN_COLORS.red,
  },

  modalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },

  modalHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
  },

  modalIconShell: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 10,
  },

  hiddenModalIcon: {
    backgroundColor: HIDDEN_COLORS.redDark,
    borderColor: HIDDEN_COLORS.red,
  },

  modalName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  hiddenModalName: {
    color: '#FFF',
  },

  modalCategoryBadge: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 8,
  },

  hiddenModalCategoryBadge: {
    color: '#FFF',
    backgroundColor: HIDDEN_COLORS.redDark,
  },

  modalDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: 10,
  },

  hiddenModalDesc: {
    color: '#DADADA',
  },

  modalProgressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden',
    marginTop: 18,
  },

  modalProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.f1Red,
  },

  modalProgressLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },

  tiersSection: {
    marginTop: 24,
  },

  tiersSectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  tierCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },

  tierCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tierBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 12,
  },

  tierBadgeText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },

  tierCardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },

  tierCardLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  tierCardReq: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },

  tierStatusText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },

  hiddenConditionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: HIDDEN_COLORS.blackSoft,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: HIDDEN_COLORS.redBorder,
    marginTop: 24,
  },

  hiddenConditionText: {
    color: '#C8C8C8',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
    fontWeight: '600',
    marginLeft: 12,
  },

  hiddenUnlockedModalBox: {
    backgroundColor: HIDDEN_COLORS.blackSoft,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: HIDDEN_COLORS.redBorderStrong,
    marginTop: 24,
  },

  hiddenUnlockedModalBoxLabel: {
    color: HIDDEN_COLORS.red,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  hiddenUnlockedModalBoxText: {
    color: '#DADADA',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});