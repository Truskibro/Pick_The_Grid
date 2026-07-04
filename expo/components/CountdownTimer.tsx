import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import Colors from '@/constants/colors';

interface CountdownTimerProps {
  targetDate?: string;
  targetTime?: string;
  raceDate?: string;
  raceTime?: string;
  compact?: boolean;
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
}: CountdownTimerProps) {
  const finalDate = targetDate ?? raceDate;
  const finalTime = targetTime ?? raceTime;

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
      <Text style={styles.label}>PREDICTIONS LOCK IN</Text>

      <Animated.View
        style={[
          styles.timerRow,
          {
            opacity: pulseAnim,
          },
        ]}
      >
        <TimeBlock value={timeLeft.days} unit="DAYS" />
        <Text style={styles.separator}>:</Text>
        <TimeBlock value={timeLeft.hours} unit="HRS" />
        <Text style={styles.separator}>:</Text>
        <TimeBlock value={timeLeft.minutes} unit="MIN" />
        <Text style={styles.separator}>:</Text>
        <TimeBlock value={timeLeft.seconds} unit="SEC" />
      </Animated.View>
    </View>
  );
}

function TimeBlock({ value, unit }: { value: number; unit: string }) {
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeValue}>{String(value).padStart(2, '0')}</Text>
      <Text style={styles.timeUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
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
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBlock: {
    alignItems: 'center',
    minWidth: 52,
  },
  timeValue: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeUnit: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  separator: {
    color: Colors.f1Red,
    fontSize: 24,
    fontWeight: '700',
    marginHorizontal: 4,
    marginBottom: 14,
  },
  compactText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});