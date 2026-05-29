import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as icons from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  TIER_COLORS,
  TIER_LABELS,
  type AchievementTier,
  type AchievementDefinition,
} from '@/constants/achievements';

interface AchievementUnlockToastProps {
  def: AchievementDefinition;
  tier: AchievementTier;
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Full-screen overlay toast displayed when an achievement is unlocked.
 * Shows the badge name, tier, and description with a premium F1 aesthetic.
 */
export default function AchievementUnlockToast({
  def,
  tier,
  visible,
  onDismiss,
}: AchievementUnlockToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 200 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 200 }),
      ]).start();

      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, opacity, scale, onDismiss]);

  if (!visible) return null;

  const tierColors = TIER_COLORS[tier];
  const tierLabel = TIER_LABELS[tier];

  // Dynamically get the icon component
  const IconComponent = (icons as any)[
    def.icon
      .split('-')
      .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
      .join('') + 'Icon'
  ] || icons.Trophy;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={['#1A1025', '#0F1419', Colors.surface]}
          locations={[0, 0.5, 1]}
          style={styles.cardGradient}
        >
          {/* Glow ring */}
          <View style={[styles.glowRing, { borderColor: tierColors.glow }]}>
            <LinearGradient
              colors={[tierColors.primary, tierColors.secondary]}
              style={styles.iconShell}
            >
              <IconComponent size={36} color="#FFF" strokeWidth={2} />
            </LinearGradient>
          </View>

          <Text style={styles.bannerLabel}>Grid Badge Unlocked</Text>

          <View style={[styles.tierPill, { backgroundColor: tierColors.glow, borderColor: tierColors.primary }]}>
            <Text style={[styles.tierPillText, { color: tierColors.primary }]}>
              {tierLabel}
            </Text>
          </View>

          <Text style={styles.badgeName}>{def.name}</Text>
          <Text style={styles.badgeDesc}>{def.description}</Text>

          {/* Tier requirement text */}
          {def.tiers && (
            <Text style={styles.tierReq}>
              {def.tiers.find((t) => t.tier === tier)?.requirement}
            </Text>
          )}
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  card: {
    marginHorizontal: 32,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardGradient: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
    gap: 10,
  },
  glowRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconShell: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
  },
  tierPill: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  tierPillText: {
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  badgeName: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  badgeDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  tierReq: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic' as const,
    marginTop: 2,
  },
});
