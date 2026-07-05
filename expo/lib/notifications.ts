import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Race, NotificationSettings } from '@/types';

const STORAGE_KEY = 'apex_draft_scheduled_notifications';
const REMINDER_MINUTES = 5;
/** A main race is ~2 hours; a sprint race is ~45 minutes. */
const RACE_DURATION_MINUTES = 120;
const SPRINT_DURATION_MINUTES = 45;

export interface ScheduledNotification {
  notificationId: string;
  raceId: string;
  /** Which event this notification fires for. */
  event: 'sprint_start' | 'sprint_end' | 'race_start' | 'race_end';
  raceName: string;
  triggerDate: string;
}

/** Default notification settings if none are stored yet. */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  lockReminder: true,
  raceStartReminder: true,
  resultsPosted: true,
  sprintStartReminder: true,
  sprintEndReminder: true,
  raceEndReminder: true,
};

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
      name: 'Race & Sprint Reminders',
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

interface EventSpec {
  event: ScheduledNotification['event'];
  triggerDate: Date;
  title: string;
  body: string;
}

/**
 * Compute the four candidate events for a single race weekend.
 * Returns only events whose trigger time is still in the future.
 */
function computeRaceEvents(race: Race): EventSpec[] {
  const now = new Date();
  const events: EventSpec[] = [];

  // Sprint events — only on sprint weekends with a known sprint start time.
  if (race.hasSprint && race.sprintDate && race.sprintTime) {
    const sprintStart = new Date(`${race.sprintDate}T${race.sprintTime}:00Z`);
    const sprintStartReminder = new Date(
      sprintStart.getTime() - REMINDER_MINUTES * 60 * 1000,
    );
    if (sprintStartReminder > now) {
      events.push({
        event: 'sprint_start',
        triggerDate: sprintStartReminder,
        title: `${race.name} — Sprint Starting`,
        body: `The sprint race starts in ${REMINDER_MINUTES} minutes. Final chance to lock your sprint picks!`,
      });
    }

    const sprintEnd = new Date(
      sprintStart.getTime() + SPRINT_DURATION_MINUTES * 60 * 1000,
    );
    if (sprintEnd > now) {
      events.push({
        event: 'sprint_end',
        triggerDate: sprintEnd,
        title: `${race.name} — Sprint Finished`,
        body: `Sprint results are in — your sprint picks are being scored right now.`,
      });
    }
  }

  // Main race events.
  if (race.raceDate && race.raceTime) {
    const raceStart = new Date(`${race.raceDate}T${race.raceTime}:00Z`);
    const raceStartReminder = new Date(
      raceStart.getTime() - REMINDER_MINUTES * 60 * 1000,
    );
    if (raceStartReminder > now) {
      events.push({
        event: 'race_start',
        triggerDate: raceStartReminder,
        title: `${race.name}`,
        body: `The race starts in ${REMINDER_MINUTES} minutes! Make sure your picks are locked.`,
      });
    }

    const raceEnd = new Date(
      raceStart.getTime() + RACE_DURATION_MINUTES * 60 * 1000,
    );
    if (raceEnd > now) {
      events.push({
        event: 'race_end',
        triggerDate: raceEnd,
        title: `${race.name} — Race Finished`,
        body: `Race results are in — your picks are being scored right now. Tap to see how you did.`,
      });
    }
  }

  return events;
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

/** Map a notification event type to the matching user setting toggle. */
function eventEnabled(
  event: ScheduledNotification['event'],
  settings: NotificationSettings,
): boolean {
  switch (event) {
    case 'sprint_start':
      return settings.sprintStartReminder;
    case 'sprint_end':
      return settings.sprintEndReminder;
    case 'race_start':
      return settings.raceStartReminder;
    case 'race_end':
      return settings.raceEndReminder;
    default:
      return true;
  }
}

async function scheduleEvent(
  race: Race,
  spec: EventSpec,
): Promise<ScheduledNotification | null> {
  const now = new Date();
  const secondsUntilTrigger = Math.max(
    1,
    Math.floor((spec.triggerDate.getTime() - now.getTime()) / 1000),
  );

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: spec.title,
        body: spec.body,
        data: {
          raceId: race.id,
          event: spec.event,
          screen: spec.event === 'race_end' || spec.event === 'sprint_end'
            ? 'race-results'
            : 'predict-race',
        },
        sound: Platform.OS === 'ios' ? 'default' : undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
        channelId: Platform.OS === 'android' ? 'race-reminders' : undefined,
      },
    });

    console.log(
      '[Notifications] Scheduled', spec.event, 'for', race.name,
      'at', spec.triggerDate.toISOString(), '(in', secondsUntilTrigger, 's)',
    );

    return {
      notificationId,
      raceId: race.id,
      event: spec.event,
      raceName: race.name,
      triggerDate: spec.triggerDate.toISOString(),
    };
  } catch (e) {
    console.log('[Notifications] Failed to schedule', spec.event, 'for', race.name, ':', e);
    return null;
  }
}

/**
 * Schedule reminders for all upcoming sprint and race events.
 * Respects the user's per-event notification settings. Cancels and
 * reschedules when trigger dates change. Removes stale entries.
 */
export async function scheduleRaceReminders(
  races: Race[],
  settings: NotificationSettings,
): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping schedule');
    return;
  }

  const upcomingRaces = races.filter((r) => r.status === 'upcoming' || r.status === 'live');

  if (upcomingRaces.length === 0) {
    console.log('[Notifications] No upcoming races to schedule reminders for');
    return;
  }

  const existing = await loadScheduled();
  // Key by raceId + event so each scheduled notification is tracked individually.
  const existingMap = new Map(
    existing.map((e) => [`${e.raceId}:${e.event}`, e]),
  );
  const newScheduled: ScheduledNotification[] = [];
  const keepKeys = new Set<string>();

  for (const race of upcomingRaces) {
    const specs = computeRaceEvents(race);

    for (const spec of specs) {
      const key = `${race.id}:${spec.event}`;

      // Skip events the user has opted out of.
      if (!eventEnabled(spec.event, settings)) {
        const stale = existingMap.get(key);
        if (stale) {
          await Notifications.cancelScheduledNotificationAsync(stale.notificationId);
          console.log('[Notifications] Cancelled disabled event', spec.event, 'for', race.name);
        }
        continue;
      }

      const existingEntry = existingMap.get(key);
      const triggerIso = spec.triggerDate.toISOString();

      if (existingEntry && existingEntry.triggerDate === triggerIso) {
        // Unchanged — keep the existing notification.
        newScheduled.push(existingEntry);
        keepKeys.add(key);
        continue;
      }

      // Either new, or the trigger time changed — cancel the stale one first.
      if (existingEntry) {
        await Notifications.cancelScheduledNotificationAsync(existingEntry.notificationId);
        console.log('[Notifications] Cancelled stale', spec.event, 'for', race.name);
      }

      const scheduled = await scheduleEvent(race, spec);
      if (scheduled) {
        newScheduled.push(scheduled);
        keepKeys.add(key);
      }
    }
  }

  // Cancel any notifications that are no longer relevant (race no longer upcoming / disabled / changed).
  for (const entry of existing) {
    const key = `${entry.raceId}:${entry.event}`;
    if (!keepKeys.has(key)) {
      await Notifications.cancelScheduledNotificationAsync(entry.notificationId);
      console.log('[Notifications] Cancelled orphan reminder:', key);
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
