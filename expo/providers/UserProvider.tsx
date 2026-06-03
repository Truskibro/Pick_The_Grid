import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured, checkSupabaseReachable } from '@/lib/supabase';
import { UserProfile, NotificationSettings } from '@/types';
import { Session, User } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  profile: 'apex_draft_profile',
  onboardingSeen: 'apex_draft_onboarding',
  notifications: 'apex_draft_notifications',
} as const;

const DEFAULT_PROFILE: UserProfile = {
  id: 'guest',
  username: 'guest',
  displayName: 'Guest Player',
  firstName: '',
  lastName: '',
  country: '',
  totalPoints: 0,
  rank: 0,
  leaguesJoined: 0,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  lockReminder: true,
  raceStartReminder: true,
  resultsPosted: true,
};

export const [UserProvider, useUser] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(true);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const loadSupabaseProfile = useCallback(async (user: User) => {
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured, using local profile for user:', user.id);
      const fallback: UserProfile = {
        id: user.id,
        username: user.user_metadata?.username || 'user_' + user.id.substring(0, 8),
        displayName: user.user_metadata?.display_name || 'New Player',
        firstName: user.user_metadata?.first_name || '',
        lastName: user.user_metadata?.last_name || '',
        country: user.user_metadata?.country || '',
        totalPoints: 0,
        rank: 0,
        leaguesJoined: 0,
      };
      setProfile(fallback);
      await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(fallback));
      return;
    }
    try {
      console.log('Loading Supabase profile for user:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('Profile fetch error:', error.message, '- creating profile now');
        const username = user.user_metadata?.username || 'user_' + user.id.substring(0, 8);
        const displayName = user.user_metadata?.display_name || 'New Player';
        const firstName = (user.user_metadata?.first_name as string) || '';
        const lastName = (user.user_metadata?.last_name as string) || '';
        const country = (user.user_metadata?.country as string) || '';

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            username,
            display_name: displayName,
            first_name: firstName,
            last_name: lastName,
            country,
            total_points: 0,
          }, { onConflict: 'id' });

        if (upsertError) {
          console.log('Profile upsert error:', upsertError.message);
        } else {
          console.log('Profile created in Supabase for user:', user.id);
        }

        const fallback: UserProfile = {
          id: user.id,
          username,
          displayName,
          firstName,
          lastName,
          country,
          totalPoints: 0,
          rank: 0,
          leaguesJoined: 0,
        };
        setProfile(fallback);
        await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(fallback));
        return;
      }

      if (data) {
        const userProfile: UserProfile = {
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          country: data.country || '',
          totalPoints: data.total_points || 0,
          rank: 0,
          leaguesJoined: 0,
        };
        setProfile(userProfile);
        await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(userProfile));
        console.log('Profile loaded:', userProfile.username);
      }
    } catch (e) {
      console.log('Error loading Supabase profile:', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [onboardingData, notifData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.onboardingSeen),
          AsyncStorage.getItem(STORAGE_KEYS.notifications),
        ]);

        if (onboardingData) setOnboardingSeen(JSON.parse(onboardingData));
        if (notifData) setNotifications(JSON.parse(notifData));

        if (!isSupabaseConfigured) {
          console.log('Supabase not configured, skipping session check');
          const cachedProfile = await AsyncStorage.getItem(STORAGE_KEYS.profile);
          if (cachedProfile) {
            const parsed = JSON.parse(cachedProfile);
            if (parsed.id !== 'guest') {
              setProfile(parsed);
              setIsGuest(false);
            }
          }
          setIsLoading(false);
          return;
        }

        let currentSession: Session | null = null;
        let sessionError: any = null;
        try {
          const result = await supabase.auth.getSession();
          currentSession = result.data?.session ?? null;
          sessionError = result.error;
        } catch (e: any) {
          console.log('Session fetch failed (network):', e?.message || e);
          const cachedProfile = await AsyncStorage.getItem(STORAGE_KEYS.profile);
          if (cachedProfile) {
            const parsed = JSON.parse(cachedProfile);
            if (parsed.id !== 'guest') {
              setProfile(parsed);
              setIsGuest(false);
            }
          }
          setIsLoading(false);
          return;
        }
        console.log('Initial session check:', currentSession ? 'found' : 'none', sessionError?.message || '');

        if (sessionError) {
          console.log('Session error, clearing invalid session:', sessionError.message);
          try { await supabase.auth.signOut(); } catch { }
          await AsyncStorage.removeItem(STORAGE_KEYS.profile);
          setProfile(DEFAULT_PROFILE);
          setIsGuest(true);
          setSession(null);
        } else if (currentSession?.user) {
          setSession(currentSession);
          setIsGuest(false);
          await loadSupabaseProfile(currentSession.user);
        } else {
          const cachedProfile = await AsyncStorage.getItem(STORAGE_KEYS.profile);
          if (cachedProfile) {
            const parsed = JSON.parse(cachedProfile);
            if (parsed.id !== 'guest') {
              setProfile(parsed);
              setIsGuest(false);
            }
          }
        }
      } catch (e) {
        console.log('Error during init:', e);
      } finally {
        setIsLoading(false);
      }
    };

    void init();

    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);

      if (event === 'TOKEN_REFRESHED' && !newSession) {
        console.log('Token refresh failed, signing out');
        setProfile(DEFAULT_PROFILE);
        setIsGuest(true);
        setSession(null);
        await AsyncStorage.removeItem(STORAGE_KEYS.profile);
        queryClient.clear();
        return;
      }

      setSession(newSession);

      if (event === 'SIGNED_IN' && newSession?.user) {
        setIsGuest(false);
        await loadSupabaseProfile(newSession.user);
        void queryClient.invalidateQueries();
      } else if (event === 'SIGNED_OUT') {
        setProfile(DEFAULT_PROFILE);
        setIsGuest(true);
        setSession(null);
        await AsyncStorage.removeItem(STORAGE_KEYS.profile);
        queryClient.clear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSupabaseProfile, queryClient]);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string, country: string) => {
    setAuthError(null);

    // Server-side normalization (defence in depth — client should already validate)
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFirst = firstName.trim().slice(0, 32);
    const trimmedLast = lastName.trim().slice(0, 32);
    const trimmedCountry = country.trim().slice(0, 56);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const nameRegex = /^[\p{L}][\p{L}\s'\-]{0,31}$/u;

    if (!emailRegex.test(normalizedEmail)) {
      setAuthError('Please enter a valid email address.');
      return false;
    }
    if (!nameRegex.test(trimmedFirst) || !nameRegex.test(trimmedLast)) {
      setAuthError('Names may only contain letters, spaces, hyphens, or apostrophes.');
      return false;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setAuthError('Password must be at least 8 characters and include a letter and a number.');
      return false;
    }

    console.log('Signing up:', normalizedEmail);

    if (!isSupabaseConfigured) {
      setAuthError('Authentication is not configured. Please try again later.');
      return false;
    }

    const reachable = await checkSupabaseReachable();
    if (!reachable) {
      setAuthError('Cannot connect to the server. The backend may be paused or unavailable. Please try again later.');
      return false;
    }

    try {
      // Auto-generate username and displayName from first/last name.
      // Username collisions are resolved server-side by handle_new_user().
      const baseUsername = (trimmedFirst + '_' + trimmedLast)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 20);
      const generatedUsername = baseUsername.length >= 3 ? baseUsername : 'user';
      const generatedDisplayName = (trimmedFirst + ' ' + trimmedLast).trim();

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            username: generatedUsername,
            display_name: generatedDisplayName,
            first_name: trimmedFirst,
            last_name: trimmedLast,
            country: trimmedCountry,
          },
        },
      });

      if (error) {
        console.log('Signup error:', error.message);
        setAuthError(error.message);
        return false;
      }

      if (data.user) {
        console.log('Signup successful, user:', data.user.id, 'confirmed:', !!data.user.email_confirmed_at);
      }

      // If Supabase returned an active session (project has email confirmation
      // disabled), immediately sign out so the user MUST verify their email
      // before they can sign in. This enforces verification client-side even
      // if the Supabase "Confirm email" setting is off.
      if (data.session) {
        console.log('Auto-session detected after signup, signing out to enforce verification');
        try { await supabase.auth.signOut(); } catch { }
      }

      return true;
    } catch (e: any) {
      console.log('Signup network error:', e?.message || e);
      setAuthError('Cannot reach the server. Please check your connection and try again.');
      return false;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    console.log('Signing in:', email);

    if (!isSupabaseConfigured) {
      setAuthError('Authentication is not configured. Please try again later.');
      return false;
    }

    const reachable = await checkSupabaseReachable();
    if (!reachable) {
      setAuthError('Cannot connect to the server. The backend may be paused or unavailable. Please try again later.');
      return false;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        console.log('Signin error:', error.message);
        // Supabase returns this message when email confirmation is required.
        if (/email not confirmed|confirm/i.test(error.message)) {
          setAuthError('Please verify your email before signing in. Check your inbox for the confirmation link.');
        } else {
          setAuthError(error.message);
        }
        return false;
      }

      // Defence in depth — if Supabase has confirmation off, enforce it here.
      if (data.user && !data.user.email_confirmed_at) {
        console.log('Signin blocked — email not verified');
        try { await supabase.auth.signOut(); } catch { }
        setAuthError('Please verify your email before signing in. Check your inbox for the confirmation link.');
        return false;
      }

      if (data.user) {
        console.log('Signin successful, user:', data.user.id);
      }

      return true;
    } catch (e: any) {
      console.log('Signin network error:', e?.message || e);
      setAuthError('Cannot reach the server. Please check your connection and try again.');
      return false;
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      setAuthError('Authentication is not configured. Please try again later.');
      return false;
    }
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (error) {
        console.log('Resend verification error:', error.message);
        setAuthError(error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      console.log('Resend verification network error:', e?.message || e);
      setAuthError('Cannot reach the server. Please check your connection and try again.');
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('Signing out...');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log('Sign out error (clearing locally anyway):', e);
    }
    setProfile(DEFAULT_PROFILE);
    setIsGuest(true);
    setSession(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.profile);
    queryClient.clear();
  }, [queryClient]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(updated));

    if (session?.user && isSupabaseConfigured) {
      // Use upsert so a missing profile row (signup-trigger race) still persists.
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          username: updated.username,
          display_name: updated.displayName,
          first_name: updated.firstName ?? '',
          last_name: updated.lastName ?? '',
          country: updated.country ?? '',
          total_points: updated.totalPoints ?? 0,
        }, { onConflict: 'id' });

      if (upsertError) {
        console.log('Profile upsert error:', upsertError.message);
        return;
      }

      // Read back to confirm Supabase has the values we just wrote.
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('id, username, display_name, first_name, last_name, country, total_points')
        .eq('id', session.user.id)
        .single();

      if (verifyError) {
        console.log('Profile verify error:', verifyError.message);
        return;
      }

      if (verifyData) {
        const confirmed: UserProfile = {
          id: verifyData.id,
          username: verifyData.username,
          displayName: verifyData.display_name,
          firstName: verifyData.first_name || '',
          lastName: verifyData.last_name || '',
          country: verifyData.country || '',
          // CRITICAL: Never let a Supabase read-back zero out a totalPoints
          // that was just set. If the upsert was for totalPoints specifically,
          // use the value we wrote, not whatever stale data came back.
          totalPoints: updates.totalPoints != null
            ? updates.totalPoints
            : (verifyData.total_points || 0),
          rank: profile.rank,
          leaguesJoined: profile.leaguesJoined,
        };
        setProfile(confirmed);
        await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(confirmed));
        console.log('Profile confirmed in Supabase:', confirmed.username, '/', confirmed.displayName, 'pts:', confirmed.totalPoints);
      }
    }
  }, [profile, session]);

  const markOnboardingSeen = useCallback(async () => {
    setOnboardingSeen(true);
    await AsyncStorage.setItem(STORAGE_KEYS.onboardingSeen, JSON.stringify(true));
  }, []);

  const updateNotifications = useCallback(async (updates: Partial<NotificationSettings>) => {
    const updated = { ...notifications, ...updates };
    setNotifications(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(updated));
  }, [notifications]);

  return useMemo(() => ({
    profile,
    session,
    isGuest,
    onboardingSeen,
    notifications,
    isLoading,
    authError,
    signUp,
    signIn,
    signOut,
    resendVerification,
    updateProfile,
    markOnboardingSeen,
    updateNotifications,
  }), [profile, session, isGuest, onboardingSeen, notifications, isLoading, authError, signUp, signIn, signOut, resendVerification, updateProfile, markOnboardingSeen, updateNotifications]);
});
