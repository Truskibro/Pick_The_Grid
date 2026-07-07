import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Modal,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import {
  Save,
  Check,
  Lock,
  AlertTriangle,
  X,
  Zap,
  ChevronUp,
  ChevronDown,
  Plus,
  Search,
  Trophy,
  Flag,
  Trash2,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useF1Data } from '@/providers/F1DataProvider';
import {
  F1_POINTS,
  SPRINT_POINTS,
  FASTEST_LAP_BONUS,
  DNF_BONUS,
  Driver,
} from '@/types';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import CountdownTimer from '@/components/CountdownTimer';
import AnimatedPressable from '@/components/AnimatedPressable';
import { calculatePoints } from '@/lib/scoring';

type ActiveTab = 'race' | 'sprint';

type PickerMode =
  | { type: 'grid'; slotIndex: number }
  | { type: 'sprint'; slotIndex: number }
  | { type: 'fl' }
  | { type: 'dnf' }
  | null;

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

function buildRaceStartDate(
  raceDate?: string,
  raceTime?: string,
): Date | null {
  if (!raceDate || !raceTime) return null;

  const cleanDate = String(raceDate).trim();
  const cleanTime = String(raceTime).trim();

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

function isRaceLockedExactlyAtStart(
  raceDate?: string,
  raceTime?: string,
): boolean {
  const raceStart = buildRaceStartDate(raceDate, raceTime);

  if (!raceStart) return false;

  return Date.now() >= raceStart.getTime();
}

/**
 * Sprint picks lock independently at the sprint start time (Saturday),
 * not at the main race start (Sunday). Falls back to the race start
 * time when no separate sprint time is configured.
 */
function isSprintLockedExactlyAtStart(
  raceDate?: string,
  raceTime?: string,
  sprintDate?: string,
  sprintTime?: string,
): boolean {
  const sprintStart = buildRaceStartDate(sprintDate, sprintTime);

  if (!sprintStart) return isRaceLockedExactlyAtStart(raceDate, raceTime);

  return Date.now() >= sprintStart.getTime();
}

function cleanPickList(
  picks: string[],
  maxLength: number,
  validDriverIds: Set<string>,
): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const pick of picks) {
    if (!pick) continue;
    if (!validDriverIds.has(pick)) continue;
    if (seen.has(pick)) continue;

    seen.add(pick);
    cleaned.push(pick);

    if (cleaned.length >= maxLength) break;
  }

  return cleaned;
}

function setDriverAtSlot(
  currentPicks: string[],
  driverId: string,
  slotIndex: number,
  maxLength: number,
  validDriverIds: Set<string>,
): string[] {
  const next = cleanPickList(currentPicks, maxLength, validDriverIds);
  const existingIndex = next.indexOf(driverId);

  if (existingIndex === slotIndex) {
    next.splice(slotIndex, 1);
    return next;
  }

  if (existingIndex !== -1) {
    next.splice(existingIndex, 1);

    const insertIndex =
      existingIndex < slotIndex
        ? Math.min(slotIndex - 1, next.length)
        : Math.min(slotIndex, next.length);

    next.splice(insertIndex, 0, driverId);

    return cleanPickList(next, maxLength, validDriverIds);
  }

  if (slotIndex < next.length) {
    next[slotIndex] = driverId;
  } else {
    next.push(driverId);
  }

  return cleanPickList(next, maxLength, validDriverIds);
}

