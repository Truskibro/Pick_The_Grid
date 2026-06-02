import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MapPin, Clock, Trophy, Target, Check, X, Zap, AlertTriangle, Medal, Flag } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useF1Data } from '@/providers/F1DataProvider';
import { useGame } from '@/providers/GameProvider';
import { calculatePoints, calculateSprintPoints } from '@/lib/scoring';
import { F1_POINTS, SPRINT_POINTS, FASTEST_LAP_BONUS, DNF_BONUS, ClassificationEntry } from '@/types';
import AnimatedPressable from '@/components/AnimatedPressable';

export default function RaceResultsScreen() {
  const { raceId } = useLocalSearchParams<{ raceId: string }>();
  const router = useRouter();
  const { getPrediction } = useGame();
  const { getRaceById, getDriverById, getTeamById, getRaceResult } = useF1Data();

  const race = raceId ? getRaceById(raceId) : undefined;
  const prediction = raceId ? getPrediction(raceId) : undefined;
  const result = raceId ? getRaceResult(raceId) : undefined;

  const breakdown = useMemo(() => {
    if (!prediction || !result || result.classification.length === 0) return null;
    return calculatePoints(prediction, result);
  }, [prediction, result]);

  const allResults = useMemo(() => {
    if (!result) return [];
    return [...result.classification].sort((a, b) => a.position - b.position);
  }, [result]);

  const sprintResults = useMemo<ClassificationEntry[]>(() => {
    if (!result?.sprintClassification) return [];
    return [...result.sprintClassification].sort((a, b) => a.position - b.position);
  }, [result]);

  const sprintBreakdown = useMemo(() => {
    if (!prediction || sprintResults.length === 0) return null;
    if (!prediction.sprintTop8 || prediction.sprintTop8.length === 0) return null;
    return calculateSprintPoints(prediction.sprintTop8, sprintResults);
  }, [prediction, sprintResults]);

  const podiumColors: Record<number, string> = {
    1: '#FFD700',
    2: '#C0C0C0',
    3: '#CD7F32',
  };

  if (!race) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Race Not Found</Text>
      </View>
    );
  }

  const raceDate = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
  const dateStr = raceDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = raceDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: race.name }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.raceHeader}>
          <Text style={styles.raceFlag}>{race.countryFlag}</Text>
          <Text style={styles.raceName}>{race.name}</Text>
          <View style={styles.locationRow}>
            <MapPin size={12} color={Colors.textMuted} />
            <Text style={styles.locationText}>{race.location}, {race.country}</Text>
          </View>
          <View style={styles.dateRow}>
            <Clock size={12} color={Colors.textSecondary} />
            <Text style={styles.dateText}>{dateStr} · {timeStr}</Text>
          </View>

          <View style={[
            styles.statusBadge,
            {
              backgroundColor: race.status === 'completed'
                ? `${Colors.success}18`
                : race.status === 'live'
                ? `${Colors.f1Red}18`
                : race.status === 'cancelled'
                ? `${Colors.textMuted}18`
                : `${Colors.info}18`
            }
          ]}>
            <Text style={[
              styles.statusText,
              {
                color: race.status === 'completed'
                  ? Colors.success
                  : race.status === 'live'
                  ? Colors.f1Red
                  : race.status === 'cancelled'
                  ? Colors.textMuted
                  : Colors.info
              }
            ]}>
              {race.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {prediction && prediction.pointsEarned > 0 && (
          <View style={styles.pointsCard}>
            <Trophy size={24} color={Colors.warning} />
            <View style={styles.pointsCardContent}>
              <Text style={styles.pointsCardLabel}>POINTS EARNED</Text>
              <Text style={styles.pointsCardValue}>{prediction.pointsEarned}</Text>
            </View>
            {breakdown && (
              <View style={styles.pointsBreakdownRow}>
                {breakdown.positionPoints > 0 && (
                  <View style={styles.breakdownChip}>
                    <Target size={10} color={Colors.info} />
                    <Text style={styles.breakdownChipText}>Pos +{breakdown.positionPoints}</Text>
                  </View>
                )}
                {breakdown.fastestLapPoints > 0 && (
                  <View style={styles.breakdownChip}>
                    <Zap size={10} color={Colors.warning} />
                    <Text style={styles.breakdownChipText}>FL +{breakdown.fastestLapPoints}</Text>
                  </View>
                )}
                {breakdown.dnfPoints > 0 && (
                  <View style={styles.breakdownChip}>
                    <AlertTriangle size={10} color={Colors.error} />
                    <Text style={styles.breakdownChipText}>DNF +{breakdown.dnfPoints}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {prediction && prediction.pointsEarned === 0 && result && result.classification.length > 0 && (
          <View style={styles.zeroPointsCard}>
            <Text style={styles.zeroPointsText}>No points earned for this race</Text>
          </View>
        )}

        {race.status === 'cancelled' && (
          <View style={styles.cancelledCard}>
            <AlertTriangle size={24} color={Colors.textMuted} />
            <Text style={styles.cancelledTitle}>Race Cancelled</Text>
            <Text style={styles.cancelledText}>
              This Grand Prix was cancelled and no results are available.
            </Text>
          </View>
        )}

        {race.status === 'upcoming' && (
          <View style={styles.upcomingCard}>
            <Target size={24} color={Colors.f1Red} />
            <Text style={styles.upcomingTitle}>Race hasn&apos;t started yet</Text>
            <Text style={styles.upcomingText}>
              Results will appear here after the race is completed.
            </Text>
            <AnimatedPressable
              style={styles.predictBtn}
              onPress={() => router.push('/predict' as any)}
            >
              <Text style={styles.predictBtnText}>Make Your Prediction</Text>
            </AnimatedPressable>
          </View>
        )}

        {result && result.classification.length > 0 && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.sectionTitle}>Full Race Results</Text>
              <Text style={styles.positionCount}>{allResults.length} classified</Text>
            </View>

            {/* Podium highlight for top 3 */}
            <View style={styles.podiumRow}>
              {allResults.slice(0, 3).map((entry) => {
                const driver = getDriverById(entry.driverId);
                const team = driver ? getTeamById(driver.teamId) : undefined;
                if (!driver) return null;
                const isP1 = entry.position === 1;
                const isP2 = entry.position === 2;
                const medalColor = podiumColors[entry.position] || Colors.textMuted;
                return (
                  <View
                    key={entry.driverId}
                    style={[
                      styles.podiumCard,
                      isP1 && styles.podiumCardFirst,
                      isP2 && styles.podiumCardSecond,
                    ]}
                  >
                    <View style={[styles.podiumMedal, { backgroundColor: `${medalColor}20`, borderColor: medalColor }]}>
                      <Medal size={isP1 ? 22 : 18} color={medalColor} />
                    </View>
                    <Text style={[styles.podiumDriver, isP1 && styles.podiumDriverFirst]} numberOfLines={1}>
                      {driver.shortName}
                    </Text>
                    <View style={[styles.podiumTeamDot, { backgroundColor: team?.color || '#666' }]} />
                    <Text style={styles.podiumGap}>{entry.gap || entry.time || '—'}</Text>
                  </View>
                );
              })}
            </View>

            {/* Full classification table */}
            <View style={styles.resultsCard}>
              {/* Table header */}
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderPos}>POS</Text>
                <Text style={styles.tableHeaderDriver}>DRIVER</Text>
                <Text style={styles.tableHeaderGap}>GAP</Text>
                <Text style={styles.tableHeaderPts}>PTS</Text>
              </View>

              {allResults.map((entry, idx) => {
                const driver = getDriverById(entry.driverId);
                const team = driver ? getTeamById(driver.teamId) : undefined;
                if (!driver) return null;
                const predictedIndex = prediction?.top10.indexOf(entry.driverId) ?? -1;
                const wasCorrectPosition = predictedIndex === entry.position - 1;
                const isPodium = entry.position <= 3;
                const isDnf = entry.status === 'retired' || entry.status === 'dnf';
                const podiumColor = podiumColors[entry.position];

                return (
                  <View
                    key={entry.driverId}
                    style={[
                      styles.resultRow,
                      isPodium && { backgroundColor: `${podiumColor}08` },
                      isDnf && styles.resultRowDnf,
                      idx % 2 === 1 && !isPodium && styles.resultRowAlt,
                    ]}
                  >
                    {/* Position */}
                    <View style={styles.posCell}>
                      <Text style={[
                        styles.resultPos,
                        isPodium && { color: podiumColor, fontWeight: '800' as const },
                        isDnf && styles.resultPosDnf,
                      ]}>
                        {entry.position}
                      </Text>
                      {isPodium && (
                        <View style={[styles.posMedalBar, { backgroundColor: podiumColor }]} />
                      )}
                    </View>

                    {/* Driver */}
                    <View style={styles.driverCell}>
                      <View style={[styles.teamDot, { backgroundColor: team?.color || '#666' }]} />
                      <View style={styles.driverInfo}>
                        <Text style={[styles.resultDriver, isDnf && styles.resultDriverDnf]} numberOfLines={1}>
                          {driver.name}
                        </Text>
                        <Text style={styles.resultTeam}>{team?.shortName || ''}</Text>
                      </View>
                    </View>

                    {/* Gap */}
                    <Text style={[styles.gapText, isDnf && styles.gapTextDnf]} numberOfLines={1}>
                      {isDnf ? entry.status.toUpperCase() : (entry.gap || entry.time || '—')}
                    </Text>

                    {/* Points / Badges */}
                    <View style={styles.badgesCell}>
                      {entry.driverId === result.fastestLapDriverId && (
                        <View style={styles.flBadge}>
                          <Zap size={10} color={Colors.warning} />
                          <Text style={styles.flBadgeText}>FL</Text>
                        </View>
                      )}
                      {isDnf && (
                        <View style={styles.dnfTag}>
                          <Flag size={10} color={Colors.error} />
                          <Text style={styles.dnfTagText}>DNF</Text>
                        </View>
                      )}
                      {prediction && wasCorrectPosition && (
                        <View style={styles.correctBadge}>
                          <Check size={10} color={Colors.success} />
                        </View>
                      )}
                      {prediction && predictedIndex >= 0 && !wasCorrectPosition && (
                        <Text style={styles.predictedPosHint}>Y:P{predictedIndex + 1}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Sprint results section */}
        {race.hasSprint && sprintResults.length > 0 && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Zap size={14} color={Colors.info} />
                <Text style={styles.sectionTitle}>Sprint Results</Text>
              </View>
              <Text style={styles.positionCount}>{sprintResults.length} classified</Text>
            </View>

            <View style={styles.resultsCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderPos}>POS</Text>
                <Text style={styles.tableHeaderDriver}>DRIVER</Text>
                <Text style={styles.tableHeaderGap}>GAP</Text>
                <Text style={styles.tableHeaderPts}>PTS</Text>
              </View>

              {sprintResults.map((entry, idx) => {
                const driver = getDriverById(entry.driverId);
                const team = driver ? getTeamById(driver.teamId) : undefined;
                if (!driver) return null;
                const predictedIndex = prediction?.sprintTop8?.indexOf(entry.driverId) ?? -1;
                const wasCorrectPosition = predictedIndex === entry.position - 1;
                const isDnf = entry.status === 'retired' || entry.status === 'dnf';

                return (
                  <View
                    key={`sprint-${entry.driverId}`}
                    style={[
                      styles.resultRow,
                      isDnf && styles.resultRowDnf,
                      idx % 2 === 1 && styles.resultRowAlt,
                    ]}
                  >
                    <View style={styles.posCell}>
                      <Text style={[styles.resultPos, isDnf && styles.resultPosDnf]}>
                        {entry.position}
                      </Text>
                    </View>

                    <View style={styles.driverCell}>
                      <View style={[styles.teamDot, { backgroundColor: team?.color || '#666' }]} />
                      <View style={styles.driverInfo}>
                        <Text style={[styles.resultDriver, isDnf && styles.resultDriverDnf]} numberOfLines={1}>
                          {driver.name}
                        </Text>
                        <Text style={styles.resultTeam}>{team?.shortName || ''}</Text>
                      </View>
                    </View>

                    <Text style={[styles.gapText, isDnf && styles.gapTextDnf]} numberOfLines={1}>
                      {isDnf ? entry.status.toUpperCase() : (entry.gap || entry.time || '—')}
                    </Text>

                    <View style={styles.badgesCell}>
                      {entry.position <= 8 && (
                        <Text style={styles.predictedPosHint}>{SPRINT_POINTS[entry.position - 1]}pt</Text>
                      )}
                      {prediction && wasCorrectPosition && (
                        <View style={styles.correctBadge}>
                          <Check size={10} color={Colors.success} />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Sprint pick breakdown */}
        {prediction && prediction.sprintTop8 && prediction.sprintTop8.length > 0 && race.hasSprint && (
          <View style={styles.predictionSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Zap size={14} color={Colors.info} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Your Sprint Picks</Text>
              {sprintBreakdown && sprintBreakdown.totalPoints > 0 && (
                <View style={[styles.matchBadge, { marginLeft: 'auto' }]}>
                  <Trophy size={10} color={Colors.success} />
                  <Text style={styles.matchBadgeText}>+{sprintBreakdown.totalPoints}</Text>
                </View>
              )}
            </View>
            <View style={styles.predictionCard}>
              {prediction.sprintTop8.map((driverId, index) => {
                const driver = getDriverById(driverId);
                const team = driver ? getTeamById(driver.teamId) : undefined;
                if (!driver) return null;
                const actualPos = sprintResults.find(r => r.driverId === driverId);
                const isExactMatch = actualPos && actualPos.position === index + 1;
                const isInTop8 = !!actualPos && actualPos.position <= 8;

                return (
                  <View key={`sprint-pick-${driverId}`} style={[
                    styles.predictionRow,
                    isExactMatch && styles.predictionRowCorrect,
                  ]}>
                    <View style={[styles.teamDot, { backgroundColor: team?.color || '#666' }]} />
                    <Text style={styles.predictionPos}>S{index + 1}</Text>
                    <Text style={styles.predictionDriver}>{driver.name}</Text>
                    {sprintResults.length > 0 && (
                      <>
                        {isExactMatch && (
                          <View style={styles.matchBadge}>
                            <Check size={10} color={Colors.success} />
                            <Text style={styles.matchBadgeText}>+{SPRINT_POINTS[index]}</Text>
                          </View>
                        )}
                        {!isExactMatch && isInTop8 && actualPos && (
                          <Text style={styles.actualPosText}>Actual: S{actualPos.position}</Text>
                        )}
                        {!isInTop8 && (
                          <View style={styles.missBadge}>
                            <X size={10} color={Colors.error} />
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {prediction && (
          <View style={styles.predictionSection}>
            <Text style={styles.sectionTitle}>Your Prediction</Text>
            <View style={styles.predictionCard}>
              {prediction.top10.map((driverId, index) => {
                const driver = getDriverById(driverId);
                const team = driver ? getTeamById(driver.teamId) : undefined;
                if (!driver) return null;

                const actualPos = result?.classification.find(r => r.driverId === driverId);
                const isExactMatch = actualPos && actualPos.position === index + 1;
                const isInTop10 = !!actualPos;

                return (
                  <View key={driverId} style={[
                    styles.predictionRow,
                    isExactMatch && styles.predictionRowCorrect,
                  ]}>
                    <View style={[styles.teamDot, { backgroundColor: team?.color || '#666' }]} />
                    <Text style={styles.predictionPos}>P{index + 1}</Text>
                    <Text style={styles.predictionDriver}>{driver.name}</Text>
                    {result && result.classification.length > 0 && (
                      <>
                        {isExactMatch && (
                          <View style={styles.matchBadge}>
                            <Check size={10} color={Colors.success} />
                            <Text style={styles.matchBadgeText}>+{F1_POINTS[index]}</Text>
                          </View>
                        )}
                        {!isExactMatch && isInTop10 && actualPos && (
                          <Text style={styles.actualPosText}>Actual: P{actualPos.position}</Text>
                        )}
                        {!isInTop10 && (
                          <View style={styles.missBadge}>
                            <X size={10} color={Colors.error} />
                          </View>
                        )}
                      </>
                    )}
                    {prediction.fastestLap === driverId && (
                      <View style={styles.flBadge}>
                        <Text style={styles.flBadgeText}>FL</Text>
                      </View>
                    )}
                    {prediction.dnf === driverId && (
                      <View style={styles.dnfBadge}>
                        <Text style={styles.dnfBadgeText}>DNF</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {prediction.fastestLap && result && result.fastestLapDriverId && (
                <View style={styles.bonusRow}>
                  <Zap size={14} color={prediction.fastestLap === result.fastestLapDriverId ? Colors.warning : Colors.textMuted} />
                  <Text style={styles.bonusLabel}>Fastest Lap</Text>
                  <Text style={styles.bonusDriver}>
                    {getDriverById(prediction.fastestLap)?.name || prediction.fastestLap}
                  </Text>
                  {prediction.fastestLap === result.fastestLapDriverId ? (
                    <View style={styles.matchBadge}>
                      <Check size={10} color={Colors.success} />
                      <Text style={styles.matchBadgeText}>+{FASTEST_LAP_BONUS}</Text>
                    </View>
                  ) : (
                    <View style={styles.missBadge}>
                      <X size={10} color={Colors.error} />
                    </View>
                  )}
                </View>
              )}

              {prediction.dnf && result && result.dnfDriverIds.length > 0 && (
                <View style={styles.bonusRow}>
                  <AlertTriangle size={14} color={result.dnfDriverIds.includes(prediction.dnf) ? Colors.error : Colors.textMuted} />
                  <Text style={styles.bonusLabel}>DNF Pick</Text>
                  <Text style={styles.bonusDriver}>
                    {getDriverById(prediction.dnf)?.name || prediction.dnf}
                  </Text>
                  {result.dnfDriverIds.includes(prediction.dnf) ? (
                    <View style={styles.matchBadge}>
                      <Check size={10} color={Colors.success} />
                      <Text style={styles.matchBadgeText}>+{DNF_BONUS}</Text>
                    </View>
                  ) : (
                    <View style={styles.missBadge}>
                      <X size={10} color={Colors.error} />
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {race.status === 'completed' && !prediction && (
          <View style={styles.noPrediction}>
            <Text style={styles.noPredictionText}>
              You didn&apos;t make a prediction for this race.
            </Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Race Info</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Round</Text>
              <Text style={styles.infoValue}>{race.round} / 22</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Laps</Text>
              <Text style={styles.infoValue}>{race.totalLaps || '\u2014'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{race.status}</Text>
            </View>
            {race.winner && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Winner</Text>
                <Text style={[styles.infoValue, { color: Colors.warning }]}>{race.winner}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  raceHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  raceFlag: {
    fontSize: 48,
    marginBottom: 4,
  },
  raceName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  pointsCard: {
    backgroundColor: 'rgba(255, 184, 0, 0.08)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.2)',
    marginBottom: 20,
  },
  pointsCardContent: {
    alignItems: 'center',
    gap: 2,
  },
  pointsCardLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
  },
  pointsCardValue: {
    color: Colors.warning,
    fontSize: 40,
    fontWeight: '800' as const,
  },
  pointsBreakdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  breakdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  breakdownChipText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  zeroPointsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  zeroPointsText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  cancelledCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  cancelledTitle: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  cancelledText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center' as const,
  },
  upcomingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  upcomingTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  upcomingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  predictBtn: {
    backgroundColor: Colors.f1Red,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 6,
  },
  predictBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  positionCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  resultsSection: {
    marginBottom: 24,
  },
  podiumRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  podiumCardFirst: {
    borderColor: '#FFD70044',
    backgroundColor: '#FFD70008',
    flex: 1.2,
  },
  podiumCardSecond: {
    borderColor: '#C0C0C044',
    backgroundColor: '#C0C0C008',
  },
  podiumMedal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  podiumDriver: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  podiumDriverFirst: {
    fontSize: 14,
    color: '#FFD700',
  },
  podiumTeamDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  podiumGap: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surfaceHighlight,
  },
  tableHeaderPos: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    width: 36,
  },
  tableHeaderDriver: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    flex: 1,
  },
  tableHeaderGap: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    width: 72,
    textAlign: 'right' as const,
  },
  tableHeaderPts: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    width: 56,
    textAlign: 'right' as const,
  },
  resultsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultRowAlt: {
    backgroundColor: `${Colors.surfaceHighlight}40`,
  },
  resultRowDnf: {
    opacity: 0.65,
  },
  posCell: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 36,
    gap: 4,
  },
  posMedalBar: {
    width: 2,
    height: 20,
    borderRadius: 1,
  },
  resultPos: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700' as const,
    width: 22,
    textAlign: 'center' as const,
  },
  resultPosDnf: {
    color: Colors.error,
  },
  driverCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverInfo: {
    flex: 1,
  },
  resultDriver: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  resultDriverDnf: {
    color: Colors.textMuted,
  },
  resultTeam: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  gapText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
    width: 72,
    textAlign: 'right' as const,
  },
  gapTextDnf: {
    color: Colors.error,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  badgesCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    width: 64,
  },
  dnfTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Colors.error}18`,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dnfTagText: {
    color: Colors.error,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  correctBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictedPosHint: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '600' as const,
  },
  predictionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  predictionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  predictionRowCorrect: {
    backgroundColor: 'rgba(0, 200, 83, 0.06)',
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  predictionPos: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700' as const,
    width: 28,
  },
  predictionDriver: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 200, 83, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  matchBadgeText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  missBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 59, 59, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actualPosText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  bonusLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  bonusDriver: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
  },
  flBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flBadgeText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  dnfBadge: {
    backgroundColor: 'rgba(255, 59, 59, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dnfBadgeText: {
    color: Colors.error,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  noPrediction: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  noPredictionText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  infoSection: {
    marginBottom: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%' as any,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
