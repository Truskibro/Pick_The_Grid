import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import createContextHook from '@nkzw/create-context-hook';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useUser } from '@/providers/UserProvider';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (!Device.isDevice) {
    console.log('[Notifications] Must use a physical device for push notifications');
    return undefined;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('race-updates', {
      name: 'Race Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E10600',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return undefined;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_PROJECT_ID;

  if (!projectId) {
    console.log('[Notifications] No projectId available');
    return undefined;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[Notifications] Got push token');
    return tokenData.data;
  } catch (e) {
    console.log('[Notifications] Failed to get push token:', e);
    return undefined;
  }
}

async function savePushTokenToSupabase(userId: string, token: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.log('[Notifications] Failed to save push token:', error.message);
    } else {
      console.log('[Notifications] Push token saved for user:', userId);
    }
  } catch (e) {
    console.log('[Notifications] Error saving push token:', e);
  }
}

async function removePushTokenFromSupabase(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: null })
      .eq('id', userId);

    if (error) {
      console.log('[Notifications] Failed to remove push token:', error.message);
    }
  } catch (e) {
    console.log('[Notifications] Error removing push token:', e);
  }
}

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const router = useRouter();
  const { session, isGuest, profile } = useUser();

  const notificationListener = useRef<Notifications.EventSubscription>(undefined);
  const responseListener = useRef<Notifications.EventSubscription>(undefined);
  const registeredTokenRef = useRef<string | null>(null);

  const registerToken = useCallback(async () => {
    const token = await registerForPushNotificationsAsync();
    if (token && session?.user) {
      registeredTokenRef.current = token;
      await savePushTokenToSupabase(session.user.id, token);
    }
  }, [session]);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notifications] Received:', notification.request.content.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[Notifications] Tapped:', data);

      if (data?.raceId && typeof data.raceId === 'string') {
        router.push(`/race-results/${data.raceId}` as any);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  useEffect(() => {
    if (!isGuest && session?.user) {
      void registerToken();
    } else if (isGuest && registeredTokenRef.current) {
      void removePushTokenFromSupabase(profile.id);
      registeredTokenRef.current = null;
    }
  }, [isGuest, session, registerToken, profile.id]);

  return { registerToken };
});
