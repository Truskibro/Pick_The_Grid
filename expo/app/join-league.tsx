import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useGame } from '@/providers/GameProvider';
import { useUser } from '@/providers/UserProvider';
import AnimatedPressable from '@/components/AnimatedPressable';

export default function JoinLeagueScreen() {
  const router = useRouter();
  const { findLeagueByCode, joinLeague } = useGame();
  const { profile } = useUser();
  const [code, setCode] = useState<string>('');

  const handleJoin = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter a join code.');
      return;
    }

    const league = await findLeagueByCode(code.trim());
    if (!league) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not Found', 'No league found with that join code. Check and try again.');
      return;
    }

    const success = await joinLeague(
      league.id,
      profile.id,
      profile.username,
      profile.displayName,
    );

    if (!success) {
      Alert.alert('Already Joined', "You're already a member of this league.");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Joined!', `You've joined "${league.name}".`, [
      { text: 'View League', onPress: () => { router.back(); router.push(`/league-detail/${league.id}` as any); } },
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.illustration}>
        <Search size={48} color={Colors.textMuted} />
      </View>

      <Text style={styles.title}>Join a League</Text>
      <Text style={styles.subtitle}>
        Enter the join code shared by the league creator to join their competition.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Join Code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="e.g. ABC123"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={10}
        />
      </View>

      <AnimatedPressable onPress={handleJoin} style={styles.joinBtn}>
        <LinearGradient colors={[Colors.f1Red, Colors.f1RedDark]} style={styles.joinGradient}>
          <Text style={styles.joinText}>Join League</Text>
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
    alignItems: 'center',
  },
  illustration: {
    marginTop: 20,
    marginBottom: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    maxWidth: 300,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  joinBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  joinGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
