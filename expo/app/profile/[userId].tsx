import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { useAchievements } from '@/providers/AchievementProvider';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_LEAGUE_MEMBERS } from '@/constants/mock-members';
import {
  VISIBLE_ACHIEVEMENTS,
  HIDDEN_ACHIEVEMENTS,
  TIER_COLORS,
  TIER_LABELS,
  type AchievementTier,
} from '@/constants/achievements';

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
  const { getLeagueMembers, fetchGlobalLeaderboard, leagues, predictions } = useGame();
  const { profile: currentUserProfile } = useUser();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      // 0. If viewing your own profile, use the local UserProvider data immediately
      if (currentUserProfile && currentUserProfile.id === userId && currentUserProfile.id !== 'guest') {
        const predictionsMade = predictions.filter((p) => (p.top10?.length ?? 0) > 0 || p.fastestLap || p.dnf).length;
        setProfile({
          id: currentUserProfile.id,
          username: currentUserProfile.username,
          displayName: currentUserProfile.displayName,
          firstName: currentUserProfile.firstName,
          lastName: currentUserProfile.lastName,
          country: currentUserProfile.country,
          totalPoints: currentUserProfile.totalPoints,
          globalRank: currentUserProfile.rank,
          leaguesJoined: leagues.length,
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
        const leaderboard = await fetchGlobalLeaderboard();
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
        setProfile({
          ...buildFallbackProfile(userId),
          username: mockMember.username,
          displayName: mockMember.displayName,
          totalPoints: 0,
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
  }, [userId, fetchGlobalLeaderboard, getLeagueMembers, currentUserProfile, leagues, predictions]);

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
              isOwnProfile={!!currentUserProfile && currentUserProfile.id === userId}
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

function ProfileAchievements({ isOwnProfile }: { isOwnProfile: boolean }) {
  const { state, unlockedCount, totalTiersCount, unlockedTiersCount } = useAchievements();

  // Collect unlocked visible achievements
  const unlockedVisible = VISIBLE_ACHIEVEMENTS.filter((def) => {
    const prog = state[def.id];
    return prog && prog.unlockedTiers.length > 0;
  });

  // Collect unlocked hidden achievements
  const unlockedHidden = HIDDEN_ACHIEVEMENTS.filter((def) => {
    const prog = state[def.id];
    return prog && prog.unlockedTiers.length > 0;
  });

  const hasAnyUnlocked = unlockedVisible.length > 0 || unlockedHidden.length > 0;

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
              const highestTier = prog?.unlockedTiers[prog.unlockedTiers.length - 1] ?? 'bronze';
              const tierColors = TIER_COLORS[highestTier as AchievementTier];
              return (
                <View
                  key={def.id}
                  style={[paStyles.badgeChip, { borderColor: tierColors.primary + '40' }]}
                >
                  <View
                    style={[
                      paStyles.badgeChipDot,
                      { backgroundColor: tierColors.primary },
                    ]}
                  />
                  <Text style={paStyles.badgeChipName} numberOfLines={1}>
                    {def.name}
                  </Text>
                  <Text
                    style={[paStyles.badgeChipTier, { color: tierColors.primary }]}
                  >
                    {TIER_LABELS[highestTier as AchievementTier]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Unlocked hidden badges */}
      {unlockedHidden.length > 0 && (
        <View style={paStyles.section}>
          <Text style={paStyles.sectionLabel}>Secret Badges</Text>
          <View style={paStyles.badgeRow}>
            {unlockedHidden.map((def) => (
              <View key={def.id} style={paStyles.hiddenBadgeChip}>
                <EyeOff size={12} color={Colors.warning} />
                <Text style={paStyles.hiddenBadgeName} numberOfLines={1}>
                  {def.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

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
  badgeChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
  },
  badgeChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeChipName: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600' as const,
    maxWidth: 110,
  },
  badgeChipTier: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  hiddenBadgeChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(255,214,10,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.2)',
  },
  hiddenBadgeName: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '600' as const,
  },
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
