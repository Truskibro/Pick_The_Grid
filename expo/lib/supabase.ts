import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('placeholder'));

let _supabaseReachable: boolean | null = null;

export async function checkSupabaseReachable(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (_supabaseReachable !== null) return _supabaseReachable;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { 'apikey': supabaseAnonKey },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    _supabaseReachable = res.ok;
    console.log('[Supabase] Reachability check:', _supabaseReachable ? 'OK' : 'NOT OK (' + res.status + ')');
    return _supabaseReachable;
  } catch (e: any) {
    console.log('[Supabase] Reachability check failed:', e?.message || e);
    _supabaseReachable = false;
    return false;
  }
}

export function resetReachabilityCache() {
  _supabaseReachable = null;
}

if (!isSupabaseConfigured) {
  console.log('[Supabase] Not configured - URL or key missing. App will use local/fallback data.');
}

const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null || value === undefined) return null;
      if (typeof value !== 'string') {
        console.log('[Supabase Storage] Non-string value for key:', key, '- clearing');
        await AsyncStorage.removeItem(key);
        return null;
      }
      if (value.trim().startsWith('{') || value.trim().startsWith('[') || value.trim().startsWith('"')) {
        try {
          JSON.parse(value);
        } catch {
          console.log('[Supabase Storage] Corrupted JSON for key:', key, '- clearing');
          await AsyncStorage.removeItem(key);
          return null;
        }
      }
      return value;
    } catch (e) {
      console.log('[Supabase Storage] getItem error for key:', key, e);
      try { await AsyncStorage.removeItem(key); } catch {}
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.log('[Supabase Storage] setItem error for key:', key, e);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.log('[Supabase Storage] removeItem error for key:', key, e);
    }
  },
};

