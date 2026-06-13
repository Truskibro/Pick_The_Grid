import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('placeholder'));

let _supabaseReachable: boolean | null = null;
let _supabaseReachableAt: number = 0;
const REACHABILITY_TTL_MS = 30_000;

export async function checkSupabaseReachable(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const now = Date.now();
  if (_supabaseReachable !== null && (now - _supabaseReachableAt) < REACHABILITY_TTL_MS) {
    return _supabaseReachable;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { 'apikey': supabaseAnonKey },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    _supabaseReachable = res.ok;
    _supabaseReachableAt = now;
    console.log('[Supabase] Reachability check:', _supabaseReachable ? 'OK' : 'NOT OK (' + res.status + ')');
    return _supabaseReachable;
  } catch (e: any) {
    console.log('[Supabase] Reachability check failed:', e?.message || e);
    _supabaseReachable = false;
    _supabaseReachableAt = now;
    return false;
  }
}

export function resetReachabilityCache() {
  _supabaseReachable = null;
  _supabaseReachableAt = 0;
}

if (!isSupabaseConfigured) {
  console.log('[Supabase] Not configured - URL or key missing. App will use local/fallback data.');
}

const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null || value === undefined) return null;
      return value;
    } catch (e) {
      console.log('[Supabase Storage] getItem error for key:', key, e);
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
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: safeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
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


