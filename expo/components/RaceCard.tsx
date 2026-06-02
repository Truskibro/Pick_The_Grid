import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Linking, Platform, Alert } from 'react-native';
import { MapPin, Clock, Trophy, Zap, PlayCircle, Flame } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Race } from '@/types';
import AnimatedPressable from './AnimatedPressable';

interface RaceCardProps {
  race: Race;
  onPress?: () => void;
  showStatus?: boolean;
  pointsEarned?: number;
}

export default React.memo(function RaceCard({ race, onPress, showStatus = true, pointsEarned }: RaceCardProps) {
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
    race.status === 'live' ? Colors.f1Red :
    race.status === 'cancelled' ? Colors.textMuted :
    Colors.info;

  const statusLabel =
    race.status === 'completed' ? 'COMPLETED' :
    race.status === 'live' ? 'LIVE' :
    race.status === 'cancelled' ? 'CANCELLED' :
    'UPCOMING';

  const handleWatchLive = useCallback(async () => {
    const url = 'https://f1tv.formula1.com/';
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
    <AnimatedPressable onPress={onPress} style={[styles.card, race.hasSprint && styles.cardSprint]}>
      {race.hasSprint && (
        <View style={styles.sprintRibbon}>
          <Flame size={11} color={Colors.background} fill={Colors.background} />
          <Text style={styles.sprintRibbonText}>SPRINT WEEKEND</Text>
          <Flame size={11} color={Colors.background} fill={Colors.background} />
        </View>
      )}
      <View style={styles.cardBody}>
      <View style={[styles.roundBadge, race.hasSprint && styles.roundBadgeSprint]}>
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
            <Trophy size={11} color={Colors.warning} />
            <Text style={styles.winnerText}>{race.winner}</Text>
          </View>
        )}

        {race.status === 'completed' && pointsEarned !== undefined && pointsEarned > 0 && (
          <View style={styles.pointsRow}>
            <Zap size={11} color={Colors.warning} />
            <Text style={styles.pointsText}>+{pointsEarned} pts earned</Text>
          </View>
        )}

        {race.status === 'live' && (
          <AnimatedPressable onPress={handleWatchLive} style={styles.watchButton} testID="watch-live-button">
            <PlayCircle size={14} color={Colors.text} />
            <Text style={styles.watchText}>Watch Live on F1 TV</Text>
          </AnimatedPressable>
        )}
      </View>
      </View>
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
});
