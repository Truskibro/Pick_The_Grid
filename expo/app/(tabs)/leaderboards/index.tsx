import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Minus,
  Shield,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react-native';

import AnimatedPressable from '@/components/AnimatedPressable';
import Colors from '@/constants/colors';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { useSeries } from '@/providers/SeriesProvider';
import { LeaderboardEntry, League } from '@/types';

type TabType = 'global' | 'league';

interface LeagueRanking {
  league: League;
  combinedPoints: number;
  memberCount: number;
  rank: number;
}

export default function LeaderboardsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('global');

  const { leagues, getLeagueMembers, fetchGlobalLeaderboard, refreshPredictions } = useGame();
  const { profile, session } = useUser();
  const { currentSeries } = useSeries();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);

    try {
      // Pull straight from Supabase — server-authored points are the single
      // source of truth. We do NOT override with local totalPoints and we do
      // NOT inject the current user, because that would make every device see
      // a different leaderboard. The current user appears on the board iff
      // they have a profiles row (created on signup) and scored predictions.
      const data = await fetchGlobalLeaderboard(currentSeries);
      setGlobalLeaderboard(data);
    } catch (e) {
      console.log('Leaderboard load error:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [fetchGlobalLeaderboard, currentSeries]);

  // Refresh leaderboard whenever the tab is focused.
  useFocusEffect(
    useCallback(() => {
      void loadLeaderboard();
    }, [loadLeaderboard])
  );

  // Refresh predictions on focus so the user's own rows are current, then
  // the leaderboard load below will reflect any freshly-scored predictions.
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        void refreshPredictions();
      }
    }, [session, refreshPredictions])
  );

  const leagueRankings: LeagueRanking[] = useMemo(() => {
    // Only show leagues belonging to the current series.
    return leagues
      .filter((league) => (league.seriesId ?? 'f1') === currentSeries)
      .map((league) => {
        const members = getLeagueMembers(league.id);
        const combinedPoints = members.reduce((sum, m) => sum + m.points, 0);

        return {
          league,
          combinedPoints,
          memberCount: members.length,
          rank: 0,
        };
      })
      .sort((a, b) => b.combinedPoints - a.combinedPoints)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [leagues, getLeagueMembers, currentSeries]);

  const top3 = globalLeaderboard.slice(0, 3);
  const rest = globalLeaderboard.slice(3);

  const leagueTop3 = leagueRankings.slice(0, 3);
  const leagueRest = leagueRankings.slice(3);

  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const podiumSizes = [72, 60, 56];
  const podiumHeights = [100, 80, 64];

  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumColorOrder =
    top3.length >= 3 ? [podiumColors[1], podiumColors[0], podiumColors[2]] : podiumColors;
  const podiumSizeOrder =
    top3.length >= 3 ? [podiumSizes[1], podiumSizes[0], podiumSizes[2]] : podiumSizes;
  const podiumHeightOrder =
    top3.length >= 3 ? [podiumHeights[1], podiumHeights[0], podiumHeights[2]] : podiumHeights;

  const leaguePodiumOrder =
    leagueTop3.length >= 3 ? [leagueTop3[1], leagueTop3[0], leagueTop3[2]] : leagueTop3;

  const renderTrendIcon = (entry: LeaderboardEntry) => {
    if (!entry.previousRank) {
      return <Minus size={13} color={Colors.textMuted} />;
    }

    if (entry.previousRank > entry.rank) {
      return <TrendingUp size={13} color={Colors.success} />;
    }

    if (entry.previousRank < entry.rank) {
      return <TrendingDown size={13} color={Colors.error} />;
    }

    return <Minus size={13} color={Colors.textMuted} />;
  };

  const renderGlobalRow = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const actualRank = item.rank ?? index + 4;
    const accentColor = actualRank <= 3 ? podiumColors[actualRank - 1] : undefined;

    return (
      <AnimatedPressable
        style={[
          styles.rankRow,
          { backgroundColor: Colors.surface, borderColor: Colors.border },
          accentColor && { borderColor: `${accentColor}40` },
        ]}
        onPress={() => router.push(`/profile/${item.userId}` as any)}
      >
        {accentColor && (
          <>
            <LinearGradient
              colors={[`${accentColor}14`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
            />
            <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
          </>
        )}

        <View style={styles.rankColumn}>
          <View
            style={[
              styles.rankBadge,
              {
                backgroundColor: Colors.surfaceHighlight,
                borderColor: Colors.border,
              },
              accentColor && {
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}55`,
              },
            ]}
          >
            <Text style={[styles.rankBadgeText, accentColor && { color: accentColor }]}>
              #{actualRank}
            </Text>
          </View>
        </View>

        <View style={styles.rowMain}>
          <View style={styles.rowTop}>
            <View style={styles.nameBlock}>
              <Text
                style={[styles.displayName, accentColor && { color: accentColor }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {item.displayName}
              </Text>

              <Text style={styles.usernameText} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>

            <View style={styles.pointsColumn}>
              <Text
                style={[
                  styles.pointsText,
                  accentColor && { color: accentColor },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {item.totalPoints.toLocaleString()}
              </Text>
              <Text style={styles.pointsLabel}>
                PTS
              </Text>
            </View>
          </View>

          <View style={styles.rowBottom}>
            <View
              style={[
                styles.trendPill,
                { backgroundColor: `${Colors.f1Red}0A`, borderColor: `${Colors.borderLight}` },
              ]}
            >
              {renderTrendIcon(item)}
              <Text style={styles.trendText} numberOfLines={1}>
                {item.previousRank ? `Prev #${item.previousRank}` : 'New Entry'}
              </Text>
            </View>

            <Text style={styles.rankMetaText} numberOfLines={1}>
              Global #{actualRank}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  const renderLeagueRow = ({ item }: { item: LeagueRanking; index: number }) => {
    const accentColor = item.rank <= 3 ? podiumColors[item.rank - 1] : undefined;

    return (
      <AnimatedPressable
        style={[
          styles.rankRow,
          { backgroundColor: Colors.surface, borderColor: Colors.border },
          accentColor && { borderColor: `${accentColor}40` },
        ]}
        onPress={() => router.push(`/league-detail/${item.league.id}` as any)}
      >
        {accentColor && (
          <>
            <LinearGradient
              colors={[`${accentColor}14`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
            />
            <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
          </>
        )}

        <View style={styles.rankColumn}>
          <View
            style={[
              styles.rankBadge,
              {
                backgroundColor: Colors.surfaceHighlight,
                borderColor: Colors.border,
              },
              accentColor && {
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}55`,
              },
            ]}
          >
            <Text style={[styles.rankBadgeText, accentColor && { color: accentColor }]}>
              #{item.rank}
            </Text>
          </View>
        </View>

        <View style={styles.rowMain}>
          <View style={styles.rowTop}>
            <View style={styles.nameBlock}>
              <Text
                style={[styles.displayName, accentColor && { color: accentColor }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {item.league.name}
              </Text>

              <View style={styles.leagueMemberLine}>
                <Users size={12} color={Colors.textMuted} />
                <Text style={styles.usernameText} numberOfLines={1}>
                  {item.memberCount} members
                </Text>
              </View>
            </View>

            <View style={styles.pointsColumn}>
              <Text
                style={[
                  styles.pointsText,
                  accentColor && { color: accentColor },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {item.combinedPoints.toLocaleString()}
              </Text>
              <Text style={styles.pointsLabel}>
                PTS
              </Text>
            </View>
          </View>

          <View style={styles.rowBottom}>
            <View
              style={[
                styles.trendPill,
                { backgroundColor: `${Colors.f1Red}0A`, borderColor: `${Colors.borderLight}` },
              ]}
            >
              <Shield size={13} color={Colors.textSecondary} />
              <Text style={styles.trendText} numberOfLines={1}>
                League
              </Text>
            </View>

            <Text style={styles.rankMetaText} numberOfLines={1}>
              League #{item.rank}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  const renderPodiumProfile = ({
    name,
    points,
    rank,
    initials,
    color,
    size,
  }: {
    name: string;
    points: number;
    rank: number;
    initials: string;
    color: string;
    size: number;
  }) => {
    return (
      <View
        style={[
          styles.podiumProfileCard,
          {
            borderColor: `${color}35`,
            backgroundColor: `${color}0D`,
            borderRadius: 18,
          },
        ]}
      >
        <View style={styles.avatarSlot}>
          <View style={styles.avatarWrap}>
            <View
              style={[
                styles.podiumAvatarGlow,
                {
                  width: size + 10,
                  height: size + 10,
                  borderRadius: (size + 10) / 2,
                  backgroundColor: `${color}10`,
                },
              ]}
            />

            <View
              style={[
                styles.podiumAvatar,
                {
                  width: size,
                  height: size,
                  borderColor: color,
                  backgroundColor: Colors.surfaceHighlight,
                  borderRadius: 999,
                },
              ]}
            >
              <Text style={[styles.podiumInitials, { fontSize: size / 3 }]}>
                {initials}
              </Text>
            </View>

            <View
              style={[
                styles.podiumRankBubble,
                { backgroundColor: color },
              ]}
            >
              <Text style={styles.podiumRankBubbleText}>#{rank}</Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.podiumName}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {name}
        </Text>

        <Text style={[styles.podiumPoints, { color }]} numberOfLines={1}>
          {points.toLocaleString()} pts
        </Text>
      </View>
    );
  };

  const getPodiumColumnStyle = (rank: number) => [
    styles.podiumColumn,
    rank === 1 && styles.podiumColumnGold,
    rank === 2 && styles.podiumColumnSilver,
    rank === 3 && styles.podiumColumnBronze,
  ];

  const renderGlobalPodium = () => {
    if (loadingLeaderboard) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.f1Red} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      );
    }

    if (top3.length === 0) return null;

    return (
      <View style={styles.podiumContainer}>
        {podiumOrder.map((entry, i) => {
          if (!entry) return null;

          const color = podiumColorOrder[i];
          const size = podiumSizeOrder[i];
          const height = podiumHeightOrder[i];

          const initials = (entry.displayName || '??')
            .split(' ')
            .map((w) => w[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <AnimatedPressable
              key={entry.userId}
              style={getPodiumColumnStyle(entry.rank)}
              onPress={() => router.push(`/profile/${entry.userId}` as any)}
            >
              {renderPodiumProfile({
                name: entry.displayName,
                points: entry.totalPoints,
                rank: entry.rank,
                initials,
                color,
                size,
              })}

              <View
                style={[
                  styles.podiumBar,
                  {
                    height,
                    backgroundColor: `${color}22`,
                    borderColor: `${color}55`,
                    borderRadius: 12,
                  },
                ]}
              >
                <Text style={[styles.podiumRank, { color }]}>#{entry.rank}</Text>
              </View>
            </AnimatedPressable>
          );
        })}
      </View>
    );
  };

  const renderLeaguePodium = () => {
    if (leagueTop3.length === 0) return null;

    return (
      <View style={styles.podiumContainer}>
        {leaguePodiumOrder.map((entry, i) => {
          if (!entry) return null;

          const color = podiumColorOrder[i] ?? podiumColors[i];
          const size = podiumSizeOrder[i] ?? podiumSizes[i];
          const height = podiumHeightOrder[i] ?? podiumHeights[i];

          const initials = entry.league.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <AnimatedPressable
              key={entry.league.id}
              style={getPodiumColumnStyle(entry.rank)}
              onPress={() => router.push(`/league-detail/${entry.league.id}` as any)}
            >
              {renderPodiumProfile({
                name: entry.league.name,
                points: entry.combinedPoints,
                rank: entry.rank,
                initials,
                color,
                size,
              })}

              <View
                style={[
                  styles.podiumBar,
                  {
                    height,
                    backgroundColor: `${color}22`,
                    borderColor: `${color}55`,
                    borderRadius: 12,
                  },
                ]}
              >
                <Text style={[styles.podiumRank, { color }]}>#{entry.rank}</Text>
              </View>
            </AnimatedPressable>
          );
        })}
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: Colors.background }]}>
      <View style={styles.tabRow}>
        <AnimatedPressable
          style={[
            styles.tab,
            { backgroundColor: Colors.surface, borderColor: Colors.border },
            activeTab === 'global' && {
              backgroundColor: Colors.f1Red,
              borderColor: Colors.f1Red,
            },
          ]}
          onPress={() => setActiveTab('global')}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>
            Global
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          style={[
            styles.tab,
            { backgroundColor: Colors.surface, borderColor: Colors.border },
            activeTab === 'league' && {
              backgroundColor: Colors.f1Red,
              borderColor: Colors.f1Red,
            },
          ]}
          onPress={() => setActiveTab('league')}
        >
          <Text style={[styles.tabText, activeTab === 'league' && styles.tabTextActive]}>
            League
          </Text>
        </AnimatedPressable>
      </View>

      {activeTab === 'global' && (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loadingLeaderboard}
          onRefresh={loadLeaderboard}
          ListHeaderComponent={renderGlobalPodium}
          renderItem={renderGlobalRow}
          ListEmptyComponent={
            loadingLeaderboard ? null : top3.length === 0 ? (
              <View style={styles.emptyState}>
                <Trophy size={42} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Rankings Yet</Text>
                <Text style={styles.emptyText}>
                  Make predictions and connect to the server to see the global leaderboard.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {activeTab === 'league' && leagues.length === 0 && (
        <View style={styles.emptyState}>
          <Shield size={42} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Leagues Yet</Text>
          <Text style={styles.emptyText}>
            Join or create a league to see rankings here.
          </Text>
        </View>
      )}

      {activeTab === 'league' && leagues.length > 0 && (
        <FlatList
          data={leagueRest}
          keyExtractor={(item) => item.league.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderLeaguePodium}
          renderItem={renderLeagueRow}
          ListEmptyComponent={null}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },

  tabText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700' as const,
  },

  tabTextActive: {
    color: '#FFF',
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    gap: 12,
  },

  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
  },

  podiumContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: 8,
    marginBottom: 28,
    paddingTop: 16,
    minHeight: 330,
  },

  podiumColumn: {
    width: '31.5%',
    alignItems: 'stretch',
  },

  podiumColumnGold: {
    marginTop: 0,
  },

  podiumColumnSilver: {
    marginTop: 22,
  },

  podiumColumnBronze: {
    marginTop: 44,
  },

  podiumProfileCard: {
    width: '100%',
    height: 124,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 5,
    paddingBottom: 8,
    overflow: 'visible',
  },

  avatarSlot: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  podiumAvatarGlow: {
    position: 'absolute',
  },

  podiumAvatar: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  podiumInitials: {
    color: Colors.text,
    fontWeight: '900' as const,
  },

  podiumRankBubble: {
    position: 'absolute',
    right: -5,
    bottom: -3,
    minWidth: 25,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },

  podiumRankBubbleText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900' as const,
  },

  podiumName: {
    color: Colors.text,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900' as const,
    textAlign: 'center',
    width: '100%',
    height: 26,
  },

  podiumPoints: {
    fontSize: 10,
    fontWeight: '900' as const,
    marginTop: 2,
    textAlign: 'center',
  },

  podiumBar: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  podiumRank: {
    fontSize: 17,
    fontWeight: '900' as const,
  },

  rankRow: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 12,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },

  accentStrip: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },

  rankColumn: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  rankBadge: {
    minWidth: 34,
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  rankBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '900' as const,
  },

  rowMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },

  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },

  nameBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },

  displayName: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900' as const,
    letterSpacing: -0.25,
  },

  usernameText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600' as const,
    marginTop: 2,
  },

  leagueMemberLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },

  pointsColumn: {
    width: 66,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 1,
  },

  pointsText: {
    color: Colors.text,
    fontSize: 23,
    fontWeight: '900' as const,
    lineHeight: 25,
    letterSpacing: -0.5,
  },

  pointsLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '900' as const,
    letterSpacing: 1.2,
    marginTop: 1,
  },

  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },

  trendPill: {
    maxWidth: '58%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  trendText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700' as const,
  },

  rankMetaText: {
    flexShrink: 1,
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    textAlign: 'right',
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },

  emptyTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
  },

  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
  },
});
