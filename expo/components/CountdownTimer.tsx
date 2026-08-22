import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import Colors from '@/constants/colors';

interface CountdownTimerProps {
  targetDate?: string;
  targetTime?: string;
  raceDate?: string;
  raceTime?: string;
  compact?: boolean;
  /** Accent color for separators and the label. Defaults to F1 red. */
  accentColor?: string;
  /** Overrides the default "PREDICTIONS LOCK IN" label. */
  label?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const LOCK_BEFORE_START_MINUTES = 0;

function buildTargetDate(targetDate?: string, targetTime?: string): Date | null {
  if (!targetDate || !targetTime) return null;

  const cleanDate = String(targetDate).trim();
  const cleanTime = String(targetTime).trim();

  if (!cleanDate || !cleanTime) return null;

  const timeWithSeconds =
    cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;

  const hasTimezone =
    timeWithSeconds.endsWith('Z') ||
    /[+-]\d{2}:?\d{2}$/.test(timeWithSeconds);

  const isoString = hasTimezone
    ? `${cleanDate}T${timeWithSeconds}`
    : `${cleanDate}T${timeWithSeconds}Z`;

  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function getLockTime(targetDate?: string, targetTime?: string): Date | null {
  const target = buildTargetDate(targetDate, targetTime);

  if (!target) return null;

  return new Date(
    target.getTime() - LOCK_BEFORE_START_MINUTES * 60 * 1000
  );
}

function getTimeLeft(targetDate?: string, targetTime?: string): TimeLeft {
  const lockTime = getLockTime(targetDate, targetTime);

  if (!lockTime) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const now = new Date();
  const diff = lockTime.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor(
      (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    ),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export function isLocked(targetDate?: string, targetTime?: string): boolean {
  const lockTime = getLockTime(targetDate, targetTime);

  if (!lockTime) return false;

  return new Date() >= lockTime;
}

export default function CountdownTimer({
  targetDate,
  targetTime,
  raceDate,
  raceTime,
  compact,
  accentColor,
  label,
}: CountdownTimerProps) {
  const finalDate = targetDate ?? raceDate;
  const finalTime = targetTime ?? raceTime;
  const accent = accentColor ?? Colors.f1Red;

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    getTimeLeft(finalDate, finalTime)
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const locked = useMemo(
    () => isLocked(finalDate, finalTime),
    [finalDate, finalTime, timeLeft]
  );

  useEffect(() => {
    setTimeLeft(getTimeLeft(finalDate, finalTime));

    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(finalDate, finalTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [finalDate, finalTime]);

  useEffect(() => {
    if (
      timeLeft.days === 0 &&
      timeLeft.hours === 0 &&
      timeLeft.minutes < 15 &&
      !locked
    ) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );

      pulse.start();

      return () => pulse.stop();
    }

    pulseAnim.setValue(1);
  }, [
    timeLeft.days,
    timeLeft.hours,
    timeLeft.minutes,
    locked,
    pulseAnim,
  ]);

  if (!finalDate || !finalTime) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Text style={styles.errorText}>Race time unavailable</Text>
      </View>
    );
  }

  if (locked) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedText}>PREDICTIONS LOCKED</Text>
        </View>
      </View>
    );
  }

  if (compact) {
    return (
      <Animated.View
        style={[
          styles.containerCompact,
          {
            opacity: pulseAnim,
          },
        ]}
      >
        <Text style={styles.compactText}>
          {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: accent }]}>
        {label ?? 'PREDICTIONS LOCK IN'}
      </Text>

      <Animated.View
        style={[
          styles.timerRow,
          {
            opacity: pulseAnim,
          },
        ]}
      >
        <TimeBlock value={timeLeft.days} unit="DAYS" accent={accent} />
        <Text style={[styles.separator, { color: accent }]}>:</Text>
        <TimeBlock value={timeLeft.hours} unit="HRS" accent={accent} />
        <Text style={[styles.separator, { color: accent }]}>:</Text>
        <TimeBlock value={timeLeft.minutes} unit="MIN" accent={accent} />
        <Text style={[styles.separator, { color: accent }]}>:</Text>
        <TimeBlock value={timeLeft.seconds} unit="SEC" accent={accent} />
      </Animated.View>
    </View>
  );
}

function TimeBlock({ value, unit, accent }: { value: number; unit: string; accent: string }) {
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeValue}>{String(value).padStart(2, '0')}</Text>
      <View style={[styles.timeUnitBar, { backgroundColor: accent }]} />
      <Text style={styles.timeUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  containerCompact: {
    paddingVertical: 4,
  },
  lockedContainer: {
    backgroundColor: 'rgba(225, 6, 0, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lockedText: {
    color: Colors.f1Red,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeBlock: {
    alignItems: 'center',
    minWidth: 58,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  timeValue: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeUnitBar: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginTop: 5,
    marginBottom: 5,
    opacity: 0.9,
  },
  timeUnit: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  separator: {
    color: Colors.f1Red,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 22,
  },
  compactText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});