function createSupabaseClient(): SupabaseClient {
  if (isSupabaseConfigured) {
    console.log('[Supabase] Initializing client with URL:', supabaseUrl.substring(0, 40) + '...');
    const safeFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const mergedInit = {
          ...init,
          signal: init?.signal || controller.signal,
        };
        const res = await fetch(url, mergedInit);
        clearTimeout(timeoutId);
        return res;
      } catch (e: any) {
        console.log('[Supabase] Fetch failed for', typeof url === 'string' ? url.substring(0, 60) : 'request', ':', e?.message || e);
        return new Response(JSON.stringify({ error: 'Network request failed', message: e?.message || 'Failed to fetch' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    };
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: safeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      global: {
        fetch: safeFetch,
      },
    });
  }

  const dummyUrl = 'https://localhost.invalid';
  const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

  return createClient(dummyUrl, dummyKey, {
    auth: {
      storage: safeStorage,
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: async (_url: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(JSON.stringify({ data: null, error: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
}

export const supabase: SupabaseClient = createSupabaseClient();

/** Track whether races have been seeded to Supabase. */
let _racesSeeded = false;
let _seedingInProgress: Promise<void> | null = null;

export function areRacesSeeded(): boolean {
  return _racesSeeded;
}

/**
 * Seeds the races table in Supabase if it's empty. Called once on startup
 * when the user is authenticated. Uses the same race data as f1-data.ts.
 *
 * Handles two database schemas:
 *   1. Correct schema  — races.id is TEXT, seed 24 races directly.
 *   2. Legacy schema   — races.id is UUID, this will fail. The function
 *      detects the type mismatch and logs a clear message telling the
 *      developer to run `supabase-fix-predictions.sql`.
 */
export async function seedRacesToSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;

  // If already seeded successfully, skip.
  if (_racesSeeded) return;

  // If a previous seed attempt is still in flight, wait for it.
  if (_seedingInProgress) {
    await _seedingInProgress;
    return;
  }

  _seedingInProgress = (async () => {
    try {
      // Quick check — do we already have races?
      const { count, error: countErr } = await supabase
        .from('races')
        .select('*', { count: 'exact', head: true });

      if (countErr) {
        console.log('[seedRaces] Count check failed:', countErr.code, countErr.message);
        // Table might not exist or might have wrong schema.
        if (countErr.code === '42P01') {
          console.log('[seedRaces] Races table does not exist — run supabase-fix-predictions.sql in the Supabase SQL Editor.');
        }
        return;
      }

      if (count && count > 0) {
        console.log('[seedRaces] Races table already has', count, 'rows — skipping seed');
        _racesSeeded = true;
        return;
      }

      console.log('[seedRaces] Races table is empty — seeding 24 races...');

      const raceRows = [
        { id: 'r01', round: 1,  name: 'Australian Grand Prix',     location: 'Melbourne',      country: 'Australia', country_flag: '🇦🇺', race_date: '2026-03-08', race_time: '05:00', status: 'completed', has_sprint: false, total_laps: 58 },
        { id: 'r02', round: 2,  name: 'Chinese Grand Prix',        location: 'Shanghai',       country: 'China',     country_flag: '🇨🇳', race_date: '2026-03-15', race_time: '07:00', status: 'completed', has_sprint: true,  total_laps: 56 },
        { id: 'r03', round: 3,  name: 'Japanese Grand Prix',       location: 'Suzuka',         country: 'Japan',     country_flag: '🇯🇵', race_date: '2026-03-29', race_time: '06:00', status: 'completed', has_sprint: false, total_laps: 53 },
        { id: 'r04', round: 4,  name: 'Bahrain Grand Prix',         location: 'Sakhir',         country: 'Bahrain',   country_flag: '🇧🇭', race_date: '2026-04-12', race_time: '16:00', status: 'cancelled', has_sprint: false, total_laps: 57 },
        { id: 'r05', round: 5,  name: 'Saudi Arabian Grand Prix',   location: 'Jeddah',          country: 'Saudi Arabia', country_flag: '🇸🇦', race_date: '2026-04-19', race_time: '18:00', status: 'cancelled', has_sprint: false, total_laps: 50 },
        { id: 'r06', round: 6,  name: 'Miami Grand Prix',           location: 'Miami',          country: 'USA',       country_flag: '🇺🇸', race_date: '2026-05-03', race_time: '20:00', status: 'completed', has_sprint: true,  total_laps: 57 },
        { id: 'r07', round: 7,  name: 'Canadian Grand Prix',        location: 'Montreal',       country: 'Canada',    country_flag: '🇨🇦', race_date: '2026-05-24', race_time: '18:00', status: 'completed', has_sprint: true,  total_laps: 70 },
        { id: 'r08', round: 8,  name: 'Monaco Grand Prix',          location: 'Monte Carlo',    country: 'Monaco',    country_flag: '🇲🇨', race_date: '2026-06-07', race_time: '13:00', status: 'completed', has_sprint: false, total_laps: 78 },
        { id: 'r09', round: 9,  name: 'Spanish Grand Prix',         location: 'Barcelona',       country: 'Spain',     country_flag: '🇪🇸', race_date: '2026-06-14', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 66 },
        { id: 'r10', round: 10, name: 'Austrian Grand Prix',        location: 'Spielberg',      country: 'Austria',   country_flag: '🇦🇹', race_date: '2026-06-28', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
        { id: 'r11', round: 11, name: 'British Grand Prix',         location: 'Silverstone',    country: 'United Kingdom', country_flag: '🇬🇧', race_date: '2026-07-05', race_time: '14:00', status: 'upcoming',  has_sprint: true,  total_laps: 52 },
        { id: 'r12', round: 12, name: 'Belgian Grand Prix',         location: 'Spa-Francorchamps', country: 'Belgium', country_flag: '🇧🇪', race_date: '2026-07-19', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 44 },
        { id: 'r13', round: 13, name: 'Hungarian Grand Prix',       location: 'Budapest',       country: 'Hungary',   country_flag: '🇭🇺', race_date: '2026-07-26', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 70 },
        { id: 'r14', round: 14, name: 'Dutch Grand Prix',           location: 'Zandvoort',      country: 'Netherlands', country_flag: '🇳🇱', race_date: '2026-08-23', race_time: '13:00', status: 'upcoming',  has_sprint: true,  total_laps: 72 },
        { id: 'r15', round: 15, name: 'Italian Grand Prix',         location: 'Monza',          country: 'Italy',     country_flag: '🇮🇹', race_date: '2026-09-06', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 53 },
        { id: 'r16', round: 16, name: 'Madrid Grand Prix',          location: 'Madrid',         country: 'Spain',     country_flag: '🇪🇸', race_date: '2026-09-13', race_time: '13:00', status: 'upcoming',  has_sprint: false, total_laps: 55 },
        { id: 'r17', round: 17, name: 'Azerbaijan Grand Prix',      location: 'Baku',           country: 'Azerbaijan', country_flag: '🇦🇿', race_date: '2026-09-27', race_time: '12:00', status: 'upcoming',  has_sprint: false, total_laps: 51 },
        { id: 'r18', round: 18, name: 'Singapore Grand Prix',       location: 'Marina Bay',     country: 'Singapore', country_flag: '🇸🇬', race_date: '2026-10-11', race_time: '12:00', status: 'upcoming',  has_sprint: true,  total_laps: 62 },
        { id: 'r19', round: 19, name: 'United States Grand Prix',   location: 'Austin',         country: 'USA',       country_flag: '🇺🇸', race_date: '2026-10-25', race_time: '19:00', status: 'upcoming',  has_sprint: false, total_laps: 56 },
        { id: 'r20', round: 20, name: 'Mexico City Grand Prix',     location: 'Mexico City',    country: 'Mexico',    country_flag: '🇲🇽', race_date: '2026-11-01', race_time: '20:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
        { id: 'r21', round: 21, name: 'São Paulo Grand Prix',       location: 'Interlagos',     country: 'Brazil',    country_flag: '🇧🇷', race_date: '2026-11-08', race_time: '17:00', status: 'upcoming',  has_sprint: false, total_laps: 71 },
        { id: 'r22', round: 22, name: 'Las Vegas Grand Prix',       location: 'Las Vegas',      country: 'USA',       country_flag: '🇺🇸', race_date: '2026-11-21', race_time: '06:00', status: 'upcoming',  has_sprint: false, total_laps: 50 },
        { id: 'r23', round: 23, name: 'Qatar Grand Prix',           location: 'Lusail',         country: 'Qatar',     country_flag: '🇶🇦', race_date: '2026-11-29', race_time: '17:00', status: 'upcoming',  has_sprint: false, total_laps: 57 },
        { id: 'r24', round: 24, name: 'Abu Dhabi Grand Prix',       location: 'Yas Marina',     country: 'UAE',       country_flag: '🇦🇪', race_date: '2026-12-06', race_time: '14:00', status: 'upcoming',  has_sprint: false, total_laps: 58 },
      ];

      const { error: insertErr } = await supabase.from('races').upsert(raceRows, { onConflict: 'id' });

      if (insertErr) {
        // 22P02 = invalid input syntax for type uuid — the database has
        // the legacy schema where races.id is UUID instead of TEXT.
        if (insertErr.code === '22P02') {
          console.log(
            '[seedRaces] DATABASE SCHEMA MISMATCH: races.id is uuid but app sends text IDs.',
            'Run supabase-fix-predictions.sql in the Supabase SQL Editor to fix.',
            'Error:', insertErr.message
          );
        } else if (insertErr.code === '42501') {
          console.log(
            '[seedRaces] PERMISSION DENIED: missing INSERT policy on races table.',
            'Run supabase-fix-predictions.sql in the Supabase SQL Editor to add it.',
            'Error:', insertErr.message
          );
        } else {
          console.log('[seedRaces] Upsert failed:', insertErr.code, insertErr.message, insertErr.details ?? '');
        }
      } else {
        console.log('[seedRaces] Successfully seeded', raceRows.length, 'races into Supabase');
        _racesSeeded = true;
      }
    } catch (e: any) {
      console.log('[seedRaces] Exception:', e?.message || e);
    } finally {
      _seedingInProgress = null;
    }
  })();

  await _seedingInProgress;
}
