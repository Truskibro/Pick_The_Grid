import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Race, RaceResult, NotificationSettings } from '@/types';

const STORAGE_KEY = 'apex_draft_scheduled_notifications';
const NOTIFIED_RESULTS_KEY = 'apex_draft_results_notified';
const REMINDER_MINUTES = 10;
/** Lock reminders fire this long before race/sprint start. */
const LOCK_REMINDER_MINUTES = 120;
/** A main race is ~2 hours; a sprint race is ~45 minutes. */
const RACE_DURATION_MINUTES = 120;
const SPRINT_DURATION_MINUTES = 45;
/** Results notifications only fire within this window after a race ends. */
const RESULTS_FRESH_WINDOW_MS = 6 * 60 * 60 * 1000;

export type NotificationSeriesId = 'f1' | 'motogp';

export interface ScheduledNotification {
  notificationId: string;
  raceId: string;
  /** Which series this notification belongs to ('f1' | 'motogp'). */
  seriesId: NotificationSeriesId;
  /** Which event this notification fires for. */
  event:
    | 'sprint_lock'
    | 'sprint_start'
    | 'sprint_end'
    | 'race_lock'
    | 'race_start'
    | 'race_end'
    | 'results_posted';
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

/**
 * Parse a race date (YYYY-MM-DD) + time (HH:MM or HH:MM:SS, UTC) into a Date.
 * Supabase returns `time` columns as "HH:MM:SS", so naively appending ":00Z"
 * produces "13:00:00:00Z" — an invalid date that silently killed every
 * reminder. Normalizes both formats and returns null when unparseable.
 */
export function buildUtcDate(
  date?: string | null,
  time?: string | null,
): Date | null {
  if (!date || !time) return null;

  const cleanDate = String(date).trim();
  const rawTime = String(time).trim();

  if (!cleanDate || !rawTime) return null;

  // Normalize "HH:MM:SS" (and "HH:MM:SS.sss") down to "HH:MM".
  const timeParts = rawTime.split(':');
  const normalizedTime =
    timeParts.length >= 2
      ? `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`
      : rawTime;

  const hasTimezone =
    /[zZ]$/.test(normalizedTime) ||
    /[+-]\d{2}:?\d{2}$/.test(normalizedTime);

  const isoString = hasTimezone
    ? `${cleanDate}T${normalizedTime}`
    : `${cleanDate}T${normalizedTime}:00Z`;

  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
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

/**
 * Create the Android notification channel on demand so scheduled and
 * immediate notifications display even when push-token registration was
 * skipped (emulators, missing project ID).
 */
async function ensureAndroidChannel(): Promise<string | undefined> {
  if (Platform.OS !== 'android') return undefined;

  try {
    await Notifications.setNotificationChannelAsync('race-reminders', {
      name: 'Race & Sprint Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8002D',
    });
  } catch (e) {
    console.log('[Notifications] Failed to create Android channel:', e);
  }

  return 'race-reminders';
}

/** Request notification permissions and return the token (or null). */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping registration');
    return null;
  }

