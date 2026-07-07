import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Zap, AlertTriangle, ChevronUp, ChevronDown, Plus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Driver } from '@/types';
import { useSeriesData } from '@/lib/useSeriesData';
import AnimatedPressable from './AnimatedPressable';

interface DriverCardProps {
  driver: Driver;
  position?: number;
  isFastestLap?: boolean;
  isDnf?: boolean;
  onPress?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleFastestLap?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  compact?: boolean;
  disabled?: boolean;
  selected?: boolean;
}

export default React.memo(function DriverCard({
  driver,
  position,
  isFastestLap,
  isDnf,
  onPress,
  onMoveUp,
  onMoveDown,
  onToggleFastestLap,
  isFirst,
  isLast,
  compact,
  disabled,
  selected,
}: DriverCardProps) {
  const { getTeamById } = useSeriesData();
  const team = getTeamById(driver.teamId);

  if (compact) {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.compactCard, disabled && styles.disabledCard]}
      >
        <View style={[styles.teamStripeCompact, { backgroundColor: team?.color || '#666' }]} />
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>{driver.name}</Text>
          <Text style={styles.compactTeam} numberOfLines={1}>{team?.shortName || ''}</Text>
        </View>
        <Text style={styles.compactPoints}>{driver.championshipPoints} pts</Text>
        <View style={styles.addIcon}>
          <Plus size={16} color="#FFF" />
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={[styles.teamStripe, { backgroundColor: team?.color || '#666' }]} />

      {onMoveUp && onMoveDown && !disabled && (
        <View style={styles.reorderControls}>
          <AnimatedPressable
            onPress={isFirst ? undefined : onMoveUp}
            style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
            scaleDown={0.8}
            disabled={isFirst}
          >
            <ChevronUp size={18} color={isFirst ? Colors.textMuted : Colors.textSecondary} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={isLast ? undefined : onMoveDown}
            style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
            scaleDown={0.8}
            disabled={isLast}
          >
            <ChevronDown size={18} color={isLast ? Colors.textMuted : Colors.textSecondary} />
          </AnimatedPressable>
        </View>
      )}

      <AnimatedPressable
        onPress={onPress}
        disabled={disabled}
        style={styles.cardBody}
        scaleDown={0.98}
      >
        {position !== undefined && (
          <View style={styles.positionBadge}>
            <Text style={[
              styles.positionText,
              position <= 3 && styles.positionTop3,
            ]}>{position}</Text>
          </View>
        )}

        <View style={styles.driverInfo}>
          <Text style={styles.driverName} numberOfLines={1}>{driver.name}</Text>
          <Text style={styles.teamName} numberOfLines={1}>{team?.shortName || ''}</Text>
        </View>

        <View style={styles.badges}>
          {isFastestLap && (
            <View style={[styles.chip, styles.fastestLapChip]}>
              <Zap size={10} color={Colors.warning} />
              <Text style={styles.chipText}>FL</Text>
            </View>
          )}
          {isDnf && (
            <View style={[styles.chip, styles.dnfChip]}>
              <AlertTriangle size={10} color={Colors.error} />
              <Text style={[styles.chipText, styles.dnfChipText]}>DNF</Text>
            </View>
          )}
        </View>
      </AnimatedPressable>

      {onToggleFastestLap && !disabled && (
        <AnimatedPressable
          onPress={onToggleFastestLap}
          style={[styles.flBtn, isFastestLap && styles.flBtnActive]}
          scaleDown={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
        >
          <Zap size={16} color={isFastestLap ? Colors.warning : Colors.textMuted} />
        </AnimatedPressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 64,
  },
  cardSelected: {
    borderColor: Colors.f1Red,
  },
  teamStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  teamStripeCompact: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  reorderControls: {
    paddingLeft: 6,
    paddingRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  reorderBtn: {
    width: 28,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
  },
  reorderBtnDisabled: {
    backgroundColor: 'transparent',
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  positionBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  positionTop3: {
    color: Colors.warning,
  },
  driverInfo: {
    flex: 1,
    paddingHorizontal: 6,
  },
  driverName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  teamName: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fastestLapChip: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
  },
  dnfChip: {
    backgroundColor: 'rgba(255, 59, 59, 0.15)',
  },
  chipText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  dnfChipText: {
    color: Colors.error,
  },
  flBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
    marginRight: 10,
  },
  flBtnActive: {
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 0,
    gap: 10,
    minHeight: 60,
  },
  disabledCard: {
    opacity: 0.4,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  compactTeam: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  compactPoints: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  addIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.f1Red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
