import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Globe, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSeries } from '@/providers/SeriesProvider';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import AnimatedPressable from '@/components/AnimatedPressable';

export default function CreateLeagueScreen() {
  const router = useRouter();
  const { currentSeries } = useSeries();
  const { createLeague } = useGame();
  const { profile, isGuest } = useUser();
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleCreate = async () => {
    if (isGuest) {
      Alert.alert(
        'Account Required',
        'You need to log in or create an account to create a league.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/auth') },
        ]
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'League name is required.');
      return;
    }

    if (isCreating) return;

    setIsCreating(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const league = await createLeague(
        name.trim(),
        description.trim(),
        visibility,
        profile.id,
        profile.username,
        profile.displayName,
        currentSeries,
      );

      Alert.alert(
        'League Created!',
        `Join code: ${league.joinCode}\nShare this with friends to invite them.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (e: any) {
      console.log('Create league error:', e?.message);
      Alert.alert(
        'Error',
        e?.message || 'Failed to create league. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>League Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Apex Predators"
          placeholderTextColor={Colors.textMuted}
          maxLength={30}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's your league about?"
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
          maxLength={120}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Visibility</Text>
        <View style={styles.visibilityRow}>
          <AnimatedPressable
            style={[styles.visOption, visibility === 'public' && styles.visOptionActive]}
            onPress={() => setVisibility('public')}
          >
            <Globe size={20} color={visibility === 'public' ? Colors.info : Colors.textMuted} />
            <Text style={[styles.visText, visibility === 'public' && styles.visTextActive]}>Public</Text>
            <Text style={styles.visDesc}>Anyone can find and join</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={[styles.visOption, visibility === 'private' && styles.visOptionActive]}
            onPress={() => setVisibility('private')}
          >
            <Lock size={20} color={visibility === 'private' ? Colors.warning : Colors.textMuted} />
            <Text style={[styles.visText, visibility === 'private' && styles.visTextActive]}>Private</Text>
            <Text style={styles.visDesc}>Invite only via join code</Text>
          </AnimatedPressable>
        </View>
      </View>

      <AnimatedPressable onPress={handleCreate} style={[styles.createBtn, isCreating && styles.createBtnDisabled]}>
        <LinearGradient colors={[Colors.f1Red, Colors.f1RedDark]} style={styles.createGradient}>
          <Text style={styles.createText}>{isCreating ? 'Creating...' : 'Create League'}</Text>
        </LinearGradient>
      </AnimatedPressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  visOption: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  visOptionActive: {
    borderColor: Colors.f1Red,
    backgroundColor: 'rgba(225, 6, 0, 0.08)',
  },
  visText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  visTextActive: {
    color: Colors.text,
  },
  visDesc: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  createBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  createText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
