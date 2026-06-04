import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as icons from 'lucide-react-native';

import Colors from '@/constants/colors';
import {
  TIER_COLORS,
  TIER_LABELS,
  type AchievementDefinition,
  type AchievementTier,
} from '@/constants/achievements';

interface AchievementUnlockToastProps {
  def?: AchievementDefinition;
  tier?: AchievementTier;
  visible: boolean;
  onDismiss: () => void;
}

const HIDDEN_UNLOCK_COLORS = {
  primary: Colors.f1Red,
  secondary: '#050505',
  glow: 'rgba(225, 6, 0, 0.42)',
  border: 'rgba(225, 6, 0, 0.72)',
};

function resolveIcon(iconName: string): React.ComponentType<any> {
  const pascal = iconName
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  return (icons as any)[pascal] || (icons as any).Trophy;
}

export default function AchievementUnlockToast({
  def,
  tier = 'bronze',
  visible,
  onDismiss,
}: AchievementUnlockToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) return undefined;

    Animated.parallel([
      Animated.spring(opacity, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 4000);

    return () => clearTimeout(timer);
  }, [visible, opacity, scale, onDismiss]);

  if (!visible || !def) return null;

  const hiddenUnlocked = def.isHidden;
  const tierColors = hiddenUnlocked ? HIDDEN_UNLOCK_COLORS : TIER_COLORS[tier];
  const tierLabel = hiddenUnlocked ? 'Secret Badge' : TIER_LABELS[tier];
  const IconComponent = resolveIcon(def.icon);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={
            hiddenUnlocked
              ? ['#050505', '#160000', '#050505']
              : ['#1A1025', '#0F1419']
          }
          style={[
            styles.cardGradient,
            hiddenUnlocked && styles.hiddenCardGradient,
          ]}
        >
          <View
            style={[
              styles.glowRing,
              {
                borderColor: tierColors.primary,
                shadowColor: tierColors.primary,
              },
            ]}
          >
            <View
              style={[
                styles.iconShell,
                {
                  backgroundColor: hiddenUnlocked
                    ? Colors.f1Red
                    : `${tierColors.primary}22`,
                  borderColor: hiddenUnlocked
                    ? '#000'
                    : `${tierColors.primary}70`,
                },
              ]}
            >
              <IconComponent size={38} color="#FFF" />
            </View>
          </View>

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
                    borderColor: `${tierColors.primary}80`,
                    backgroundColor: `${tierColors.primary}14`,
                  },
            ]}
          >
            <Text
              style={[
                styles.tierPillText,
                { color: hiddenUnlocked ? '#FFF' : tierColors.primary },
              ]}
            >
              {tierLabel}
            </Text>
          </View>

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
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
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
  },

  hiddenCardGradient: {
    borderWidth: 1.5,
    borderColor: HIDDEN_UNLOCK_COLORS.border,
  },

  glowRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowOpacity: 0.75,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },

  iconShell: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  bannerLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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

  badgeName: {
    color: Colors.text,
    fontSize: 24,
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
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
});