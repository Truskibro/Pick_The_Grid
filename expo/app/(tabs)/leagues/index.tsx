import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus,
  UserPlus,
  Search,
  Globe,
  Lock,
  Users,
  Crown,
  ChevronRight,
  Shield,
  Trophy,
  Swords,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSeries } from '@/providers/SeriesProvider';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import AnimatedPressable from '@/components/AnimatedPressable';
import ChamferOverlay from '@/components/ChamferOverlay';
import { League } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LeaguesScreen() {
  const router = useRouter();
  const { config, currentSeries } = useSeries();
  const seriesColors = config.colors;
  const isMotoGP = currentSeries === 'motogp';
  const { leagues: allLeagues, getLeagueMembers, refreshLeagues, fetchPublicLeagues, joinLeague } = useGame();
  const { profile, isGuest } = useUser();

  // Filter leagues by the current series. Existing leagues without a
  // series_id default to 'f1' so they remain visible in F1 mode.
  const leagues = useMemo(() =>
    allLeagues.filter((l) => (l.seriesId ?? 'f1') === currentSeries),
    [allLeagues, currentSeries],
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showDiscover, setShowDiscover] = useState<boolean>(false);
  const [publicLeagues, setPublicLeagues] = useState<League[]>([]);
  const [loadingPublic, setLoadingPublic] = useState<boolean>(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLeagues();
    if (showDiscover) {
      const pub = await fetchPublicLeagues();
      setPublicLeagues(pub);
    }
    setRefreshing(false);
  }, [refreshLeagues, fetchPublicLeagues, showDiscover]);

  const handleDiscover = useCallback(async () => {
    if (isGuest) {
      Alert.alert('Account Required', 'Log in to discover public leagues.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    if (showDiscover) {
      setShowDiscover(false);
      return;
    }
    setShowDiscover(true);
    setLoadingPublic(true);
    const pub = await fetchPublicLeagues();
    setPublicLeagues(pub);
    setLoadingPublic(false);
  }, [isGuest, showDiscover, fetchPublicLeagues, router]);

  const handleQuickJoin = useCallback(async (league: League) => {
    if (isGuest) {
      Alert.alert('Account Required', 'Log in to join leagues.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    setJoiningId(league.id);
    const success = await joinLeague(league.id, profile.id, profile.username, profile.displayName);
    setJoiningId(null);
    if (success) {
      Alert.alert('Joined!', `You've joined "${league.name}".`);
      await refreshLeagues();
      const pub = await fetchPublicLeagues();
      setPublicLeagues(pub);
    } else {
      Alert.alert('Already Joined', "You're already a member of this league.");
    }
  }, [isGuest, joinLeague, profile, refreshLeagues, fetchPublicLeagues, router]);

  const myLeagueIds = new Set(leagues.map(l => l.id));
  const discoverableLeagues = publicLeagues.filter(l => !myLeagueIds.has(l.id));

  const getOwnerDisplayName = (league: League): string => {
    if (league.ownerId === profile.id) return profile.displayName;
    const members = getLeagueMembers(league.id);
    const owner = members.find(m => m.role === 'owner');
    return owner?.displayName || 'Unknown';
  };

  const renderLeague = ({ item, index }: { item: League; index: number }) => {
    const isOwner = item.ownerId === profile.id;
    const isPublic = item.visibility === 'public';
    const ownerName = getOwnerDisplayName(item);
    const cardDelay = index * 80;

    return (
      <AnimatedPressable
        style={[
          styles.leagueCard,
          isMotoGP && { borderRadius: 0, borderWidth: 0 },
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20 + cardDelay * 0.2, 0],
                }),
              },
            ],
          },
        ]}
        onPress={() => router.push(`/league-detail/${item.id}` as any)}
      >
        <View style={[styles.cardAccent, isPublic ? styles.accentPublic : styles.accentPrivate, isMotoGP && { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardNameBlock}>
              <View style={[styles.cardInitialsCircle, isMotoGP && { borderRadius: 2 }]}>
                <Text style={styles.cardInitials}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardNameInfo}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  {isOwner && <Crown size={13} color={isMotoGP ? seriesColors.highlight : Colors.warning} />}
                </View>
                <Text style={styles.cardOwner}>by {ownerName}</Text>
              </View>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </View>
          <View style={styles.cardMetaRow}>
            <View style={[styles.visPill, isPublic ? styles.visPillPublic : styles.visPillPrivate, isMotoGP && { borderRadius: 2 }]}>
              {isPublic ? (
                <Globe size={10} color={Colors.info} />
              ) : (
                <Lock size={10} color={Colors.warning} />
              )}
              <Text style={[styles.visPillText, !isPublic && { color: Colors.warning }]}>
                {isPublic ? 'PUBLIC' : 'PRIVATE'}
              </Text>
            </View>
            <View style={[styles.memberPill, isMotoGP && { borderRadius: 2 }]}>
              <Users size={10} color={Colors.textSecondary} />
              <Text style={styles.memberPillText}>{item.memberCount}</Text>
            </View>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
            ) : null}
          </View>
        </View>
        {isMotoGP && (
          <ChamferOverlay chamferSize={12} borderColor={seriesColors.border} borderWidth={1} surroundingColor={seriesColors.background} />
        )}
      </AnimatedPressable>
    );
  };

  const renderDiscoverLeague = (item: League, index: number) => {
    const isJoining = joiningId === item.id;
    const isPublic = item.visibility === 'public';
    return (
      <View key={item.id} style={styles.discoverCard}>
        <View style={[styles.discoverAccent, isPublic ? styles.accentPublic : styles.accentPrivate]} />
        <View style={styles.discoverContent}>
          <View style={styles.discoverTopRow}>
            <View style={styles.discoverNameBlock}>
              <Text style={styles.discoverName} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.discoverDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
            </View>
            <AnimatedPressable
              style={[styles.joinBtn, { backgroundColor: seriesColors.primary }, isJoining && styles.joinBtnLoading]}
              onPress={() => handleQuickJoin(item)}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.joinBtnText}>Join</Text>
              )}
            </AnimatedPressable>
          </View>
          <View style={styles.discoverMeta}>
            <View style={[styles.visPill, isPublic ? styles.visPillPublic : styles.visPillPrivate]}>
              {isPublic ? (
                <Globe size={9} color={Colors.info} />
              ) : (
                <Lock size={9} color={Colors.warning} />
              )}
              <Text style={[styles.visPillText, { fontSize: 9 }, !isPublic && { color: Colors.warning }]}>
                {isPublic ? 'PUBLIC' : 'PRIVATE'}
              </Text>
            </View>
            <View style={styles.memberPill}>
              <Users size={9} color={Colors.textSecondary} />
              <Text style={[styles.memberPillText, { fontSize: 10 }]}>{item.memberCount} members</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const leagueCount = leagues.length;

  return (
    <View style={styles.container}>
      <FlatList
        data={leagues}
        keyExtractor={item => item.id}
        renderItem={renderLeague}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.f1Red}
            colors={[Colors.f1Red]}
            progressViewOffset={10}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Hero Banner */}
            <Animated.View
              style={[
                styles.heroBanner,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <LinearGradient
                colors={['#1A1025', '#0F1419', Colors.background]}
                locations={[0, 0.6, 1]}
                style={styles.heroGradient}
              >
                <View style={styles.heroContent}>
                  <View style={styles.heroTitleRow}>
                    <Swords size={22} color={Colors.f1Red} />
                    <Text style={styles.heroTitle}>Leagues</Text>
                  </View>
                  <Text style={styles.heroSubtitle}>
                    Compete with friends. Prove you're the best.
                  </Text>
                  {leagueCount > 0 && (
                    <View style={styles.heroStats}>
                      <View style={styles.heroStat}>
                        <Trophy size={14} color={Colors.warning} />
                        <Text style={styles.heroStatValue}>{leagueCount}</Text>
                        <Text style={styles.heroStatLabel}>Active</Text>
                      </View>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <AnimatedPressable
                style={styles.actionBtn}
                onPress={() => router.push('/create-league' as any)}
              >
                <LinearGradient
                  colors={['rgba(225,6,0,0.12)', 'rgba(225,6,0,0.04)']}
                  style={styles.actionBtnInner}
                >
                  <View style={styles.actionIconCircle}>
                    <Plus size={16} color={Colors.f1Red} />
                  </View>
                  <Text style={styles.actionBtnText}>Create</Text>
                </LinearGradient>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.actionBtn}
                onPress={() => router.push('/join-league' as any)}
              >
                <View style={styles.actionBtnInner}>
                  <View style={[styles.actionIconCircle, styles.actionIconCircleAlt]}>
                    <UserPlus size={16} color={Colors.info} />
                  </View>
                  <Text style={styles.actionBtnText}>Join</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.actionBtn, showDiscover && styles.actionBtnActive]}
                onPress={handleDiscover}
              >
                <View style={[styles.actionBtnInner, showDiscover && styles.actionBtnInnerActive]}>
                  <View style={[styles.actionIconCircle, showDiscover && styles.actionIconCircleActive]}>
                    <Search size={16} color={showDiscover ? '#FFF' : Colors.success} />
                  </View>
                  <Text style={[styles.actionBtnText, showDiscover && styles.actionBtnTextActive]}>
                    Browse
                  </Text>
                </View>
              </AnimatedPressable>
            </View>

            {/* Discover Section */}
            {showDiscover && (
              <View style={styles.discoverSection}>
                <View style={styles.sectionLabel}>
                  <Globe size={14} color={Colors.info} />
                  <Text style={styles.sectionLabelText}>Discover Public Leagues</Text>
                </View>
                {loadingPublic ? (
                  <ActivityIndicator color={Colors.f1Red} style={{ marginVertical: 24 }} />
                ) : discoverableLeagues.length === 0 ? (
                  <View style={styles.discoverEmpty}>
                    <Text style={styles.discoverEmptyText}>No new public leagues to join.</Text>
                  </View>
                ) : (
                  discoverableLeagues.map((item, i) => renderDiscoverLeague(item, i))
                )}
              </View>
            )}

            {/* Section Header */}
            {leagues.length > 0 && (
              <View style={styles.sectionLabel}>
                <Trophy size={14} color={Colors.warning} />
                <Text style={styles.sectionLabelText}>My Leagues</Text>
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>{leagueCount}</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !showDiscover ? (
            <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
              <View style={styles.emptyIconShell}>
                <Shield size={36} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Leagues Yet</Text>
              <Text style={styles.emptyText}>
                Create a league to compete with friends,{'\n'}
                join with a code, or browse public leagues.
              </Text>
              <AnimatedPressable
                style={styles.emptyCreateBtn}
                onPress={() => router.push('/create-league' as any)}
              >
                <LinearGradient
                  colors={[Colors.f1Red, Colors.f1RedDark]}
                  style={styles.emptyCreateGradient}
                >
                  <Plus size={16} color="#FFF" />
                  <Text style={styles.emptyCreateText}>Create Your First League</Text>
                </LinearGradient>
              </AnimatedPressable>
            </Animated.View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  /* ── Hero Banner ── */
  heroBanner: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  heroContent: {
    gap: 10,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: 4,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,214,10,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroStatValue: {
    color: Colors.warning,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  heroStatLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
  },

  /* ── Action Buttons ── */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    backgroundColor: Colors.surface,
    borderRadius: 14,
  },
  actionBtnActive: {
    borderColor: Colors.f1Red,
  },
  actionBtnInnerActive: {
    backgroundColor: Colors.f1Red,
  },
  actionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(225,6,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCircleAlt: {
    backgroundColor: 'rgba(10,132,255,0.12)',
  },
  actionIconCircleActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  actionBtnTextActive: {
    color: '#FFF',
  },

  /* ── Section Label ── */
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionLabelText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  sectionCount: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
  },

  /* ── League Card ── */
  leagueCard: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  accentPublic: {
    backgroundColor: Colors.info,
  },
  accentPrivate: {
    backgroundColor: Colors.warning,
  },
  cardContent: {
    padding: 16,
    paddingLeft: 19,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  cardInitialsCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInitials: {
    color: Colors.f1Red,
    fontSize: 17,
    fontWeight: '800' as const,
  },
  cardNameInfo: {
    flex: 1,
    gap: 2,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    flex: 1,
  },
  cardOwner: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  visPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  visPillPublic: {
    backgroundColor: 'rgba(10,132,255,0.1)',
  },
  visPillPrivate: {
    backgroundColor: 'rgba(255,214,10,0.1)',
  },
  visPillText: {
    color: Colors.info,
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  memberPillText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  cardDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    flex: 1,
  },

  /* ── Discover Cards ── */
  discoverSection: {
    marginBottom: 22,
  },
  discoverCard: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  discoverAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  discoverContent: {
    padding: 14,
    paddingLeft: 16,
    gap: 8,
  },
  discoverTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  discoverNameBlock: {
    flex: 1,
    gap: 2,
  },
  discoverName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  discoverDesc: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  discoverMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  joinBtn: {
    backgroundColor: Colors.f1Red,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 56,
    alignItems: 'center',
  },
  joinBtnLoading: {
    opacity: 0.6,
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  discoverEmpty: {
    paddingVertical: 20,
  },
  discoverEmptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },

  /* ── Empty State ── */
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 14,
  },
  emptyIconShell: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
    lineHeight: 21,
    maxWidth: 280,
  },
  emptyCreateBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  emptyCreateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyCreateText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
