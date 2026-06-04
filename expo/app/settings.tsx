import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
  Check,
  ChevronRight,
  FileText,
  Flag,
  LogIn,
  LogOut,
  Pencil,
  Save,
  Shield,
  Trophy,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import AnimatedPressable from '@/components/AnimatedPressable';
import CountryPicker from '@/components/CountryPicker';
import Colors from '@/constants/colors';
import { COUNTRIES } from '@/constants/countries';
import { useAchievements } from '@/providers/AchievementProvider';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';

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

  const { leagues, totalPoints, predictions } = useGame();
  const { unlockedCount, totalTiersCount, unlockedTiersCount } = useAchievements();

  const [editorOpen, setEditorOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [country, setCountry] = useState(profile.country);
  const [saving, setSaving] = useState(false);

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
    setEditorOpen(true);
  };

  const handleSaveProfile = async () => {
    const trimmedDisplayName = displayName.trim().replace(/\s+/g, ' ');
    const trimmedUsername = username.trim().replace(/^@+/, '');
    const trimmedFirst = firstName.trim().replace(/\s+/g, ' ');
    const trimmedLast = lastName.trim().replace(/\s+/g, ' ');
    const trimmedCountry = country.trim();

    if (!trimmedDisplayName || !trimmedUsername || !trimmedFirst || !trimmedLast || !trimmedCountry) {
      Alert.alert('Missing info', 'Display name, username, first name, last name, and country are required.');
      return;
    }

    if (!DISPLAY_NAME_REGEX.test(trimmedDisplayName)) {
      Alert.alert(
        'Invalid display name',
        'Display name must be 2–32 characters and can use letters, numbers, spaces, apostrophes, periods, hyphens, and underscores.'
      );
      return;
    }

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      Alert.alert(
        'Invalid username',
        'Username must be 3–20 characters and can only use letters, numbers, and underscores.'
      );
      return;
    }

    if (!NAME_REGEX.test(trimmedFirst) || !NAME_REGEX.test(trimmedLast)) {
      Alert.alert(
        'Invalid name',
        'First and last name must be 1–32 characters and only contain letters, spaces, hyphens, or apostrophes.'
      );
      return;
    }

    if (!COUNTRIES.some((c) => c.name === trimmedCountry)) {
      Alert.alert('Invalid country', 'Please select a valid country from the list.');
      return;
    }

    setSaving(true);

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
      Alert.alert('Save failed', e?.message || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroWrap}>
        <LinearGradient colors={[Colors.f1RedDark, '#1A1025']} style={styles.hero}>
          <View style={styles.heroPattern} />

          <View style={styles.heroTop}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>

            <AnimatedPressable style={styles.editPill} onPress={openEditor}>
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
            <LogIn size={18} color={Colors.f1Red} />
          </View>

          <View style={styles.signInContent}>
            <Text style={styles.signInTitle}>Sign in to save your progress</Text>
            <Text style={styles.signInText}>Sync predictions and compete in leagues</Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </AnimatedPressable>
      )}

      <Text style={styles.sectionLabel}>Account</Text>

      <View style={styles.card}>
        <AnimatedPressable style={styles.row} onPress={openEditor}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(225,6,0,0.12)' }]}>
            <UserIcon size={18} color={Colors.f1Red} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Profile Settings</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {profile.displayName} · @{profile.username}
            </Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </AnimatedPressable>
      </View>

      <Text style={styles.sectionLabel}>Plaque</Text>

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
        <View style={styles.toggleRow}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(48,209,88,0.12)' }]}>
            <Bell size={18} color={Colors.success} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Lock Reminder</Text>
            <Text style={styles.rowValue}>2 hours before predictions lock</Text>
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
      </View>

      <Text style={styles.sectionLabel}>About</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <FileText size={18} color={Colors.textSecondary} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Terms of Service</Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Shield size={18} color={Colors.textSecondary} />
          </View>

          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </View>
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
        onRequestClose={() => setEditorOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <AnimatedPressable style={styles.modalClose} onPress={() => setEditorOpen(false)}>
              <X size={20} color={Colors.text} />
            </AnimatedPressable>

            <Text style={styles.modalTitle}>Edit Profile</Text>

            <AnimatedPressable
              style={[styles.modalSave, saving && styles.modalSaveDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </AnimatedPressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalAvatarWrap}>
              <LinearGradient colors={[Colors.f1Red, Colors.f1RedDark]} style={styles.modalAvatar}>
                <Text style={styles.modalAvatarText}>{initials}</Text>
              </LinearGradient>

              <Text style={styles.modalAvatarHint}>Your initials update from your display name</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <View style={styles.fieldWrap}>
                <UserIcon size={18} color={Colors.textMuted} />
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Display name"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.fieldInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={32}
                />
              </View>
              <Text style={styles.fieldHint}>This is the name shown on leaderboards, leagues, and your profile.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.fieldWrap}>
                <AtSign size={18} color={Colors.textMuted} />
                <TextInput
                  value={username}
                  onChangeText={(text) => setUsername(text.replace(/^@+/, '').replace(/\s/g, ''))}
                  placeholder="username"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.fieldInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
              </View>
              <Text style={styles.fieldHint}>3–20 characters. Letters, numbers, and underscores only.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>First Name</Text>
              <View style={styles.fieldWrap}>
                <UserIcon size={18} color={Colors.textMuted} />
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.fieldInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={32}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Last Name</Text>
              <View style={styles.fieldWrap}>
                <UserIcon size={18} color={Colors.textMuted} />
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.fieldInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={32}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Country</Text>
              <CountryPicker value={country} onChange={setCountry} placeholder="Select Country" />
            </View>

            <AnimatedPressable
              style={[styles.modalSaveBig, saving && styles.modalSaveDisabled]}
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

  modalAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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