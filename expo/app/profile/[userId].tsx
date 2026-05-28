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
  TrendingUp,
  Flag,
  Hash,
  MapPin,
  BarChart3,
  Zap,
  Medal,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useGame } from '@/providers/GameProvider';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface PublicProfile {
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

async function fetchUserProfile(userId: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, first_name, last_name, country, total_points')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.log('fetchUserProfile: profile not found', error?.message);
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
      displayName: profile.display_name?.trim() || profile.username?.trim() || 'Unknown',
      firstName: profile.first_name?.trim() || '',
      lastName: profile.last_name?.trim() || '',
      country: profile.country?.trim() || '',
      totalPoints: profile.total_points ?? 0,
      globalRank: (rankData ?? 0) + 1,
      leaguesJoined: leaguesData ?? 0,
      predictionsMade: predsData ?? 0,
    };
  } catch (e) {
    console.log('fetchUserProfile: error', e);
    return null;
  }
}

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { fetchGlobalLeaderboard } = useGame();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const data = await fetchUserProfile(userId);
      if (cancelled) return;
      if (data) {
        setProfile(data);
      } else {
        setError('User not found.');
      }
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <ActivityIndicator size="large" color={Colors.f1Red} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Text style={styles.errorText}>{error || 'Profile not found.'}</Text>
      </View>
    );
  }

  const initials = profile.displayName
    .split(/\s+/)
    .map(s => s.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: profile.displayName }} />
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
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{initials}</Text>
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
              <Text style={styles.pointsText}>{profile.totalPoints.toLocaleString()} pts</Text>
            </View>
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
            <Text style={styles.statValue}>#{profile.globalRank}</Text>
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

        {/* Accuracy */}
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

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </Animated.View>
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
});
