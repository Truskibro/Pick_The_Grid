import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Target, Users, UserPlus, Settings, Trophy, Flag, Zap, LogIn, Clock, MapPin, ChevronRight, Swords, Gauge, Circle } from 'lucide-react-native';

import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import { useSeries } from '@/providers/SeriesProvider';
import { useSeriesData } from '@/lib/useSeriesData';
import { useUser } from '@/providers/UserProvider';
import { useGame } from '@/providers/GameProvider';
import CountdownTimer from '@/components/CountdownTimer';
import AnimatedPressable from '@/components/AnimatedPressable';
import ChamferOverlay from '@/components/ChamferOverlay';
import { Race } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { config, currentSeries } = useSeries();
  const seriesColors = config.colors;
  const seriesLabels = config.labels;
  const { isGuest, profile } = useUser();
  const { leagues, totalPoints, predictions } = useGame();
  const { nextRace, races, drivers } = useSeriesData();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(48)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const upcomingRaces = useMemo(() => {
    return races.filter(r => r.status === 'upcoming').slice(0, 3);
  }, [races]);

  const predictionsMade = predictions.filter(p => p.top10.length > 0).length;
  const displayName = profile.displayName || 'Player';
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'P';

  const isMotoGP = currentSeries === 'motogp';

  return (
    <View style={[styles.container, { backgroundColor: seriesColors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <AnimatedPressable
              onPress={() => router.push('/settings' as any)}
              style={styles.headerSettingsBtn}
              scaleDown={0.85}
            >
              <Settings size={20} color={Colors.textSecondary} />
            </AnimatedPressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* ── HERO SECTION ── */}
          <LinearGradient
            colors={seriesColors.heroGradient as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={styles.hero}
          >
            {/* Circuit / speed accent lines */}
            <View style={styles.circuitLines}>
              {isMotoGP ? (
                <>
                  <View style={[styles.speedLine, { top: 16, left: -30, width: 200, transform: [{ rotate: '-38deg' }], backgroundColor: seriesColors.primary }]} />
                  <View style={[styles.speedLine, { top: 56, right: -50, width: 160, transform: [{ rotate: '-38deg' }], backgroundColor: seriesColors.primary }]} />
                  <View style={[styles.leanLine, { top: 84, left: -10, width: 130, transform: [{ rotate: '52deg' }] }]} />
                  <View style={[styles.circuitDot, { top: 14, left: 165, backgroundColor: seriesColors.primary }]} />
                </>
              ) : (
                <>
                  <View style={[styles.circuitLine, { top: 20, left: -20, width: 180, transform: [{ rotate: '-28deg' }] }]} />
                  <View style={[styles.circuitLine, { top: 60, right: -40, width: 140, transform: [{ rotate: '22deg' }] }]} />
                  <View style={[styles.circuitDot, { top: 18, left: 155 }]} />
                  <View style={[styles.circuitDot, { top: 62, right: 95 }]} />
                </>
              )}
            </View>

            {/* Header row */}
            <View style={styles.heroHeader}>
              {isGuest ? (
                <AnimatedPressable
                  style={[styles.signInPill, { backgroundColor: seriesColors.primary }]}
                  onPress={() => router.push('/auth' as any)}
                >
                  <LogIn size={13} color="#FFF" />
                  <Text style={styles.signInPillText}>Sign In</Text>
                </AnimatedPressable>
              ) : (
                <AnimatedPressable
                  style={styles.userPill}
                  onPress={() => router.push('/settings' as any)}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: seriesColors.primary }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <Text style={styles.userPillName} numberOfLines={1}>{displayName}</Text>
                </AnimatedPressable>
              )}
              <View style={[styles.seasonBadge, { backgroundColor: seriesColors.accentGlow, borderColor: `${seriesColors.primary}26` }]}>
                <View style={[styles.liveDot, { backgroundColor: seriesColors.primary }]} />
                <Text style={[styles.seasonBadgeText, { color: seriesColors.primary }]}>2026</Text>
              </View>
            </View>

            {/* Hero title */}
            <Text style={styles.heroTitle}>{seriesLabels.heroTitle}</Text>
            <Text style={styles.heroSubtitle}>
              {seriesLabels.heroSubtitle}
            </Text>
          </LinearGradient>

          {/* ── NEXT RACE SPOTLIGHT ── */}
          {nextRace && (
            <View style={styles.spotlightSection}>
              <View style={styles.spotlightHeader}>
                <View style={styles.spotlightLabelRow}>
                  <Circle size={6} color={seriesColors.primary} fill={seriesColors.primary} />
                  <Text style={[styles.spotlightLabel, { color: seriesColors.primary }]}>NEXT RACE</Text>
                </View>
                <Text style={styles.spotlightRound}>Round {nextRace.round}</Text>
              </View>

              <AnimatedPressable
                style={[styles.spotlightCard, isMotoGP && { borderRadius: 0, borderWidth: 0 }]}
                onPress={() => router.push('/calendar' as any)}
                scaleDown={0.98}
              >
                <LinearGradient
                  colors={['#141820', '#1A1F2A']}
                  style={styles.spotlightCardInner}
                >
                  <View style={styles.spotlightTopRow}>
                    <Text style={styles.spotlightFlag}>{nextRace.countryFlag}</Text>
                    <View style={[styles.spotlightTrackBadge, { backgroundColor: `${seriesColors.primary}1A` }]}>
                      <Gauge size={10} color={seriesColors.primary} />
                      <Text style={[styles.spotlightTrackText, { color: seriesColors.primary }]}>CIRCUIT</Text>
                    </View>
                  </View>
                  <Text style={styles.spotlightRaceName}>{nextRace.name}</Text>
                  <View style={styles.spotlightLocation}>
                    <MapPin size={11} color={Colors.textMuted} />
                    <Text style={styles.spotlightLocationText}>{nextRace.location}, {nextRace.country}</Text>
                  </View>

                  <View style={styles.spotlightDivider} />

                  <CountdownTimer
                    targetDate={nextRace.raceDate}
                    targetTime={nextRace.raceTime}
                  />

                  <AnimatedPressable
                    style={styles.setGridBtn}
                    onPress={() => router.push('/predict' as any)}
                  >
                    <LinearGradient
                      colors={[seriesColors.primary, seriesColors.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.setGridBtnGradient}
                    >
                      <Target size={16} color="#FFF" />
                      <Text style={styles.setGridBtnText}>Set Your Grid</Text>
                      <ChevronRight size={16} color="rgba(255,255,255,0.5)" />
                    </LinearGradient>
                  </AnimatedPressable>
                </LinearGradient>
                {isMotoGP && (
                  <ChamferOverlay chamferSize={16} borderColor={seriesColors.border} borderWidth={1} surroundingColor={seriesColors.background} />
                )}
              </AnimatedPressable>
            </View>
          )}

          {/* ── STATS DASHBOARD ── */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionLabel}>{isMotoGP ? 'YOUR GARAGE' : 'YOUR PADDOCK'}</Text>
            <View style={styles.statsGrid}>
              <StatsCard
                icon={<Trophy size={18} color={isMotoGP ? seriesColors.highlight : Colors.warning} />}
                value={totalPoints}
                label="Points"
                color={isMotoGP ? seriesColors.highlight : Colors.warning}
                isMotoGP={isMotoGP}
              />
              <StatsCard
                icon={<Users size={18} color={Colors.info} />}
                value={leagues.length}
                label="Leagues"
                color={Colors.info}
                isMotoGP={isMotoGP}
              />
              <StatsCard
                icon={<Target size={18} color={seriesColors.primary} />}
                value={predictionsMade}
                label="Picks Made"
                color={seriesColors.primary}
                isMotoGP={isMotoGP}
              />
              <StatsCard
                icon={<Flag size={18} color={Colors.success} />}
                value={drivers.length}
                label={seriesLabels.competitors}
                color={Colors.success}
                isMotoGP={isMotoGP}
              />
            </View>
          </View>

          {/* ── LEAGUE ACTIONS ── */}
          <View style={styles.actionsSection}>
            <AnimatedPressable
              style={[styles.actionCard, isMotoGP && { borderRadius: 0, borderWidth: 0 }]}
              onPress={() => router.push('/create-league' as any)}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: `${seriesColors.primary}1F` }]}>
                <Swords size={20} color={seriesColors.primary} />
              </View>
              <Text style={styles.actionTitle}>Create League</Text>
              <Text style={styles.actionSubtitle}>Start your own championship</Text>
              {isMotoGP && (
                <ChamferOverlay chamferSize={12} borderColor={seriesColors.border} borderWidth={1} surroundingColor={seriesColors.background} />
              )}
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.actionCard, isMotoGP && { borderRadius: 0, borderWidth: 0 }]}
              onPress={() => router.push('/join-league' as any)}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(10, 132, 255, 0.12)' }]}>
                <UserPlus size={20} color={Colors.info} />
              </View>
              <Text style={styles.actionTitle}>Join League</Text>
              <Text style={styles.actionSubtitle}>Compete with friends</Text>
              {isMotoGP && (
                <ChamferOverlay chamferSize={12} borderColor={seriesColors.border} borderWidth={1} surroundingColor={seriesColors.background} />
              )}
            </AnimatedPressable>
          </View>

          {/* ── GUEST BANNER ── */}
          {isGuest && (
            <AnimatedPressable
              style={[styles.guestBannerWrap, { borderColor: `${seriesColors.primary}1F` }]}
              onPress={() => router.push('/auth' as any)}
            >
              <LinearGradient
                colors={[`${seriesColors.primary}1A`, `${seriesColors.primary}05`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.guestBanner}
              >
                <View style={styles.guestBannerLeft}>
                  <Text style={[styles.guestBannerTitle, { color: seriesColors.primary }]}>Playing as Guest</Text>
                  <Text style={styles.guestBannerText}>
                    Sign in to save picks and compete in leagues
                  </Text>
                </View>
                <ChevronRight size={16} color={seriesColors.primary} />
              </LinearGradient>
            </AnimatedPressable>
          )}

          {/* ── UPCOMING RACES ── */}
          {upcomingRaces.length > 1 && (
            <View style={styles.upcomingSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionLabel}>UP NEXT</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.upcomingScroll}
              >
                {upcomingRaces.slice(1).map((race) => (
                  <UpcomingRaceCard
                    key={race.id}
                    race={race}
                    onPress={() => router.push('/calendar' as any)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── HOW IT WORKS ── */}
          <View style={styles.howSection}>
            <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
            <View style={[styles.howCard, isMotoGP && { borderRadius: 0, borderWidth: 0 }]}>
              <HowStep
                step="1"
                icon={<Target size={16} color={seriesColors.primary} />}
                title="Set Your Grid"
                text={`Pick the top ${config.pickLimits.raceTopN} finishing order before each race locks`}
                isMotoGP={isMotoGP}
              />
              <View style={styles.howDivider} />
              <HowStep
                step="2"
                icon={<Zap size={16} color={isMotoGP ? seriesColors.highlight : Colors.warning} />}
                title="Bonus Picks"
                text={`Choose Fastest Lap and ${seriesLabels.dnfLabel} ${seriesLabels.competitorsLower} for extra points`}
                isMotoGP={isMotoGP}
              />
              <View style={styles.howDivider} />
              <HowStep
                step="3"
                icon={<Trophy size={16} color={Colors.info} />}
                title="Score & Climb"
                text="Earn points for correct picks. Dominate your leagues"
                isMotoGP={isMotoGP}
              />
              {isMotoGP && (
                <ChamferOverlay chamferSize={14} borderColor={seriesColors.border} borderWidth={1} surroundingColor={seriesColors.background} />
              )}
            </View>
          </View>

          {/* Bottom spacer */}
          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ── Sub-components ── */

function StatsCard({ icon, value, label, color, isMotoGP }: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  isMotoGP?: boolean;
}) {
  const { config } = useSeries();
  const seriesColors = config.colors;
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 800,
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, [animatedValue]);

  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }, isMotoGP && { borderRadius: 0, borderWidth: 0 }]}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}14` }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color: Colors.text }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      {isMotoGP && (
        <ChamferOverlay chamferSize={10} borderColor={seriesColors.border} borderWidth={1} />
      )}
    </View>
  );
}

function UpcomingRaceCard({ race, onPress }: { race: Race; onPress: () => void }) {
  const { config, currentSeries } = useSeries();
  const seriesColors = config.colors;
  const isMotoGP = currentSeries === 'motogp';
  const raceDate = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
  const dateStr = raceDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <AnimatedPressable onPress={onPress} style={[styles.upcomingCard, { borderColor: seriesColors.border }, isMotoGP && { borderRadius: 0, borderWidth: 0 }]}>
      <LinearGradient
        colors={[seriesColors.surface, seriesColors.surfaceElevated]}
        style={styles.upcomingCardInner}
      >
        <View style={styles.upcomingCardTop}>
          <Text style={styles.upcomingFlag}>{race.countryFlag}</Text>
          <Text style={styles.upcomingRound}>R{race.round}</Text>
        </View>
        <Text style={styles.upcomingName} numberOfLines={2}>{race.name}</Text>
        <View style={styles.upcomingDateRow}>
          <Clock size={10} color={Colors.textMuted} />
          <Text style={styles.upcomingDate}>{dateStr}</Text>
        </View>
      </LinearGradient>
      {isMotoGP && (
        <ChamferOverlay chamferSize={12} borderColor={seriesColors.border} borderWidth={1} surroundingColor={seriesColors.background} />
      )}
    </AnimatedPressable>
  );
}

function HowStep({ step, icon, title, text, isMotoGP }: {
  step: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  isMotoGP?: boolean;
}) {
  return (
    <View style={styles.howStep}>
      <View style={styles.howStepLeft}>
        <View style={[styles.howStepNum, isMotoGP && styles.howStepNumMotoGP]}>
          <Text style={[styles.howStepNumText, isMotoGP && styles.howStepNumTextMotoGP]}>{step}</Text>
        </View>
      </View>
      <View style={styles.howStepContent}>
        <View style={styles.howStepHeader}>
          {icon}
          <Text style={styles.howStepTitle}>{title}</Text>
        </View>
        <Text style={styles.howStepText}>{text}</Text>
      </View>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerSettingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },

  /* Hero */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  circuitLines: {
    ...StyleSheet.absoluteFillObject,
  },
  circuitLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(225, 6, 0, 0.08)',
  },
  speedLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  leanLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  circuitDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(225, 6, 0, 0.18)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingRight: 14,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 22,
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.f1Red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800' as const,
  },
  userPillName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
    maxWidth: 100,
  },
  signInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.f1Red,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  signInPillText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  seasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(225, 6, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.15)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.f1Red,
  },
  seasonBadgeText: {
    color: Colors.f1Red,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 38,
    fontWeight: '900' as const,
    letterSpacing: -1.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  /* Next Race Spotlight */
  spotlightSection: {
    paddingHorizontal: 20,
    marginTop: -8,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  spotlightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spotlightLabel: {
    color: Colors.f1Red,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  spotlightRound: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  spotlightCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  spotlightCardMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  spotlightCardInner: {
    padding: 20,
  },
  spotlightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  spotlightFlag: {
    fontSize: 36,
  },
  spotlightTrackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(225, 6, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  spotlightTrackText: {
    color: Colors.f1Red,
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  spotlightRaceName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  spotlightLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotlightLocationText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  spotlightDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 16,
    marginBottom: 4,
  },
  setGridBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  setGridBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  setGridBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
    flex: 1,
  },

  /* Stats */
  statsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: (SCREEN_W - 50) / 2,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  statCardMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800' as const,
    marginBottom: 2,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
  },

  /* Actions */
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionCardMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 3,
  },
  actionSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },

  /* Guest Banner */
  guestBannerWrap: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.12)',
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  guestBannerLeft: {
    flex: 1,
  },
  guestBannerTitle: {
    color: Colors.f1Red,
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  guestBannerText: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  /* Upcoming Races */
  upcomingSection: {
    marginTop: 24,
  },
  sectionTitleRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  upcomingScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  upcomingCard: {
    width: 155,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  upcomingCardMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  upcomingCardInner: {
    padding: 14,
    height: 130,
    justifyContent: 'space-between',
  },
  upcomingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upcomingFlag: {
    fontSize: 22,
  },
  upcomingRound: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  upcomingName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
    lineHeight: 17,
    flex: 1,
    marginTop: 6,
  },
  upcomingDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  upcomingDate: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },

  /* How It Works */
  howSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  howCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  howCardMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  howStep: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  howDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  howStepLeft: {
    alignItems: 'center',
  },
  howStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(225, 6, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepNumMotoGP: {
    borderRadius: 2,
    transform: [{ rotate: '-12deg' }],
    backgroundColor: 'rgba(255, 240, 0, 0.1)',
    borderColor: 'rgba(255, 240, 0, 0.3)',
  },
  howStepNumText: {
    color: Colors.f1Red,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  howStepNumTextMotoGP: {
    color: '#FFF000',
    transform: [{ rotate: '12deg' }],
  },
  howStepContent: {
    flex: 1,
  },
  howStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  howStepTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  howStepText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
});
