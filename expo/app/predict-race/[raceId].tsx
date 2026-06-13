import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Animated, Modal, Pressable, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Save, Check, Lock, AlertTriangle, X, Zap, ChevronUp, ChevronDown, Plus, Search, Trophy, Flag, Trash2, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useF1Data } from '@/providers/F1DataProvider';
import { F1_POINTS, SPRINT_POINTS, FASTEST_LAP_BONUS, DNF_BONUS, Driver } from '@/types';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import CountdownTimer, { isLocked } from '@/components/CountdownTimer';
import AnimatedPressable from '@/components/AnimatedPressable';
import { calculatePoints } from '@/lib/scoring';

type PickerMode = { type: 'fl' } | { type: 'dnf' } | null;

const PODIUM_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

const SPRINT_PODIUM_COLORS: Record<number, string> = {
  1: '#64D2FF',
  2: '#5E9EFF',
  3: '#5078E0',
};

export default function PredictRaceScreen() {
  const { raceId } = useLocalSearchParams<{ raceId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { getRaceById, drivers, getTeamById, getRaceResult } = useF1Data();
  const { savePrediction, getPrediction } = useGame();
  const { isGuest } = useUser();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const race = raceId ? getRaceById(raceId) : undefined;
  const raceResult = raceId ? getRaceResult(raceId) : undefined;
  const raceIsCompleted = race?.status === 'completed';

  const existingPrediction = race ? getPrediction(race.id) : undefined;

  // Compute scoring breakdown when race is completed and results exist
  const completedBreakdown = useMemo(() => {
    if (!raceIsCompleted || !existingPrediction || !raceResult || raceResult.classification.length === 0) return null;
    return calculatePoints(existingPrediction, raceResult);
  }, [raceIsCompleted, existingPrediction, raceResult]);

  const completedPoints = (existingPrediction?.pointsEarned ?? 0) + (existingPrediction?.sprintPointsEarned ?? 0);

  // Set the navigation title to the race name
  useEffect(() => {
    if (race) {
      navigation.setOptions({ title: race.name });
    }
  }, [race, navigation]);

  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(existingPrediction?.top10 || []);
  const [sprintTop8, setSprintTop8] = useState<string[]>(existingPrediction?.sprintTop8 || []);
  const [fastestLap, setFastestLap] = useState<string | null>(existingPrediction?.fastestLap || null);
  const [dnf, setDnf] = useState<string | null>(existingPrediction?.dnf || null);
  const [saved, setSaved] = useState<boolean>(false);
  const [lastSyncedPredId, setLastSyncedPredId] = useState<string | null>(null);
  const [lastSyncedRaceId, setLastSyncedRaceId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerMode>(null);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    if (!race) return;
    if (existingPrediction) {
      const predKey = existingPrediction.id + '_' + existingPrediction.updatedAt;
      if (lastSyncedPredId !== predKey || lastSyncedRaceId !== race.id) {
        setSelectedDrivers(existingPrediction.top10 || []);
        setSprintTop8(existingPrediction.sprintTop8 || []);
        setFastestLap(existingPrediction.fastestLap || null);
        setDnf(existingPrediction.dnf || null);
        setLastSyncedPredId(predKey);
        setLastSyncedRaceId(race.id);
        setSaved(true);
      }
    } else if (lastSyncedRaceId !== race.id) {
      setSelectedDrivers([]);
      setSprintTop8([]);
      setFastestLap(null);
      setDnf(null);
      setLastSyncedPredId(null);
      setLastSyncedRaceId(race.id);
      setSaved(false);
    }
  }, [existingPrediction, race, lastSyncedPredId, lastSyncedRaceId]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const locked = race ? isLocked(race.raceDate, race.raceTime) : true;

  const potentialPoints = useMemo(() => {
    let points = 0;
    selectedDrivers.forEach((_, i) => {
      if (i < F1_POINTS.length) points += F1_POINTS[i];
    });
    if (fastestLap) points += FASTEST_LAP_BONUS;
    if (dnf) points += DNF_BONUS;
    return points;
  }, [selectedDrivers, fastestLap, dnf]);

  const sprintPotentialPoints = useMemo(() => {
    let points = 0;
    sprintTop8.forEach((_, i) => {
      if (i < SPRINT_POINTS.length) points += SPRINT_POINTS[i];
    });
    return points;
  }, [sprintTop8]);

  const driverById = useCallback((id: string) => drivers.find(d => d.id === id), [drivers]);

  const addDriverToNextSlot = useCallback((driverId: string) => {
    if (locked) return;
    if (selectedDrivers.includes(driverId)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedDrivers(prev => prev.filter(id => id !== driverId));
      if (fastestLap === driverId) setFastestLap(null);
      setSaved(false);
      return;
    }
    if (selectedDrivers.length >= 10) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Grid Full', 'Remove a driver from your grid first.');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDrivers(prev => [...prev, driverId]);
    setSaved(false);
  }, [locked, selectedDrivers, fastestLap]);

  const removeDriver = useCallback((driverId: string) => {
    if (locked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedDrivers(prev => prev.filter(id => id !== driverId));
    if (fastestLap === driverId) setFastestLap(null);
    setSaved(false);
  }, [locked, fastestLap]);

  const moveDriver = useCallback((index: number, direction: 'up' | 'down') => {
    if (locked) return;
    void Haptics.selectionAsync();
    setSelectedDrivers(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }, [locked]);

  const addDriverToSprintSlot = useCallback((driverId: string) => {
    if (locked) return;
    if (sprintTop8.includes(driverId)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSprintTop8(prev => prev.filter(id => id !== driverId));
      setSaved(false);
      return;
    }
    if (sprintTop8.length >= 8) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Sprint Grid Full', 'Remove a driver from your sprint grid first.');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSprintTop8(prev => [...prev, driverId]);
    setSaved(false);
  }, [locked, sprintTop8]);

  const removeSprintDriver = useCallback((driverId: string) => {
    if (locked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSprintTop8(prev => prev.filter(id => id !== driverId));
    setSaved(false);
  }, [locked]);

  const moveSprintDriver = useCallback((index: number, direction: 'up' | 'down') => {
    if (locked) return;
    void Haptics.selectionAsync();
    setSprintTop8(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }, [locked]);

  const clearSprint = useCallback(() => {
    if (locked) return;
    Alert.alert('Clear Sprint Grid', 'Remove all your sprint picks?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setSprintTop8([]);
          setSaved(false);
        },
      },
    ]);
  }, [locked]);

  const selectFastestLap = useCallback((driverId: string) => {
    if (locked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFastestLap(prev => prev === driverId ? null : driverId);
    setSaved(false);
  }, [locked]);

  const selectDnf = useCallback((driverId: string) => {
    if (locked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDnf(prev => prev === driverId ? null : driverId);
    setSaved(false);
  }, [locked]);

  const clearAll = useCallback(() => {
    if (locked) return;
    Alert.alert('Clear Grid', 'Remove all your picks?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setSelectedDrivers([]);
          setFastestLap(null);
          setDnf(null);
          setSaved(false);
        },
      },
    ]);
  }, [locked]);

  const handleSave = useCallback(async () => {
    if (!race) {
      Alert.alert('Error', 'Race data is not available.');
      return;
    }
    if (selectedDrivers.length === 0) {
      Alert.alert('Cannot Save', 'Please select at least one driver for the race grid.');
      return;
    }
    const existing = getPrediction(race.id);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result = await savePrediction({
        raceId: race.id,
        top10: selectedDrivers,
        fastestLap,
        dnf,
        pointsEarned: existing?.pointsEarned ?? 0,
        sprintTop8: sprintTop8,
        sprintPointsEarned: existing?.sprintPointsEarned ?? 0,
        username: existing?.username ?? null,
        displayName: existing?.displayName ?? null,
      });
      setSaved(true);

      if (result.synced) {
        Alert.alert('Prediction Saved!', 'Your prediction has been saved and synced to the cloud.');
      } else if (isGuest) {
        Alert.alert('Prediction Saved!', 'Saved on this device. Set up your profile to sync to cloud.');
      } else {
        Alert.alert(
          'Prediction Saved Locally',
          'Could not sync to cloud. Your session may have expired.\n\nTo fix: go to Settings > Sign Out, then sign back in.',
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      console.log('[handleSave] Error:', e?.message || e);
      Alert.alert('Save Failed', 'An unexpected error occurred. Please try again.');
    }
  }, [race, selectedDrivers, sprintTop8, fastestLap, dnf, savePrediction, getPrediction, isGuest]);

  const openPicker = useCallback((mode: PickerMode) => {
    if (locked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearch('');
    setPicker(mode);
  }, [locked]);

  const closePicker = useCallback(() => setPicker(null), []);

  const pickerDrivers = useMemo(() => {
    if (!picker) return [];
    const all = [...drivers].sort((a, b) => b.championshipPoints - a.championshipPoints);
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(d => {
      const team = getTeamById(d.teamId);
      return d.name.toLowerCase().includes(q) || (team?.shortName.toLowerCase().includes(q) ?? false);
    });
  }, [picker, drivers, search, getTeamById]);

  const handlePickerSelect = useCallback((driverId: string) => {
    if (!picker) return;
    if (picker.type === 'fl') selectFastestLap(driverId);
    else selectDnf(driverId);
    closePicker();
  }, [picker, selectFastestLap, selectDnf, closePicker]);

  const sortedPoolDrivers = useMemo(() => {
    return [...drivers]
      .filter(d => !selectedDrivers.includes(d.id))
      .sort((a, b) => b.championshipPoints - a.championshipPoints);
  }, [drivers, selectedDrivers]);

  const sortedSprintPoolDrivers = useMemo(() => {
    return [...drivers]
      .filter(d => !sprintTop8.includes(d.id))
      .sort((a, b) => b.championshipPoints - a.championshipPoints);
  }, [drivers, sprintTop8]);

  if (!race) {
    return (
      <View style={styles.emptyContainer}>
        <Trophy size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Race Not Found</Text>
        <Text style={styles.emptyText}>This race could not be found.</Text>
      </View>
    );
  }

  const filledCount = selectedDrivers.length;
  const progress = filledCount / 10;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <LinearGradient
            colors={['rgba(225, 6, 0, 0.18)', 'rgba(225, 6, 0, 0.02)', 'transparent']}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroLeft}>
                <Text style={styles.targetLabel}>PREDICTING</Text>
                <Text style={styles.raceName} numberOfLines={2}>{race.name}</Text>
                <View style={styles.heroLocationRow}>
                  <Text style={styles.heroFlag}>{race.countryFlag}</Text>
                  <Text style={styles.heroLocation}>{race.location}</Text>
                </View>
              </View>
              <View style={styles.roundBadge}>
                <Text style={styles.roundBadgeLabel}>R{race.round}</Text>
              </View>
            </View>

            <View style={styles.countdownWrap}>
              <CountdownTimer targetDate={race.raceDate} targetTime={race.raceTime} compact />
            </View>

            {locked && !raceIsCompleted && (
              <View style={styles.lockedBanner}>
                <Lock size={14} color={Colors.f1Red} />
                <Text style={styles.lockedText}>Predictions locked for this race</Text>
              </View>
            )}

            {raceIsCompleted && completedBreakdown && (
              <View style={styles.completedBanner}>
                <View style={styles.completedBannerTop}>
                  <Trophy size={18} color={Colors.warning} />
                  <View style={styles.completedBannerPoints}>
                    <Text style={styles.completedBannerValue}>{completedPoints}</Text>
                    <Text style={styles.completedBannerLabel}>PTS EARNED</Text>
                  </View>
                </View>
                <View style={styles.completedBannerBreakdown}>
                  {completedBreakdown.positionPoints > 0 && (
                    <View style={styles.breakdownChipMini}>
                      <Flag size={9} color={Colors.info} />
                      <Text style={styles.breakdownChipMiniText}>Pos +{completedBreakdown.positionPoints}</Text>
                    </View>
                  )}
                  {completedBreakdown.fastestLapPoints > 0 && (
                    <View style={styles.breakdownChipMini}>
                      <Zap size={9} color={Colors.warning} />
                      <Text style={styles.breakdownChipMiniText}>FL +{completedBreakdown.fastestLapPoints}</Text>
                    </View>
                  )}
                  {completedBreakdown.dnfPoints > 0 && (
                    <View style={styles.breakdownChipMini}>
                      <AlertTriangle size={9} color={Colors.error} />
                      <Text style={styles.breakdownChipMiniText}>DNF +{completedBreakdown.dnfPoints}</Text>
                    </View>
                  )}
                </View>
                <AnimatedPressable
                  style={styles.completedViewBtn}
                  onPress={() => router.push(`/race-results/${race.id}` as any)}
                  scaleDown={0.97}
                >
                  <Text style={styles.completedViewBtnText}>View Full Results</Text>
                  <ChevronRight size={14} color={Colors.f1Red} />
                </AnimatedPressable>
              </View>
            )}

            {raceIsCompleted && !completedBreakdown && (
              <View style={styles.completedBanner}>
                <View style={styles.completedBannerTop}>
                  <Trophy size={18} color={Colors.textMuted} />
                  <View style={styles.completedBannerPoints}>
                    <Text style={[styles.completedBannerValue, { color: Colors.textMuted }]}>0</Text>
                    <Text style={styles.completedBannerLabel}>PTS EARNED</Text>
                  </View>
                </View>
                <AnimatedPressable
                  style={styles.completedViewBtn}
                  onPress={() => router.push(`/race-results/${race.id}` as any)}
                  scaleDown={0.97}
                >
                  <Text style={styles.completedViewBtnText}>View Race Results</Text>
                  <ChevronRight size={14} color={Colors.f1Red} />
                </AnimatedPressable>
              </View>
            )}
          </LinearGradient>

          {/* Stats tiles */}
          <View style={styles.statsRow}>
            <StatTile
              label="POINTS"
              value={String(potentialPoints)}
              accent={Colors.warning}
              icon={<Trophy size={14} color={Colors.warning} />}
            />
            <StatTile
              label="GRID"
              value={`${filledCount}/10`}
              accent={Colors.info}
              icon={<Flag size={14} color={Colors.info} />}
              progress={progress}
            />
            <StatTile
              label="FL"
              value={fastestLap ? (driverById(fastestLap)?.name.split(' ').slice(-1)[0] ?? '—') : '—'}
              accent={Colors.warning}
              icon={<Zap size={14} color={Colors.warning} />}
              compact
            />
            <StatTile
              label="DNF"
              value={dnf ? (driverById(dnf)?.name.split(' ').slice(-1)[0] ?? '—') : '—'}
              accent={Colors.error}
              icon={<AlertTriangle size={14} color={Colors.error} />}
              compact
            />
            {race.hasSprint && (
              <StatTile
                label="SPRINT"
                value={String(sprintPotentialPoints)}
                accent={Colors.info}
                icon={<Zap size={14} color={Colors.info} />}
                compact
              />
            )}
          </View>

          {/* Grid */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Starting Grid</Text>
                <Text style={styles.sectionSubtitle}>Tap a driver below to add · arrows to reorder</Text>
              </View>
              {!locked && filledCount > 0 && (
                <AnimatedPressable onPress={clearAll} style={styles.clearBtn} scaleDown={0.92}>
                  <Trash2 size={13} color={Colors.textSecondary} />
                  <Text style={styles.clearBtnText}>Clear</Text>
                </AnimatedPressable>
              )}
            </View>

            <View style={styles.gridList}>
              {Array.from({ length: 10 }).map((_, i) => {
                const driverId = selectedDrivers[i];
                const driver = driverId ? driverById(driverId) : undefined;
                const team = driver ? getTeamById(driver.teamId) : undefined;
                const isFL = driver?.id === fastestLap;
                const isDnf = driver?.id === dnf;
                const position = i + 1;
                const podiumColor = PODIUM_COLORS[position];

                return (
                  <GridSlot
                    key={`slot-${i}`}
                    position={position}
                    podiumColor={podiumColor}
                    driver={driver}
                    teamColor={team?.color}
                    teamName={team?.shortName}
                    isFL={isFL}
                    isDnf={isDnf}
                    locked={locked}
                    isFirst={i === 0}
                    isLast={i === filledCount - 1}
                    onRemove={() => driver && removeDriver(driver.id)}
                    onMoveUp={() => moveDriver(i, 'up')}
                    onMoveDown={() => moveDriver(i, 'down')}
                    onToggleFL={() => driver && selectFastestLap(driver.id)}
                  />
                );
              })}
            </View>
          </View>

          {/* Driver pool */}
          {!locked && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Drivers</Text>
                  <Text style={styles.sectionSubtitle}>Tap to add to grid · tap again to remove</Text>
                </View>
              </View>

              <View style={styles.poolGrid}>
                {sortedPoolDrivers.map((d) => {
                  const t = getTeamById(d.teamId);
                  return (
                    <AnimatedPressable
                      key={d.id}
                      onPress={() => addDriverToNextSlot(d.id)}
                      style={styles.poolCard}
                      scaleDown={0.95}
                    >
                      <View style={[styles.poolStripe, { backgroundColor: t?.color || '#666' }]} />
                      <View style={styles.poolCardContent}>
                        <Text style={styles.poolDriverName} numberOfLines={1}>{d.name}</Text>
                        <Text style={styles.poolTeamName} numberOfLines={1}>{t?.shortName || ''}</Text>
                      </View>
                      <View style={styles.poolBadge}>
                        <Plus size={14} color={Colors.text} />
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Sprint Grid — only for sprint weekends */}
          {race.hasSprint && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Sprint Grid</Text>
                  <Text style={styles.sectionSubtitle}>Predict top 8 · 1st = 8pts, 8th = 1pt</Text>
                </View>
                {!locked && sprintTop8.length > 0 && (
                  <AnimatedPressable onPress={clearSprint} style={styles.clearBtn} scaleDown={0.92}>
                    <Trash2 size={13} color={Colors.textSecondary} />
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </AnimatedPressable>
                )}
              </View>

              <View style={styles.gridList}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const driverId = sprintTop8[i];
                  const driver = driverId ? driverById(driverId) : undefined;
                  const team = driver ? getTeamById(driver.teamId) : undefined;
                  const position = i + 1;
                  const sprintColor = position <= 3 ? SPRINT_PODIUM_COLORS[position] : undefined;

                  return (
                    <SprintGridSlot
                      key={`sprint-slot-${i}`}
                      position={position}
                      sprintColor={sprintColor}
                      driver={driver}
                      teamColor={team?.color}
                      teamName={team?.shortName}
                      locked={locked}
                      isFirst={i === 0}
                      isLast={i === sprintTop8.length - 1}
                      onRemove={() => driver && removeSprintDriver(driver.id)}
                      onMoveUp={() => moveSprintDriver(i, 'up')}
                      onMoveDown={() => moveSprintDriver(i, 'down')}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Sprint driver pool */}
          {race.hasSprint && !locked && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Sprint Drivers</Text>
                  <Text style={styles.sectionSubtitle}>Tap to add to sprint grid · tap again to remove</Text>
                </View>
              </View>

              <View style={styles.poolGrid}>
                {sortedSprintPoolDrivers.map((d) => {
                  const t = getTeamById(d.teamId);
                  return (
                    <AnimatedPressable
                      key={d.id}
                      onPress={() => addDriverToSprintSlot(d.id)}
                      style={styles.poolCard}
                      scaleDown={0.95}
                    >
                      <View style={[styles.poolStripe, { backgroundColor: t?.color || '#666' }]} />
                      <View style={styles.poolCardContent}>
                        <Text style={styles.poolDriverName} numberOfLines={1}>{d.name}</Text>
                        <Text style={styles.poolTeamName} numberOfLines={1}>{t?.shortName || ''}</Text>
                      </View>
                      <View style={styles.poolBadge}>
                        <Plus size={14} color={Colors.text} />
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Fastest Lap */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Fastest Lap</Text>
                <Text style={styles.sectionSubtitle}>+{FASTEST_LAP_BONUS} pts if correct · any driver eligible</Text>
              </View>
            </View>

            {fastestLap ? (() => {
              const d = driverById(fastestLap);
              const t = d ? getTeamById(d.teamId) : undefined;
              if (!d) return null;
              return (
                <View style={styles.flSelectedRow}>
                  <View style={[styles.teamStripe, { backgroundColor: t?.color || '#666' }]} />
                  <View style={styles.flSelectedContent}>
                    <View style={styles.flIconBubble}>
                      <Zap size={16} color={Colors.warning} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.flDriverName}>{d.name}</Text>
                      <Text style={styles.flDriverTeam}>{t?.shortName || ''}</Text>
                    </View>
                    {!locked && (
                      <AnimatedPressable onPress={() => selectFastestLap(d.id)} style={styles.flRemoveBtn} scaleDown={0.85}>
                        <X size={16} color={Colors.textSecondary} />
                      </AnimatedPressable>
                    )}
                  </View>
                </View>
              );
            })() : (
              <AnimatedPressable
                onPress={() => openPicker({ type: 'fl' })}
                style={styles.flPickBtn}
                scaleDown={0.97}
                disabled={locked}
              >
                <View style={styles.flPickLeft}>
                  <View style={styles.flPickIcon}>
                    <Zap size={18} color={Colors.warning} />
                  </View>
                  <View style={styles.flPickContent}>
                    <Text style={styles.flPickText}>Pick Fastest Lap</Text>
                    <Text style={styles.flPickHint}>Tap to select</Text>
                  </View>
                </View>
                <View style={styles.flPickChevron}>
                  <Plus size={18} color={Colors.warning} />
                </View>
              </AnimatedPressable>
            )}
          </View>

          {/* DNF */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>DNF Pick</Text>
                <Text style={styles.sectionSubtitle}>+{DNF_BONUS} pts if correct · any driver eligible</Text>
              </View>
            </View>

            {dnf ? (() => {
              const d = driverById(dnf);
              const t = d ? getTeamById(d.teamId) : undefined;
              if (!d) return null;
              return (
                <View style={styles.dnfSelectedRow}>
                  <View style={[styles.teamStripe, { backgroundColor: t?.color || '#666' }]} />
                  <View style={styles.dnfSelectedContent}>
                    <View style={styles.dnfIconBubble}>
                      <AlertTriangle size={16} color={Colors.error} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.dnfDriverName}>{d.name}</Text>
                      <Text style={styles.dnfDriverTeam}>{t?.shortName || ''}</Text>
                    </View>
                    {!locked && (
                      <AnimatedPressable onPress={() => selectDnf(d.id)} style={styles.dnfRemoveBtn} scaleDown={0.85}>
                        <X size={16} color={Colors.textSecondary} />
                      </AnimatedPressable>
                    )}
                  </View>
                </View>
              );
            })() : (
              <AnimatedPressable
                onPress={() => openPicker({ type: 'dnf' })}
                style={styles.dnfPickBtn}
                scaleDown={0.97}
                disabled={locked}
              >
                <View style={styles.dnfPickLeft}>
                  <View style={styles.dnfPickIcon}>
                    <AlertTriangle size={18} color={Colors.error} />
                  </View>
                  <View style={styles.dnfPickContent}>
                    <Text style={styles.dnfPickText}>Pick DNF Driver</Text>
                    <Text style={styles.dnfPickHint}>Tap to select</Text>
                  </View>
                </View>
                <View style={styles.dnfPickChevron}>
                  <Plus size={18} color={Colors.error} />
                </View>
              </AnimatedPressable>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Sticky save bar */}
        {!locked && (
          <View style={styles.saveBar}>
            <View style={styles.saveBarInfo}>
              <Text style={styles.saveBarLabel}>POTENTIAL</Text>
              <Text style={styles.saveBarPoints}>{potentialPoints + sprintPotentialPoints} pts</Text>
            </View>
            <AnimatedPressable onPress={handleSave} style={styles.saveButton} scaleDown={0.96}>
              <LinearGradient
                colors={saved ? [Colors.success, '#1E8E3E'] : [Colors.f1Red, Colors.f1RedDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveGradient}
              >
                {saved ? <Check size={18} color="#FFF" /> : <Save size={18} color="#FFF" />}
                <Text style={styles.saveText}>{saved ? 'Saved' : 'Save Prediction'}</Text>
              </LinearGradient>
            </AnimatedPressable>
          </View>
        )}
      </Animated.View>

      {/* FL / DNF picker modal */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {picker?.type === 'fl' ? 'Pick Fastest Lap' : 'Pick DNF Driver'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {picker?.type === 'fl' ? 'Who sets the fastest lap?' : 'Any driver you think won\u2019t finish'}
                </Text>
              </View>
              <AnimatedPressable onPress={closePicker} style={styles.modalCloseBtn} scaleDown={0.85}>
                <X size={18} color={Colors.text} />
              </AnimatedPressable>
            </View>

            <View style={styles.searchWrap}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search drivers or teams"
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={10}>
                  <X size={14} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {pickerDrivers.length === 0 && (
                <Text style={styles.modalEmpty}>No drivers found</Text>
              )}
              {pickerDrivers.map((d, idx) => {
                const t = getTeamById(d.teamId);
                const isCurrentSelection = picker?.type === 'fl' ? fastestLap === d.id : dnf === d.id;
                return (
                  <AnimatedPressable
                    key={d.id}
                    onPress={() => handlePickerSelect(d.id)}
                    style={[styles.pickerRow, isCurrentSelection && styles.pickerRowActive]}
                    scaleDown={0.98}
                  >
                    <View style={[styles.pickerStripe, { backgroundColor: t?.color || '#666' }]} />
                    <Text style={styles.pickerRank}>{idx + 1}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.pickerName}>{d.name}</Text>
                      <Text style={styles.pickerTeam}>{t?.shortName || ''} · {d.championshipPoints} pts</Text>
                    </View>
                    {isCurrentSelection ? (
                      <View style={styles.pickerCheck}>
                        <Check size={14} color="#FFF" />
                      </View>
                    ) : (
                      <View style={styles.pickerAdd}>
                        <Plus size={14} color={Colors.text} />
                      </View>
                    )}
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------- Reusable sub-components ----------

interface StatTileProps {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
  progress?: number;
  compact?: boolean;
}

const StatTile = React.memo(function StatTile({ label, value, accent, icon, progress, compact }: StatTileProps) {
  return (
    <View style={[styles.statTile, compact && styles.statTileCompact]}>
      <View style={styles.statTileHeader}>
        {icon}
        <Text style={[styles.statTileLabel, { color: accent }]}>{label}</Text>
      </View>
      <Text style={styles.statTileValue} numberOfLines={1}>{value}</Text>
      {progress !== undefined && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: accent }]} />
        </View>
      )}
    </View>
  );
});

interface GridSlotProps {
  position: number;
  podiumColor?: string;
  driver?: Driver;
  teamColor?: string;
  teamName?: string;
  isFL: boolean;
  isDnf: boolean;
  locked: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleFL: () => void;
}

const GridSlot = React.memo(function GridSlot({
  position, podiumColor, driver, teamColor, teamName, isFL, isDnf,
  locked, isFirst, isLast, onRemove, onMoveUp, onMoveDown, onToggleFL,
}: GridSlotProps) {
  if (!driver) {
    return (
      <View style={[styles.slotEmpty, podiumColor ? { borderColor: podiumColor + '55' } : null]}>
        <View style={[styles.positionBadge, podiumColor ? { backgroundColor: podiumColor + '22', borderColor: podiumColor } : null]}>
          <Text style={[styles.positionText, podiumColor ? { color: podiumColor } : null]}>P{position}</Text>
        </View>
        <View style={styles.slotEmptyContent}>
          <Text style={styles.slotEmptyText}>Empty</Text>
          <Text style={styles.slotEmptyHint}>Add a driver below</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.slotFilled, podiumColor ? { borderColor: podiumColor + '55' } : null]}>
      <View style={[styles.teamStripe, { backgroundColor: teamColor || '#666' }]} />

      <View style={[styles.positionBadge, podiumColor ? { backgroundColor: podiumColor + '22', borderColor: podiumColor } : null]}>
        <Text style={[styles.positionText, podiumColor ? { color: podiumColor } : null]}>P{position}</Text>
      </View>

      <View style={styles.slotDriverInfo}>
        <Text style={styles.slotDriverName} numberOfLines={1}>{driver.name}</Text>
        <View style={styles.slotMetaRow}>
          <Text style={styles.slotTeamName} numberOfLines={1}>{teamName || ''}</Text>
          {isFL && (
            <View style={styles.miniBadge}>
              <Zap size={9} color={Colors.warning} />
              <Text style={styles.miniBadgeText}>FL</Text>
            </View>
          )}
        </View>
      </View>

      {!locked && (
        <View style={styles.slotActions}>
          <AnimatedPressable
            onPress={onToggleFL}
            style={[styles.actionBtn, isFL && styles.actionBtnActiveFL]}
            scaleDown={0.85}
            hitSlop={6}
          >
            <Zap size={14} color={isFL ? Colors.warning : Colors.textSecondary} />
          </AnimatedPressable>

          <View style={styles.reorderStack}>
            <AnimatedPressable
              onPress={isFirst ? undefined : onMoveUp}
              style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
              scaleDown={0.8}
              disabled={isFirst}
              hitSlop={4}
            >
              <ChevronUp size={14} color={isFirst ? Colors.textMuted : Colors.text} />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={isLast ? undefined : onMoveDown}
              style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
              scaleDown={0.8}
              disabled={isLast}
              hitSlop={4}
            >
              <ChevronDown size={14} color={isLast ? Colors.textMuted : Colors.text} />
            </AnimatedPressable>
          </View>

          <AnimatedPressable onPress={onRemove} style={styles.actionBtn} scaleDown={0.85} hitSlop={6}>
            <X size={14} color={Colors.textSecondary} />
          </AnimatedPressable>
        </View>
      )}

      {isDnf && (
        <View style={styles.dnfRibbon}>
          <AlertTriangle size={9} color={Colors.error} />
          <Text style={styles.dnfRibbonText}>DNF</Text>
        </View>
      )}
    </View>
  );
});

interface SprintGridSlotProps {
  position: number;
  sprintColor?: string;
  driver?: Driver;
  teamColor?: string;
  teamName?: string;
  locked: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SprintGridSlot = React.memo(function SprintGridSlot({
  position, sprintColor, driver, teamColor, teamName,
  locked, isFirst, isLast, onRemove, onMoveUp, onMoveDown,
}: SprintGridSlotProps) {
  const pointValue = SPRINT_POINTS[position - 1] ?? 0;

  if (!driver) {
    return (
      <View style={[styles.slotEmpty, sprintColor ? { borderColor: sprintColor + '55' } : null]}>
        <View style={[styles.positionBadge, sprintColor ? { backgroundColor: sprintColor + '22', borderColor: sprintColor } : null]}>
          <Text style={[styles.positionText, sprintColor ? { color: sprintColor } : null]}>S{position}</Text>
        </View>
        <View style={styles.slotEmptyContent}>
          <Text style={styles.slotEmptyText}>Empty</Text>
          <Text style={styles.slotEmptyHint}>Add a driver below</Text>
        </View>
        <View style={styles.sprintPointBadge}>
          <Text style={styles.sprintPointText}>{pointValue}pt</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.slotFilled, sprintColor ? { borderColor: sprintColor + '55' } : null]}>
      <View style={[styles.teamStripe, { backgroundColor: teamColor || '#666' }]} />

      <View style={[styles.positionBadge, sprintColor ? { backgroundColor: sprintColor + '22', borderColor: sprintColor } : null]}>
        <Text style={[styles.positionText, sprintColor ? { color: sprintColor } : null]}>S{position}</Text>
      </View>

      <View style={styles.slotDriverInfo}>
        <Text style={styles.slotDriverName} numberOfLines={1}>{driver.name}</Text>
        <Text style={styles.slotTeamName} numberOfLines={1}>{teamName || ''}</Text>
      </View>

      <View style={styles.sprintPointBadge}>
        <Text style={styles.sprintPointText}>{pointValue}pt</Text>
      </View>

      {!locked && (
        <View style={styles.slotActions}>
          <View style={styles.reorderStack}>
            <AnimatedPressable
              onPress={isFirst ? undefined : onMoveUp}
              style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
              scaleDown={0.8}
              disabled={isFirst}
              hitSlop={4}
            >
              <ChevronUp size={14} color={isFirst ? Colors.textMuted : Colors.text} />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={isLast ? undefined : onMoveDown}
              style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
              scaleDown={0.8}
              disabled={isLast}
              hitSlop={4}
            >
              <ChevronDown size={14} color={isLast ? Colors.textMuted : Colors.text} />
            </AnimatedPressable>
          </View>

          <AnimatedPressable onPress={onRemove} style={styles.actionBtn} scaleDown={0.85} hitSlop={6}>
            <X size={14} color={Colors.textSecondary} />
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, padding: 40, gap: 12,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700' as const },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },

  scrollContent: { paddingBottom: 24 },

  hero: {
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroLeft: { flex: 1 },
  targetLabel: {
    color: Colors.f1Red, fontSize: 10, fontWeight: '800' as const,
    letterSpacing: 2.4, marginBottom: 6,
  },
  raceName: {
    color: Colors.text, fontSize: 26, fontWeight: '800' as const,
    letterSpacing: -0.5, lineHeight: 30,
  },
  heroLocationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  heroFlag: { fontSize: 18 },
  heroLocation: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' as const },
  roundBadge: {
    backgroundColor: 'rgba(225, 6, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.35)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  roundBadgeLabel: {
    color: Colors.f1Red, fontSize: 12, fontWeight: '800' as const, letterSpacing: 0.5,
  },
  countdownWrap: { marginTop: 16 },
  lockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(225, 6, 0, 0.1)',
    borderRadius: 10, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.25)',
  },
  lockedText: { color: Colors.f1Red, fontSize: 13, fontWeight: '600' as const },

  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, marginTop: 4,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1, borderColor: Colors.border,
    gap: 6,
    minHeight: 70,
  },
  statTileCompact: {},
  statTileHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTileLabel: {
    fontSize: 10, fontWeight: '800' as const, letterSpacing: 1,
  },
  statTileValue: {
    color: Colors.text, fontSize: 18, fontWeight: '800' as const,
  },
  progressTrack: {
    height: 3, backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },

  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text, fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: Colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '500' as const,
  },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  clearBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' as const },

  gridList: { gap: 8 },

  slotEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border,
    paddingVertical: 12, paddingHorizontal: 12,
    minHeight: 60,
  },
  slotEmptyContent: { flex: 1, gap: 2 },
  slotEmptyText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' as const },
  slotEmptyHint: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' as const },
  slotFilled: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 62,
    position: 'relative',
  },
  teamStripe: { width: 4, alignSelf: 'stretch' },
  positionBadge: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  positionText: { color: Colors.text, fontSize: 13, fontWeight: '800' as const, letterSpacing: -0.3 },
  slotDriverInfo: { flex: 1, paddingHorizontal: 12, gap: 2 },
  slotDriverName: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  slotMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotTeamName: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' as const },
  miniBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  miniBadgeText: { color: Colors.warning, fontSize: 9, fontWeight: '800' as const },
  slotActions: {
    flexDirection: 'row', alignItems: 'center',
    paddingRight: 8, gap: 4,
  },
  actionBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
  },
  actionBtnActiveFL: { backgroundColor: 'rgba(255, 214, 10, 0.2)' },
  reorderStack: { gap: 2 },
  reorderBtn: {
    width: 24, height: 18, borderRadius: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
  },
  reorderBtnDisabled: { backgroundColor: 'transparent', opacity: 0.4 },
  dnfRibbon: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255, 69, 58, 0.18)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  dnfRibbonText: { color: Colors.error, fontSize: 9, fontWeight: '800' as const },

  poolGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  poolCard: {
    flexDirection: 'row', alignItems: 'center',
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 56,
  },
  poolStripe: { width: 4, alignSelf: 'stretch' },
  poolCardContent: { flex: 1, paddingHorizontal: 10, gap: 2 },
  poolDriverName: { color: Colors.text, fontSize: 13, fontWeight: '700' as const },
  poolTeamName: { color: Colors.textMuted, fontSize: 10, fontWeight: '500' as const },
  poolBadge: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },

  flSelectedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 214, 10, 0.08)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255, 214, 10, 0.3)',
    overflow: 'hidden',
    minHeight: 60,
  },
  flSelectedContent: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, gap: 12,
  },
  flIconBubble: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255, 214, 10, 0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  flDriverName: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  flDriverTeam: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  flRemoveBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
  },
  flPickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255, 214, 10, 0.35)',
  },
  flPickLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  flPickIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255, 214, 10, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  flPickContent: { gap: 2 },
  flPickText: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  flPickHint: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' as const },
  flPickChevron: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 214, 10, 0.12)',
  },

  dnfSelectedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255, 69, 58, 0.25)',
    overflow: 'hidden',
    minHeight: 60,
  },
  dnfSelectedContent: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, gap: 12,
  },
  dnfIconBubble: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  dnfDriverName: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  dnfDriverTeam: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  dnfRemoveBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
  },
  dnfPickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  dnfPickLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dnfPickIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  dnfPickContent: { gap: 2 },
  dnfPickText: { color: Colors.text, fontSize: 15, fontWeight: '700' as const },
  dnfPickHint: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' as const },
  dnfPickChevron: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },

  saveBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(11, 14, 17, 0.95)',
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  saveBarInfo: { gap: 2 },
  saveBarLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '800' as const, letterSpacing: 1.2 },
  saveBarPoints: { color: Colors.warning, fontSize: 20, fontWeight: '800' as const },
  saveButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  saveGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8,
  },
  saveText: { color: '#FFF', fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.2 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24,
    maxHeight: '85%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    color: Colors.text, fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.3,
  },
  modalSubtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  modalList: { maxHeight: 480 },
  modalListContent: { gap: 6, paddingBottom: 12 },
  modalEmpty: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 56,
  },
  pickerRowActive: { borderColor: Colors.f1Red },
  pickerStripe: { width: 4, alignSelf: 'stretch' },
  pickerRank: {
    color: Colors.textMuted, fontSize: 12, fontWeight: '700' as const,
    width: 28, textAlign: 'center',
  },
  pickerName: { color: Colors.text, fontSize: 14, fontWeight: '700' as const },
  pickerTeam: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  pickerAdd: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  pickerCheck: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.f1Red,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },

  sprintPointBadge: {
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    marginRight: 8,
  },
  sprintPointText: {
    color: Colors.info, fontSize: 10, fontWeight: '800' as const,
  },

  completedBanner: {
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  completedBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  completedBannerPoints: {
    gap: 0,
  },
  completedBannerValue: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  completedBannerLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  completedBannerBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  breakdownChipMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  breakdownChipMiniText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600' as const,
  },
  completedViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completedViewBtnText: {
    color: Colors.f1Red,
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
