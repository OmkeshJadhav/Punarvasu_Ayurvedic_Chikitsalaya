/**
 * Service-role Supabase client.
 *
 * Bypasses Row Level Security completely. It exists for the few operations
 * that cannot be expressed as an authenticated user's action - scheduled jobs,
 * webhook handlers, administrative maintenance (`docs/DATABASE.md` section
 * 6.4).
 *
 * Rules, not preferences:
 *   1. Server-only. `import "server-only"` makes a client import a build error.
 *   2. Every call site performs its own authorization check first. This client
 *      has no user and therefore no permissions to check.
 *   3. Reaching for it because a policy is inconvenient is a defect. Fix the
 *      policy.
 *   4. Its use is audited.
 *
 * Session persistence is disabled: this client must never adopt, refresh or
 * write a user session.
 */
import { createClient } from "@supabase/supabase-js";
import "server-only";

import { getSupabasePublicConfig } from "@/config/env.public";
import { requireSupabaseServiceRoleKey } from "@/config/env.server";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  const { supabaseUrl } = getSupabasePublicConfig();

  return createClient<Database>(supabaseUrl, requireSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