  if (!Device.isDevice) {
    console.log('[Notifications] Not a physical device — skipping push token registration');
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

  await ensureAndroidChannel();

  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;

  if (!projectId) {
    console.log('[Notifications] No EXPO_PUBLIC_PROJECT_ID set — skipping token registration');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log('[Notifications] Push token obtained:', token);
    return token;
  } catch (e: any) {
    console.log(
      '[Notifications] Failed to fetch Expo push token:',
      e?.message || e,
    );
    return null;
  }
}

interface EventSpec {
  event: ScheduledNotification['event'];
  triggerDate: Date;
  title: string;
  body: string;
}

/**
 * Compute the candidate events for a single race weekend.
 * Returns only events whose trigger time is still in the future.
 */
function computeRaceEvents(race: Race): EventSpec[] {
  const now = new Date();
  const events: EventSpec[] = [];

  // Sprint events — only on sprint weekends with a known sprint start time.
  if (race.hasSprint) {
    const sprintStart = buildUtcDate(race.sprintDate, race.sprintTime);

    if (sprintStart) {
      const sprintLock = new Date(
        sprintStart.getTime() - LOCK_REMINDER_MINUTES * 60 * 1000,
      );
      if (sprintLock > now) {
        events.push({
          event: 'sprint_lock',
          triggerDate: sprintLock,
          title: `${race.name} — Sprint Picks Lock in 2 Hours`,
          body: 'Sprint picks lock when the sprint starts. Finalise your grid now!',
        });
      }

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
  }

  // Main race events.
  const raceStart = buildUtcDate(race.raceDate, race.raceTime);

  if (raceStart) {
    const raceLock = new Date(
      raceStart.getTime() - LOCK_REMINDER_MINUTES * 60 * 1000,
    );
    if (raceLock > now) {
      events.push({
        event: 'race_lock',
        triggerDate: raceLock,
        title: `${race.name} — Picks Lock in 2 Hours`,
        body: 'Predictions lock when the race starts. Make sure your grid is set!',
      });
    }

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
    case 'sprint_lock':
    case 'race_lock':
      return settings.lockReminder;
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
  seriesId: NotificationSeriesId,
): Promise<ScheduledNotification | null> {
  const now = new Date();
  const secondsUntilTrigger = Math.max(
    1,
    Math.floor((spec.triggerDate.getTime() - now.getTime()) / 1000),
  );

  try {
    const channelId = await ensureAndroidChannel();

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
        channelId,
      },
    });

    console.log(
      '[Notifications] Scheduled', spec.event, 'for', race.name,
      'at', spec.triggerDate.toISOString(), '(in', secondsUntilTrigger, 's)',
    );

    return {
      notificationId,
      raceId: race.id,
      seriesId,
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
 * Schedule reminders for all upcoming sprint and race events of ONE series.
 * Respects the user's per-event notification settings. Cancels and
 * reschedules when trigger dates change. Removes stale entries — but only
 * entries belonging to this series, since both series' data providers are
 * mounted at the same time and manage their own notifications.
 *
 * Deliberately NOT filtered by race status: a race flips to 'completed'
 * a couple of hours after start while its race_end notification (start +
 * 2h) may still be pending. Time-based filtering in computeRaceEvents
 * already keeps only future triggers, which is the correct gate.
 */
export async function scheduleRaceReminders(
  races: Race[],
  settings: NotificationSettings,
  seriesId: NotificationSeriesId = 'f1',
): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping schedule');
    return;
  }

  const seriesRaces = races.filter(
    (r) => (r.seriesId ?? 'f1') === seriesId && r.status !== 'cancelled',
  );

  if (seriesRaces.length === 0) {
    console.log('[Notifications] No', seriesId, 'races to schedule reminders for');
    return;
  }

  const existing = await loadScheduled();
  // Entries belonging to other series are managed by their own provider.
  const otherSeries = existing.filter((e) => (e.seriesId ?? 'f1') !== seriesId);
  const thisSeries = existing.filter((e) => (e.seriesId ?? 'f1') === seriesId);

  // Key by raceId + event so each scheduled notification is tracked individually.
  const existingMap = new Map(
    thisSeries.map((e) => [`${e.raceId}:${e.event}`, e]),
  );
  const newScheduled: ScheduledNotification[] = [];
  const keepKeys = new Set<string>();

  for (const race of seriesRaces) {
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

      const scheduled = await scheduleEvent(race, spec, seriesId);
      if (scheduled) {
        newScheduled.push(scheduled);
        keepKeys.add(key);
      }
    }
  }

  // Cancel any of THIS series' notifications that are no longer relevant
  // (trigger passed / disabled / changed).
  for (const entry of thisSeries) {
    const key = `${entry.raceId}:${entry.event}`;
    if (!keepKeys.has(key)) {
      await Notifications.cancelScheduledNotificationAsync(entry.notificationId);
      console.log('[Notifications] Cancelled orphan reminder:', key);
    }
  }

  await saveScheduled([...otherSeries, ...newScheduled]);
  console.log('[Notifications] Active', seriesId, 'reminders:', newScheduled.length);
}

/** Load the set of race IDs that already fired a results notification. */
async function loadNotifiedResults(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_RESULTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Fire an immediate local notification when fresh race results appear
 * ("Results Posted" setting). Best-effort: only fires while the app is
 * running, and only for races that ended within the last 6 hours. Each
 * race notifies at most once per device (tracked in AsyncStorage).
 */
export async function maybeNotifyResultsPosted(
  raceResults: RaceResult[],
  races: Race[],
  settings: NotificationSettings,
  seriesId: NotificationSeriesId = 'f1',
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!settings.resultsPosted) return;

  const now = Date.now();
  const notified = await loadNotifiedResults();
  const notifiedSet = new Set(notified);
  const freshIds: string[] = [];

  for (const result of raceResults) {
    if (!result.classification || result.classification.length === 0) continue;
    if (notifiedSet.has(result.raceId)) continue;

    const race = races.find(
      (r) => r.id === result.raceId && (r.seriesId ?? 'f1') === seriesId,
    );
    if (!race) continue;

    const raceStart = buildUtcDate(race.raceDate, race.raceTime);
    if (!raceStart) continue;

    const raceEnd = raceStart.getTime() + RACE_DURATION_MINUTES * 60 * 1000;
    const age = now - raceEnd;

    // Too early (race still running) or too old (stale historical result).
    if (age < 0 || age > RESULTS_FRESH_WINDOW_MS) continue;

    freshIds.push(result.raceId);
    notifiedSet.add(result.raceId);

    try {
      const channelId = await ensureAndroidChannel();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${race.name} — Results Posted`,
          body: 'Final classification is in — tap to see how your picks scored.',
          data: {
            raceId: race.id,
            event: 'results_posted',
            screen: 'race-results',
          },
          sound: Platform.OS === 'ios' ? 'default' : undefined,
        },
        trigger: null,
      });

      console.log('[Notifications] Results posted notification sent for', race.name);
    } catch (e) {
      console.log('[Notifications] Failed to notify results for', race.name, ':', e);
    }
  }

  if (freshIds.length > 0) {
    try {
      const next = [...notified, ...freshIds].slice(-200);
      await AsyncStorage.setItem(NOTIFIED_RESULTS_KEY, JSON.stringify(next));
    } catch (e) {
      console.log('[Notifications] Failed to persist notified results:', e);
    }
  }
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
