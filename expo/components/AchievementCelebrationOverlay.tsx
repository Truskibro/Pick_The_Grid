import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as icons from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import {
  TIER_COLORS,
  TIER_LABELS,
  type AchievementDefinition,
  type AchievementTier,
} from '@/constants/achievements';
import { useAchievements } from '@/providers/AchievementProvider';

/* ------------------------------------------------------------------ */
/*  Confetti particle system                                           */
/* ------------------------------------------------------------------ */

interface ConfettiParticle {
  id: number;
  /** start angle in degrees, 0 = up */
  angle: number;
  /** burst distance in px */
  distance: number;
  color: string;
  size: number;
  rotateFrom: number;
  rotateTo: number;
  delay: number;
}

const CONFETTI_COLORS = [
  '#E10600',
  '#FFD700',
  '#76E4FF',
  '#30D158',
  '#FF3B30',
  '#C0C0C0',
  '#FF9F0A',
  '#BF5AF2',
];

const TIER_COLOR_LIST = ['#CD7F32', '#C0C0C0', '#FFD700', '#76E4FF'];

function buildConfetti(tierColor: string, hidden: boolean): ConfettiParticle[] {
  const palette = hidden
    ? ['#E10600', '#FF2D2D', '#0A0A0A', '#3A0000', '#FFFFFF']
    : [...TIER_COLOR_LIST, ...CONFETTI_COLORS, tierColor];

  const particles: ConfettiParticle[] = [];
  const count = 28;

  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i + (Math.random() * 14 - 7);
    const distance = 150 + Math.random() * 140;
    particles.push({
      id: i,
      angle,
      distance,
      color: palette[i % palette.length],
      size: 6 + Math.random() * 8,
      rotateFrom: Math.random() * 360,
      rotateTo: Math.random() * 720 - 360,
      delay: Math.random() * 120,
    });
  }

  return particles;
}

