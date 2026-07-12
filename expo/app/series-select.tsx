import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Flag, Bike, ChevronRight } from 'lucide-react-native';

import AnimatedPressable from '@/components/AnimatedPressable';
import { useSeries } from '@/providers/SeriesProvider';
import { ALL_SERIES, SeriesId } from '@/constants/series';

const { width: SCREEN_W } = Dimensions.get('window');

export default function SeriesSelectScreen() {
  const router = useRouter();
  const { selectSeries, isLoading, hasChosen } = useSeries();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // If user already chose a series, redirect to tabs.
  useEffect(() => {
    if (!isLoading && hasChosen) {
      router.replace('/(tabs)' as any);
    }
  }, [isLoading, hasChosen, router]);

  const handleSelect = async (seriesId: SeriesId) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await selectSeries(seriesId);
    router.replace('/(tabs)' as any);
  };

  if (isLoading) {
    return <View style={styles.loadingContainer} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>APEX DRAFT</Text>
            <Text style={styles.headerTitle}>Choose Your Series</Text>
            <Text style={styles.headerSubtitle}>
              Select a racing championship to start predicting.
            </Text>
          </View>

          {/* Series cards */}
          <View style={styles.cardsContainer}>
            {ALL_SERIES.map((series, index) => (
              <SeriesCard
                key={series.id}
                seriesId={series.id}
                name={series.name}
                tagline={series.tagline}
                colors={series.colors}
                onSelect={() => handleSelect(series.id)}
                delay={index * 120}
              />
            ))}
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>
            You can switch series anytime from Settings.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

interface SeriesCardProps {
  seriesId: SeriesId;
  name: string;
  tagline: string;
  colors: typeof ALL_SERIES[number]['colors'];
  onSelect: () => void;
  delay: number;
}

function SeriesCard({ seriesId, name, tagline, colors, onSelect, delay }: SeriesCardProps) {
  const cardAnim = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(cardSlide, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [cardAnim, cardSlide, delay]);

  const isF1 = seriesId === 'f1';
  const Icon = isF1 ? Flag : Bike;

  return (
    <Animated.View
      style={{
        opacity: cardAnim,
        transform: [{ translateY: cardSlide }],
      }}
    >
      <AnimatedPressable
        onPress={onSelect}
        scaleDown={0.97}
        style={[styles.cardWrapper, !isF1 && styles.cardWrapperMotoGP]}
      >
        <LinearGradient
          colors={colors.heroGradient as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.card,
            isF1 ? styles.f1Card : styles.motogpCard,
            !isF1 && styles.cardMotoGP,
            { borderColor: colors.primary },
          ]}
        >
          {/* Decorative accent lines */}
          {isF1 ? (
            <>
              <View
                style={[
                  styles.circuitLine,
                  {
                    top: 24,
                    left: -30,
                    width: 200,
                    transform: [{ rotate: '-28deg' }],
                    backgroundColor: colors.primary,
                  },
                ]}
              />
              <View
                style={[
                  styles.circuitDot,
                  { top: 22, left: 165, backgroundColor: colors.primary },
                ]}
              />
            </>
          ) : (
            <>
              {/* MotoGP: angular speed lines + leaning grid motif */}
              <View
                style={[
                  styles.speedLine,
                  {
                    top: 18,
                    left: -40,
                    width: 220,
                    transform: [{ rotate: '-35deg' }],
                    backgroundColor: colors.primary,
                    opacity: 0.12,
                  },
                ]}
              />
              <View
                style={[
                  styles.speedLine,
                  {
                    top: 58,
                    right: -40,
                    width: 180,
                    transform: [{ rotate: '-35deg' }],
                    backgroundColor: colors.primary,
                    opacity: 0.06,
                  },
                ]}
              />
              <View
                style={[
                  styles.leanLine,
                  { top: 90, left: -10, width: 140, transform: [{ rotate: '55deg' }] },
                ]}
              />
              <View
                style={[
                  styles.leanLine,
                  { top: 120, right: -10, width: 100, transform: [{ rotate: '55deg' }] },
                ]}
              />
              <View
                style={[
                  styles.hexAccent,
                  { top: 24, right: 28, borderColor: colors.primary },
                ]}
              />
              <View
                style={[
                  styles.hexAccent,
                  { top: 24, right: 28, borderColor: colors.highlight, opacity: 0.12 },
                ]}
              />
            </>
          )}

          {/* Icon badge */}
          <View
            style={[
              styles.iconBadge,
              !isF1 && styles.iconBadgeMotoGP,
              { backgroundColor: `${colors.primary}22`, borderColor: colors.primary },
            ]}
          >
            <Icon size={28} color={colors.primary} />
          </View>

          {/* Card text */}
          <View style={styles.cardTextContainer}>
            <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>{name}</Text>
            <Text style={[styles.cardTagline, { color: 'rgba(255,255,255,0.6)' }]}>
              {tagline}
            </Text>
          </View>

          {/* Enter button */}
          <View style={styles.enterRow}>
            <View
              style={[
                styles.enterBtn,
                !isF1 && styles.enterBtnMotoGP,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <Text style={styles.enterBtnText}>ENTER</Text>
              <ChevronRight size={16} color="#FFF" />
            </View>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0E11',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0E11',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  appName: {
    color: '#E10600',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 4,
    marginBottom: 8,
  },
  headerTitle: {
    color: '#F5F5F7',
    fontSize: 28,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 20,
  },
  cardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardWrapperMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  card: {
    minHeight: 200,
    padding: 24,
    borderWidth: 1.5,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cardMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  f1Card: {},
  motogpCard: {},
  circuitLine: {
    position: 'absolute',
    height: 2,
    opacity: 0.15,
    borderRadius: 2,
  },
  circuitDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.3,
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
  hexAccent: {
    position: 'absolute',
    width: 40,
    height: 46,
    borderWidth: 2,
    borderRadius: 8,
    opacity: 0.18,
    transform: [{ rotate: '12deg' }, { skewX: '-12deg' }],
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  iconBadgeMotoGP: {
    borderRadius: 4,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardTextContainer: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 8,
  },
  cardTagline: {
    fontSize: 14,
    lineHeight: 20,
  },
  enterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  enterBtnMotoGP: {
    borderRadius: 2,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  enterBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  footerText: {
    color: '#48484A',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
  },
});
