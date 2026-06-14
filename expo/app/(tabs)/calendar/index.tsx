import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Animated } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';
import RaceCard from '@/components/RaceCard';
import { Race } from '@/types';

export default function CalendarScreen() {
  const router = useRouter();
  const { races, isRefreshing, refreshAll, getRaceResult, getDriverById } = useF1Data();
  const { getPrediction, refreshPredictions } = useGame();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      void refreshPredictions();
    }, [refreshPredictions]),
  );

  const handleRefresh = useCallback(() => {
    void refreshPredictions();
    void refreshAll();
  }, [refreshAll, refreshPredictions]);

  const upcoming = races.filter(r => r.status === 'upcoming');
  const completed = races
    .filter(r => r.status === 'completed')
    .slice()
    .sort((a, b) => new Date(b.raceDate).getTime() - new Date(a.raceDate).getTime());
  const live = races.filter(r => r.status === 'live');
  const cancelled = races.filter(r => r.status === 'cancelled');

  const sections = [
    ...(live.length > 0 ? [{ title: 'LIVE NOW', data: live }] : []),
    ...(upcoming.length > 0 ? [{ title: 'UPCOMING', data: upcoming }] : []),
    ...(completed.length > 0 ? [{ title: 'COMPLETED', data: completed }] : []),
    ...(cancelled.length > 0 ? [{ title: 'CANCELLED', data: cancelled }] : []),
  ];

  const allItems: Array<{ type: 'header'; title: string } | { type: 'race'; race: Race }> = [];
  sections.forEach(section => {
    allItems.push({ type: 'header', title: section.title });
    section.data.forEach(race => {
      allItems.push({ type: 'race', race });
    });
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <FlatList
        data={allItems}
        keyExtractor={(item, index) => item.type === 'header' ? `h-${index}` : `r-${(item as { type: 'race'; race: Race }).race.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                <View style={styles.sectionLine} />
              </View>
            );
          }
          const raceId = item.race.id;
          const prediction = getPrediction(raceId);
          const result = getRaceResult(raceId);
          const hasPrediction = !!prediction && (
            prediction.top10.length > 0 ||
            prediction.sprintTop8.length > 0 ||
            !!prediction.fastestLap ||
            !!prediction.dnf
          );

          // Compute points live from prediction + race result, matching
          // the race-results screen — never trust stored pointsEarned.
          let livePoints: number | undefined;
          let liveSprintPoints: number | undefined;

          if (prediction && result && result.classification.length > 0) {
            const breakdown = calculatePoints(prediction, result);
            livePoints = breakdown.totalPoints;

            if (
              prediction.sprintTop8.length > 0 &&
              result.sprintClassification &&
              result.sprintClassification.length > 0
            ) {
              const sprintBreakdown = calculateSprintPoints(
                prediction.sprintTop8,
                result.sprintClassification,
              );
              liveSprintPoints = sprintBreakdown.totalPoints;
            }
          }

          // Resolve pick driver IDs to short names for the RaceCard
          const pickNames: string[] | undefined = prediction?.top10
            ? prediction.top10
                .map((id: string) => getDriverById(id)?.shortName)
                .filter((n: string | undefined): n is string => !!n)
            : undefined;
          const fastestLapPickName: string | null = prediction?.fastestLap
            ? (getDriverById(prediction.fastestLap)?.shortName ?? null)
            : null;
          const dnfPickName: string | null = prediction?.dnf
            ? (getDriverById(prediction.dnf)?.shortName ?? null)
            : null;

          return (
            <RaceCard
              race={item.race}
              onPress={() => {
                if (item.race.status === 'completed' || item.race.status === 'live') {
                  router.push(`/race-results/${item.race.id}` as any);
                } else if (item.race.status === 'cancelled') {
                  router.push(`/race-results/${item.race.id}` as any);
                } else {
                  router.push(`/predict-race/${item.race.id}` as any);
                }
              }}
              pointsEarned={livePoints}
              sprintPointsEarned={liveSprintPoints}
              hasPrediction={hasPrediction}
              pickNames={pickNames}
              fastestLapPickName={fastestLapPickName}
              dnfPickName={dnfPickName}
            />
          );
        }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{races.length} Races</Text>
            <Text style={styles.headerSub}>
              {completed.length} completed · {upcoming.length} remaining
            </Text>
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
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  headerSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 8,
  },
  sectionTitle: {
    color: Colors.f1Red,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
});
