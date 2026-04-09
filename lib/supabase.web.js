import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const isSSR = typeof window === 'undefined';

const WebStorage = {
  getItem: (key) => {
    if (isSSR) return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (isSSR) return;
    window.localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (isSSR) return;
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: WebStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});