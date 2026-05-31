import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Animated, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, TrendingUp, TrendingDown, Minus, Users, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useGame } from '@/providers/GameProvider';
import AnimatedPressable from '@/components/AnimatedPressable';
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
  const { leagues, getLeagueMembers, fetchGlobalLeaderboard } = useGame();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(true);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await fetchGlobalLeaderboard();
      setGlobalLeaderboard(data);
    } catch (e) {
      console.log('Leaderboard load error:', e);
    }
    setLoadingLeaderboard(false);
  }, [fetchGlobalLeaderboard]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const leagueRankings: LeagueRanking[] = useMemo(() => {
    return leagues
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
  }, [leagues, getLeagueMembers]);

  const top3 = globalLeaderboard.slice(0, 3);
  const rest = globalLeaderboard.slice(3);

  const leagueTop3 = leagueRankings.slice(0, 3);
  const leagueRest = leagueRankings.slice(3);

  const renderTrendIcon = (entry: LeaderboardEntry) => {
    if (!entry.previousRank) return <Minus size={12} color={Colors.textMuted} />;
    if (entry.previousRank > entry.rank) return <TrendingUp size={12} color={Colors.success} />;
    if (entry.previousRank < entry.rank) return <TrendingDown size={12} color={Colors.error} />;
    return <Minus size={12} color={Colors.textMuted} />;
  };

  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const podiumSizes = [72, 60, 56];
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumColorOrder = top3.length >= 3 ? [podiumColors[1], podiumColors[0], podiumColors[2]] : podiumColors;
  const podiumSizeOrder = top3.length >= 3 ? [podiumSizes[1], podiumSizes[0], podiumSizes[2]] : podiumSizes;
  const podiumHeights = top3.length >= 3 ? [80, 100, 64] : [100, 80, 64];

  const leaguePodiumOrder = leagueTop3.length >= 3 ? [leagueTop3[1], leagueTop3[0], leagueTop3[2]] : leagueTop3;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.tabRow}>
        <AnimatedPressable
          style={[styles.tab, activeTab === 'global' && styles.tabActive]}
          onPress={() => setActiveTab('global')}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>Global</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.tab, activeTab === 'league' && styles.tabActive]}
          onPress={() => setActiveTab('league')}
        >
          <Text style={[styles.tabText, activeTab === 'league' && styles.tabTextActive]}>League</Text>
        </AnimatedPressable>
      </View>

      {activeTab === 'global' && (
        <FlatList
          data={rest}
          keyExtractor={item => item.userId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loadingLeaderboard}
          onRefresh={loadLeaderboard}
          ListHeaderComponent={
            loadingLeaderboard ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.f1Red} />
                <Text style={styles.loadingText}>Loading leaderboard...</Text>
              </View>
            ) : top3.length > 0 ? (
              <View style={styles.podiumContainer}>
                {podiumOrder.map((entry, i) => {
                  if (!entry) return null;
                  const initials = (entry.displayName || '??').split(' ').map(w => w[0]).join('').substring(0, 2);
                  return (
                    <AnimatedPressable key={entry.userId} style={styles.podiumItem} onPress={() => router.push(`/profile/${entry.userId}` as any)}>
                      <View style={[styles.podiumAvatar, { width: podiumSizeOrder[i], height: podiumSizeOrder[i], borderColor: podiumColorOrder[i] }]}>
                        <Text style={[styles.podiumInitials, { fontSize: podiumSizeOrder[i] * 0.3 }]}>{initials}</Text>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{entry.displayName}</Text>
                      <Text style={[styles.podiumPoints, { color: podiumColorOrder[i] }]}>{entry.totalPoints} pts</Text>
                      <View style={[styles.podiumBar, { height: podiumHeights[i], backgroundColor: `${podiumColorOrder[i]}30` }]}>
                        <Text style={[styles.podiumRank, { color: podiumColorOrder[i] }]}>#{entry.rank}</Text>
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const accentColor = index < 3
              ? [Colors.warning, '#A0A0A8', '#CD7F32'][index]
              : undefined;
            const initials = (item.displayName || '??').split(' ').map(w => w[0]).join('').substring(0, 2);
            return (
              <AnimatedPressable
                style={styles.rankRow}
                onPress={() => router.push(`/profile/${item.userId}` as any)}
              >
                {/* Left accent strip */}
                {accentColor && (
                  <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
                )}

                {/* Rank badge */}
                <View style={[
                  styles.rankBadge,
                  accentColor && { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` },
                ]}>
                  <Text style={[
                    styles.rankBadgeText,
                    accentColor && { color: accentColor },
                  ]}>{item.rank}</Text>
                </View>

                {/* Avatar */}
                <View style={[
                  styles.avatar,
                  accentColor && { borderColor: `${accentColor}30` },
                ]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                {/* Name + username */}
                <View style={styles.nameCol}>
                  <Text style={styles.displayName} numberOfLines={1}>{item.displayName}</Text>
                  <Text style={styles.usernameText} numberOfLines={1}>@{item.username}</Text>
                </View>

                {/* Trend */}
                <View style={styles.trendCol}>
                  {renderTrendIcon(item)}
                </View>

                {/* Points pill */}
                <View style={[
                  styles.pointsPill,
                  accentColor && { backgroundColor: `${accentColor}12` },
                ]}>
                  <Text style={[
                    styles.pointsPillText,
                    accentColor && { color: accentColor },
                  ]}>{item.totalPoints.toLocaleString()}</Text>
                </View>
              </AnimatedPressable>
            );
          }}
          ListEmptyComponent={
            loadingLeaderboard ? null : top3.length === 0 ? (
              <View style={styles.emptyState}>
                <Trophy size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Rankings Yet</Text>
                <Text style={styles.emptyText}>Make predictions and connect to the server to see the global leaderboard.</Text>
              </View>
            ) : null
          }
        />
      )}

      {activeTab === 'league' && leagues.length === 0 && (
        <View style={styles.emptyState}>
          <Shield size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Leagues Yet</Text>
          <Text style={styles.emptyText}>Join or create a league to see rankings here</Text>
        </View>
      )}

      {activeTab === 'league' && leagues.length > 0 && (
        <FlatList
          data={leagueRest}
          keyExtractor={item => item.league.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            leagueTop3.length > 0 ? (
              <View style={styles.podiumContainer}>
                {leaguePodiumOrder.map((entry, i) => {
                  if (!entry) return null;
                  const initials = entry.league.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                  return (
                    <View key={entry.league.id} style={styles.podiumItem}>
                      <View style={[styles.podiumAvatar, { width: podiumSizeOrder[i], height: podiumSizeOrder[i], borderColor: podiumColorOrder[i] }]}>
                        <Text style={[styles.podiumInitials, { fontSize: podiumSizeOrder[i] * 0.3 }]}>{initials}</Text>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{entry.league.name}</Text>
                      <Text style={[styles.podiumPoints, { color: podiumColorOrder[i] }]}>{entry.combinedPoints} pts</Text>
                      <View style={styles.leagueMemberBadge}>
                        <Users size={10} color={Colors.textSecondary} />
                        <Text style={styles.leagueMemberCount}>{entry.memberCount}</Text>
                      </View>
                      <View style={[styles.podiumBar, { height: podiumHeights[i], backgroundColor: `${podiumColorOrder[i]}30` }]}>
                        <Text style={[styles.podiumRank, { color: podiumColorOrder[i] }]}>#{entry.rank}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const accentColor = index < 3
              ? [Colors.warning, '#A0A0A8', '#CD7F32'][index]
              : undefined;
            return (
              <AnimatedPressable
                style={styles.rankRow}
                onPress={() => router.push(`/league-detail/${item.league.id}` as any)}
              >
                {accentColor && (
                  <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
                )}
                <View style={[
                  styles.rankBadge,
                  accentColor && { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` },
                ]}>
                  <Text style={[
                    styles.rankBadgeText,
                    accentColor && { color: accentColor },
                  ]}>{item.rank}</Text>
                </View>
                <View style={[styles.leagueAvatar, accentColor && { borderColor: `${accentColor}30` }]}>
                  <Shield size={14} color={accentColor ?? Colors.f1Red} />
                </View>
                <View style={styles.nameCol}>
                  <Text style={styles.displayName} numberOfLines={1}>{item.league.name}</Text>
                  <Text style={styles.usernameText} numberOfLines={1}>{item.memberCount} members</Text>
                </View>
                <View style={[
                  styles.pointsPill,
                  accentColor && { backgroundColor: `${accentColor}12` },
                ]}>
                  <Text style={[
                    styles.pointsPillText,
                    accentColor && { color: accentColor },
                  ]}>{item.combinedPoints.toLocaleString()}</Text>
                </View>
              </AnimatedPressable>
            );
          }}
          ListEmptyComponent={null}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.f1Red,
    borderColor: Colors.f1Red,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  tabTextActive: {
    color: '#FFF',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },

  /* ── Podium ── */
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 28,
    paddingTop: 16,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  podiumAvatar: {
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumInitials: {
    color: Colors.text,
    fontWeight: '700' as const,
  },
  podiumName: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  podiumPoints: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  podiumBar: {
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: {
    fontSize: 18,
    fontWeight: '800' as const,
  },

  /* ── Rank Row ── */
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  accentStrip: {
    width: 3,
    height: '100%',
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rankBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800' as const,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  avatarText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  nameCol: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  displayName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  usernameText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '400' as const,
    marginTop: 1,
  },
  trendCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 4,
  },
  pointsPill: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 48,
    alignItems: 'center',
    marginLeft: 'auto' as const,
  },
  pointsPillText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },

  /* ── League tab extras ── */
  leagueAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(225, 6, 0, 0.08)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  leagueMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  leagueMemberCount: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '600' as const,
  },

  /* ── Empty ── */
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
