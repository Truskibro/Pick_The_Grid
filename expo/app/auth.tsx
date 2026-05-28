import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { COUNTRIES } from '@/constants/countries';
import { useUser } from '@/providers/UserProvider';
import AnimatedPressable from '@/components/AnimatedPressable';
import CountryPicker from '@/components/CountryPicker';

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, authError, isGuest, resendVerification } = useUser();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const NAME_REGEX = /^[\p{L}][\p{L}\s'\-]{0,31}$/u;

  const passwordChecks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  };
  const passwordStrong = passwordChecks.length && passwordChecks.letter && passwordChecks.number;
  const [loading, setLoading] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedCountry = country.trim();

    if (!normalizedEmail || !password) {
      Alert.alert('Missing Fields', 'Please enter email and password.');
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 254) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (mode === 'signup') {
      if (!trimmedFirst || !trimmedLast || !trimmedCountry) {
        Alert.alert('Missing Fields', 'Please enter your first name, last name, and country.');
        return;
      }
      if (!NAME_REGEX.test(trimmedFirst) || !NAME_REGEX.test(trimmedLast)) {
        Alert.alert(
          'Invalid Name',
          'Names must be 1–32 characters and only contain letters, spaces, hyphens, or apostrophes.'
        );
        return;
      }
      const isValidCountry = COUNTRIES.some(c => c.name === trimmedCountry);
      if (!isValidCountry) {
        Alert.alert('Invalid Country', 'Please select a valid country from the list.');
        return;
      }
      if (!passwordStrong) {
        Alert.alert(
          'Weak Password',
          'Password must be at least 8 characters and include both a letter and a number.'
        );
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Passwords Do Not Match', 'Please re-enter the same password in both fields.');
        return;
      }
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let success = false;
    if (mode === 'login') {
      success = await signIn(normalizedEmail, password);
    } else {
      success = await signUp(normalizedEmail, password, trimmedFirst, trimmedLast, trimmedCountry);
    }

    setLoading(false);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (mode === 'signup') {
        Alert.alert(
          'Verify Your Email',
          `We sent a confirmation link to ${normalizedEmail}. Tap the link in that email to activate your account, then come back here to sign in.`,
          [
            {
              text: 'Resend Email',
              onPress: async () => {
                const ok = await resendVerification(normalizedEmail);
                Alert.alert(
                  ok ? 'Email Sent' : 'Could Not Resend',
                  ok
                    ? 'A new confirmation email is on its way.'
                    : 'Please try again in a moment.'
                );
              },
            },
            { text: 'OK', onPress: () => setMode('login') },
          ]
        );
      } else {
        router.back();
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      Alert.alert('Enter Email', 'Type your email above and try again.');
      return;
    }
    const ok = await resendVerification(normalizedEmail);
    Alert.alert(
      ok ? 'Email Sent' : 'Could Not Resend',
      ok
        ? `A new confirmation email is on its way to ${normalizedEmail}.`
        : 'Please try again in a moment.'
    );
  };

  const switchMode = () => {
    Haptics.selectionAsync();
    setMode(prev => prev === 'login' ? 'signup' : 'login');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.logo}>APEX DRAFT</Text>
            <Text style={styles.logoSub}>F1</Text>
          </View>

          <Text style={styles.title}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Sign in to sync predictions and compete in leagues'
              : 'Join the ultimate F1 prediction game'}
          </Text>

          {authError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{authError}</Text>
              {mode === 'login' && /verify your email/i.test(authError) && (
                <AnimatedPressable onPress={handleResend} style={styles.resendBtn}>
                  <Text style={styles.resendText}>Resend verification email</Text>
                </AnimatedPressable>
              )}
            </View>
          )}

          {mode === 'signup' && (
            <>
              <View style={styles.inputWrapper}>
                <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor={Colors.textMuted}
                  autoCorrect={false}
                  autoComplete="given-name"
                  textContentType="givenName"
                  maxLength={32}
                />
              </View>

              <View style={styles.inputWrapper}>
                <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                  placeholderTextColor={Colors.textMuted}
                  autoCorrect={false}
                  autoComplete="family-name"
                  textContentType="familyName"
                  maxLength={32}
                />
              </View>

              <CountryPicker
                value={country}
                onChange={setCountry}
                placeholder="Select Country"
              />
            </>
          )}

          <View style={styles.inputWrapper}>
            <Mail size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={254}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'signup' ? 'Password (8+ chars, letter & number)' : 'Password'}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              maxLength={72}
            />
            <AnimatedPressable
              onPress={() => setShowPassword(prev => !prev)}
              style={styles.eyeBtn}
            >
              {showPassword
                ? <EyeOff size={18} color={Colors.textMuted} />
                : <Eye size={18} color={Colors.textMuted} />
              }
            </AnimatedPressable>
          </View>

          {mode === 'signup' && (
            <>
              <View style={styles.inputWrapper}>
                <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  maxLength={72}
                />
              </View>

              {password.length > 0 && (
                <View style={styles.strengthBox}>
                  <PasswordRule ok={passwordChecks.length} label="At least 8 characters" />
                  <PasswordRule ok={passwordChecks.letter} label="Contains a letter" />
                  <PasswordRule ok={passwordChecks.number} label="Contains a number" />
                </View>
              )}
            </>
          )}

          <AnimatedPressable onPress={handleSubmit} disabled={loading} style={styles.submitBtn}>
            <LinearGradient
              colors={[Colors.f1Red, Colors.f1RedDark]}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>
                  <ArrowRight size={18} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </AnimatedPressable>

          <AnimatedPressable onPress={switchMode} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
              <Text style={styles.switchTextBold}>
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </AnimatedPressable>

          <AnimatedPressable onPress={() => router.back()} style={styles.guestBtn}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.ruleRow}>
      <View style={[styles.ruleDot, ok && styles.ruleDotOk]}>
        {ok && <Check size={10} color="#FFF" />}
      </View>
      <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  inner: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  logo: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: 2,
  },
  logoSub: {
    color: Colors.f1Red,
    fontSize: 28,
    fontWeight: '900' as const,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700' as const,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 59, 59, 0.12)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 59, 0.25)',
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    lineHeight: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: 4,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  switchBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  switchTextBold: {
    color: Colors.f1Red,
    fontWeight: '700' as const,
  },
  guestBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  guestText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  strengthBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleDotOk: { backgroundColor: Colors.success },
  ruleText: { color: Colors.textMuted, fontSize: 12 },
  ruleTextOk: { color: Colors.text },
  resendBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  resendText: {
    color: Colors.f1Red,
    fontSize: 13,
    fontWeight: '700' as const,
  },
});
