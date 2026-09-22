/**
 * Server Supabase client, bound to the request's cookies.
 *
 * This is the default client for server components, server actions and route
 * handlers. It acts as the signed-in user, so RLS still applies - which is
 * what makes it the right tool: server-side authorization checks and database
 * policies both hold.
 *
 * A new client is created per request. Caching one across requests would leak
 * one user's session into another's.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import "server-only";

import { getSupabasePublicConfig } from "@/config/env.public";
import {
  hardenCookieOptions,
  isDevelopmentRuntime,
} from "@/lib/security/cookies";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getSupabasePublicConfig();
  const isDevelopment = isDevelopmentRuntime();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            // Phase 19. The same hardening the proxy applies, applied here too
            // — this is the path a *sign-in* takes, so a cookie written here
            // without `HttpOnly` would be readable by script for the whole of
            // the session it just created. Both writers must agree, or the
            // attribute depends on which one happened to run last.
            cookieStore.set(
              name,
              value,
              hardenCookieOptions(options, isDevelopment),
            );
          }
        } catch {
          // Server components cannot write cookies. Session refresh happens in
          // middleware, which is added with authentication; until then there is
          // no session to refresh and nothing is lost by ignoring this.
        }
      },
    },
  });
}
