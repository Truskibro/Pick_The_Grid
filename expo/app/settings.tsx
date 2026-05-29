import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  User as UserIcon,
  Bell,
  FileText,
  LogOut,
  Save,
  LogIn,
  Trophy,
  Users,
  Flag,
  Pencil,
  X,
  ChevronRight,
  Check,
  Shield,
  AtSign,
  Eye,
  Award,
  ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';
import { useGame } from '@/providers/GameProvider';
import AnimatedPressable from '@/components/AnimatedPressable';
import CountryPicker from '@/components/CountryPicker';
import { COUNTRIES } from '@/constants/countries';
import { useAchievements } from '@/providers/AchievementProvider';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, isGuest, notifications, updateProfile, updateNotifications, signOut } = useUser();
  const { leagues, totalPoints, predictions } = useGame();
  const { unlockedCount, totalTiersCount, unlockedTiersCount } = useAchievements();

  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>(profile.firstName);
  const [lastName, setLastName] = useState<string>(profile.lastName);
  const [country, setCountry] = useState<string>(profile.country);
  const [saving, setSaving] = useState<boolean>(false);

  const NAME_REGEX = /^[\p{L}][\p{L}\s'\-]{0,31}$/u;

  useEffect(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setCountry(profile.country);
  }, [profile.firstName, profile.lastName, profile.country]);

  const initials = useMemo(() => {
    const source = (profile.displayName || profile.username || 'P').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }, [profile.displayName, profile.username]);

  const predictionsMade = useMemo(
    () => predictions.filter((p) => (p.top10?.length ?? 0) > 0 || p.fastestLap || p.dnf).length,
    [predictions],
  );

  const openEditor = () => {
    if (isGuest) {
      router.push('/auth' as any);
      return;
    }
    Haptics.selectionAsync();
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setCountry(profile.country);
    setEditorOpen(true);
  };

  const handleSaveProfile = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedCountry = country.trim();

    if (!trimmedFirst || !trimmedLast || !trimmedCountry) {
      Alert.alert('Missing info', 'First name, last name, and country are required.');
      return;
    }
    if (!NAME_REGEX.test(trimmedFirst) || !NAME_REGEX.test(trimmedLast)) {
      Alert.alert(
        'Invalid name',
        'Names must be 1–32 characters and only contain letters, spaces, hyphens, or apostrophes.'
      );
      return;
    }
    if (!COUNTRIES.some(c => c.name === trimmedCountry)) {
      Alert.alert('Invalid country', 'Please select a valid country from the list.');
      return;
    }

    const newDisplayName = (trimmedFirst + ' ' + trimmedLast).trim();

    setSaving(true);
    try {
      await updateProfile({
        displayName: newDisplayName,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        country: trimmedCountry,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditorOpen(false);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero profile card */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={[Colors.f1Red, Colors.f1RedDark, '#3A0000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroPattern} />
            <View style={styles.heroTop}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>
              <AnimatedPressable onPress={openEditor} style={styles.editPill}>
                <Pencil size={12} color="#FFF" />
                <Text style={styles.editPillText}>{isGuest ? 'Sign In' : 'Edit'}</Text>
              </AnimatedPressable>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {profile.displayName}
            </Text>
            <View style={styles.heroHandleRow}>
              <AtSign size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroHandle} numberOfLines={1}>
                {profile.username}
              </Text>
              {!isGuest && (
                <View style={styles.verifiedBadge}>
                  <Check size={10} color="#FFF" />
                </View>
              )}
            </View>
          </LinearGradient>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statCell}>
              <Trophy size={16} color={Colors.warning} />
              <Text style={styles.statValue}>{totalPoints}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Users size={16} color={Colors.info} />
              <Text style={styles.statValue}>{leagues.length}</Text>
              <Text style={styles.statLabel}>Leagues</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Flag size={16} color={Colors.success} />
              <Text style={styles.statValue}>{predictionsMade}</Text>
              <Text style={styles.statLabel}>Predicts</Text>
            </View>
          </View>
        </View>

        {isGuest && (
          <AnimatedPressable
            style={styles.signInBanner}
            onPress={() => router.push('/auth' as any)}
          >
            <View style={styles.signInIcon}>
              <LogIn size={18} color={Colors.f1Red} />
            </View>
            <View style={styles.signInContent}>
              <Text style={styles.signInTitle}>Sign in to save your progress</Text>
              <Text style={styles.signInText}>Sync predictions and compete in leagues</Text>
            </View>
            <ChevronRight size={18} color={Colors.textSecondary} />
          </AnimatedPressable>
        )}

        {/* Account row (profile edit) */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <AnimatedPressable onPress={openEditor} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(225,6,0,0.12)' }]}>
              <UserIcon size={16} color={Colors.f1Red} />
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

        {/* Plaque */}
        <Text style={styles.sectionLabel}>Plaque</Text>
        <View style={styles.card}>
          <AnimatedPressable
            onPress={() => {
              if (isGuest) {
                router.push('/auth' as any);
                return;
              }
              Haptics.selectionAsync();
              router.push('/achievements' as any);
            }}
            style={styles.row}
          >
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,214,10,0.12)' }]}>
              <Award size={16} color={Colors.warning} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Grid Badges</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {unlockedTiersCount}/{totalTiersCount} tiers · {unlockedCount} badges unlocked
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </AnimatedPressable>

          <View style={styles.divider} />

          <AnimatedPressable
            onPress={() => {
              if (isGuest) {
                router.push('/auth' as any);
                return;
              }
              Haptics.selectionAsync();
              router.push(`/profile/${profile.id}` as any);
            }}
            style={styles.row}
          >
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(10,132,255,0.12)' }]}>
              <Eye size={16} color={Colors.info} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Preview Public Profile</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                See your plaque, stats, and achievements
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </AnimatedPressable>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,214,10,0.12)' }]}>
              <Bell size={16} color={Colors.warning} />
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
              <Flag size={16} color={Colors.info} />
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
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(48,209,88,0.12)' }]}>
              <Trophy size={16} color={Colors.success} />
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

        {/* Legal */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <AnimatedPressable style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(142,142,147,0.15)' }]}>
              <FileText size={16} color={Colors.textSecondary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Terms of Service</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </AnimatedPressable>
          <View style={styles.divider} />
          <AnimatedPressable style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(142,142,147,0.15)' }]}>
              <Shield size={16} color={Colors.textSecondary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </AnimatedPressable>
        </View>

        {!isGuest && (
          <AnimatedPressable onPress={handleSignOut} style={styles.signOutBtn}>
            <LogOut size={16} color={Colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </AnimatedPressable>
        )}

        <Text style={styles.version}>Apex Draft F1 · v1.0.0</Text>
      </ScrollView>

      {/* Profile edit modal */}
      <Modal
        visible={editorOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditorOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <View style={styles.modalHeader}>
            <AnimatedPressable onPress={() => setEditorOpen(false)} style={styles.modalClose}>
              <X size={20} color={Colors.text} />
            </AnimatedPressable>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <AnimatedPressable
              onPress={handleSaveProfile}
              disabled={saving}
              style={[styles.modalSave, saving && styles.modalSaveDisabled]}
            >
              <Text style={styles.modalSaveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </AnimatedPressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalAvatarWrap}>
              <LinearGradient
                colors={[Colors.f1Red, Colors.f1RedDark]}
                style={styles.modalAvatar}
              >
                <Text style={styles.modalAvatarText}>
                  {((firstName[0] || '') + (lastName[0] || '') || 'P').toUpperCase()}
                </Text>
              </LinearGradient>
              <Text style={styles.modalAvatarHint}>Your initials</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>First Name</Text>
              <View style={styles.fieldWrap}>
                <UserIcon size={16} color={Colors.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={32}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Last Name</Text>
              <View style={styles.fieldWrap}>
                <UserIcon size={16} color={Colors.textSecondary} />
                <TextInput
                  style={styles.fieldInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={32}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Country</Text>
              <CountryPicker
                value={country}
                onChange={setCountry}
                placeholder="Select Country"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={[styles.fieldWrap, styles.fieldWrapDisabled]}>
                <AtSign size={16} color={Colors.textMuted} />
                <Text style={styles.fieldReadOnly} numberOfLines={1}>{profile.username}</Text>
              </View>
              <Text style={styles.fieldHint}>Your username is set at sign-up and can’t be changed.</Text>
            </View>

            <AnimatedPressable
              onPress={handleSaveProfile}
              disabled={saving}
              style={[styles.modalSaveBig, saving && styles.modalSaveDisabled]}
            >
              <Save size={16} color="#FFF" />
              <Text style={styles.modalSaveBigText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </AnimatedPressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 60 },

  heroWrap: { marginBottom: 24, borderRadius: 20, overflow: 'hidden' as const },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 70,
    position: 'relative' as const,
  },
  heroPattern: {
    position: 'absolute' as const,
    right: -30,
    top: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
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
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarText: { color: '#FFF', fontSize: 26, fontWeight: '800' as const, letterSpacing: 0.5 },
  editPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editPillText: { color: '#FFF', fontSize: 12, fontWeight: '700' as const },
  heroName: { color: '#FFF', fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  heroHandleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginTop: 4 },
  heroHandle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' as const },
  verifiedBadge: {
    marginLeft: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  statsStrip: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.surfaceElevated,
    marginHorizontal: 16,
    marginTop: -50,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCell: { flex: 1, alignItems: 'center' as const, gap: 4 },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: '800' as const },
  statLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  signInBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
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
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  signInContent: { flex: 1 },
  signInTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' as const, marginBottom: 2 },
  signInText: { color: Colors.textSecondary, fontSize: 12 },

  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
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
    overflow: 'hidden' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rowContent: { flex: 1 },
  rowLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' as const },
  rowValue: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 58 },

  signOutBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: 'rgba(255, 59, 59, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 59, 0.25)',
    marginBottom: 24,
  },
  signOutText: { color: Colors.error, fontSize: 14, fontWeight: '700' as const },
  version: { color: Colors.textMuted, fontSize: 12, textAlign: 'center' as const },

  // Modal
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  modalTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' as const },
  modalSave: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: Colors.f1Red,
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  modalContent: { padding: 20 },
  modalAvatarWrap: { alignItems: 'center' as const, marginBottom: 28, marginTop: 8 },
  modalAvatar: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    marginBottom: 10,
  },
  modalAvatarText: { color: '#FFF', fontSize: 36, fontWeight: '800' as const, letterSpacing: 1 },
  modalAvatarHint: { color: Colors.textSecondary, fontSize: 12 },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700' as const,
    textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8, marginLeft: 4,
  },
  fieldWrap: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  fieldInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 14 },
  fieldHint: { color: Colors.textMuted, fontSize: 11, marginTop: 6, marginLeft: 4 },
  fieldWrapDisabled: { opacity: 0.7 },
  fieldReadOnly: { flex: 1, color: Colors.textSecondary, fontSize: 15, paddingVertical: 14 },

  modalSaveBig: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, backgroundColor: Colors.f1Red, borderRadius: 12, paddingVertical: 16, marginTop: 8,
  },
  modalSaveBigText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },

});
