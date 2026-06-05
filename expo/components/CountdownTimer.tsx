import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Colors from '@/constants/colors';

interface CountdownTimerProps {
  targetDate: string;
  targetTime: string;
  compact?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const LOCK_MINUTES = 5;

function getTimeLeft(targetDate: string, targetTime: string): TimeLeft {
  const target = new Date(`${targetDate}T${targetTime}:00Z`);
  const lockTime = new Date(target.getTime() - LOCK_MINUTES * 60 * 1000);
  const now = new Date();
  const diff = lockTime.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function isLocked(targetDate: string, targetTime: string): boolean {
  const target = new Date(`${targetDate}T${targetTime}:00Z`);
  const lockTime = new Date(target.getTime() - LOCK_MINUTES * 60 * 1000);
  return new Date() >= lockTime;
}

export { isLocked };

export default function CountdownTimer({ targetDate, targetTime, compact }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft(targetDate, targetTime));
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate, targetTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate, targetTime]);

  useEffect(() => {
    if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 15) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [timeLeft.days, timeLeft.hours, pulseAnim]);

  const locked = isLocked(targetDate, targetTime);

  if (locked) {
    return (
      <View style={[styles.container, compact && styles.containerCompact, styles.lockedContainer]}>
        <Text style={styles.lockedText}>PREDICTIONS LOCKED</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <Animated.View style={[styles.container, styles.containerCompact, { opacity: pulseAnim }]}>
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
    <Animated.View style={[styles.container, { opacity: pulseAnim }]}>
      <Text style={styles.label}>PREDICTIONS LOCK IN</Text>
      <View style={styles.timerRow}>
        <TimeBlock value={timeLeft.days} unit="DAYS" />
        <Text style={styles.separator}>:</Text>
        <TimeBlock value={timeLeft.hours} unit="HRS" />
        <Text style={styles.separator}>:</Text>
        <TimeBlock value={timeLeft.minutes} unit="MIN" />
        <Text style={styles.separator}>:</Text>
        <TimeBlock value={timeLeft.seconds} unit="SEC" />
      </View>
    </Animated.View>
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
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
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
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'],
  },
  timeUnit: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 1,
    marginTop: 2,
  },
  separator: {
    color: Colors.f1Red,
    fontSize: 24,
    fontWeight: '700' as const,
    marginHorizontal: 4,
    marginBottom: 14,
  },
  compactText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'],
  },
});
