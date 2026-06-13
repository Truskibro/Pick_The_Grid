import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Race } from '@/types';

const STORAGE_KEY = 'apex_draft_scheduled_notifications';
const REMINDER_MINUTES = 5;

export interface ScheduledNotification {
  notificationId: string;
  raceId: string;
  raceName: string;
  triggerDate: string;
}

/** Configure how notifications appear when the app is in the foreground. */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Request notification permissions and return the token (or null). */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping registration');
    return null;
  }

  if (!Device.isDevice) {
    console.log('[Notifications] Not a physical device — skipping registration');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('race-reminders', {
      name: 'Race Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8002D',
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });

  console.log('[Notifications] Push token obtained:', token);
  return token;
}

/**
 * Schedule a 5-minute race reminder notification.
 * Returns the scheduled notification info, or null if scheduling failed.
 */
async function scheduleRaceReminder(race: Race): Promise<ScheduledNotification | null> {
  // Compute the race start time.
  const raceStart = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
  // Trigger 5 minutes before race start.
  const triggerDate = new Date(raceStart.getTime() - REMINDER_MINUTES * 60 * 1000);
  const now = new Date();

  // Don't schedule if the trigger time is already in the past.
  if (triggerDate <= now) {
    return null;
  }

  // Expo scheduled notifications have a max of ~30 days on some platforms.
  // We still try — if a race is more than 30 days out, schedule it anyway.
  const secondsUntilTrigger = Math.max(
    1,
    Math.floor((triggerDate.getTime() - now.getTime()) / 1000)
  );

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${race.name}`,
        body: `Predictions lock in ${REMINDER_MINUTES} minutes! Make your picks now.`,
        data: { raceId: race.id, screen: 'predict-race' },
        sound: Platform.OS === 'ios' ? 'default' : undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
        channelId: Platform.OS === 'android' ? 'race-reminders' : undefined,
      },
    });

    console.log(
      '[Notifications] Scheduled reminder for',
      race.name,
      'at',
      triggerDate.toISOString(),
      '(in',
      secondsUntilTrigger,
      's)'
    );

    return {
      notificationId,
      raceId: race.id,
      raceName: race.name,
      triggerDate: triggerDate.toISOString(),
    };
  } catch (e) {
    console.log('[Notifications] Failed to schedule reminder for', race.name, ':', e);
    return null;
  }
}

/** Persist scheduled notification records to AsyncStorage. */
async function saveScheduled(notifications: ScheduledNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.log('[Notifications] Failed to persist scheduled notifications:', e);
  }
}

/** Load previously scheduled notification records from AsyncStorage. */
async function loadScheduled(): Promise<ScheduledNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScheduledNotification[];
  } catch {
    return [];
  }
}

/**
 * Schedule reminders for all upcoming races that don't already have one.
 * Cancels and reschedules if the trigger date has changed (e.g. rescheduled race).
 */
export async function scheduleRaceReminders(races: Race[]): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping schedule');
    return;
  }

  const upcomingRaces = races.filter(
    (r) => r.status === 'upcoming' && r.raceDate && r.raceTime
  );

  if (upcomingRaces.length === 0) {
    console.log('[Notifications] No upcoming races to schedule reminders for');
    return;
  }

  const existing = await loadScheduled();
  const existingMap = new Map(existing.map((e) => [e.raceId, e]));
  const newScheduled: ScheduledNotification[] = [];

  for (const race of upcomingRaces) {
    const existingEntry = existingMap.get(race.id);

    if (existingEntry) {
      // Check if the trigger date has changed (e.g. rescheduled race).
      const raceStart = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
      const expectedTrigger = new Date(raceStart.getTime() - REMINDER_MINUTES * 60 * 1000);

      if (existingEntry.triggerDate === expectedTrigger.toISOString()) {
        // No change — keep existing notification.
        newScheduled.push(existingEntry);
        continue;
      }

      // Trigger date changed — cancel the old notification.
      await Notifications.cancelScheduledNotificationAsync(existingEntry.notificationId);
      console.log('[Notifications] Cancelled stale reminder for', race.name);
    }

    // Schedule a new notification.
    const scheduled = await scheduleRaceReminder(race);
    if (scheduled) {
      newScheduled.push(scheduled);
    }
  }

  // Remove notifications for races that are no longer upcoming.
  const newRaceIds = new Set(newScheduled.map((s) => s.raceId));
  for (const entry of existing) {
    if (!newRaceIds.has(entry.raceId)) {
      await Notifications.cancelScheduledNotificationAsync(entry.notificationId);
      console.log('[Notifications] Cancelled reminder for non-upcoming race:', entry.raceId);
    }
  }

  await saveScheduled(newScheduled);
  console.log('[Notifications] Active reminders:', newScheduled.length);
}

/**
 * Cancel all scheduled race reminders.
 */
export async function cancelAllRaceReminders(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(STORAGE_KEY);
  console.log('[Notifications] All race reminders cancelled');
}
