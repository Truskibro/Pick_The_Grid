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
          accentColor && { borderLeftColor: accentColor },
          { opacity: fadeAnim },
        ]}
        onPress={() => router.push(`/profile/${item.userId}` as any)}
      >
        <View style={styles.rankColumn}>
          <View
            style={[
              styles.rankBadge,
              accentColor && {
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}55`,
              },
            ]}
          >
            <Text
              style={[
                styles.rankBadgeText,
                accentColor && { color: accentColor },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              #{rank}
            </Text>
          </View>
        </View>

        <View style={styles.middleColumn}>
          <View style={styles.nameLine}>
            <Text
              style={[styles.displayName, accentColor && { color: accentColor }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {item.displayName || item.username}
            </Text>

            {item.role === 'owner' && (
              <Crown size={11} color={Colors.warning} style={styles.crownIcon} />
            )}
          </View>

          <Text style={styles.usernameText} numberOfLines={1}>
            @{item.username}
          </Text>

          <View style={styles.badgeRow}>
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

            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                {item.role === 'owner' ? 'Owner' : 'Member'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pointsColumn}>
          <Text
            style={[styles.pointsText, accentColor && { color: accentColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {item.points.toLocaleString()}
          </Text>
          <Text style={styles.pointsLabel}>PTS</Text>
          <Text style={styles.rankMetaText} numberOfLines={1}>
            #{rank}
          </Text>
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
    marginBottom: 12,
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
    marginTop: 8,
  },

  metaRow: {
    flexDirection: 'row',
    marginTop: 12,
  },

  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginHorizontal: 4,
  },

  metaText: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginLeft: 4,
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
    marginBottom: 22,
  },

  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 4,
  },

  actionBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
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
  },

  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 7,
  },

  sectionCount: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 7,
  },

  sectionCountText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  memberCard: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderColor: Colors.border,
    borderLeftColor: Colors.border,
  },

  memberCardTop: {
    borderColor: 'rgba(255,214,10,0.16)',
    backgroundColor: '#12161D',
  },

  rankColumn: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },

  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rankBadgeText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '900',
  },

  middleColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 8,
  },

  nameLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
  },

  displayName: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: -0.2,
    flex: 1,
    minWidth: 0,
  },

  crownIcon: {
    marginLeft: 4,
    marginTop: 3,
    flexShrink: 0,
  },

  usernameText: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    marginTop: 2,
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },

  pointsColumn: {
    width: 56,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 1,
    flexShrink: 0,
  },

  pointsText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
    letterSpacing: -0.45,
    textAlign: 'right',
  },

  pointsLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 1,
  },

  rankMetaText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 18,
  },

  rolePill: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 3,
  },

  rolePillText: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
  },

  youBadge: {
    backgroundColor: Colors.f1Red,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 3,
  },

  youBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },

  demoBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 4,
    marginBottom: 3,
  },

  demoBadgeText: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
  },
});