function ConfettiBurst({
  particles,
  play,
  color,
}: {
  particles: ConfettiParticle[];
  play: Animated.Value;
  color: string;
}) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.sin(rad) * p.distance;
        const ty = -Math.cos(rad) * p.distance - 30;

        const translateX = play.interpolate({
          inputRange: [0, 1],
          outputRange: [0, tx],
        });
        const translateY = play.interpolate({
          inputRange: [0, 1],
          outputRange: [0, ty],
        });
        const opacity = play.interpolate({
          inputRange: [0, 0.15, 0.7, 1],
          outputRange: [0, 1, 1, 0],
        });
        const scale = play.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0.3, 1, 0.6],
        });
        const rotate = play.interpolate({
          inputRange: [0, 1],
          outputRange: [`${p.rotateFrom}deg`, `${p.rotateTo}deg`],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.confettiPiece,
              {
                width: p.size,
                height: p.size * 0.42,
                backgroundColor: p.color,
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotate },
                ],
              },
            ]}
          />
        );
      })}
      {color ? null : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Rotating light rays                                                */
/* ------------------------------------------------------------------ */

function LightRays({ color, spin }: { color: string; spin: Animated.Value }) {
  const rays = useMemo(() => {
    const arr: { rotate: number; opacity: number }[] = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      arr.push({ rotate: (360 / count) * i, opacity: 0.5 });
    }
    return arr;
  }, []);

  const rotateInterp = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: rotateInterp }] }]}
      pointerEvents="none"
    >
      {rays.map((r, i) => (
        <View
          key={i}
          style={[
            styles.ray,
            {
              transform: [{ rotate: `${r.rotate}deg` }],
              opacity: 0.18,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/*  Icon resolver                                                      */
/* ------------------------------------------------------------------ */

function resolveIcon(iconName: string): React.ComponentType<any> {
  const pascal = iconName
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return (icons as any)[pascal] || (icons as any).Trophy;
}

/* ------------------------------------------------------------------ */
/*  Main overlay                                                       */
/* ------------------------------------------------------------------ */

const HIDDEN_COLORS = {
  primary: Colors.f1Red,
  glow: 'rgba(225, 6, 0, 0.55)',
  border: 'rgba(225, 6, 0, 0.85)',
};

const DISPLAY_MS = 5200;

export default function AchievementCelebrationOverlay() {
  const { unlockQueue, dismissUnlock } = useAchievements();

  const current =
    unlockQueue.length > 0 && !unlockQueue[0].dismissed ? unlockQueue[0] : null;

  const def = current?.def;
  const tier = current?.tier ?? 'bronze';
  const visible = !!current && !!def;

  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardRotate = useRef(new Animated.Value(-0.08)).current;
  const ring1Scale = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(0)).current;
  const ring3Scale = useRef(new Animated.Value(0)).current;
  const iconPop = useRef(new Animated.Value(0)).current;
  const raySpin = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const shineTranslate = useRef(new Animated.Value(-1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(0)).current;

  const confetti = useMemo<ConfettiParticle[]>(() => {
    if (!def) return [];
    const tierColor = def.isHidden
      ? HIDDEN_COLORS.primary
      : TIER_COLORS[tier].primary;
    return buildConfetti(tierColor, !!def.isHidden);
  }, [def, tier]);

  // Fire the celebration whenever a new unlock becomes visible.
  useEffect(() => {
    if (!visible || !def) return;

    // Reset all animation values to start state.
    backdropOpacity.setValue(0);
    cardScale.setValue(0.3);
    cardOpacity.setValue(0);
    cardRotate.setValue(-0.08);
    ring1Scale.setValue(0);
    ring2Scale.setValue(0);
    ring3Scale.setValue(0);
    iconPop.setValue(0);
    raySpin.setValue(0);
    glowPulse.setValue(0);
    shineTranslate.setValue(-1);
    burst.setValue(0);
    titleSlide.setValue(0);
    subtitleSlide.setValue(0);

    // Haptic celebration: notification success + a heavy bump for impact.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 180);

    // Sequence: backdrop -> rings -> card pop -> icon pop -> confetti -> shine
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 12,
          stiffness: 170,
          mass: 0.9,
        }),
        Animated.spring(cardRotate, {
          toValue: 0,
          useNativeDriver: true,
          damping: 14,
          stiffness: 150,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.spring(iconPop, {
            toValue: 1,
            useNativeDriver: true,
            damping: 10,
            stiffness: 220,
          }),
        ]),
        Animated.sequence([
          Animated.delay(120),
          Animated.spring(ring1Scale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 14,
            stiffness: 120,
          }),
          Animated.spring(ring2Scale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 14,
            stiffness: 110,
          }),
          Animated.spring(ring3Scale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 16,
            stiffness: 90,
          }),
        ]),
        Animated.sequence([
          Animated.delay(260),
          Animated.timing(burst, {
            toValue: 1,
            duration: 1100,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(titleSlide, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(subtitleSlide, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Continuous ray spin + glow pulse loop while visible.
        Animated.loop(
          Animated.timing(raySpin, {
            toValue: 1,
            duration: 9000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          { iterations: -1 }
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowPulse, {
              toValue: 1,
              duration: 1100,
              useNativeDriver: true,
            }),
            Animated.timing(glowPulse, {
              toValue: 0,
              duration: 1100,
              useNativeDriver: true,
            }),
          ]),
          { iterations: -1 }
        ),
        // Shine sweep across the card.
        Animated.sequence([
          Animated.delay(420),
          Animated.timing(shineTranslate, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const timer = setTimeout(() => {
      animateOut();
    }, DISPLAY_MS);

    function animateOut() {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 0.85,
          useNativeDriver: true,
          damping: 16,
          stiffness: 200,
        }),
      ]).start(() => dismissUnlock());
    }

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, def?.id, tier]);

  if (!visible || !def) return null;

  const hiddenUnlocked = def.isHidden;
  const tierColors = hiddenUnlocked ? HIDDEN_COLORS : TIER_COLORS[tier];
  const tierLabel = hiddenUnlocked ? 'Secret Badge' : TIER_LABELS[tier];
  const IconComponent = resolveIcon(def.icon);
  const accent = tierColors.primary;

  const iconScale = iconPop.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1],
  });
  const iconRotate = iconPop.interpolate({
    inputRange: [0, 1],
    outputRange: ['-25deg', '0deg'],
  });

  const glowShadow = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 28],
  });
  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.95],
  });

  const titleY = titleSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const titleO = titleSlide.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0.4, 1],
  });
  const subY = subtitleSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const subO = subtitleSlide.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.4, 1],
  });

  const shineX = shineTranslate.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  return (
    <Animated.View
      style={[styles.overlay, { opacity: backdropOpacity }]}
      pointerEvents="auto"
      onTouchStart={() => dismissUnlock()}
    >
      {/* Confetti behind the card */}
      <View style={styles.burstAnchor}>
        <ConfettiBurst particles={confetti} play={burst} color={accent} />
      </View>

      {/* Card */}
      <Animated.View
        style={[
          styles.cardWrap,
          {
            opacity: cardOpacity,
            transform: [
              { scale: cardScale },
              { rotate: cardRotate.interpolate({
                inputRange: [-0.08, 0],
                outputRange: ['-5deg', '0deg'],
              }) },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.glowAura,
            {
              shadowColor: accent,
              shadowOpacity: glowOpacity,
              shadowRadius: glowShadow,
            },
          ]}
        />

        <LinearGradient
          colors={
            hiddenUnlocked
              ? ['#050505', '#1A0000', '#050505']
              : ['#0F1419', '#1A1025', '#0F1419']
          }
          style={[
            styles.card,
            hiddenUnlocked && styles.hiddenCard,
            { borderColor: `${accent}80` },
          ]}
        >
          {/* Rotating light rays behind the badge */}
          <View style={styles.rayAnchor}>
            <LightRays color={accent} spin={raySpin} />
          </View>

          {/* Shine sweep */}
          <Animated.View
            style={[
              styles.shine,
              {
                transform: [{ translateX: shineX }],
              },
            ]}
            pointerEvents="none"
          />

          {/* Pulsing concentric rings + badge */}
          <View style={styles.badgeStack}>
            {/* Ring 3 (outermost) */}
            <Animated.View
              style={[
                styles.ring,
                {
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  borderColor: `${accent}30`,
                  transform: [{ scale: ring3Scale }],
                },
              ]}
            />
            {/* Ring 2 */}
            <Animated.View
              style={[
                styles.ring,
                {
                  width: 122,
                  height: 122,
                  borderRadius: 61,
                  borderColor: `${accent}55`,
                  transform: [{ scale: ring2Scale }],
                },
              ]}
            />
            {/* Ring 1 */}
            <Animated.View
              style={[
                styles.ring,
                {
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderColor: accent,
                  borderWidth: 2,
                  transform: [{ scale: ring1Scale }],
                },
              ]}
            />

            {/* Badge core */}
            <Animated.View
              style={[
                styles.iconShell,
                {
                  backgroundColor: hiddenUnlocked ? Colors.f1Red : `${accent}22`,
                  borderColor: hiddenUnlocked ? '#000' : `${accent}90`,
                  transform: [{ scale: iconScale }, { rotate: iconRotate }],
                },
              ]}
            >
              <IconComponent size={42} color="#FFF" />
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.bannerWrap,
              { opacity: titleO, transform: [{ translateY: titleY }] },
            ]}
          >
            <Text
              style={[
                styles.bannerLabel,
                hiddenUnlocked && styles.hiddenBannerLabel,
              ]}
            >
              {hiddenUnlocked ? 'Secret Badge Unlocked' : 'Grid Badge Unlocked'}
            </Text>
            <View
              style={[
                styles.tierPill,
                hiddenUnlocked
                  ? styles.hiddenTierPill
                  : {
                      borderColor: `${accent}90`,
                      backgroundColor: `${accent}1F`,
                    },
              ]}
            >
              <Text
                style={[
                  styles.tierPillText,
                  { color: hiddenUnlocked ? '#FFF' : accent },
                ]}
              >
                {tierLabel}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.textWrap,
              { opacity: subO, transform: [{ translateY: subY }] },
            ]}
          >
            <Text
              style={[
                styles.badgeName,
                hiddenUnlocked && styles.hiddenBadgeName,
              ]}
            >
              {def.name}
            </Text>
            <Text
              style={[
                styles.badgeDesc,
                hiddenUnlocked && styles.hiddenBadgeDesc,
              ]}
            >
              {def.description}
            </Text>

            {def.tiers && !hiddenUnlocked && (
              <Text style={styles.tierReq}>
                {def.tiers.find((t) => t.tier === tier)?.requirement}
              </Text>
            )}

            {hiddenUnlocked && (
              <View style={styles.hiddenRevealBox}>
                <Text style={styles.hiddenRevealText}>
                  {def.unlockHint ?? 'You completed a secret objective.'}
                </Text>
              </View>
            )}
          </Animated.View>

          <Text style={styles.tapHint}>Tap to dismiss</Text>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },

  burstAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardWrap: {
    width: 320,
    maxWidth: '88%',
    alignItems: 'center',
  },

  glowAura: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    elevation: 24,
  },

  card: {
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: 26,
  },

  hiddenCard: {
    borderWidth: 2,
  },

  rayAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ray: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 4,
    height: 380,
    marginLeft: -2,
    marginTop: -190,
    borderRadius: 2,
  },

  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 90,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ skewX: '-20deg' }],
  },

  badgeStack: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },

  iconShell: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },

  bannerWrap: {
    alignItems: 'center',
  },

  bannerLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    textAlign: 'center',
  },

  hiddenBannerLabel: {
    color: Colors.f1Red,
  },

  tierPill: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 10,
  },

  hiddenTierPill: {
    backgroundColor: '#080808',
    borderColor: Colors.f1Red,
  },

  tierPillText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  textWrap: {
    alignItems: 'center',
    marginTop: 4,
  },

  badgeName: {
    color: Colors.text,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: 10,
  },

  hiddenBadgeName: {
    color: '#FFF',
  },

  badgeDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },

  hiddenBadgeDesc: {
    color: '#DADADA',
  },

  tierReq: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },

  hiddenRevealBox: {
    backgroundColor: '#080808',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(225,6,0,0.45)',
    marginTop: 14,
  },

  hiddenRevealText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },

  tapHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 18,
    letterSpacing: 0.4,
  },

  confettiPiece: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -4,
    marginTop: -3,
    borderRadius: 2,
  },
});
