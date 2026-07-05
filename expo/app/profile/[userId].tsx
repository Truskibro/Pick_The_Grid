import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  Modal,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Trophy,
  Users,
  BarChart3,
  Zap,
  MapPin,
  Shield,
  Award,
  Sparkles,
  Flag,
  Lock,
  EyeOff,
  CheckCircle,
  Check,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { useAchievements } from '@/providers/AchievementProvider';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_LEAGUE_MEMBERS, scoreMockMember } from '@/constants/mock-members';
import { MOCK_RACE_RESULTS } from '@/constants/f1-data';
import {
  VISIBLE_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  ALL_ACHIEVEMENTS,
  TIER_COLORS,
  TIER_LABELS,
  createEmptyProgress,
  type AchievementTier,
  type AchievementDefinition,
  type AchievementProgress,
  type AchievementState,
} from '@/constants/achievements';
import * as lucideIcons from 'lucide-react-native';

function resolveAchievementIcon(iconName: string): React.ComponentType<any> {
  const pascal = iconName
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return (lucideIcons as any)[pascal] || (lucideIcons as any).Trophy;
}

interface ProfileData {
  id: string;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  country: string;
  totalPoints: number;
  globalRank: number;
  leaguesJoined: number;
  predictionsMade: number;
}

function buildFallbackProfile(userId: string): ProfileData {
  return {
    id: userId,
    username: 'player',
    displayName: 'Unknown Player',
    firstName: '',
    lastName: '',
    country: '',
    totalPoints: 0,
    globalRank: 0,
    leaguesJoined: 0,
    predictionsMade: 0,
  };
}

