import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AtSign,
  Award,
  Bell,
  Bike,
  Check,
  ChevronRight,
  Flag,
  LogIn,
  LogOut,
  Pencil,
  Save,
  Send,
  Shield,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import AnimatedPressable from '@/components/AnimatedPressable';
import CountryPicker from '@/components/CountryPicker';
import Colors from '@/constants/colors';
import { COUNTRIES } from '@/constants/countries';
import { ALL_SERIES, SeriesId } from '@/constants/series';
import { useSeries } from '@/providers/SeriesProvider';
import { useAchievements } from '@/providers/AchievementProvider';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import { ensureAndroidChannel } from '@/lib/notifications';

export default function SettingsScreen() {
  const router = useRouter();

  const {
    profile,
    isGuest,
    notifications,
    updateProfile,
    updateNotifications,
    signOut,
  } = useUser();

  const { leagues: allLeagues, totalPoints, predictions } = useGame();
  const { unlockedCount, totalTiersCount, unlockedTiersCount } = useAchievements();
  const { currentSeries, switchSeries, config } = useSeries();
  const seriesColors = config.colors;

  const leagues = useMemo(() =>
    allLeagues.filter((l) => (l.seriesId ?? 'f1') === currentSeries),
    [allLeagues, currentSeries],
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [country, setCountry] = useState(profile.country);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<ProfileFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const NAME_REGEX = /^[\p{L}][\p{L}\s'\-]{0,31}$/u;
  const DISPLAY_NAME_REGEX = /^[\p{L}0-9][\p{L}0-9\s'._-]{1,31}$/u;
  const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

  useEffect(() => {
    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setCountry(profile.country);
  }, [
    profile.displayName,
    profile.username,
    profile.firstName,
    profile.lastName,
    profile.country,
  ]);

  // Reflect the OS-level notification permission so users understand why
  // toggles might have no effect when the system setting is off.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getPermissionsAsync()
      .then(({ status }) => {
        setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      })
      .catch(() => setPermissionStatus('unknown'));
  }, []);

  const openSystemNotificationSettings = () => {
    if (permissionStatus !== 'denied') return;
    if (Platform.OS === 'ios') {
      void Linking.openURL('app-settings:');
    } else if (Platform.OS === 'android') {
      void Linking.openSettings();
    }
  };

  const sendTestNotification = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Notifications only work on the mobile app.');
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: asked } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(asked === 'granted' ? 'granted' : 'denied');
        if (asked !== 'granted') {
          Alert.alert(
            'Permission Needed',
            'Enable notifications for this app in your phone\u2019s Settings to receive race reminders.',
          );
          return;
        }
      }

      await ensureAndroidChannel();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '\u{1F3CE} Test Notification',
          body: 'Notifications are working! Race reminders will look like this.',
          sound: Platform.OS === 'ios' ? 'default' : undefined,
        },
        trigger: null,
      });
    } catch (e) {
      console.log('[Settings] Test notification failed:', e);
      Alert.alert('Failed', 'Could not send the test notification on this device.');
    }
  };

  const initials = useMemo(() => {
    const source = (displayName || username || profile.displayName || profile.username || 'P').trim();
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  }, [displayName, username, profile.displayName, profile.username]);

  const predictionsMade = useMemo(() => {
    return predictions.filter((p) => (p.top10?.length ?? 0) > 0 || p.fastestLap || p.dnf).length;
  }, [predictions]);

  const openEditor = () => {
    if (isGuest) {
      router.push('/auth' as any);
      return;
    }

    void Haptics.selectionAsync();

    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setCountry(profile.country);
    setFormErrors({});
    setSaveError(null);
    setEditorOpen(true);
  };

  const handleSaveProfile = async () => {
    const trimmedDisplayName = displayName.trim().replace(/\s+/g, ' ');
    const trimmedUsername = username.trim().replace(/^@+/, '');
    const trimmedFirst = firstName.trim().replace(/\s+/g, ' ');
    const trimmedLast = lastName.trim().replace(/\s+/g, ' ');
    const trimmedCountry = country.trim();

    const errors: ProfileFieldErrors = {};

    if (!trimmedDisplayName) {
      errors.displayName = 'Display name is required.';
    } else if (!DISPLAY_NAME_REGEX.test(trimmedDisplayName)) {
      errors.displayName = '2\u201332 characters: letters, numbers, spaces, . _ - or apostrophes.';
    }

    if (!trimmedUsername) {
      errors.username = 'Username is required.';
    } else if (!USERNAME_REGEX.test(trimmedUsername)) {
      errors.username = '3\u201320 characters: letters, numbers, and underscores only.';
    }

    if (!trimmedFirst) {
      errors.firstName = 'First name is required.';
    } else if (!NAME_REGEX.test(trimmedFirst)) {
      errors.firstName = '1\u201332 characters: letters, spaces, hyphens, or apostrophes.';
    }

    if (!trimmedLast) {
      errors.lastName = 'Last name is required.';
    } else if (!NAME_REGEX.test(trimmedLast)) {
      errors.lastName = '1\u201332 characters: letters, spaces, hyphens, or apostrophes.';
    }

    if (!trimmedCountry) {
      errors.country = 'Country is required.';
    } else if (!COUNTRIES.some((c) => c.name === trimmedCountry)) {
      errors.country = 'Select a valid country from the list.';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await updateProfile({
        displayName: trimmedDisplayName,
        username: trimmedUsername,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        country: trimmedCountry,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorOpen(false);
    } catch (e: any) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaveError(e?.message || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isEditorDirty = () =>
    displayName !== profile.displayName ||
    username !== profile.username ||
    firstName !== profile.firstName ||
    lastName !== profile.lastName ||
    country !== profile.country;

  const closeEditor = () => {
    if (saving) return;

    if (isEditorDirty()) {
      Alert.alert('Discard changes?', 'Your edits haven\u2019t been saved yet.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => setEditorOpen(false) },
      ]);
      return;
    }

    setEditorOpen(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: seriesColors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.heroWrap}>
        <LinearGradient colors={[seriesColors.primaryDark, seriesColors.surfaceElevated]} style={styles.hero}>
          <View style={styles.heroPattern} />

          <View style={styles.heroTop}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>

            <AnimatedPressable style={[styles.editPill, { backgroundColor: seriesColors.primary }]} onPress={openEditor}>
              {isGuest ? <LogIn size={14} color="#FFF" /> : <Pencil size={14} color="#FFF" />}
              <Text style={styles.editPillText}>{isGuest ? 'Sign In' : 'Edit'}</Text>
            </AnimatedPressable>
          </View>

          <Text style={styles.heroName} numberOfLines={1}>
            {profile.displayName}
          </Text>

          <View style={styles.heroHandleRow}>
            <AtSign size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.heroHandle} numberOfLines={1}>
              {profile.username}
            </Text>

            {!isGuest && (
              <View style={styles.verifiedBadge}>
                <Check size={10} color="#FFF" />
              </View>
            )}
          </View>

          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeText}>{totalPoints.toLocaleString()} pts</Text>
          </View>
        </LinearGradient>

        <View style={styles.statsStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{totalPoints.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCell}>
            <Text style={styles.statValue}>{leagues.length}</Text>
            <Text style={styles.statLabel}>Leagues</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCell}>
            <Text style={styles.statValue}>{predictionsMade}</Text>
            <Text style={styles.statLabel}>Predicts</Text>
          </View>
        </View>
      </View>

      {isGuest && (
        <AnimatedPressable style={styles.signInBanner} onPress={() => router.push('/auth' as any)}>
          <View style={styles.signInIcon}>
            <LogIn size={18} color={seriesColors.primary} />
          </View>

          <View style={styles.signInContent}>
            <Text style={styles.signInTitle}>Sign in to save your progress</Text>
            <Text style={styles.signInText}>Sync predictions and compete in leagues</Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </AnimatedPressable>
      )}

      <Text style={styles.sectionLabel}>Racing Series</Text>

      <View style={styles.card}>
        {ALL_SERIES.map((series) => {
          const isActive = series.id === currentSeries;
          return (
            <AnimatedPressable
              key={series.id}
              style={[styles.row, isActive && { backgroundColor: `${series.colors.primary}12` }]}
              onPress={async () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                await switchSeries(series.id);
              }}
              scaleDown={0.98}
            >
              <View style={[styles.rowIcon, { backgroundColor: `${series.colors.primary}1F` }]}>
                {series.id === 'f1' ? (
                  <Flag size={18} color={series.colors.primary} />
                ) : (
                  <Bike size={18} color={series.colors.primary} />
                )}
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{series.name}</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {isActive ? 'Active' : 'Switch to ' + series.name}
                </Text>
              </View>
              {isActive ? (
                <Check size={18} color={series.colors.primary} />
              ) : (
                <ChevronRight size={18} color={Colors.textMuted} />
              )}
            </AnimatedPressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Achievements & Profile</Text>

      <View style={styles.card}>
        <AnimatedPressable
          style={styles.row}
          onPress={() => {
            if (isGuest) {
              router.push('/auth' as any);
              return;
            }

            void Haptics.selectionAsync();
            router.push('/achievements' as any);
          }}
        >
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,214,10,0.12)' }]}>
            <Award size={18} color={Colors.warning} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Grid Badges</Text>
            <Text style={styles.rowValue}>
              {unlockedTiersCount}/{totalTiersCount} tiers · {unlockedCount} badges unlocked
            </Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </AnimatedPressable>

        <View style={styles.divider} />

        <AnimatedPressable
          style={styles.row}
          onPress={() => {
            if (isGuest) {
              router.push('/auth' as any);
              return;
            }

            void Haptics.selectionAsync();
            router.push(`/profile/${profile.id}` as any);
          }}
        >
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(10,132,255,0.12)' }]}>
            <Trophy size={18} color={Colors.info} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Preview Public Profile</Text>
            <Text style={styles.rowValue}>See your plaque, stats, and achievements</Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </AnimatedPressable>
      </View>

      <Text style={styles.sectionLabel}>Notifications</Text>

      <View style={styles.card}>
        <AnimatedPressable
          onPress={openSystemNotificationSettings}
          style={styles.toggleRow}
          disabled={permissionStatus !== 'denied'}
        >
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Shield size={18} color={Colors.textSecondary} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>System Permission</Text>
            <Text style={styles.rowValue}>
              {permissionStatus === 'granted'
                ? 'Allowed — reminders can appear'
                : permissionStatus === 'denied'
                  ? 'Blocked — tap to enable in Settings'
                  : 'Checking…'}
            </Text>
          </View>

          {permissionStatus === 'denied' && (
            <ChevronRight size={18} color={Colors.textMuted} />
          )}
        </AnimatedPressable>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(48,209,88,0.12)' }]}>
            <Bell size={18} color={Colors.success} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Lock Reminder</Text>
            <Text style={styles.rowValue}>2 hours before race & sprint picks lock</Text>
          </View>

          <Switch
            value={notifications.lockReminder}
            onValueChange={(val) => updateNotifications({ lockReminder: val })}
            trackColor={{ false: Colors.surfaceHighlight, true: Colors.f1Red }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(10,132,255,0.12)' }]}>
            <Flag size={18} color={Colors.info} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Race Start</Text>
            <Text style={styles.rowValue}>When the race is about to start</Text>
          </View>

          <Switch
            value={notifications.raceStartReminder}
            onValueChange={(val) => updateNotifications({ raceStartReminder: val })}
            trackColor={{ false: Colors.surfaceHighlight, true: Colors.f1Red }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,159,10,0.12)' }]}>
            <Flag size={18} color={Colors.warning} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Sprint Start</Text>
            <Text style={styles.rowValue}>Before a sprint race begins (sprint weekends)</Text>
          </View>

          <Switch
            value={notifications.sprintStartReminder}
            onValueChange={(val) => updateNotifications({ sprintStartReminder: val })}
            trackColor={{ false: Colors.surfaceHighlight, true: Colors.f1Red }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,159,10,0.12)' }]}>
            <Flag size={18} color={Colors.warning} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Sprint Finished</Text>
            <Text style={styles.rowValue}>When the sprint ends and picks are scored</Text>
          </View>

          <Switch
            value={notifications.sprintEndReminder}
            onValueChange={(val) => updateNotifications({ sprintEndReminder: val })}
            trackColor={{ false: Colors.surfaceHighlight, true: Colors.f1Red }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(48,209,88,0.12)' }]}>
            <Flag size={18} color={Colors.success} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Race Finished</Text>
            <Text style={styles.rowValue}>When the race ends and picks are scored</Text>
          </View>

          <Switch
            value={notifications.raceEndReminder}
            onValueChange={(val) => updateNotifications({ raceEndReminder: val })}
            trackColor={{ false: Colors.surfaceHighlight, true: Colors.f1Red }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,214,10,0.12)' }]}>
            <Trophy size={18} color={Colors.warning} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Results Posted</Text>
            <Text style={styles.rowValue}>When race results are available</Text>
          </View>

          <Switch
            value={notifications.resultsPosted}
            onValueChange={(val) => updateNotifications({ resultsPosted: val })}
            trackColor={{ false: Colors.surfaceHighlight, true: Colors.f1Red }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.divider} />

        <AnimatedPressable
          onPress={() => void sendTestNotification()}
          style={styles.toggleRow}
        >
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(225, 6, 0, 0.12)' }]}>
            <Send size={18} color={Colors.f1Red} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Send Test Notification</Text>
            <Text style={styles.rowValue}>Check that reminders appear on this device</Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </AnimatedPressable>
      </View>

      {!isGuest && (
        <AnimatedPressable style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={18} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </AnimatedPressable>
      )}

      <Text style={styles.version}>Apex Draft F1 · v1.0.0</Text>

      <Modal
        visible={editorOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <AnimatedPressable style={styles.modalClose} onPress={closeEditor}>
              <X size={20} color={Colors.text} />
            </AnimatedPressable>

            <Text style={styles.modalTitle}>Edit Profile</Text>

            <AnimatedPressable
              style={[
                styles.modalSave,
                saving && styles.modalSaveDisabled,
                { backgroundColor: seriesColors.primary },
              ]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </AnimatedPressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalAvatarWrap}>
              <LinearGradient
                colors={[seriesColors.primary, seriesColors.primaryDark]}
                style={styles.modalAvatarRing}
              >
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>{initials}</Text>
                </View>
              </LinearGradient>

              <Text style={styles.modalAvatarHint}>Your initials update from your display name</Text>
            </View>

            {saveError && (
              <View style={styles.saveErrorBanner}>
                <Text style={styles.saveErrorText}>{saveError}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>Public Identity</Text>

            <ProfileField
              label="Display Name"
              icon={<UserIcon size={18} color={Colors.textMuted} />}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              error={formErrors.displayName}
              isFocused={focusedField === 'displayName'}
              accentColor={seriesColors.primary}
              onFocus={() => setFocusedField('displayName')}
              onBlur={() => setFocusedField(null)}
              maxLength={32}
              autoCapitalize="words"
              hint="Shown on leaderboards, leagues, and your profile."
            />

            <ProfileField
              label="Username"
              icon={<AtSign size={18} color={Colors.textMuted} />}
              value={username}
              onChangeText={(text) => setUsername(text.replace(/^@+/, '').replace(/\s/g, ''))}
              placeholder="username"
              error={formErrors.username}
              isFocused={focusedField === 'username'}
              accentColor={seriesColors.primary}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              maxLength={20}
              autoCapitalize="none"
              hint="3–20 characters. Letters, numbers, and underscores only."
            />

            <Text style={styles.sectionLabel}>Personal Details</Text>

            <View style={styles.fieldRowPair}>
              <ProfileField
                label="First Name"
                icon={<UserIcon size={18} color={Colors.textMuted} />}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                error={formErrors.firstName}
                isFocused={focusedField === 'firstName'}
                accentColor={seriesColors.primary}
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
                maxLength={32}
                autoCapitalize="words"
                style={styles.fieldHalf}
              />

              <ProfileField
                label="Last Name"
                icon={<UserIcon size={18} color={Colors.textMuted} />}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                error={formErrors.lastName}
                isFocused={focusedField === 'lastName'}
                accentColor={seriesColors.primary}
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
                maxLength={32}
                autoCapitalize="words"
                style={styles.fieldHalf}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Country</Text>
              <CountryPicker
                value={country}
                onChange={(next) => {
                  setCountry(next);
                  if (formErrors.country) {
                    setFormErrors((prev) => ({ ...prev, country: undefined }));
                  }
                }}
                placeholder="Select Country"
              />
              {formErrors.country ? <Text style={styles.fieldError}>{formErrors.country}</Text> : null}
            </View>

            <AnimatedPressable
              style={[
                styles.modalSaveBig,
                saving && styles.modalSaveDisabled,
                { backgroundColor: seriesColors.primary },
              ]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              <Save size={18} color="#FFF" />
              <Text style={styles.modalSaveBigText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </AnimatedPressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

interface ProfileFieldErrors {
  displayName?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
}

interface ProfileFieldProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  isFocused: boolean;
  accentColor: string;
  onFocus: () => void;
  onBlur: () => void;
  maxLength?: number;
  autoCapitalize?: 'none' | 'words';
  hint?: string;
  style?: object;
}

function ProfileField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  error,
  isFocused,
  accentColor,
  onFocus,
  onBlur,
  maxLength,
  autoCapitalize = 'words',
  hint,
  style,
}: ProfileFieldProps) {
  const hasError = Boolean(error);

  return (
    <View style={[styles.fieldGroup, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <View
        style={[
          styles.fieldWrap,
          isFocused && !hasError && { borderColor: accentColor, borderWidth: 1 },
          hasError && { borderColor: Colors.error, borderWidth: 1 },
        ]}
      >
        {icon}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          style={styles.fieldInput}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </View>

      {hasError ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  content: {
    padding: 16,
    paddingBottom: 60,
  },

  heroWrap: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
  },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 70,
    position: 'relative',
  },

  heroPattern: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  avatar: {
    flex: 1,
    borderRadius: 34,
    backgroundColor: '#1A0000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  editPillText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },

  heroName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  heroHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  heroHandle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  verifiedBadge: {
    marginLeft: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pointsBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  pointsBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    marginHorizontal: 16,
    marginTop: -50,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  statCell: {
    flex: 1,
    alignItems: 'center',
  },

  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },

  statLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 6, 0, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(225, 6, 0, 0.25)',
  },

  signInIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(225, 6, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  signInContent: {
    flex: 1,
  },

  signInTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },

  signInText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },

  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 8,
    marginTop: 4,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  rowContent: {
    flex: 1,
    minWidth: 0,
  },

  rowLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  rowValue: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 58,
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 59, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 59, 0.25)',
    marginBottom: 24,
  },

  signOutText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  version: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },

  modalRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },

  modalSave: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: Colors.f1Red,
  },

  modalSaveDisabled: {
    opacity: 0.5,
  },

  modalSaveText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },

  modalAvatarWrap: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },

  modalAvatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  modalAvatar: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveErrorBanner: {
    backgroundColor: 'rgba(255, 69, 58, 0.10)',
    borderColor: 'rgba(255, 69, 58, 0.30)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },

  saveErrorText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600',
  },

  fieldRowPair: {
    flexDirection: 'row',
    gap: 12,
  },

  fieldHalf: {
    flex: 1,
  },

  fieldError: {
    color: Colors.error,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
  },

  modalAvatarText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1,
  },

  modalAvatarHint: {
    color: Colors.textSecondary,
    fontSize: 12,
  },

  fieldGroup: {
    marginBottom: 20,
  },

  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },

  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  fieldInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 14,
    marginLeft: 10,
  },

  fieldHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
  },

  modalSaveBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.f1Red,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },

  modalSaveBigText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
});