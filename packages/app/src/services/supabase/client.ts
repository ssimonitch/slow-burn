import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { resolveSupabaseEnv } from '@/lib/env';

import type { Database } from './types';

const globalClient = globalThis as typeof globalThis & {
  __supabaseClient?: SupabaseClient<Database>;
};

export function getSupabaseClient(): SupabaseClient<Database> {
  if (globalClient.__supabaseClient) {
    return globalClient.__supabaseClient;
  }

  const { url, anonKey } = resolveSupabaseEnv();

  globalClient.__supabaseClient = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return globalClient.__supabaseClient;
}
