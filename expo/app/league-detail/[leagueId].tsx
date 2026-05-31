import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Copy,
  Crown,
  Globe,
  Lock,
  Medal,
  Share2,
  Trash2,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import AnimatedPressable from '@/components/AnimatedPressable';
import Colors from '@/constants/colors';
import {
  MIAMI_RACE_ID,
  MOCK_LEAGUE_MEMBERS,
  scoreMockMember,
} from '@/constants/mock-members';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { LeagueMember } from '@/types';

export default function LeagueDetailScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();

  const {
    leagues,
    getLeagueMembers,
    fetchLeagueMembers,
    deleteLeague,
    totalPoints,
  } = useGame();

  const { getRaceResult } = useF1Data();
  const { profile } = useUser();

  const league = leagues.find((l) => l.id === leagueId);
  const rawMembers = leagueId ? getLeagueMembers(leagueId) : [];

  // Inject mock league members (Sainz4Ever55, Whitney) with picks scored
  // against the live Miami GP result.
  const miamiResult = getRaceResult(MIAMI_RACE_ID);
  const mockMembers: LeagueMember[] = MOCK_LEAGUE_MEMBERS.map((mock) =>
    scoreMockMember(mock, miamiResult)
  );

  // Always override current user with live profile data.
  const members: LeagueMember[] = rawMembers.map((m) =>
    m.userId === profile.id
      ? {
          ...m,
          displayName: profile.displayName,
          username: profile.username,
          points: totalPoints,
        }
      : m
  );

  const hasCurrentUser = members.some((m) => m.userId === profile.id);

  const baseMembers: LeagueMember[] = hasCurrentUser
    ? members
    : [
        ...members,
        {
          userId: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          role: 'member' as const,
          points: totalPoints,
          joinedAt: new Date().toISOString(),
        },
      ];

  const existingIds = new Set(baseMembers.map((m) => m.userId));

  const finalMembers: LeagueMember[] = [
    ...baseMembers,
    ...mockMembers.filter((m) => !existingIds.has(m.userId)),
  ];

  const isOwner = league?.ownerId === profile.id;
  const [isFetchingMembers, setIsFetchingMembers] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fetchLeagueMembersRef = useRef(fetchLeagueMembers);

  fetchLeagueMembersRef.current = fetchLeagueMembers;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (!leagueId) return;

    let cancelled = false;
    setIsFetchingMembers(true);

    const doFetch = async () => {
      try {
        await fetchLeagueMembersRef.current(leagueId);
      } catch (e) {
        console.log('LeagueDetail: fetchLeagueMembers error:', e);
      } finally {
        if (!cancelled) setIsFetchingMembers(false);
      }
    };

    void doFetch();

    const timeout = setTimeout(() => {
      if (!cancelled) setIsFetchingMembers(false);
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [leagueId, profile.displayName, profile.username]);

  if (!league) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>League Not Found</Text>
      </View>
    );
  }

  const handleCopyCode = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Join Code', `Share this code with friends:\n\n${league.joinCode}`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my Apex Draft F1 league "${league.name}"! Use code: ${league.joinCode}`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete League',
      `Are you sure you want to delete "${league.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLeague(league.id);
            router.back();
          },
        },
      ]
    );
  };

  const sortedMembers = [...finalMembers].sort((a, b) => b.points - a.points);

  const top3Accents = [Colors.warning, '#A0A0A8', '#CD7F32'] as const;

  const isMockMember = (userId: string) =>
    MOCK_LEAGUE_MEMBERS.some((m) => m.userId === userId);

  const renderMember = ({ item, index }: { item: LeagueMember; index: number }) => {
    const rank = index + 1;
    const isTop3 = index < 3;
    const accentColor: string | undefined = isTop3 ? top3Accents[index] : undefined;
    const isCurrentUser = item.userId === profile.id;
    const isDemo = isMockMember(item.userId);

    return (
      <AnimatedPressable
        style={[
          styles.memberCard,
          isTop3 && styles.memberCardTop,
          { opacity: fadeAnim },
        ]}
        onPress={() => router.push(`/profile/${item.userId}` as any)}
      >
        {accentColor && (
          <>
            <LinearGradient
              colors={[`${accentColor}18`, 'transparent']}
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
              accentColor && {
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}50`,
              },
            ]}
          >
            {isTop3 ? (
              <Medal size={18} color={accentColor} />
            ) : (
              <Text style={styles.rankBadgeText}>#{rank}</Text>
            )}
          </View>
        </View>

        <View style={styles.memberMain}>
          <View style={styles.memberTopRow}>
            <View style={styles.memberInfo}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.displayName, accentColor && { color: accentColor }]}
                  numberOfLines={1}
                >
                  {item.displayName || item.username}
                </Text>

                {item.role === 'owner' && (
                  <Crown size={13} color={Colors.warning} />
                )}

                {isCurrentUser && (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>YOU</Text>
                  </View>
                )}

                {isDemo && (
                  <View style={styles.demoBadge}>
                    <Text style={styles.demoBadgeText}>DEMO</Text>
                  </View>
                )}
              </View>

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
              >
                {item.points.toLocaleString()}
              </Text>
              <Text style={styles.pointsLabel}>PTS</Text>
            </View>
          </View>

          <View style={styles.memberBottomRow}>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                {item.role === 'owner' ? 'League Owner' : 'League Member'}
              </Text>
            </View>

            <Text style={styles.rankMetaText}>Rank #{rank}</Text>
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: league.name }} />

      <FlatList
        data={sortedMembers}
        keyExtractor={(item) => item.userId}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.leagueHero}>
              <LinearGradient
                colors={['#1A1025', '#0F1419']}
                style={styles.heroGradient}
              >
                <View style={styles.leagueIconLg}>
                  {league.visibility === 'public' ? (
                    <Globe size={26} color={Colors.info} />
                  ) : (
                    <Lock size={26} color={Colors.warning} />
                  )}
                </View>

                <Text style={styles.leagueName}>{league.name}</Text>

                {league.description ? (
                  <Text style={styles.leagueDesc}>{league.description}</Text>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <Users size={11} color={Colors.textSecondary} />
                    <Text style={styles.metaText}>{finalMembers.length} members</Text>
                  </View>

                  <View style={styles.metaPill}>
                    {league.visibility === 'public' ? (
                      <Globe size={11} color={Colors.textSecondary} />
                    ) : (
                      <Lock size={11} color={Colors.textSecondary} />
                    )}
                    <Text style={styles.metaText}>
                      {league.visibility === 'public' ? 'Public' : 'Private'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>JOIN CODE</Text>
              <Text style={styles.codeValue}>{league.joinCode}</Text>
            </View>

            <View style={styles.actionRow}>
              <AnimatedPressable style={styles.actionBtn} onPress={handleCopyCode}>
                <Copy size={15} color={Colors.text} />
                <Text style={styles.actionBtnText}>Copy Code</Text>
              </AnimatedPressable>

              <AnimatedPressable style={styles.actionBtn} onPress={handleShare}>
                <Share2 size={15} color={Colors.text} />
                <Text style={styles.actionBtnText}>Share</Text>
              </AnimatedPressable>

              {isOwner && (
                <AnimatedPressable
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={handleDelete}
                >
                  <Trash2 size={15} color={Colors.error} />
                  <Text style={[styles.actionBtnText, styles.deleteBtnText]}>
                    Delete
                  </Text>
                </AnimatedPressable>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Users size={17} color={Colors.text} />
                <Text style={styles.sectionTitle}>Members</Text>
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>{finalMembers.length}</Text>
                </View>
              </View>

              {isFetchingMembers && (
                <ActivityIndicator size="small" color={Colors.f1Red} />
              )}
            </View>
          </View>
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },

  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 4,
  },

  leagueHero: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 16,
    overflow: 'hidden',
  },

  heroGradient: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 12,
  },

  leagueIconLg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  leagueName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },

  leagueDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },

  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  metaText: {
    color: Colors.textSecondary,
    fontSize: 11,
  },

  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },

  codeLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },

  codeValue: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },

  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  actionBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },

  deleteBtn: {
    borderColor: 'rgba(255, 59, 59, 0.2)',
    backgroundColor: 'rgba(255, 59, 59, 0.06)',
  },

  deleteBtnText: {
    color: Colors.error,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },

  sectionCount: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },

  sectionCountText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  memberCard: {
    minHeight: 98,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  memberCardTop: {
    borderColor: 'rgba(255,214,10,0.16)',
    backgroundColor: '#12161D',
  },

  accentStrip: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },

  rankColumn: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  rankBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },

  rankBadgeText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '900',
  },

  memberMain: {
    flex: 1,
    justifyContent: 'space-between',
    minWidth: 0,
  },

  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  memberInfo: {
    flex: 1,
    minWidth: 0,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },

  displayName: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    flexShrink: 1,
  },

  usernameText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 4,
  },

  pointsColumn: {
    minWidth: 86,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },

  pointsText: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.7,
  },

  pointsLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 2,
  },

  memberBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },

  rolePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  rolePillText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  rankMetaText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  youBadge: {
    backgroundColor: Colors.f1Red,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  youBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },

  demoBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  demoBadgeText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },
});