import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Linking, Platform, Alert } from 'react-native';
import { MapPin, Clock, Trophy, Zap, PlayCircle, Flame, CheckCircle, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getSeriesConfig } from '@/constants/series';
import { useSeries } from '@/providers/SeriesProvider';
import { Race } from '@/types';
import AnimatedPressable from './AnimatedPressable';
import ChamferOverlay from './ChamferOverlay';

interface RaceCardProps {
  race: Race;
  onPress?: () => void;
  showStatus?: boolean;
  pointsEarned?: number;
  sprintPointsEarned?: number;
  hasPrediction?: boolean;
  /** Short names of the user's top picks (e.g. ["HAM", "RUS", "NOR"]) */
  pickNames?: string[];
  /** Short name of the user's fastest lap pick */
  fastestLapPickName?: string | null;
  /** Short name of the user's DNF pick */
  dnfPickName?: string | null;
}

export default React.memo(function RaceCard({ race, onPress, showStatus = true, pointsEarned, sprintPointsEarned, hasPrediction = false, pickNames, fastestLapPickName, dnfPickName }: RaceCardProps) {
  const { config, currentSeries } = useSeries();
  const seriesColors = config.colors;
  const isMotoGP = currentSeries === 'motogp';
  const raceDate = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
  const dateStr = raceDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = raceDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const statusColor =
    race.status === 'completed' ? Colors.success :
    race.status === 'live' ? seriesColors.primary :
    race.status === 'cancelled' ? Colors.textMuted :
    Colors.info;

  const statusLabel =
    race.status === 'completed' ? 'COMPLETED' :
    race.status === 'live' ? 'LIVE' :
    race.status === 'cancelled' ? 'CANCELLED' :
    'UPCOMING';

  const totalPoints = (pointsEarned ?? 0) + (sprintPointsEarned ?? 0);
  const shouldShowPoints = race.status === 'completed' && pointsEarned !== undefined;
  // MotoGP uses yellow highlight, F1 uses amber/warning
  const pointsColor = isMotoGP ? seriesColors.highlight : Colors.warning;
  // MotoGP cards: remove borderRadius/borderWidth so ChamferOverlay can draw true 45° chamfers
  const motogpCardOverrides = isMotoGP
    ? { borderRadius: 0, borderWidth: 0 }
    : {};
  const hasPicks = (pickNames && pickNames.length > 0) || !!fastestLapPickName || !!dnfPickName;
  const shouldShowPicks = race.status === 'completed' && hasPicks;
  const shouldShowPredictionSaved = hasPrediction && !shouldShowPoints && !shouldShowPicks;

  const handleWatchLive = useCallback(async () => {
    const seriesConfig = getSeriesConfig((race.seriesId as 'f1' | 'motogp') ?? 'f1');
    const url = seriesConfig.labels.watchUrl;
    try {
      const supported = Platform.OS === 'web' ? true : await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open', 'Could not open F1 TV link.');
      }
    } catch (e) {
      console.log('[RaceCard] open live link failed', e);
    }
  }, []);

  return (
    <AnimatedPressable onPress={onPress} style={[styles.card, motogpCardOverrides, race.hasSprint && !isMotoGP && styles.cardSprint]}>
      {race.hasSprint && (
        <View style={styles.sprintRibbon}>
          <Flame size={11} color={Colors.background} fill={Colors.background} />
          <Text style={styles.sprintRibbonText}>SPRINT WEEKEND</Text>
          <Flame size={11} color={Colors.background} fill={Colors.background} />
        </View>
      )}
      <View style={styles.cardBody}>
      <View style={[styles.roundBadge, { backgroundColor: seriesColors.surfaceHighlight }, race.hasSprint && styles.roundBadgeSprint]}>
        <Text style={[styles.roundText, race.hasSprint && styles.roundTextSprint]}>R{race.round}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.flag}>{race.countryFlag}</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.name} numberOfLines={1}>{race.name}</Text>
            <View style={styles.locationRow}>
              <MapPin size={10} color={Colors.textMuted} />
              <Text style={styles.location}>{race.location}, {race.country}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dateRow}>
            <Clock size={11} color={Colors.textSecondary} />
            <Text style={styles.dateText}>{dateStr} · {timeStr}</Text>
          </View>

          <View style={styles.badgeGroup}>
            {showStatus && (
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                {race.status === 'live' && <View style={[styles.liveDot, { backgroundColor: statusColor }]} />}
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {race.status === 'completed' && race.winner && (
          <View style={styles.winnerRow}>
            <Trophy size={11} color={pointsColor} />
            <Text style={[styles.winnerText, { color: pointsColor }]}>{race.winner}</Text>
          </View>
        )}

        {shouldShowPicks && (
          <View style={styles.picksSection}>
            {/* Points header */}
            <View style={styles.picksHeader}>
              <Trophy size={11} color={pointsColor} />
              <Text style={[styles.picksHeaderText, { color: pointsColor }]}>
                {totalPoints > 0 ? `+${totalPoints} pts` : '0 pts'}
              </Text>
            </View>

            {/* Compact picks row */}
            {pickNames && pickNames.length > 0 && (
              <View style={styles.picksRow}>
                {pickNames.slice(0, 5).map((name, i) => (
                  <View key={`pick-${i}`} style={styles.pickChip}>
                    <Text style={styles.pickChipPos}>P{i + 1}</Text>
                    <Text style={styles.pickChipName} numberOfLines={1}>{name}</Text>
                  </View>
                ))}
                {pickNames.length > 5 && (
                  <Text style={styles.picksMore}>+{pickNames.length - 5} more</Text>
                )}
              </View>
            )}

            {/* FL / DNF badges row */}
            {(fastestLapPickName || dnfPickName) && (
              <View style={styles.bonusPicksRow}>
                {fastestLapPickName && (
                  <View style={styles.bonusChip}>
                    <Zap size={9} color={pointsColor} />
                    <Text style={styles.bonusChipLabel}>FL</Text>
                    <Text style={styles.bonusChipName} numberOfLines={1}>{fastestLapPickName}</Text>
                  </View>
                )}
                {dnfPickName && (
                  <View style={styles.bonusChip}>
                    <AlertTriangle size={9} color={Colors.error} />
                    <Text style={styles.bonusChipLabel}>DNF</Text>
                    <Text style={styles.bonusChipName} numberOfLines={1}>{dnfPickName}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {shouldShowPoints && !shouldShowPicks && (
          <View style={styles.pointsRow}>
            <Zap size={11} color={pointsColor} />
            <Text style={[styles.pointsText, { color: pointsColor }]}>{totalPoints > 0 ? `+${totalPoints} pts earned` : '0 pts earned'}</Text>
          </View>
        )}

        {shouldShowPredictionSaved && (
          <View style={styles.predictionSavedRow}>
            <CheckCircle size={11} color={Colors.success} />
            <Text style={styles.predictionSavedText}>
              {race.status === 'completed' ? 'Prediction submitted' : 'Prediction saved'}
            </Text>
          </View>
        )}

        {race.status === 'live' && (
          <AnimatedPressable onPress={handleWatchLive} style={[styles.watchButton, { backgroundColor: seriesColors.primary }, isMotoGP && { borderRadius: 2 }]} testID="watch-live-button">
            <PlayCircle size={14} color={Colors.text} />
            <Text style={styles.watchText}>{isMotoGP ? 'Watch Live on MotoGP VideoPass' : 'Watch Live on F1 TV'}</Text>
          </AnimatedPressable>
        )}
      </View>
      </View>
      {/* 45° chamfered corners for MotoGP */}
      {isMotoGP && (
        <ChamferOverlay
          chamferSize={14}
          borderColor={race.hasSprint ? Colors.warning : seriesColors.border}
          borderWidth={race.hasSprint ? 1.5 : 1}
          surroundingColor={seriesColors.background}
        />
      )}
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cardSprint: {
    borderColor: Colors.warning,
    borderWidth: 1.5,
  },
  cardBody: {
    flexDirection: 'row',
  },
  sprintRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.warning,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  sprintRibbonText: {
    color: Colors.background,
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 1.2,
  },
  roundBadgeSprint: {
    backgroundColor: `${Colors.warning}22`,
  },
  roundTextSprint: {
    color: Colors.warning,
  },
  roundBadge: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
  },
  roundText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flag: {
    fontSize: 24,
  },
  titleContainer: {
    flex: 1,
  },
  name: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  location: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  winnerText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pointsText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  predictionSavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  predictionSavedText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.f1Red,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  watchText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  // Picks summary section
  picksSection: {
    backgroundColor: `${Colors.surfaceHighlight}60`,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 2,
  },
  picksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  picksHeaderText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  picksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickChipPos: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  pickChipName: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '600' as const,
    maxWidth: 50,
  },
  picksMore: {
    color: Colors.textMuted,
    fontSize: 10,
    alignSelf: 'center',
  },
  bonusPicksRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bonusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bonusChipLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  bonusChipName: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '600' as const,
    maxWidth: 60,
  },
});
