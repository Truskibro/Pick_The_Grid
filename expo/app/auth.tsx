import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Info,
  Flag,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { COUNTRIES } from '@/constants/countries';
import { useUser } from '@/providers/UserProvider';
import AnimatedPressable from '@/components/AnimatedPressable';
import CountryPicker from '@/components/CountryPicker';

type AuthMode = 'login' | 'signup';

interface Notice {
  type: 'error' | 'info';
  text: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[\p{L}][\p{L}\s'\-]{0,31}$/u;

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

  const passwordChecks = {
    length: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
  };
  const passwordStrong = passwordChecks.length && passwordChecks.letter && passwordChecks.number;
  const [loading, setLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // The combined message shown in the inline banner: provider auth errors plus
  // page-local notices. Inline (never Alert.alert) so it is visible on web too.
  const banner: Notice | null = notice ?? (authError ? { type: 'error', text: authError } : null);

  const navigateAfterAuth = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        // /auth was the entry route (e.g. page reload in the preview) — there
        // is no stack to pop, so send the user into the app directly.
        router.replace('/(tabs)' as any);
      }
    } catch {
      router.replace('/(tabs)' as any);
    }
  };

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedCountry = country.trim();

    setNotice(null);

    if (!normalizedEmail || !password) {
      setNotice({ type: 'error', text: 'Please enter your email and password.' });
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 254) {
      setNotice({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    if (mode === 'signup') {
      if (!trimmedFirst || !trimmedLast || !trimmedCountry) {
        setNotice({ type: 'error', text: 'Please enter your first name, last name, and country.' });
        return;
      }
      if (!NAME_REGEX.test(trimmedFirst) || !NAME_REGEX.test(trimmedLast)) {
        setNotice({
          type: 'error',
          text: 'Names must be 1–32 characters and only contain letters, spaces, hyphens, or apostrophes.',
        });
        return;
      }
      const isValidCountry = COUNTRIES.some(c => c.name === trimmedCountry);
      if (!isValidCountry) {
        setNotice({ type: 'error', text: 'Please select a valid country from the list.' });
        return;
      }
      if (!passwordStrong) {
        setNotice({
          type: 'error',
          text: 'Password must be at least 8 characters and include both a letter and a number.',
        });
        return;
      }
      if (password !== confirmPassword) {
        setNotice({ type: 'error', text: 'Passwords do not match — please re-enter the same password in both fields.' });
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
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setNotice({
          type: 'info',
          text: `We sent a confirmation link to ${normalizedEmail}. Tap the link in that email to activate your account, then come back here and sign in.`,
        });
      } else {
        navigateAfterAuth();
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setNotice({ type: 'error', text: 'Type your email above and try again.' });
      return;
    }
    const ok = await resendVerification(normalizedEmail);
    setNotice(
      ok
        ? { type: 'info', text: `A new confirmation email is on its way to ${normalizedEmail}.` }
        : { type: 'error', text: 'Could not resend the verification email — please try again in a moment.' },
    );
  };

  const switchMode = (next: AuthMode) => {
    if (mode === next) return;
    Haptics.selectionAsync();
    setMode(next);
    setNotice(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[`${Colors.f1Red}26`, 'transparent']}
        style={styles.topGlow}
        pointerEvents="none"
      />
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
              <View style={styles.flagIcon}>
                <Flag size={16} color="#FFF" />
              </View>
              <Text style={styles.logo}>APEX DRAFT</Text>
              <Text style={styles.logoSub}>F1</Text>
            </View>

            {/* Segmented mode switch */}
            <View style={styles.modeSwitch}>
              <AnimatedPressable
                style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
                onPress={() => switchMode('login')}
              >
                <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>
                  Sign In
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
                onPress={() => switchMode('signup')}
              >
                <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
                  Sign Up
                </Text>
              </AnimatedPressable>
            </View>

            <Text style={styles.title}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in to sync predictions and compete in leagues.'
                : 'Join the ultimate F1 prediction game.'}
            </Text>

            {banner && (
              <View
                style={[
                  styles.banner,
                  banner.type === 'error' ? styles.bannerError : styles.bannerInfo,
                ]}
              >
                {banner.type === 'error'
                  ? <AlertCircle size={16} color={Colors.error} style={styles.bannerIcon} />
                  : <Info size={16} color={Colors.f1Red} style={styles.bannerIcon} />}
                <View style={styles.bannerBody}>
                  <Text
                    style={[
                      styles.bannerText,
                      banner.type === 'error' && styles.bannerTextError,
                    ]}
                  >
                    {banner.text}
                  </Text>
                  {/verify your email/i.test(banner.text) && (
                    <AnimatedPressable onPress={handleResend} style={styles.resendBtn}>
                      <Text style={styles.resendText}>Resend verification email</Text>
                    </AnimatedPressable>
                  )}
                </View>
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

            <AnimatedPressable onPress={() => router.back()} style={styles.guestBtn}>
              <Text style={styles.guestText}>Continue as Guest</Text>
            </AnimatedPressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  container: {
    flex: 1,
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  flagIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.f1Red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '900' as const,
    letterSpacing: 2,
  },
  logoSub: {
    color: Colors.f1Red,
    fontSize: 24,
    fontWeight: '900' as const,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  modeBtnActive: {
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: `${Colors.f1Red}55`,
    paddingVertical: 9,
  },
  modeBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  modeBtnTextActive: {
    color: Colors.f1Red,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800' as const,
    marginTop: 4,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  banner: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bannerError: {
    backgroundColor: 'rgba(255, 59, 59, 0.12)',
    borderColor: 'rgba(255, 59, 59, 0.25)',
  },
  bannerInfo: {
    backgroundColor: 'rgba(225, 6, 0, 0.08)',
    borderColor: `${Colors.f1Red}44`,
  },
  bannerIcon: {
    marginTop: 1,
  },
  bannerBody: {
    flex: 1,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
  },
  bannerTextError: {
    color: Colors.error,
  },
  resendBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  resendText: {
    color: Colors.f1Red,
    fontSize: 13,
    fontWeight: '700' as const,
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
});
