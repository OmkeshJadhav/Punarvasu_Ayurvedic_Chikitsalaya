/**
 * Browser Supabase client.
 *
 * Runs with the anonymous key and the signed-in user's session, so every query
 * it makes is subject to Row Level Security. It is safe in the browser only
 * because RLS is enabled and deny-by-default on every table holding user or
 * clinical data (`docs/DATABASE.md` section 6).
 *
 * Use it only for work that genuinely belongs in the browser. Anything that
 * decides access, or reads data the user should not be able to enumerate,
 * belongs on the server.
 */
import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/config/env.public";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  const env = getSupabasePublicConfig();
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