async function fetchFromSupabase(userId: string): Promise<ProfileData | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, first_name, last_name, country, total_points')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      console.log('fetchFromSupabase: not found for', userId, error?.message || '');
      return null;
    }

    const [{ count: rankData }, { count: leaguesData }, { count: predsData }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gt('total_points', profile.total_points ?? 0),
        supabase
          .from('league_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('user_predictions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

    return {
      id: profile.id,
      username: profile.username?.trim() || 'unknown',
      displayName: profile.display_name?.trim() || profile.username?.trim() || 'Player',
      firstName: (profile.first_name || '').trim(),
      lastName: (profile.last_name || '').trim(),
      country: (profile.country || '').trim(),
      totalPoints: profile.total_points ?? 0,
      globalRank: (rankData ?? 0) + 1,
      leaguesJoined: leaguesData ?? 0,
      predictionsMade: predsData ?? 0,
    };
  } catch (e) {
    console.log('fetchFromSupabase: error', e);
    return null;
  }
}

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  // Only subscribe to fetchGlobalLeaderboard — the rest we read via refs
  // to avoid ProfileScreen re-rendering on every prediction/league change.
  const gameCtx = useGame();
  const { profile: currentUserProfile } = useUser();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Stable refs so effect doesn't re-run on every context change
  const fetchGlobalLeaderboardRef = useRef(gameCtx.fetchGlobalLeaderboard);
  fetchGlobalLeaderboardRef.current = gameCtx.fetchGlobalLeaderboard;
  const currentUserProfileRef = useRef(currentUserProfile);
  currentUserProfileRef.current = currentUserProfile;
  const predictionsRef = useRef(gameCtx.predictions);
  predictionsRef.current = gameCtx.predictions;
  const leaguesRef = useRef(gameCtx.leagues);
  leaguesRef.current = gameCtx.leagues;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const cp = currentUserProfileRef.current;
    const preds = predictionsRef.current;
    const lgs = leaguesRef.current;

    const load = async () => {
      setLoading(true);

      // 0. If viewing your own profile, use the local UserProvider data immediately
      if (cp && cp.id === userId && cp.id !== 'guest') {
        const predictionsMade = preds.filter((p) => (p.top10?.length ?? 0) > 0 || p.fastestLap || p.dnf).length;
        setProfile({
          id: cp.id,
          username: cp.username,
          displayName: cp.displayName,
          firstName: cp.firstName,
          lastName: cp.lastName,
          country: cp.country,
          totalPoints: cp.totalPoints,
          globalRank: cp.rank,
          leaguesJoined: lgs.length,
          predictionsMade,
        });
        setLoading(false);
        // Still try Supabase to enrich with accurate global rank
        const sb = await fetchFromSupabase(userId);
        if (!cancelled && sb) setProfile(sb);
        return;
      }

      // 1. Try Supabase first
      const supabaseProfile = await fetchFromSupabase(userId);
      if (cancelled) return;

      if (supabaseProfile) {
        setProfile(supabaseProfile);
        setLoading(false);
        return;
      }

      // 2. Try leaderboard data
      try {
        const leaderboard = await fetchGlobalLeaderboardRef.current();
        const lbEntry = leaderboard.find((e) => e.userId === userId);
        if (lbEntry) {
          setProfile({
            ...buildFallbackProfile(userId),
            username: lbEntry.username,
            displayName: lbEntry.displayName,
            totalPoints: lbEntry.totalPoints,
            globalRank: lbEntry.rank,
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        console.log('Leaderboard search skipped:', e);
      }

      // 3. Try mock members (Sainz4Ever55, Whitney etc.)
      const mockMember = MOCK_LEAGUE_MEMBERS.find((m) => m.userId === userId);
      if (mockMember) {
        const scored = scoreMockMember(mockMember, MOCK_RACE_RESULTS);
        setProfile({
          ...buildFallbackProfile(userId),
          username: mockMember.username,
          displayName: mockMember.displayName,
          totalPoints: scored.points,
          globalRank: 0,
        });
        setLoading(false);
        return;
      }

      // 4. Show a limited fallback view — don't just say "not found"
      const fallback = buildFallbackProfile(userId);
      setProfile(fallback);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, fadeAnim, slideAnim]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <ActivityIndicator size="large" color={Colors.f1Red} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Text style={styles.errorText}>Could not load this profile.</Text>
      </View>
    );
  }

  const hasFullData = profile.displayName !== 'Unknown Player' && profile.username !== 'player';
  const initials = profile.displayName
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase() || '??';
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: hasFullData ? profile.displayName : 'Profile' }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <Animated.View
          style={[
            styles.heroCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <LinearGradient
            colors={['#1A1025', '#0F1419', Colors.surface]}
            locations={[0, 0.5, 1]}
            style={styles.heroGradient}
          >
            <View style={[styles.avatarLarge, !hasFullData && styles.avatarLimited]}>
              <Text style={[styles.avatarLargeText, !hasFullData && styles.avatarLimitedText]}>
                {initials}
              </Text>
            </View>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            <Text style={styles.username}>@{profile.username}</Text>

            {fullName && (
              <Text style={styles.fullName}>{fullName}</Text>
            )}

            {profile.country ? (
              <View style={styles.countryRow}>
                <MapPin size={13} color={Colors.textSecondary} />
                <Text style={styles.countryText}>{profile.country}</Text>
              </View>
            ) : null}

            {/* Points badge */}
            <View style={styles.pointsBadge}>
              <Trophy size={16} color={Colors.warning} />
              <Text style={styles.pointsText}>
                {profile.totalPoints.toLocaleString()} pts
              </Text>
            </View>

            {/* Limited-data notice */}
            {!hasFullData && (
              <View style={styles.limitedNotice}>
                <Shield size={13} color={Colors.textMuted} />
                <Text style={styles.limitedNoticeText}>
                  Limited profile — this player hasn&apos;t created a full profile yet.
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Animated.View
            style={[
              styles.statCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={[styles.statIconShell, { backgroundColor: 'rgba(255,214,10,0.1)' }]}>
              <Trophy size={18} color={Colors.warning} />
            </View>
            <Text style={styles.statValue}>
              {profile.globalRank > 0 ? `#${profile.globalRank}` : '—'}
            </Text>
            <Text style={styles.statLabel}>Global Rank</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={[styles.statIconShell, { backgroundColor: 'rgba(10,132,255,0.1)' }]}>
              <Users size={18} color={Colors.info} />
            </View>
            <Text style={styles.statValue}>{profile.leaguesJoined}</Text>
            <Text style={styles.statLabel}>Leagues</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.statCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={[styles.statIconShell, { backgroundColor: 'rgba(48,209,88,0.1)' }]}>
              <BarChart3 size={18} color={Colors.success} />
            </View>
            <Text style={styles.statValue}>{profile.predictionsMade}</Text>
            <Text style={styles.statLabel}>Predictions</Text>
          </Animated.View>
        </View>

        {/* Performance Card */}
        <Animated.View
          style={[
            styles.detailCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.detailHeader}>
            <Zap size={16} color={Colors.f1Red} />
            <Text style={styles.detailTitle}>Performance</Text>
          </View>
          <View style={styles.perfRow}>
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>
                {profile.predictionsMade > 0
                  ? ((profile.totalPoints / (profile.predictionsMade * 150)) * 100).toFixed(1)
                  : '0.0'}%
              </Text>
              <Text style={styles.perfLabel}>Avg Score Rate</Text>
            </View>
            <View style={styles.perfDivider} />
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>
                {profile.predictionsMade > 0
                  ? (profile.totalPoints / profile.predictionsMade).toFixed(0)
                  : '0'}
              </Text>
              <Text style={styles.perfLabel}>Avg Pts / Race</Text>
            </View>
          </View>
        </Animated.View>

        {/* Achievements (Plaque) — real data */}
        <Animated.View
          style={[
            styles.achievementsCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,214,10,0.06)', 'rgba(255,214,10,0.01)']}
            style={styles.achievementsInner}
          >
            <View style={styles.achievementsHeader}>
              <View style={[styles.achievementsIconShell]}>
                <Award size={18} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.achievementsTitle}>Achievements</Text>
                <Text style={styles.achievementsSubtitle}>
                  Badges and milestones pinned to this player&apos;s plaque
                </Text>
              </View>
            </View>

            <ProfileAchievements
              userId={userId}
              isOwnProfile={!!currentUserProfile && currentUserProfile.id === userId}
              key={userId}
            />
          </LinearGradient>
        </Animated.View>

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────── */
/*  ProfileAchievements — shows badge progress     */
/* ─────────────────────────────────────────────── */

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

/** Build an AchievementState for an arbitrary user from Supabase rows. */
function buildRemoteState(rows: any[]): AchievementState {
  const state: AchievementState = {};
  for (const def of ALL_ACHIEVEMENTS) {
    state[def.id] = createEmptyProgress(def.id);
  }
  for (const row of rows) {
    const id: string = row.achievement_id;
    if (!id || !state[id]) continue;
    const tiers: AchievementTier[] = Array.isArray(row.unlocked_tiers)
      ? row.unlocked_tiers.filter((t: string) =>
          ['bronze', 'silver', 'gold', 'platinum'].includes(t)
        )
      : [];
    state[id] = {
      achievementId: id,
      unlockedTiers: tiers,
      currentValue: row.current_value ?? 0,
      unlockedAt:
        typeof row.unlocked_at === 'object' && row.unlocked_at !== null
          ? row.unlocked_at
          : {},
    };
  }
  return state;
}

const ProfileAchievements = React.memo(function ProfileAchievements({
  userId,
  isOwnProfile,
}: {
  userId: string;
  isOwnProfile: boolean;
}) {
  const localAchievements = useAchievements();
  const [selectedDef, setSelectedDef] = useState<AchievementDefinition | null>(null);

  // For other users' profiles, fetch their achievement rows from Supabase.
  // user_achievements has a public SELECT policy (achievements_select_all)
  // so any authenticated client can read another user's badges — this is
  // what makes them visible on a profile plaque.
  const [remoteState, setRemoteState] = useState<AchievementState | null>(null);

  useEffect(() => {
    if (isOwnProfile || !userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('user_achievements')
          .select('achievement_id, unlocked_tiers, current_value, unlocked_at')
          .eq('user_id', userId);
        if (cancelled) return;
        if (error) {
          console.log('[Profile] remote achievements load failed:', error.message);
          setRemoteState({});
          return;
        }
        setRemoteState(buildRemoteState(data ?? []));
      } catch (e) {
        if (!cancelled) setRemoteState({});
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, isOwnProfile]);

  // Choose the source of truth: local for own profile, remote for others.
  const state: AchievementState = isOwnProfile
    ? localAchievements.state
    : (remoteState ?? {});

  const { unlockedCount, unlockedTiersCount, totalTiersCount } = useMemo(() => {
    let unlocked = 0;
    let unlockedTiers = 0;
    let totalTiers = 0;
    for (const def of ALL_ACHIEVEMENTS) {
      if (def.isHidden) continue;
      if (def.tiers) totalTiers += def.tiers.length;
      const prog = state[def.id];
      if (prog && (prog.unlockedTiers ?? []).length > 0) {
        unlocked++;
        unlockedTiers += (prog.unlockedTiers ?? []).length;
      }
    }
    return { unlockedCount: unlocked, unlockedTiersCount: unlockedTiers, totalTiersCount: totalTiers };
  }, [state]);

  // Memoize filtered achievement lists to avoid recomputation on re-renders
  const unlockedVisible = useMemo(() => {
    return VISIBLE_ACHIEVEMENTS.filter((def) => {
      const prog = state[def.id];
      return (prog?.unlockedTiers?.length ?? 0) > 0;
    });
  }, [state]);

  const unlockedHidden = useMemo(() => {
    return HIDDEN_ACHIEVEMENTS.filter((def) => {
      const prog = state[def.id];
      return (prog?.unlockedTiers?.length ?? 0) > 0;
    });
  }, [state]);

  const hasAnyUnlocked = unlockedVisible.length > 0 || unlockedHidden.length > 0;

  // While loading another user's badges, show a subtle placeholder.
  if (!isOwnProfile && remoteState === null) {
    return (
      <View style={paStyles.emptyState}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
        <Text style={paStyles.emptyBody}>Loading badges…</Text>
      </View>
    );
  }

  if (!hasAnyUnlocked) {
    return (
      <View style={paStyles.emptyState}>
        <View style={paStyles.emptyIconShell}>
          <Lock size={16} color={Colors.textMuted} />
        </View>
        <Text style={paStyles.emptyTitle}>No badges yet</Text>
        <Text style={paStyles.emptyBody}>
          Predict races and compete in leagues to earn Grid Badges.
        </Text>
      </View>
    );
  }

  return (
    <View style={paStyles.container}>
      {/* Summary row */}
      <View style={paStyles.summary}>
        <View style={paStyles.summaryStat}>
          <Text style={paStyles.summaryValue}>{unlockedCount}</Text>
          <Text style={paStyles.summaryLabel}>Badges</Text>
        </View>
        <View style={paStyles.summaryDivider} />
        <View style={paStyles.summaryStat}>
          <Text style={paStyles.summaryValue}>
            {unlockedTiersCount}/{totalTiersCount}
          </Text>
          <Text style={paStyles.summaryLabel}>Tiers</Text>
        </View>
      </View>

      {/* Unlocked visible badges */}
      {unlockedVisible.length > 0 && (
        <View style={paStyles.section}>
          <Text style={paStyles.sectionLabel}>Earned Badges</Text>
          <View style={paStyles.badgeRow}>
            {unlockedVisible.map((def) => {
              const prog = state[def.id];
              const tiers = prog?.unlockedTiers ?? [];
              const highestTier = tiers.length > 0 ? tiers[tiers.length - 1] : 'bronze';
              const tierColors = TIER_COLORS[highestTier as AchievementTier];
              return (
                <ProfileBadgeIcon
                  key={def.id}
                  def={def}
                  progress={prog}
                  color={tierColors.primary}
                  tierLabel={TIER_LABELS[highestTier as AchievementTier]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDef(def);
                  }}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Unlocked hidden badges — tappable, styled like the achievements tab */}
      {unlockedHidden.length > 0 && (
        <View style={paStyles.section}>
          <Text style={paStyles.sectionLabel}>Secret Badges</Text>
          <View style={paStyles.badgeRow}>
            {unlockedHidden.map((def) => (
              <ProfileBadgeIcon
                key={def.id}
                def={def}
                color={HIDDEN_COLORS.red}
                isHidden
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDef(def);
                }}
              />
            ))}
          </View>
        </View>
      )}

      <ProfileAchievementDetailModal
        def={selectedDef}
        progress={selectedDef ? state[selectedDef.id] : undefined}
        visible={!!selectedDef}
        hideDescription={selectedDef?.isHidden ?? false}
        onClose={() => setSelectedDef(null)}
      />
    </View>
  );
});

const paStyles = StyleSheet.create({
  container: {
    gap: 14,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 20,
    gap: 8,
  },
  emptyIconShell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  emptyBody: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center' as const,
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  summary: {
    flexDirection: 'row' as const,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800' as const,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  badgeIconChip: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: 52,
    height: 52,
    borderRadius: 14,
    gap: 2,
  },
  badgeIconTierLabel: {
    fontSize: 8,
    fontWeight: '800' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%' as const,
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
    paddingBottom: 36,
  },
  modalHeader: {
    alignItems: 'center' as const,
    paddingTop: 16,
    paddingBottom: 4,
  },
  modalIconShell: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    marginBottom: 10,
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
    marginTop: 8,
  },
  modalDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center' as const,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  modalProgressTrack: {
    width: '100%' as const,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden' as const,
    marginTop: 18,
  },
  modalProgressFill: {
    height: '100%' as const,
    borderRadius: 2,
    backgroundColor: Colors.f1Red,
  },
  modalProgressLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  tiersSection: {
    marginTop: 24,
  },
  tiersSectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  tierBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    marginRight: 12,
  },
  tierBadgeText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800' as const,
  },
  tierCardTitleBlock: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 2,
  },
  tierStatusText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    marginLeft: 8,
  },
});

/* Icon-based badge chip used on the profile screen. Both visible and secret
   badges are tappable buttons that open the detail modal. Secret badges are
   styled to match the achievements tab (black + F1 red), and their modal
   shows only the badge name (no description). */
const ProfileBadgeIcon = React.memo(function ProfileBadgeIcon({
  def,
  progress,
  color,
  tierLabel,
  isHidden = false,
  onPress,
}: {
  def: AchievementDefinition;
  progress?: AchievementProgress;
  color: string;
  tierLabel?: string;
  isHidden?: boolean;
  onPress?: () => void;
}) {
  const Icon = resolveAchievementIcon(def.icon);

  // Secret badges: tappable, styled like the achievements tab (black + F1 red)
  if (isHidden) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!onPress}
        style={[
          paStyles.badgeIconChip,
          {
            backgroundColor: HIDDEN_COLORS.black,
            borderColor: HIDDEN_COLORS.redBorderStrong,
            borderWidth: 1.5,
          },
        ]}
      >
        <Icon size={20} color="#FFF" />
        {tierLabel ? (
          <Text style={[paStyles.badgeIconTierLabel, { color: HIDDEN_COLORS.red }]} numberOfLines={1}>
            {tierLabel}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  // Visible badges: tappable buttons that open the detail modal
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        paStyles.badgeIconChip,
        {
          backgroundColor: `${color}18`,
          borderColor: `${color}55`,
          borderWidth: 1,
        },
      ]}
    >
      <Icon size={20} color={color} />
      {tierLabel ? (
        <Text style={[paStyles.badgeIconTierLabel, { color }]} numberOfLines={1}>
          {tierLabel}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});

/* Detail modal shown when a visible badge icon is tapped on the profile. */
const ProfileAchievementDetailModal = React.memo(function ProfileAchievementDetailModal({
  def,
  progress,
  visible,
  hideDescription = false,
  onClose,
}: {
  def: AchievementDefinition | null;
  progress: AchievementProgress | undefined;
  visible: boolean;
  hideDescription?: boolean;
  onClose: () => void;
}) {
  if (!def) return null;

  const Icon = resolveAchievementIcon(def.icon);
  const unlocked = (progress?.unlockedTiers?.length ?? 0) > 0;
  const highestTier = unlocked ? progress!.unlockedTiers[progress!.unlockedTiers.length - 1] : null;
  const isHidden = def.isHidden;
  const accentColor = isHidden
    ? HIDDEN_COLORS.red
    : (highestTier ? TIER_COLORS[highestTier].primary : Colors.textMuted);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={paStyles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            paStyles.modalSheet,
            isHidden && {
              backgroundColor: HIDDEN_COLORS.black,
              borderTopWidth: 1,
              borderColor: HIDDEN_COLORS.redBorderStrong,
            },
          ]}
          onPress={() => {}}
        >
          <View
            style={[
              paStyles.modalHandle,
              isHidden && { backgroundColor: HIDDEN_COLORS.redBorder },
            ]}
          />
          <ScrollView contentContainerStyle={paStyles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <View style={paStyles.modalHeader}>
              <View
                style={[
                  paStyles.modalIconShell,
                  {
                    backgroundColor: isHidden
                      ? HIDDEN_COLORS.redSoft
                      : `${accentColor}22`,
                    borderColor: isHidden
                      ? HIDDEN_COLORS.redBorder
                      : `${accentColor}70`,
                  },
                ]}
              >
                <Icon size={32} color={isHidden ? '#FFF' : accentColor} />
              </View>

              <Text
                style={[
                  paStyles.modalName,
                  isHidden && { color: '#FFF' },
                ]}
              >
                {def.name}
              </Text>

              <Text
                style={[
                  paStyles.modalCategoryBadge,
                  isHidden && {
                    color: HIDDEN_COLORS.red,
                    backgroundColor: HIDDEN_COLORS.redSoft,
                    borderColor: HIDDEN_COLORS.redBorder,
                    borderWidth: 1,
                  },
                ]}
              >
                {isHidden ? 'Secret' : def.category.charAt(0).toUpperCase() + def.category.slice(1)}
              </Text>

              {!hideDescription ? (
                <Text
                  style={[
                    paStyles.modalDesc,
                    isHidden && { color: '#D8D8D8' },
                  ]}
                >
                  {def.description}
                </Text>
              ) : (
                <Text
                  style={[
                    paStyles.modalDesc,
                    isHidden && { color: HIDDEN_COLORS.red },
                  ]}
                >
                  A secret achievement. Keep playing to discover more!
                </Text>
              )}
            </View>

            {def.tiers && progress && (
              <>
                <View style={paStyles.modalProgressTrack}>
                  <View
                    style={[
                      paStyles.modalProgressFill,
                      {
                        width:
                          def.tiers.length > 0
                            ? `${Math.min(
                                100,
                                Math.round(
                                  (progress.currentValue /
                                    def.tiers[def.tiers.length - 1].value) *
                                    100
                                )
                              )}%`
                            : '0%',
                        backgroundColor: accentColor,
                      },
                    ]}
                  />
                </View>

                <Text style={paStyles.modalProgressLabel}>
                  Progress: {progress.currentValue} / {def.tiers[def.tiers.length - 1].value}
                </Text>

                <View style={paStyles.tiersSection}>
                  <Text
                    style={[
                      paStyles.tiersSectionTitle,
                      isHidden && { color: HIDDEN_COLORS.red },
                    ]}
                  >
                    TIER REQUIREMENTS
                  </Text>

                  {def.tiers.map((tierDef, idx) => {
                    const tierUnlocked = progress?.unlockedTiers?.includes(tierDef.tier) ?? false;
                    const tierColors = TIER_COLORS[tierDef.tier];
                    const previousUnlocked =
                      idx === 0 ||
                      (progress?.unlockedTiers?.includes(def.tiers![idx - 1].tier) ?? false);
                    const nextTier = !tierUnlocked && previousUnlocked;
                    const tierAccent = isHidden ? HIDDEN_COLORS.red : tierColors.primary;

                    return (
                      <View
                        key={tierDef.tier}
                        style={[
                          paStyles.tierCard,
                          isHidden && {
                            backgroundColor: HIDDEN_COLORS.blackRaised,
                            borderColor: HIDDEN_COLORS.redBorder,
                          },
                          tierUnlocked && {
                            borderColor: `${tierAccent}70`,
                            backgroundColor: `${tierAccent}10`,
                          },
                        ]}
                      >
                        <View style={paStyles.tierCardHeader}>
                          <View
                            style={[
                              paStyles.tierBadge,
                              {
                                backgroundColor: tierUnlocked
                                  ? `${tierAccent}24`
                                  : (isHidden ? HIDDEN_COLORS.blackSoft : Colors.surfaceHighlight),
                                borderColor: tierUnlocked ? `${tierAccent}80` : (isHidden ? HIDDEN_COLORS.redBorder : Colors.border),
                              },
                            ]}
                          >
                            {tierUnlocked ? (
                              <Check size={15} color={tierAccent} />
                            ) : (
                              <Text style={[paStyles.tierBadgeText, isHidden && { color: HIDDEN_COLORS.red }]}>{idx + 1}</Text>
                            )}
                          </View>

                          <View style={paStyles.tierCardTitleBlock}>
                            <Text style={[paStyles.tierCardLabel, isHidden && { color: '#FFF' }]}>{TIER_LABELS[tierDef.tier]}</Text>
                            <Text style={[paStyles.tierCardReq, isHidden && { color: '#C8C8C8' }]}>{tierDef.requirement}</Text>
                          </View>

                          <Text
                            style={[
                              paStyles.tierStatusText,
                              tierUnlocked && { color: tierAccent },
                              isHidden && !tierUnlocked && { color: HIDDEN_COLORS.red },
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
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

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
    gap: 14,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  /* ── Hero ── */
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroGradient: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.f1Red,
    marginBottom: 4,
  },
  avatarLargeText: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
  },
  avatarLimited: {
    borderColor: Colors.textMuted,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatarLimitedText: {
    color: Colors.textMuted,
  },
  displayName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  username: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  fullName: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  countryText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,214,10,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  pointsText: {
    color: Colors.warning,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  limitedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  limitedNoticeText: {
    color: Colors.textMuted,
    fontSize: 11,
    flexShrink: 1,
    textAlign: 'center',
  },

  /* ── Stats Grid ── */
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconShell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
  },

  /* ── Detail Card ── */
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  detailTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perfItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  perfValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
  },
  perfLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  perfDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },

  /* ── Achievements ── */
  achievementsCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  achievementsInner: {
    padding: 18,
    gap: 12,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementsIconShell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,214,10,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementsTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  achievementsSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  comingSoonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: 'rgba(255,214,10,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.25)',
  },
  comingSoonLabel: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  comingSoonBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  previewBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
});