export default function PredictRaceScreen() {
  const { raceId } = useLocalSearchParams<{ raceId: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const { getRaceById, drivers, getTeamById, getRaceResult } = useF1Data();
  const { savePrediction, getPrediction, refreshPredictions } = useGame();
  const { profile, isGuest } = useUser();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const race = raceId ? getRaceById(raceId) : undefined;
  const raceResult = raceId ? getRaceResult(raceId) : undefined;
  const raceIsCompleted = race?.status === 'completed';
  const existingPrediction = race ? getPrediction(race.id) : undefined;

  const [activeTab, setActiveTab] = useState<ActiveTab>('race');
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(
    existingPrediction?.top10 || [],
  );
  const [sprintTop8, setSprintTop8] = useState<string[]>(
    existingPrediction?.sprintTop8 || [],
  );
  const [fastestLap, setFastestLap] = useState<string | null>(
    existingPrediction?.fastestLap || null,
  );
  const [dnf, setDnf] = useState<string | null>(
    existingPrediction?.dnf || null,
  );
  const [saved, setSaved] = useState(false);
  const [lastSyncedPredId, setLastSyncedPredId] = useState<string | null>(null);
  const [lastSyncedRaceId, setLastSyncedRaceId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerMode>(null);
  const [search, setSearch] = useState('');

  const validDriverIds = useMemo(
    () => new Set(drivers.map((driver) => driver.id)),
    [drivers],
  );

  const locked = race
    ? isRaceLockedExactlyAtStart(race.raceDate, race.raceTime)
    : true;

  const sprintLocked = race
    ? isSprintLockedExactlyAtStart(
        race.raceDate,
        race.raceTime,
        race.sprintDate,
        race.sprintTime,
      )
    : true;

  const cleanedSelectedDrivers = useMemo(
    () => cleanPickList(selectedDrivers, 10, validDriverIds),
    [selectedDrivers, validDriverIds],
  );

  const cleanedSprintTop8 = useMemo(
    () => cleanPickList(sprintTop8, 8, validDriverIds),
    [sprintTop8, validDriverIds],
  );

  const completedBreakdown = useMemo(() => {
    if (
      !raceIsCompleted ||
      !existingPrediction ||
      !raceResult ||
      raceResult.classification.length === 0
    ) {
      return null;
    }

    return calculatePoints(existingPrediction, raceResult);
  }, [raceIsCompleted, existingPrediction, raceResult]);

  const completedPoints =
    (existingPrediction?.pointsEarned ?? 0) +
    (existingPrediction?.sprintPointsEarned ?? 0);

  useEffect(() => {
    if (race) {
      navigation.setOptions({ title: race.name });
    }
  }, [race, navigation]);

  useEffect(() => {
    if (!race) return;

    if (!race.hasSprint && activeTab === 'sprint') {
      setActiveTab('race');
    }
  }, [race, activeTab]);

  useEffect(() => {
    if (!race) return;

    if (existingPrediction) {
      const predKey = `${existingPrediction.id}_${existingPrediction.updatedAt}`;

      if (lastSyncedPredId !== predKey || lastSyncedRaceId !== race.id) {
        setSelectedDrivers(existingPrediction.top10 || []);
        setSprintTop8(existingPrediction.sprintTop8 || []);
        setFastestLap(existingPrediction.fastestLap || null);
        setDnf(existingPrediction.dnf || null);
        setLastSyncedPredId(predKey);
        setLastSyncedRaceId(race.id);
        setSaved(true);
      }

      return;
    }

    if (lastSyncedRaceId !== race.id) {
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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      void refreshPredictions();
    }, [refreshPredictions]),
  );

  const driverById = useCallback(
    (id: string) => drivers.find((driver) => driver.id === id),
    [drivers],
  );

  const racePotentialPoints = useMemo(() => {
    let points = 0;

    cleanedSelectedDrivers.forEach((_, index) => {
      if (index < F1_POINTS.length) points += F1_POINTS[index];
    });

    if (fastestLap) points += FASTEST_LAP_BONUS;
    if (dnf) points += DNF_BONUS;

    return points;
  }, [cleanedSelectedDrivers, fastestLap, dnf]);

  const sprintPotentialPoints = useMemo(() => {
    let points = 0;

    cleanedSprintTop8.forEach((_, index) => {
      if (index < SPRINT_POINTS.length) points += SPRINT_POINTS[index];
    });

    return points;
  }, [cleanedSprintTop8]);

  const totalPotentialPoints = racePotentialPoints + sprintPotentialPoints;

  const raceProgress = cleanedSelectedDrivers.length / 10;
  const sprintProgress = cleanedSprintTop8.length / 8;

  const sortedRacePoolDrivers = useMemo(() => {
    return [...drivers]
      .filter((driver) => !cleanedSelectedDrivers.includes(driver.id))
      .sort((a, b) => b.championshipPoints - a.championshipPoints);
  }, [drivers, cleanedSelectedDrivers]);

  const sortedSprintPoolDrivers = useMemo(() => {
    return [...drivers]
      .filter((driver) => !cleanedSprintTop8.includes(driver.id))
      .sort((a, b) => b.championshipPoints - a.championshipPoints);
  }, [drivers, cleanedSprintTop8]);

  const pickerDrivers = useMemo(() => {
    if (!picker) return [];

    const all = [...drivers].sort(
      (a, b) => b.championshipPoints - a.championshipPoints,
    );

    if (!search.trim()) return all;

    const q = search.trim().toLowerCase();

    return all.filter((driver) => {
      const team = getTeamById(driver.teamId);

      return (
        driver.name.toLowerCase().includes(q) ||
        driver.shortName.toLowerCase().includes(q) ||
        (team?.shortName.toLowerCase().includes(q) ?? false) ||
        (team?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [picker, drivers, search, getTeamById]);

  const openPicker = useCallback(
    (mode: PickerMode) => {
      if (mode?.type === 'sprint') {
        if (sprintLocked) return;
      } else if (locked) {
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setSearch('');
      setPicker(mode);
    },
    [locked, sprintLocked],
  );

  const closePicker = useCallback(() => {
    setPicker(null);
    setSearch('');
  }, []);

  const handlePickerSelect = useCallback(
    (driverId: string) => {
      if (!picker) return;

      if (picker.type === 'sprint') {
        if (sprintLocked) return;
      } else if (locked) {
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (picker.type === 'grid') {
        setSelectedDrivers((prev) =>
          setDriverAtSlot(
            prev,
            driverId,
            picker.slotIndex,
            10,
            validDriverIds,
          ),
        );
      }

      if (picker.type === 'sprint') {
        setSprintTop8((prev) =>
          setDriverAtSlot(
            prev,
            driverId,
            picker.slotIndex,
            8,
            validDriverIds,
          ),
        );
      }

      if (picker.type === 'fl') {
        setFastestLap((prev) => (prev === driverId ? null : driverId));
      }

      if (picker.type === 'dnf') {
        setDnf((prev) => (prev === driverId ? null : driverId));
      }

      setSaved(false);
      closePicker();
    },
    [picker, locked, sprintLocked, validDriverIds, closePicker],
  );

  const addRaceDriver = useCallback(
    (driverId: string) => {
      if (locked) return;

      setSelectedDrivers((prev) => {
        const cleaned = cleanPickList(prev, 10, validDriverIds);

        if (cleaned.includes(driverId)) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          if (fastestLap === driverId) setFastestLap(null);
          if (dnf === driverId) setDnf(null);

          setSaved(false);
          return cleaned.filter((id) => id !== driverId);
        }

        if (cleaned.length >= 10) {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          Alert.alert(
            'Race Grid Full',
            'Remove a driver from your race grid first.',
          );
          return cleaned;
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setSaved(false);
        return [...cleaned, driverId];
      });
    },
    [locked, validDriverIds, fastestLap, dnf],
  );

  const addSprintDriver = useCallback(
    (driverId: string) => {
      if (sprintLocked) return;

      setSprintTop8((prev) => {
        const cleaned = cleanPickList(prev, 8, validDriverIds);

        if (cleaned.includes(driverId)) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          setSaved(false);
          return cleaned.filter((id) => id !== driverId);
        }

        if (cleaned.length >= 8) {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          Alert.alert(
            'Sprint Grid Full',
            'Remove a driver from your sprint grid first.',
          );
          return cleaned;
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setSaved(false);
        return [...cleaned, driverId];
      });
    },
    [sprintLocked, validDriverIds],
  );

  const removeRaceDriver = useCallback(
    (driverId: string) => {
      if (locked) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setSelectedDrivers((prev) =>
        cleanPickList(prev, 10, validDriverIds).filter(
          (id) => id !== driverId,
        ),
      );

      if (fastestLap === driverId) setFastestLap(null);
      if (dnf === driverId) setDnf(null);

      setSaved(false);
    },
    [locked, validDriverIds, fastestLap, dnf],
  );

  const removeSprintDriver = useCallback(
    (driverId: string) => {
      if (sprintLocked) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setSprintTop8((prev) =>
        cleanPickList(prev, 8, validDriverIds).filter(
          (id) => id !== driverId,
        ),
      );

      setSaved(false);
    },
    [sprintLocked, validDriverIds],
  );

  const moveRaceDriver = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (locked) return;

      void Haptics.selectionAsync();

      setSelectedDrivers((prev) => {
        const next = cleanPickList(prev, 10, validDriverIds);
        const target = direction === 'up' ? index - 1 : index + 1;

        if (index < 0 || index >= next.length) return next;
        if (target < 0 || target >= next.length) return next;

        [next[index], next[target]] = [next[target], next[index]];

        return next;
      });

      setSaved(false);
    },
    [locked, validDriverIds],
  );

  const moveSprintDriver = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (sprintLocked) return;

      void Haptics.selectionAsync();

      setSprintTop8((prev) => {
        const next = cleanPickList(prev, 8, validDriverIds);
        const target = direction === 'up' ? index - 1 : index + 1;

        if (index < 0 || index >= next.length) return next;
        if (target < 0 || target >= next.length) return next;

        [next[index], next[target]] = [next[target], next[index]];

        return next;
      });

      setSaved(false);
    },
    [sprintLocked, validDriverIds],
  );

  const clearRace = useCallback(() => {
    if (locked) return;

    Alert.alert('Clear Race Picks', 'Remove all race picks?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          setSelectedDrivers([]);
          setFastestLap(null);
          setDnf(null);
          setSaved(false);
        },
      },
    ]);
  }, [locked]);

  const clearSprint = useCallback(() => {
    if (sprintLocked) return;

    Alert.alert('Clear Sprint Picks', 'Remove all sprint picks?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          setSprintTop8([]);
          setSaved(false);
        },
      },
    ]);
  }, [sprintLocked]);

  const clearFastestLap = useCallback(() => {
    if (locked) return;

    setFastestLap(null);
    setSaved(false);
  }, [locked]);

  const clearDnf = useCallback(() => {
    if (locked) return;

    setDnf(null);
    setSaved(false);
  }, [locked]);

  const handleSave = useCallback(async () => {
    if (!race) {
      Alert.alert('Error', 'Race data is not available.');
      return;
    }

    const finalTop10 = cleanPickList(selectedDrivers, 10, validDriverIds);
    const finalSprintTop8 = cleanPickList(sprintTop8, 8, validDriverIds);

    const finalFastestLap =
      fastestLap && validDriverIds.has(fastestLap) ? fastestLap : null;

    const finalDnf = dnf && validDriverIds.has(dnf) ? dnf : null;

    // Race picks required only if race picks are still editable.
    if (!locked && finalTop10.length !== 10) {
      setActiveTab('race');
      Alert.alert(
        'Cannot Save',
        `Please select exactly 10 race drivers. You currently have ${finalTop10.length}.`,
      );
      return;
    }

    // Sprint picks required only if sprint picks are still editable.
    if (
      race.hasSprint &&
      !sprintLocked &&
      finalSprintTop8.length !== 8
    ) {
      setActiveTab('sprint');
      Alert.alert(
        'Cannot Save',
        `Please select exactly 8 sprint drivers. You currently have ${finalSprintTop8.length}.`,
      );
      return;
    }

    // If both race and sprint are locked, nothing left to save.
    if (locked && sprintLocked) {
      Alert.alert(
        'Predictions Locked',
        'Both race and sprint picks are locked.',
      );
      return;
    }

    // Preserve locked-side picks from the existing prediction.
    const existing = getPrediction(race.id);
    const persistedTop10 = locked ? (existing?.top10 ?? []) : finalTop10;
    const persistedFastestLap = locked
      ? (existing?.fastestLap ?? null)
      : finalFastestLap;
    const persistedDnf = locked ? (existing?.dnf ?? null) : finalDnf;
    const persistedSprintTop8 =
      sprintLocked || !race.hasSprint
        ? (existing?.sprintTop8 ?? [])
        : finalSprintTop8;

    setSelectedDrivers(persistedTop10);
    setSprintTop8(race.hasSprint ? persistedSprintTop8 : []);
    setFastestLap(persistedFastestLap);
    setDnf(persistedDnf);

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result = await savePrediction({
        raceId: race.id,
        top10: persistedTop10,
        fastestLap: persistedFastestLap,
        dnf: persistedDnf,
        pointsEarned: existing?.pointsEarned ?? 0,
        sprintTop8: race.hasSprint ? persistedSprintTop8 : [],
        sprintPointsEarned: existing?.sprintPointsEarned ?? 0,
        username: profile.username,
        displayName: profile.displayName,
      });

      setSaved(true);

      if (result.synced) {
        Alert.alert(
          'Prediction Saved!',
          'Your prediction has been saved and synced to the cloud.',
        );
      } else if (isGuest) {
        Alert.alert(
          'Prediction Saved!',
          'Saved on this device. Set up your profile to sync to cloud.',
        );
      } else {
        Alert.alert(
          'Prediction Saved Locally',
          result.errorMessage ??
            'Could not sync to cloud. Please sign out and sign back in, then try again.',
        );
      }
    } catch (e: any) {
      console.log('[PredictRaceScreen] Save failed:', e?.message || e);
      Alert.alert(
        'Save Failed',
        'An unexpected error occurred. Please try again.',
      );
    }
  }, [
    race,
    selectedDrivers,
    sprintTop8,
    fastestLap,
    dnf,
    validDriverIds,
    savePrediction,
    getPrediction,
    profile.username,
    profile.displayName,
    isGuest,
    locked,
    sprintLocked,
  ]);

  if (!race) {
    return (
      <View style={styles.emptyContainer}>
        <AlertTriangle color={Colors.f1Red} size={34} />
        <Text style={styles.emptyTitle}>Race Not Found</Text>
        <Text style={styles.emptyText}>This race could not be found.</Text>
      </View>
    );
  }

  const fastestLapDriver = fastestLap ? driverById(fastestLap) : undefined;
  const dnfDriver = dnf ? driverById(dnf) : undefined;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={[styles.flex, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['rgba(225,6,0,0.18)', Colors.background]}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.targetLabel}>PREDICTING</Text>
              <Text style={styles.raceName}>{race.name}</Text>

              <View style={styles.heroLocationRow}>
                <Text style={styles.heroFlag}>{race.countryFlag}</Text>
                <Text style={styles.heroLocation}>
                  {race.location} · {race.country}
                </Text>
              </View>
            </View>

            <View style={styles.roundBadge}>
              <Text style={styles.roundBadgeLabel}>R{race.round}</Text>
            </View>
          </View>

          <View style={styles.countdownWrap}>
            <CountdownTimer
              raceDate={race.raceDate}
              raceTime={race.raceTime}
            />
          </View>

          {locked && (
            <View style={styles.lockedBanner}>
              <Lock color={Colors.f1Red} size={16} />
              <Text style={styles.lockedText}>
                {locked && sprintLocked
                  ? 'Race & sprint predictions locked'
                  : locked
                    ? 'Race predictions locked because the race has started'
                    : 'Sprint predictions locked because the sprint has started'}
              </Text>
            </View>
          )}

          {!locked && sprintLocked && race.hasSprint && (
            <View style={styles.lockedBanner}>
              <Lock color={Colors.info} size={16} />
              <Text style={styles.lockedText}>
                Sprint predictions locked — race picks still open
              </Text>
            </View>
          )}

          {raceIsCompleted && (
            <View style={styles.completedBanner}>
              <View style={styles.completedBannerTop}>
                <Trophy color={Colors.info} size={22} />
                <View style={styles.completedBannerPoints}>
                  <Text style={styles.completedBannerValue}>
                    {completedPoints}
                  </Text>
                  <Text style={styles.completedBannerLabel}>PTS EARNED</Text>
                </View>
              </View>

              {completedBreakdown && (
                <View style={styles.completedBannerBreakdown}>
                  {completedBreakdown.positionPoints > 0 && (
                    <View style={styles.breakdownChipMini}>
                      <Text style={styles.breakdownChipMiniText}>
                        Race +{completedBreakdown.positionPoints}
                      </Text>
                    </View>
                  )}

                  {completedBreakdown.fastestLapPoints > 0 && (
                    <View style={styles.breakdownChipMini}>
                      <Text style={styles.breakdownChipMiniText}>
                        FL +{completedBreakdown.fastestLapPoints}
                      </Text>
                    </View>
                  )}

                  {completedBreakdown.dnfPoints > 0 && (
                    <View style={styles.breakdownChipMini}>
                      <Text style={styles.breakdownChipMiniText}>
                        DNF +{completedBreakdown.dnfPoints}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <AnimatedPressable
                onPress={() => router.push(`/race-results/${race.id}` as any)}
                scaleDown={0.97}
                style={styles.completedViewBtn}
              >
                <Text style={styles.completedViewBtnText}>
                  View Full Results
                </Text>
                <ChevronRight color={Colors.f1Red} size={16} />
              </AnimatedPressable>
            </View>
          )}
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatTile
            label="RACE"
            value={`${cleanedSelectedDrivers.length}/10`}
            accent={Colors.f1Red}
            icon={<Flag color={Colors.f1Red} size={16} />}
            progress={raceProgress}
          />

          {race.hasSprint && (
            <StatTile
              label="SPRINT"
              value={`${cleanedSprintTop8.length}/8`}
              accent={Colors.info}
              icon={<Zap color={Colors.info} size={16} />}
              progress={sprintProgress}
            />
          )}

          <StatTile
            label="POTENTIAL"
            value={`${totalPotentialPoints}`}
            accent={Colors.warning}
            icon={<Trophy color={Colors.warning} size={16} />}
          />
        </View>

        {race.hasSprint && (
          <View style={styles.tabsWrap}>
            <AnimatedPressable
              onPress={() => setActiveTab('race')}
              style={[
                styles.tabButton,
                activeTab === 'race' && styles.tabButtonActiveRace,
              ]}
              scaleDown={0.97}
            >
              <Flag
                color={activeTab === 'race' ? Colors.f1Red : Colors.textMuted}
                size={16}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'race' && styles.tabTextRace,
                ]}
              >
                Race Picks
              </Text>

              <View
                style={[
                  styles.tabCount,
                  activeTab === 'race' && styles.tabCountRace,
                ]}
              >
                <Text style={styles.tabCountText}>
                  {cleanedSelectedDrivers.length}/10
                </Text>
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={() => setActiveTab('sprint')}
              style={[
                styles.tabButton,
                activeTab === 'sprint' && styles.tabButtonActiveSprint,
              ]}
              scaleDown={0.97}
            >
              <Zap
                color={
                  activeTab === 'sprint' ? Colors.info : Colors.textMuted
                }
                size={16}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'sprint' && styles.tabTextSprint,
                ]}
              >
                Sprint Picks
              </Text>

              <View
                style={[
                  styles.tabCount,
                  activeTab === 'sprint' && styles.tabCountSprint,
                ]}
              >
                <Text style={styles.tabCountText}>
                  {cleanedSprintTop8.length}/8
                </Text>
              </View>
            </AnimatedPressable>
          </View>
        )}

        {activeTab === 'race' && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Race Grid</Text>
                  <Text style={styles.sectionSubtitle}>
                    Pick exact top 10 finishing order
                  </Text>
                </View>

                {!locked && cleanedSelectedDrivers.length > 0 && (
                  <AnimatedPressable
                    onPress={clearRace}
                    style={styles.clearBtn}
                    scaleDown={0.95}
                  >
                    <Trash2 color={Colors.textSecondary} size={14} />
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </AnimatedPressable>
                )}
              </View>

              <View style={styles.gridList}>
                {Array.from({ length: 10 }).map((_, index) => {
                  const position = index + 1;
                  const driverId = cleanedSelectedDrivers[index];
                  const driver = driverId ? driverById(driverId) : undefined;
                  const team = driver ? getTeamById(driver.teamId) : undefined;

                  return (
                    <GridSlot
                      key={`race-slot-${position}`}
                      position={position}
                      points={F1_POINTS[index] ?? 0}
                      podiumColor={PODIUM_COLORS[position]}
                      driver={driver}
                      teamColor={team?.color}
                      teamName={team?.shortName}
                      isFL={driver?.id === fastestLap}
                      isDnf={driver?.id === dnf}
                      locked={locked}
                      isFirst={index === 0}
                      isLast={index === cleanedSelectedDrivers.length - 1}
                      onPress={() =>
                        openPicker({ type: 'grid', slotIndex: index })
                      }
                      onRemove={() => driver && removeRaceDriver(driver.id)}
                      onMoveUp={() => moveRaceDriver(index, 'up')}
                      onMoveDown={() => moveRaceDriver(index, 'down')}
                    />
                  );
                })}
              </View>
            </View>

            {!locked && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available Race Drivers</Text>
                <Text style={styles.sectionSubtitle}>
                  Tap a driver to add them to the next race slot
                </Text>

                <View style={styles.driverList}>
                  {sortedRacePoolDrivers.map((driver) => {
                    const team = getTeamById(driver.teamId);

                    return (
                      <DriverPickRow
                        key={`race-pool-${driver.id}`}
                        driver={driver}
                        teamColor={team?.color}
                        teamName={team?.shortName}
                        accentColor={Colors.f1Red}
                        onPress={() => addRaceDriver(driver.id)}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bonus Picks</Text>
              <Text style={styles.sectionSubtitle}>
                Fastest lap +{FASTEST_LAP_BONUS} · DNF +{DNF_BONUS} · DNS does
                not count
              </Text>

              <View style={styles.bonusList}>
                <BonusPickCard
                  label="Fastest Lap"
                  hint="Pick any driver"
                  icon={<Zap color={Colors.warning} size={18} />}
                  driver={fastestLapDriver}
                  teamName={
                    fastestLapDriver
                      ? getTeamById(fastestLapDriver.teamId)?.shortName
                      : undefined
                  }
                  accentColor={Colors.warning}
                  locked={locked}
                  onPress={() => openPicker({ type: 'fl' })}
                  onClear={clearFastestLap}
                />

                <BonusPickCard
                  label="DNF Pick"
                  hint="Will not finish"
                  icon={<AlertTriangle color={Colors.error} size={18} />}
                  driver={dnfDriver}
                  teamName={
                    dnfDriver
                      ? getTeamById(dnfDriver.teamId)?.shortName
                      : undefined
                  }
                  accentColor={Colors.error}
                  locked={locked}
                  onPress={() => openPicker({ type: 'dnf' })}
                  onClear={clearDnf}
                />
              </View>
            </View>
          </>
        )}

        {activeTab === 'sprint' && race.hasSprint && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Sprint Grid</Text>
                  <Text style={styles.sectionSubtitle}>
                    Pick exact top 8 sprint order
                  </Text>
                </View>

                {!sprintLocked && cleanedSprintTop8.length > 0 && (
                  <AnimatedPressable
                    onPress={clearSprint}
                    style={styles.clearBtn}
                    scaleDown={0.95}
                  >
                    <Trash2 color={Colors.textSecondary} size={14} />
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </AnimatedPressable>
                )}
              </View>

              <View style={styles.gridList}>
                {Array.from({ length: 8 }).map((_, index) => {
                  const position = index + 1;
                  const driverId = cleanedSprintTop8[index];
                  const driver = driverId ? driverById(driverId) : undefined;
                  const team = driver ? getTeamById(driver.teamId) : undefined;

                  return (
                    <GridSlot
                      key={`sprint-slot-${position}`}
                      position={position}
                      positionPrefix="S"
                      points={SPRINT_POINTS[index] ?? 0}
                      podiumColor={SPRINT_PODIUM_COLORS[position]}
                      driver={driver}
                      teamColor={team?.color}
                      teamName={team?.shortName}
                      locked={sprintLocked}
                      isFirst={index === 0}
                      isLast={index === cleanedSprintTop8.length - 1}
                      onPress={() =>
                        openPicker({ type: 'sprint', slotIndex: index })
                      }
                      onRemove={() => driver && removeSprintDriver(driver.id)}
                      onMoveUp={() => moveSprintDriver(index, 'up')}
                      onMoveDown={() => moveSprintDriver(index, 'down')}
                    />
                  );
                })}
              </View>
            </View>

            {!sprintLocked && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Available Sprint Drivers
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Tap a driver to add them to the next sprint slot
                </Text>

                <View style={styles.driverList}>
                  {sortedSprintPoolDrivers.map((driver) => {
                    const team = getTeamById(driver.teamId);

                    return (
                      <DriverPickRow
                        key={`sprint-pool-${driver.id}`}
                        driver={driver}
                        teamColor={team?.color}
                        teamName={team?.shortName}
                        accentColor={Colors.info}
                        onPress={() => addSprintDriver(driver.id)}
                      />
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>

      {(!locked || (race.hasSprint && !sprintLocked)) && (
        <View style={styles.saveBar}>
          <View style={styles.saveBarInfo}>
            <Text style={styles.saveBarLabel}>POTENTIAL</Text>
            <Text style={styles.saveBarPoints}>
              {totalPotentialPoints} pts
            </Text>
          </View>

          <AnimatedPressable
            onPress={handleSave}
            style={styles.saveButton}
            scaleDown={0.97}
          >
            <LinearGradient
              colors={
                saved
                  ? ['#2ECC71', '#27AE60']
                  : [Colors.f1Red, Colors.f1RedDark || '#A00000']
              }
              style={styles.saveGradient}
            >
              {saved ? (
                <Check color="#FFF" size={18} />
              ) : (
                <Save color="#FFF" size={18} />
              )}

              <Text style={styles.saveText}>
                {saved ? 'Saved' : 'Save Prediction'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      )}

      <Modal
        visible={!!picker}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  {picker?.type === 'grid' && 'Pick Race Driver'}
                  {picker?.type === 'sprint' && 'Pick Sprint Driver'}
                  {picker?.type === 'fl' && 'Pick Fastest Lap'}
                  {picker?.type === 'dnf' && 'Pick DNF Driver'}
                </Text>

                <Text style={styles.modalSubtitle}>
                  {picker?.type === 'dnf'
                    ? 'DNS does not count as DNF.'
                    : 'Select a driver from the list.'}
                </Text>
              </View>

              <Pressable style={styles.modalCloseBtn} onPress={closePicker}>
                <X color={Colors.textSecondary} size={18} />
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <Search color={Colors.textMuted} size={16} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search drivers"
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={10}>
                  <X color={Colors.textMuted} size={16} />
                </Pressable>
              )}
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
            >
              {pickerDrivers.length === 0 && (
                <Text style={styles.modalEmpty}>No drivers found</Text>
              )}

              {pickerDrivers.map((driver, index) => {
                const team = getTeamById(driver.teamId);

                const isCurrent =
                  (picker?.type === 'grid' &&
                    cleanedSelectedDrivers[picker.slotIndex] === driver.id) ||
                  (picker?.type === 'sprint' &&
                    cleanedSprintTop8[picker.slotIndex] === driver.id) ||
                  (picker?.type === 'fl' && fastestLap === driver.id) ||
                  (picker?.type === 'dnf' && dnf === driver.id);

                const alreadyPicked =
                  picker?.type === 'grid'
                    ? cleanedSelectedDrivers.includes(driver.id)
                    : picker?.type === 'sprint'
                      ? cleanedSprintTop8.includes(driver.id)
                      : false;

                return (
                  <AnimatedPressable
                    key={`picker-${driver.id}`}
                    onPress={() => handlePickerSelect(driver.id)}
                    style={[
                      styles.pickerRow,
                      isCurrent && styles.pickerRowActive,
                    ]}
                    scaleDown={0.98}
                  >
                    <View
                      style={[
                        styles.pickerStripe,
                        {
                          backgroundColor: team?.color || Colors.border,
                        },
                      ]}
                    />

                    <Text style={styles.pickerRank}>{index + 1}</Text>

                    <View style={styles.flex}>
                      <Text style={styles.pickerName}>{driver.name}</Text>
                      <Text style={styles.pickerTeam}>
                        {team?.shortName || driver.shortName}
                        {alreadyPicked && !isCurrent
                          ? ' · already picked'
                          : ''}
                      </Text>
                    </View>

                    {isCurrent ? (
                      <View style={styles.pickerCheck}>
                        <Check color="#FFF" size={16} />
                      </View>
                    ) : (
                      <View style={styles.pickerAdd}>
                        <Plus color={Colors.f1Red} size={16} />
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

interface StatTileProps {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
  progress?: number;
}

function StatTile({ label, value, accent, icon, progress }: StatTileProps) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTileHeader}>
        {icon}
        <Text style={[styles.statTileLabel, { color: accent }]}>{label}</Text>
      </View>

      <Text style={styles.statTileValue}>{value}</Text>

      {progress !== undefined && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(1, Math.max(0, progress)) * 100}%`,
                backgroundColor: accent,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

interface DriverPickRowProps {
  driver: Driver;
  teamColor?: string;
  teamName?: string;
  accentColor: string;
  onPress: () => void;
}

function DriverPickRow({
  driver,
  teamColor,
  teamName,
  accentColor,
  onPress,
}: DriverPickRowProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      style={styles.driverPickRow}
      scaleDown={0.97}
    >
      <View
        style={[
          styles.driverPickStripe,
          { backgroundColor: teamColor || Colors.border },
        ]}
      />

      <View style={styles.driverPickMain}>
        <Text style={styles.driverPickName}>{driver.name}</Text>
        <Text style={styles.driverPickTeam}>
          {teamName || driver.shortName}
        </Text>
      </View>

      <View style={[styles.driverPickAdd, { borderColor: accentColor }]}>
        <Plus color={accentColor} size={17} />
      </View>
    </AnimatedPressable>
  );
}

interface BonusPickCardProps {
  label: string;
  hint: string;
  icon: React.ReactNode;
  driver?: Driver;
  teamName?: string;
  accentColor: string;
  locked: boolean;
  onPress: () => void;
  onClear: () => void;
}

function BonusPickCard({
  label,
  hint,
  icon,
  driver,
  teamName,
  accentColor,
  locked,
  onPress,
  onClear,
}: BonusPickCardProps) {
  return (
    <AnimatedPressable
      onPress={driver ? undefined : onPress}
      style={[styles.bonusCard, { borderColor: `${accentColor}55` }]}
      scaleDown={0.97}
      disabled={locked}
    >
      <View style={[styles.bonusIcon, { backgroundColor: `${accentColor}22` }]}>
        {icon}
      </View>

      <View style={styles.bonusMain}>
        <Text style={styles.bonusLabel}>{label}</Text>

        {driver ? (
          <>
            <Text style={styles.bonusDriver}>{driver.name}</Text>
            <Text style={styles.bonusHint}>
              {teamName || driver.shortName}
            </Text>
          </>
        ) : (
          <Text style={styles.bonusHint}>{hint}</Text>
        )}
      </View>

      {!locked && driver ? (
        <Pressable style={styles.bonusClear} onPress={onClear}>
          <X color={Colors.textSecondary} size={16} />
        </Pressable>
      ) : (
        <ChevronRight color={accentColor} size={18} />
      )}
    </AnimatedPressable>
  );
}

interface GridSlotProps {
  position: number;
  positionPrefix?: string;
  points: number;
  podiumColor?: string;
  driver?: Driver;
  teamColor?: string;
  teamName?: string;
  isFL?: boolean;
  isDnf?: boolean;
  locked: boolean;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function GridSlot({
  position,
  positionPrefix = 'P',
  points,
  podiumColor,
  driver,
  teamColor,
  teamName,
  isFL,
  isDnf,
  locked,
  isFirst,
  isLast,
  onPress,
  onRemove,
  onMoveUp,
  onMoveDown,
}: GridSlotProps) {
  if (!driver) {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={locked}
        style={styles.slotEmpty}
        scaleDown={0.98}
      >
        <View
          style={[
            styles.positionBadge,
            podiumColor && { borderColor: podiumColor },
          ]}
        >
          <Text style={styles.positionText}>
            {positionPrefix}
            {position}
          </Text>
        </View>

        <View style={styles.slotEmptyContent}>
          <Text style={styles.slotEmptyText}>Empty</Text>
          <Text style={styles.slotEmptyHint}>Tap to choose a driver</Text>
        </View>

        <Text style={styles.slotPointText}>{points}pts</Text>
      </AnimatedPressable>
    );
  }

  return (
    <View style={styles.slotFilled}>
      <View
        style={[
          styles.teamStripe,
          { backgroundColor: teamColor || Colors.border },
        ]}
      />

      <AnimatedPressable
        onPress={onPress}
        disabled={locked}
        style={[
          styles.positionBadge,
          podiumColor && { borderColor: podiumColor },
        ]}
        scaleDown={0.9}
      >
        <Text style={styles.positionText}>
          {positionPrefix}
          {position}
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={onPress}
        disabled={locked}
        style={styles.slotDriverInfo}
        scaleDown={0.98}
      >
        <Text style={styles.slotDriverName}>{driver.name}</Text>

        <View style={styles.slotMetaRow}>
          <Text style={styles.slotTeamName}>
            {teamName || driver.shortName}
          </Text>

          {isFL && (
            <View style={styles.flMiniBadge}>
              <Zap color={Colors.warning} size={10} />
              <Text style={styles.flMiniBadgeText}>FL</Text>
            </View>
          )}

          {isDnf && (
            <View style={styles.dnfMiniBadge}>
              <AlertTriangle color={Colors.error} size={10} />
              <Text style={styles.dnfMiniBadgeText}>DNF</Text>
            </View>
          )}
        </View>
      </AnimatedPressable>

      {!locked && (
        <View style={styles.slotActions}>
          <View style={styles.reorderStack}>
            <AnimatedPressable
              onPress={onMoveUp}
              disabled={isFirst}
              style={[
                styles.reorderBtn,
                isFirst && styles.reorderBtnDisabled,
              ]}
              scaleDown={0.85}
            >
              <ChevronUp color={Colors.textSecondary} size={14} />
            </AnimatedPressable>

            <AnimatedPressable
              onPress={onMoveDown}
              disabled={isLast}
              style={[
                styles.reorderBtn,
                isLast && styles.reorderBtnDisabled,
              ]}
              scaleDown={0.85}
            >
              <ChevronDown color={Colors.textSecondary} size={14} />
            </AnimatedPressable>
          </View>

          <AnimatedPressable
            onPress={onRemove}
            style={styles.actionBtn}
            scaleDown={0.85}
          >
            <X color={Colors.textSecondary} size={14} />
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 40,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  hero: {
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  targetLabel: {
    color: Colors.f1Red,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  raceName: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  heroFlag: {
    fontSize: 18,
    marginRight: 8,
  },
  heroLocation: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  roundBadge: {
    backgroundColor: 'rgba(225, 6, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roundBadgeLabel: {
    color: Colors.f1Red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownWrap: {
    marginTop: 16,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 6, 0, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.25)',
  },
  lockedText: {
    color: Colors.f1Red,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 70,
    marginRight: 8,
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statTileLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 4,
  },
  statTileValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  tabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 18,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 8,
  },
  tabButtonActiveRace: {
    backgroundColor: 'rgba(225,6,0,0.12)',
    borderColor: 'rgba(225,6,0,0.35)',
  },
  tabButtonActiveSprint: {
    backgroundColor: 'rgba(10,132,255,0.12)',
    borderColor: 'rgba(10,132,255,0.35)',
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  tabTextRace: {
    color: Colors.f1Red,
  },
  tabTextSprint: {
    color: Colors.info,
  },
  tabCount: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabCountRace: {
    backgroundColor: 'rgba(225,6,0,0.18)',
  },
  tabCountSprint: {
    backgroundColor: 'rgba(10,132,255,0.18)',
  },
  tabCountText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderText: {
    flex: 1,
    paddingRight: 10,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
  gridList: {
    marginTop: 2,
  },
  slotEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 60,
    marginBottom: 8,
  },
  slotEmptyContent: {
    flex: 1,
    marginLeft: 12,
  },
  slotEmptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  slotEmptyHint: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  slotPointText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  slotFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 62,
    marginBottom: 8,
  },
  teamStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  positionBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  positionText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  slotDriverInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  slotDriverName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  slotTeamName: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  flMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  flMiniBadgeText: {
    color: Colors.warning,
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 3,
  },
  dnfMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  dnfMiniBadgeText: {
    color: Colors.error,
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 3,
  },
  slotActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
    marginLeft: 4,
  },
  reorderStack: {
    marginLeft: 4,
  },
  reorderBtn: {
    width: 24,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
    marginBottom: 2,
  },
  reorderBtnDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  driverList: {
    marginTop: 12,
  },
  driverPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 56,
    marginBottom: 8,
  },
  driverPickStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  driverPickMain: {
    flex: 1,
    paddingHorizontal: 12,
  },
  driverPickName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  driverPickTeam: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  driverPickAdd: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bonusList: {
    marginTop: 12,
  },
  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  bonusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bonusMain: {
    flex: 1,
  },
  bonusLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  bonusDriver: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  bonusHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  bonusClear: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
  },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 14, 17, 0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  saveBarInfo: {
    marginRight: 12,
  },
  saveBarLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  saveBarPoints: {
    color: Colors.warning,
    fontSize: 20,
    fontWeight: '800',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  saveText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginLeft: 10,
  },
  modalList: {
    maxHeight: 480,
  },
  modalListContent: {
    paddingBottom: 12,
  },
  modalEmpty: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    minHeight: 56,
    marginBottom: 6,
  },
  pickerRowActive: {
    borderColor: Colors.f1Red,
  },
  pickerStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  pickerRank: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
  },
  pickerName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pickerTeam: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  pickerAdd: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickerCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.f1Red,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  completedBanner: {
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
    padding: 14,
    marginTop: 16,
  },
  completedBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedBannerPoints: {
    marginLeft: 10,
  },
  completedBannerValue: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  completedBannerLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  completedBannerBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  breakdownChipMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  breakdownChipMiniText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  completedViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 10,
  },
  completedViewBtnText: {
    color: Colors.f1Red,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
});
