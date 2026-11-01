import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let supabaseClient = null;

export function getSupabase() {
  if (!env.supabase.isConfigured) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseClient;
}
