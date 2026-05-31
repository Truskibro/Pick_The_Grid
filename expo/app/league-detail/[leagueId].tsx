import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Share, ActivityIndicator, Animated } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Globe, Lock, Users, Copy, Share2, Trash2, Medal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useGame } from '@/providers/GameProvider';
import { useF1Data } from '@/providers/F1DataProvider';
import { useUser } from '@/providers/UserProvider';
import AnimatedPressable from '@/components/AnimatedPressable';
import { LeagueMember } from '@/types';
import { MOCK_LEAGUE_MEMBERS, MIAMI_RACE_ID, scoreMockMember } from '@/constants/mock-members';

export default function LeagueDetailScreen() {
  const { leagueId } = useLocalSearchParams<{ leagueId: string }>();
  const router = useRouter();
  const { leagues, getLeagueMembers, fetchLeagueMembers, deleteLeague, totalPoints } = useGame();
  const { getRaceResult } = useF1Data();
  const { profile } = useUser();

  const league = leagues.find(l => l.id === leagueId);
  const rawMembers = leagueId ? getLeagueMembers(leagueId) : [];

  // Inject mock league members (Sainz4Ever55, Whitney) with picks scored
  // against the live Miami GP result.
  const miamiResult = getRaceResult(MIAMI_RACE_ID);
  const mockMembers: LeagueMember[] = MOCK_LEAGUE_MEMBERS.map(m => scoreMockMember(m, miamiResult));

  // Always override current user with live profile data
  const members: LeagueMember[] = rawMembers.map(m =>
    m.userId === profile.id
      ? { ...m, displayName: profile.displayName, username: profile.username, points: totalPoints }
      : m
  );

  // Ensure current user is always in the list
  const hasCurrentUser = members.some(m => m.userId === profile.id);
  const baseMembers = hasCurrentUser
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

  // Merge in mock members (skip any already-present user id, e.g. on re-render)
  const existingIds = new Set(baseMembers.map(m => m.userId));
  const finalMembers: LeagueMember[] = [
    ...baseMembers,
    ...mockMembers.filter(m => !existingIds.has(m.userId)),
  ];

  const isOwner = league?.ownerId === profile.id;
  const [isFetchingMembers, setIsFetchingMembers] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fetchLeagueMembersRef = useRef(fetchLeagueMembers);
  fetchLeagueMembersRef.current = fetchLeagueMembers;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    setIsFetchingMembers(true);

    console.log('LeagueDetail: fetching for', leagueId);

    const doFetch = async () => {
      try {
        const result = await fetchLeagueMembersRef.current(leagueId);
        console.log('LeagueDetail: fetch returned', result?.length, 'members');
      } catch (e) {
        console.log('LeagueDetail: fetchLeagueMembers error:', e);
      } finally {
        if (!cancelled) setIsFetchingMembers(false);
      }
    };

    void doFetch();

    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.log('LeagueDetail: fetch timed out');
        setIsFetchingMembers(false);
      }
    }, 10000);

    return () => { cancelled = true; clearTimeout(timeout); };
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

  const getMedalColor = (rank: number): string => {
    if (rank === 0) return Colors.warning;
    if (rank === 1) return '#A0A0A8';
    if (rank === 2) return '#CD7F32';
    return Colors.textMuted;
  };

  const isMockMember = (userId: string) =>
    MOCK_LEAGUE_MEMBERS.some(m => m.userId === userId);

  const top3Accents = [Colors.warning, '#A0A0A8', '#CD7F32'] as const;

  const renderMember = ({ item, index }: { item: LeagueMember; index: number }) => {
    const initials = (item.displayName || item.username)
      .trim()
      .split(/\s+/)
      .map(s => s.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
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
        {/* Subtle gradient background for top 3 */}
        {isTop3 && (
          <LinearGradient
            colors={[`${accentColor}10`, 'transparent']}
            style={StyleSheet.absoluteFill as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            pointerEvents="none"
          />
        )}

        {/* Left accent strip */}
        {accentColor && (
          <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
        )}

        {/* Rank badge */}
        <View style={[
          styles.rankBadge,
          accentColor && { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` },
        ]}>
          {isTop3 ? (
            <Medal size={12} color={accentColor} />
          ) : (
            <Text style={styles.rankBadgeText}>{index + 1}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={[
          styles.avatar,
          isCurrentUser && styles.avatarCurrent,
          accentColor && { borderColor: `${accentColor}30` },
          isTop3 && index === 0 && styles.avatarGold,
        ]}>
          <Text style={[
            styles.avatarText,
            isCurrentUser && styles.avatarTextCurrent,
            isTop3 && index === 0 && { color: Colors.warning },
          ]}>
            {initials}
          </Text>
        </View>

        {/* Name + badges row */}
        <View style={styles.nameCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.displayName, accentColor && { color: accentColor }]} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            {item.role === 'owner' && <Crown size={10} color={Colors.warning} style={{ marginLeft: 4 }} />}
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
          <Text style={styles.usernameText} numberOfLines={1}>@{item.username}</Text>
        </View>

        {/* Points pill */}
        <View style={[
          styles.pointsPill,
          accentColor && { backgroundColor: `${accentColor}12` },
        ]}>
          <Text style={[
            styles.pointsPillText,
            accentColor && { color: accentColor },
          ]}>{item.points.toLocaleString()}</Text>
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ title: league.name }} />
      <FlatList
        data={sortedMembers}
        keyExtractor={item => item.userId}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* League Hero */}
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
                      <Globe size={11} color={Colors.info} />
                    ) : (
                      <Lock size={11} color={Colors.warning} />
                    )}
                    <Text style={styles.metaText}>
                      {league.visibility === 'public' ? 'Public' : 'Private'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Join Code Card */}
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>JOIN CODE</Text>
              <Text style={styles.codeValue}>{league.joinCode}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <AnimatedPressable style={styles.actionBtn} onPress={handleCopyCode}>
                <Copy size={15} color={Colors.info} />
                <Text style={styles.actionBtnText}>Copy Code</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.actionBtn} onPress={handleShare}>
                <Share2 size={15} color={Colors.success} />
                <Text style={styles.actionBtnText}>Share</Text>
              </AnimatedPressable>
              {isOwner && (
                <AnimatedPressable style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
                  <Trash2 size={15} color={Colors.error} />
                  <Text style={[styles.actionBtnText, styles.deleteBtnText]}>Delete</Text>
                </AnimatedPressable>
              )}
            </View>

            {/* Members Header */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Medal size={15} color={Colors.warning} />
                <Text style={styles.sectionTitle}>Members</Text>
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>{finalMembers.length}</Text>
                </View>
              </View>
              {isFetchingMembers && (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
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
    fontWeight: '600' as const,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 4,
  },

  /* ── League Hero ── */
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
    fontWeight: '700' as const,
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

  /* ── Code Card ── */
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
    fontWeight: '700' as const,
    letterSpacing: 2,
    marginBottom: 6,
  },
  codeValue: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: 6,
  },

  /* ── Action Row ── */
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
    fontWeight: '600' as const,
  },
  deleteBtn: {
    borderColor: 'rgba(255, 59, 59, 0.2)',
    backgroundColor: 'rgba(255, 59, 59, 0.06)',
  },
  deleteBtnText: {
    color: Colors.error,
  },

  /* ── Section Header ── */
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
    fontWeight: '700' as const,
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
    fontWeight: '700' as const,
  },

  /* ── Member Card ── */
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 0,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  memberCardTop: {
    borderColor: 'rgba(255,214,10,0.10)',
    backgroundColor: '#12161D',
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
    marginLeft: 12,
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
  avatarCurrent: {
    backgroundColor: 'rgba(225,6,0,0.12)',
    borderColor: Colors.f1Red,
  },
  avatarText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  avatarTextCurrent: {
    color: Colors.f1Red,
  },
  avatarGold: {
    backgroundColor: 'rgba(255,214,10,0.1)',
  },
  nameCol: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  displayName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  usernameText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '400' as const,
    marginTop: 1,
  },
  youBadge: {
    backgroundColor: Colors.f1Red,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  youBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800' as const,
  },
  demoBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  demoBadgeText: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '700' as const,
  },
  pointsPill: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 48,
    alignItems: 'center',
    marginLeft: 8,
  },
  pointsPillText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
